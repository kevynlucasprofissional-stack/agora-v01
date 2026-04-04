/**
 * Ágora Multi-Agent Kernel — Run & Step lifecycle management.
 *
 * Provides granular per-step tracking for analysis runs.
 * Each step has its own start/complete/fail lifecycle with
 * independent timing, model, and token tracking.
 *
 * Usage:
 *   const run = await KernelRun.create(supabaseAdmin, analysisRequestId, "gemini-2.5-flash");
 *   const step = await run.startStep("intake");
 *   await step.complete({ output: data }, { model: "gemini-2.5-flash", tokensIn: 100, tokensOut: 200 });
 *   await run.finish("completed");
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// ── Step definitions ─────────────────────────────────────────

export type StepKind =
  | "intake"
  | "sociobehavioral"
  | "offer_analysis"
  | "performance_timing"
  | "synthesis"
  | "image_generation"
  | "post_processing";

export type AgentKind =
  | "master_orchestrator"
  | "sociobehavioral"
  | "offer_engineer"
  | "performance_scientist"
  | "chief_strategist";

export const PIPELINE_STEPS: ReadonlyArray<{
  kind: StepKind;
  order: number;
  agent: AgentKind;
  label: string;
}> = [
  { kind: "intake",              order: 0, agent: "master_orchestrator",    label: "Intake & Contexto" },
  { kind: "sociobehavioral",     order: 1, agent: "sociobehavioral",       label: "Análise Sociocomportamental" },
  { kind: "offer_analysis",      order: 2, agent: "offer_engineer",        label: "Engenharia de Oferta" },
  { kind: "performance_timing",  order: 3, agent: "performance_scientist", label: "Performance & Timing" },
  { kind: "synthesis",           order: 4, agent: "chief_strategist",      label: "Síntese Final" },
] as const;

// ── Step handle ──────────────────────────────────────────────

export interface StepMetrics {
  model?: string;
  tokensIn?: number;
  tokensOut?: number;
}

export class KernelStep {
  private startedAt: number;

  constructor(
    private db: SupabaseClient,
    public readonly stepId: string,
    public readonly kind: StepKind,
  ) {
    this.startedAt = Date.now();
  }

  /** Mark step completed with output and optional metrics */
  async complete(
    outputPayload: Record<string, unknown> | null,
    metrics?: StepMetrics,
  ): Promise<void> {
    const duration = Date.now() - this.startedAt;
    await this.db
      .from("run_steps")
      .update({
        status: "completed",
        output_payload: outputPayload || {},
        completed_at: new Date().toISOString(),
        duration_ms: duration,
        model_used: metrics?.model || null,
        tokens_input: metrics?.tokensIn || null,
        tokens_output: metrics?.tokensOut || null,
      })
      .eq("id", this.stepId);
  }

  /** Mark step failed with error message */
  async fail(errorMessage: string): Promise<void> {
    const duration = Date.now() - this.startedAt;
    await this.db
      .from("run_steps")
      .update({
        status: "failed",
        error_message: errorMessage,
        completed_at: new Date().toISOString(),
        duration_ms: duration,
      })
      .eq("id", this.stepId);
  }
}

// ── Run handle ───────────────────────────────────────────────

export class KernelRun {
  private startTime: number;
  private stepIds = new Map<StepKind, string>();

  private constructor(
    private db: SupabaseClient,
    public readonly runId: string,
    public readonly analysisRequestId: string,
  ) {
    this.startTime = Date.now();
  }

  /** Create a new run with all pipeline steps pre-registered as pending */
  static async create(
    db: SupabaseClient,
    analysisRequestId: string,
    modelPrimary: string,
    inputPayload?: Record<string, unknown>,
  ): Promise<KernelRun | null> {
    try {
      const { data: runData } = await db
        .from("analysis_runs")
        .insert({
          analysis_request_id: analysisRequestId,
          status: "running",
          model_primary: modelPrimary,
          started_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (!runData?.id) return null;

      const run = new KernelRun(db, runData.id, analysisRequestId);

      // Create all steps in pending state
      const steps = PIPELINE_STEPS.map((s) => ({
        run_id: runData.id,
        step_kind: s.kind,
        step_order: s.order,
        agent_kind: s.agent,
        status: "pending" as const,
        input_payload: s.order === 0 ? (inputPayload || {}) : {},
      }));

      const { data: stepRows } = await db
        .from("run_steps")
        .insert(steps)
        .select("id, step_kind");

      if (stepRows) {
        for (const row of stepRows) {
          run.stepIds.set(row.step_kind as StepKind, row.id);
        }
      }

      return run;
    } catch (e) {
      console.warn("KernelRun.create failed (non-fatal):", e);
      return null;
    }
  }

  /** Start a specific step — marks it as running and returns a handle */
  async startStep(kind: StepKind, inputPayload?: Record<string, unknown>): Promise<KernelStep | null> {
    const stepId = this.stepIds.get(kind);
    if (!stepId) return null;

    try {
      await this.db
        .from("run_steps")
        .update({
          status: "running",
          started_at: new Date().toISOString(),
          input_payload: inputPayload || {},
        })
        .eq("id", stepId);

      return new KernelStep(this.db, stepId, kind);
    } catch (e) {
      console.warn(`KernelRun.startStep(${kind}) failed:`, e);
      return null;
    }
  }

  /** Finish the entire run as completed or failed */
  async finish(
    status: "completed" | "failed",
    opts?: { modelUsed?: string; errorMessage?: string },
  ): Promise<void> {
    const duration = Date.now() - this.startTime;

    try {
      await this.db
        .from("analysis_runs")
        .update({
          status,
          completed_at: new Date().toISOString(),
          duration_ms: duration,
          model_fallback: opts?.modelUsed || null,
          error_message: opts?.errorMessage || null,
        })
        .eq("id", this.runId);

      // Mark any remaining pending steps as skipped (failed with skip reason)
      if (status === "failed") {
        await this.db
          .from("run_steps")
          .update({
            status: "failed",
            error_message: opts?.errorMessage || "Run failed",
            completed_at: new Date().toISOString(),
          })
          .eq("run_id", this.runId)
          .in("status", ["pending", "running"]);
      }
    } catch (e) {
      console.warn("KernelRun.finish failed (non-fatal):", e);
    }
  }
}

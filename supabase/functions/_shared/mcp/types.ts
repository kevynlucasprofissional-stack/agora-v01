/**
 * MCP-ready type contracts for Ágora's internal catalog.
 *
 * These types mirror MCP protocol concepts (Tool, Resource, Prompt)
 * but are used internally first. When we expose a real MCP server,
 * these contracts become the source of truth for schema generation.
 */

// ── Tool ─────────────────────────────────────────────────────

export interface ToolParameter {
  name: string;
  type: "string" | "number" | "boolean" | "object" | "array";
  description: string;
  required?: boolean;
}

export interface ToolDefinition {
  /** Unique identifier, e.g. "agora.analyze_campaign" */
  name: string;
  /** Human-readable description */
  description: string;
  /** Category for grouping */
  category: "analysis" | "creative" | "data" | "integration";
  /** Input parameters schema */
  inputSchema: ToolParameter[];
  /** Output type description */
  outputDescription: string;
  /** Whether this tool is currently available */
  enabled: boolean;
  /** The edge function that implements this tool */
  edgeFunctionName?: string;
}

// ── Resource ─────────────────────────────────────────────────

export type ResourceType =
  | "demographic"    // IBGE, census
  | "benchmark"      // industry benchmarks
  | "market"         // market data, trends
  | "enterprise"     // enterprise-specific context
  | "template";      // reusable templates

export interface ResourceDefinition {
  /** Unique URI, e.g. "agora://resources/ibge/{region}" */
  uri: string;
  /** Human-readable name */
  name: string;
  /** Description of what this resource provides */
  description: string;
  /** Resource type for categorization */
  type: ResourceType;
  /** MIME type of the content */
  mimeType: string;
  /** Whether this resource requires authentication */
  requiresAuth: boolean;
  /** Whether this is available in the current plan */
  planGate?: "freemium" | "standard" | "pro" | "enterprise";
}

// ── Prompt ───────────────────────────────────────────────────

export interface PromptArgument {
  name: string;
  description: string;
  required?: boolean;
}

export interface PromptDefinition {
  /** Unique identifier, e.g. "agora.prompts.socio_analyst" */
  name: string;
  /** Human-readable description */
  description: string;
  /** Version string for tracking prompt evolution */
  version: string;
  /** Arguments that can be injected into the prompt */
  arguments: PromptArgument[];
  /** The agent kind this prompt belongs to */
  agentKind?: string;
}

// ── Execution contracts ──────────────────────────────────────

export interface ToolExecutionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  category?: string;
  metadata?: {
    durationMs?: number;
    modelUsed?: string;
    tokensInput?: number;
    tokensOutput?: number;
  };
}

export interface ResourceFetchResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  source?: string;
  cachedAt?: string;
}

/**
 * Shared chat types, helpers and utilities for Ágora chat views.
 *
 * Used by: NewAnalysisPage, AnalysisChatPage, ReportChatBlock
 */

import { supabase } from "@/integrations/supabase/client";

// ── Types ────────────────────────────────────────────────────

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  image_url?: string | null;
  expires_at?: string | null;
}

// ── Persistence helpers ──────────────────────────────────────

export async function saveMessage(
  conversationId: string,
  role: string,
  content: string,
  imageUrl?: string | null,
  expiresAt?: string | null,
) {
  await supabase.from("chat_messages").insert({
    conversation_id: conversationId,
    role,
    content,
    image_url: imageUrl || null,
    expires_at: expiresAt || null,
  } as any);
}

// ── Content helpers ──────────────────────────────────────────

/** Check if an image's signed URL has expired */
export function isImageExpired(expiresAt: string | null | undefined): boolean {
  if (!expiresAt) return false;
  return new Date(expiresAt) < new Date();
}

/** Extract creative_job_id from message content markers */
export function extractCreativeJobId(content: string): string | null {
  const match = content.match(/\[creative_job_id:([^\]]+)\]/);
  return match ? match[1] : null;
}

/** Remove internal markers from message content for display */
export function cleanMessageContent(content: string): string {
  return content
    .replace("##READY##", "")
    .replace(/\n?\n?\[creative_job_id:[^\]]+\]/g, "")
    .trim();
}

// ── Scroll helpers ───────────────────────────────────────────

/**
 * Check if a scroll container is near the bottom.
 * Used to decide whether to auto-scroll on new messages.
 */
export function isNearBottom(el: HTMLElement, threshold = 100): boolean {
  return el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
}

/** Scroll to bottom of a container using requestAnimationFrame */
export function scrollToBottom(el: HTMLElement | null) {
  if (!el) return;
  requestAnimationFrame(() => {
    el.scrollTop = el.scrollHeight;
  });
}

// ── Textarea auto-resize ─────────────────────────────────────

export function autoResizeTextarea(el: HTMLTextAreaElement, maxHeight = 160) {
  el.style.height = "auto";
  el.style.height = Math.min(el.scrollHeight, maxHeight) + "px";
}

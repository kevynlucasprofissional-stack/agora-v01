/**
 * ChatMessageBubble — unified message rendering for all Ágora chat views.
 *
 * Handles: markdown rendering, context cards, inline images, expired images,
 * creative job links, and streaming indicators.
 */

import { motion } from "framer-motion";
import { Loader2, ExternalLink, ImageIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { TypewriterMarkdown } from "@/components/TypewriterMarkdown";
import { parseContextCards } from "@/lib/parseContextCards";
import { ContextCards } from "@/components/ContextCards";
import {
  type ChatMessage,
  isImageExpired,
  extractCreativeJobId,
  cleanMessageContent,
} from "@/lib/chatHelpers";

interface ChatMessageBubbleProps {
  message: ChatMessage;
  index: number;
  isLastAssistant: boolean;
  isStreaming: boolean;
  isBusy?: boolean;
  onContextCardSelect?: (text: string) => void;
  /** Optional link params for creative studio */
  studioLinkParams?: string;
  /** Variant for styling differences */
  variant?: "default" | "compact";
}

export function ChatMessageBubble({
  message,
  index,
  isLastAssistant,
  isStreaming,
  isBusy = false,
  onContextCardSelect,
  studioLinkParams = "",
  variant = "default",
}: ChatMessageBubbleProps) {
  const isUser = message.role === "user";
  const hasImage = !!message.image_url;
  const expired = hasImage && isImageExpired(message.expires_at);
  const rawContent = cleanMessageContent(message.content);
  const parsed = !isUser ? parseContextCards(rawContent) : null;
  const displayContent = parsed ? parsed.textWithoutCards : rawContent;
  const creativeJobId = !isUser ? extractCreativeJobId(message.content) : null;

  const isCompact = variant === "compact";
  const maxWidth = isCompact ? "max-w-[85%]" : "max-w-[85%]";
  const bubblePadding = isCompact ? "px-3.5 py-2.5" : "px-4 py-3";

  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex ${isUser ? "justify-end" : "justify-start"}`}
    >
      <div
        className={`${maxWidth} rounded-2xl ${bubblePadding} text-sm leading-relaxed ${
          isUser
            ? "bg-primary text-primary-foreground"
            : isCompact
              ? "bg-accent/50 border border-border/50"
              : "bg-card border border-border/40"
        }`}
      >
        {isUser ? (
          <div className="whitespace-pre-wrap">{message.content}</div>
        ) : (
          <>
            <TypewriterMarkdown
              content={displayContent}
              isStreaming={isStreaming && isLastAssistant}
              className="prose prose-sm max-w-none prose-p:text-muted-foreground prose-strong:text-foreground prose-li:text-muted-foreground prose-headings:text-foreground"
            />

            {/* Context cards */}
            {parsed &&
              parsed.cards.length > 0 &&
              !isStreaming &&
              isLastAssistant &&
              onContextCardSelect && (
                <ContextCards
                  cards={parsed.cards}
                  onSelect={onContextCardSelect}
                  disabled={isBusy}
                />
              )}

            {/* Inline image */}
            {hasImage && !expired && (
              <div className="mt-3">
                <img
                  src={message.image_url!}
                  alt="Criativo gerado"
                  className={`w-full rounded-lg border border-border/50 ${
                    isCompact ? "max-w-[280px]" : "max-w-[320px]"
                  }`}
                />
                {creativeJobId && (
                  <div className="mt-2 flex justify-center">
                    <Button variant="outline" size="sm" asChild>
                      <Link
                        to={`/app/creative-studio/${creativeJobId}${studioLinkParams ? `?${studioLinkParams}` : ""}`}
                      >
                        Abrir no Estúdio Criativo{" "}
                        <ExternalLink className="h-3.5 w-3.5 ml-1.5" />
                      </Link>
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Expired image */}
            {hasImage && expired && (
              <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50 border border-border/50 text-muted-foreground text-xs">
                <ImageIcon className="h-4 w-4 shrink-0" />
                <span>Imagem expirada</span>
              </div>
            )}
          </>
        )}
      </div>
    </motion.div>
  );
}

/** Loading bubble shown while waiting for assistant response */
export function ChatLoadingBubble({ variant = "default" }: { variant?: "default" | "compact" }) {
  return (
    <div className="flex justify-start">
      <div
        className={`rounded-2xl px-4 py-3 ${
          variant === "compact"
            ? "bg-accent/50 border border-border/50"
            : "bg-card border border-border/40"
        }`}
      >
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    </div>
  );
}

import { useState } from "react";
import { Copy, ThumbsUp, ThumbsDown, Share2, Check } from "lucide-react";
import { toast } from "sonner";

interface ChatMessageActionsProps {
  content: string;
  messageIndex: number;
  role: "user" | "assistant";
  onFeedback?: (index: number, type: "like" | "dislike") => void;
  feedback?: "like" | "dislike" | null;
}

export function ChatMessageActions({ content, messageIndex, role, onFeedback, feedback }: ChatMessageActionsProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Erro ao copiar.");
    }
  };

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (navigator.share) {
      try {
        await navigator.share({ text: content });
      } catch { /* cancelled */ }
    } else {
      await navigator.clipboard.writeText(content);
      toast.success("Conteúdo copiado para compartilhar!");
    }
  };

  return (
    <div className="flex items-center gap-0.5 opacity-0 group-hover/msg:opacity-100 transition-opacity">
      <button
        onClick={handleCopy}
        className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
        title="Copiar"
      >
        {copied ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />}
      </button>

      {role === "assistant" && (
        <>
          <button
            onClick={(e) => { e.stopPropagation(); onFeedback?.(messageIndex, "like"); }}
            className={`p-1 rounded transition-colors ${
              feedback === "like"
                ? "text-success bg-success/10"
                : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
            }`}
            title="Boa resposta"
          >
            <ThumbsUp className="h-3 w-3" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onFeedback?.(messageIndex, "dislike"); }}
            className={`p-1 rounded transition-colors ${
              feedback === "dislike"
                ? "text-destructive bg-destructive/10"
                : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
            }`}
            title="Resposta ruim"
          >
            <ThumbsDown className="h-3 w-3" />
          </button>
        </>
      )}

      <button
        onClick={handleShare}
        className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
        title="Compartilhar"
      >
        <Share2 className="h-3 w-3" />
      </button>
    </div>
  );
}

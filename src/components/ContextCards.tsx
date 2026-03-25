import { useState } from "react";
import { motion } from "framer-motion";
import { MessageSquare } from "lucide-react";
import type { ContextCardData } from "@/lib/parseContextCards";

interface ContextCardsProps {
  cards: ContextCardData[];
  onSelect: (text: string) => void;
  disabled?: boolean;
}

export function ContextCards({ cards, onSelect, disabled }: ContextCardsProps) {
  const [customInputIdx, setCustomInputIdx] = useState<number | null>(null);
  const [customText, setCustomText] = useState("");

  if (cards.length === 0) return null;

  return (
    <div className="space-y-3 mt-3">
      {cards.map((card, cardIdx) => (
        <motion.div
          key={cardIdx}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: cardIdx * 0.1 }}
          className="rounded-xl border border-border/60 bg-card/80 backdrop-blur-sm overflow-hidden"
        >
          {/* Question header */}
          <div className="px-4 py-3 border-b border-border/40 flex items-start gap-2">
            <MessageSquare className="h-4 w-4 text-primary mt-0.5 shrink-0" />
            <p className="text-sm font-medium text-foreground leading-snug">{card.question}</p>
          </div>

          {/* Options */}
          <div className="p-2 space-y-1">
            {card.options.map((option, optIdx) => (
              <button
                key={optIdx}
                onClick={() => !disabled && onSelect(option)}
                disabled={disabled}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left text-sm transition-colors hover:bg-accent/60 disabled:opacity-50 disabled:cursor-not-allowed group"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-xs font-semibold text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                  {optIdx + 1}
                </span>
                <span className="text-muted-foreground group-hover:text-foreground transition-colors">
                  {option}
                </span>
              </button>
            ))}

            {/* Custom option */}
            {customInputIdx === cardIdx ? (
              <div className="flex items-center gap-2 px-3 py-2">
                <input
                  autoFocus
                  value={customText}
                  onChange={(e) => setCustomText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && customText.trim()) {
                      onSelect(customText.trim());
                      setCustomText("");
                      setCustomInputIdx(null);
                    }
                    if (e.key === "Escape") {
                      setCustomInputIdx(null);
                      setCustomText("");
                    }
                  }}
                  placeholder="Digite sua resposta..."
                  className="flex-1 text-sm bg-transparent border-b border-border/60 outline-none text-foreground placeholder:text-muted-foreground/60 py-1"
                />
                <button
                  onClick={() => {
                    if (customText.trim()) {
                      onSelect(customText.trim());
                      setCustomText("");
                      setCustomInputIdx(null);
                    }
                  }}
                  disabled={!customText.trim()}
                  className="text-xs text-primary hover:text-primary/80 font-medium disabled:opacity-40"
                >
                  Enviar
                </button>
              </div>
            ) : (
              <button
                onClick={() => !disabled && setCustomInputIdx(cardIdx)}
                disabled={disabled}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left text-sm transition-colors hover:bg-accent/60 disabled:opacity-50 disabled:cursor-not-allowed group"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-border/60 text-xs text-muted-foreground group-hover:border-primary/40">
                  ✏️
                </span>
                <span className="text-muted-foreground/70 group-hover:text-foreground transition-colors italic">
                  Outra resposta...
                </span>
              </button>
            )}
          </div>
        </motion.div>
      ))}
    </div>
  );
}

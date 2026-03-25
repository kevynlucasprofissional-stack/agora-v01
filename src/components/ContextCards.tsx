import { useState } from "react";
import { motion } from "framer-motion";
import { MessageSquare, Send, PenLine } from "lucide-react";
import type { ContextCardData } from "@/lib/parseContextCards";

interface ContextCardsProps {
  cards: ContextCardData[];
  onSelect: (text: string) => void;
  disabled?: boolean;
}

export function ContextCards({ cards, onSelect, disabled }: ContextCardsProps) {
  const [customInputIdx, setCustomInputIdx] = useState<number | null>(null);
  const [customText, setCustomText] = useState("");
  const [textInputValues, setTextInputValues] = useState<Record<number, string>>({});

  if (cards.length === 0) return null;

  const submitCustom = () => {
    if (customText.trim()) {
      onSelect(customText.trim());
      setCustomText("");
      setCustomInputIdx(null);
    }
  };

  const submitTextInput = (cardIdx: number) => {
    const val = textInputValues[cardIdx]?.trim();
    if (val) {
      onSelect(val);
      setTextInputValues((prev) => ({ ...prev, [cardIdx]: "" }));
    }
  };

  return (
    <div className="space-y-3 mt-4">
      {cards.map((card, cardIdx) => {
        const isTextType = card.type === "text";

        return (
          <motion.div
            key={cardIdx}
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: cardIdx * 0.08, duration: 0.3 }}
            className="rounded-2xl border border-border/40 bg-gradient-to-b from-card/90 to-card/60 backdrop-blur-md shadow-sm overflow-hidden"
          >
            {/* Question header */}
            <div className="px-4 py-3.5 flex items-start gap-2.5">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-primary/10 mt-0.5">
                <MessageSquare className="h-3.5 w-3.5 text-primary" />
              </div>
              <p className="text-sm font-medium text-foreground leading-snug">{card.question}</p>
            </div>

            {/* Text input type */}
            {isTextType && (
              <div className="px-4 pb-4">
                <div className="flex items-center gap-2 rounded-xl border border-border/50 bg-background/50 px-3 py-2 focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/20 transition-all">
                  <input
                    autoFocus
                    value={textInputValues[cardIdx] || ""}
                    onChange={(e) =>
                      setTextInputValues((prev) => ({ ...prev, [cardIdx]: e.target.value }))
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter") submitTextInput(cardIdx);
                    }}
                    placeholder={card.placeholder || "Digite sua resposta..."}
                    disabled={disabled}
                    className="flex-1 text-sm bg-transparent outline-none text-foreground placeholder:text-muted-foreground/50"
                  />
                  <button
                    onClick={() => submitTextInput(cardIdx)}
                    disabled={disabled || !textInputValues[cardIdx]?.trim()}
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <Send className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* Choice options */}
            {!isTextType && card.options && (
              <div className="px-2 pb-2 space-y-0.5">
                {card.options.map((option, optIdx) => (
                  <button
                    key={optIdx}
                    onClick={() => !disabled && onSelect(option)}
                    disabled={disabled}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-sm transition-all hover:bg-primary/5 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed group"
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-muted/80 text-xs font-semibold text-muted-foreground group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                      {optIdx + 1}
                    </span>
                    <span className="text-muted-foreground group-hover:text-foreground transition-colors">
                      {option}
                    </span>
                  </button>
                ))}

                {/* Custom answer toggle */}
                {customInputIdx === cardIdx ? (
                  <div className="flex items-center gap-2 mx-3 my-2 rounded-xl border border-border/50 bg-background/50 px-3 py-2 focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/20 transition-all">
                    <input
                      autoFocus
                      value={customText}
                      onChange={(e) => setCustomText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") submitCustom();
                        if (e.key === "Escape") {
                          setCustomInputIdx(null);
                          setCustomText("");
                        }
                      }}
                      placeholder="Escreva sua resposta..."
                      className="flex-1 text-sm bg-transparent outline-none text-foreground placeholder:text-muted-foreground/50"
                    />
                    <button
                      onClick={submitCustom}
                      disabled={!customText.trim()}
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      <Send className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => !disabled && setCustomInputIdx(cardIdx)}
                    disabled={disabled}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-sm transition-all hover:bg-muted/40 disabled:opacity-50 disabled:cursor-not-allowed group"
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-dashed border-border/60 text-muted-foreground/60 group-hover:border-primary/40 group-hover:text-primary/60 transition-colors">
                      <PenLine className="h-3 w-3" />
                    </span>
                    <span className="text-muted-foreground/60 group-hover:text-muted-foreground transition-colors italic text-xs">
                      Outra resposta...
                    </span>
                  </button>
                )}
              </div>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}

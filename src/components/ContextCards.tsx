import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, Send, PenLine, ChevronRight, Check } from "lucide-react";
import type { ContextCardData } from "@/lib/parseContextCards";

interface ContextCardsProps {
  cards: ContextCardData[];
  onSelect: (text: string) => void;
  disabled?: boolean;
}

export function ContextCards({ cards, onSelect, disabled }: ContextCardsProps) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [customInputIdx, setCustomInputIdx] = useState<number | null>(null);
  const [customText, setCustomText] = useState("");
  const [textInputValue, setTextInputValue] = useState("");
  const [submitted, setSubmitted] = useState(false);

  if (cards.length === 0 || submitted) return null;

  const card = cards[currentIdx];
  const isLast = currentIdx === cards.length - 1;
  const answeredCount = Object.keys(answers).length;
  const isTextType = card?.type === "text";

  const selectAnswer = useCallback((answer: string) => {
    const newAnswers = { ...answers, [currentIdx]: answer };
    setAnswers(newAnswers);
    setCustomInputIdx(null);
    setCustomText("");
    setTextInputValue("");

    if (isLast) {
      // All answered — build combined message and send
      const parts = cards.map((c, i) => {
        const a = i === currentIdx ? answer : newAnswers[i];
        return `**${c.question}**\n${a}`;
      });
      const combined = parts.join("\n\n");
      setSubmitted(true);
      onSelect(combined);
    } else {
      setCurrentIdx((prev) => prev + 1);
    }
  }, [answers, currentIdx, isLast, cards, onSelect]);

  const submitCustom = () => {
    if (customText.trim()) {
      selectAnswer(customText.trim());
    }
  };

  const submitTextInput = () => {
    if (textInputValue.trim()) {
      selectAnswer(textInputValue.trim());
    }
  };

  return (
    <div className="mt-4 space-y-2">
      {/* Progress indicator */}
      {cards.length > 1 && (
        <div className="flex items-center gap-2 px-1">
          <div className="flex gap-1">
            {cards.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i < currentIdx
                    ? "w-6 bg-primary"
                    : i === currentIdx
                    ? "w-6 bg-primary/60"
                    : "w-3 bg-muted/60"
                }`}
              />
            ))}
          </div>
          <span className="text-[11px] text-muted-foreground/60 ml-auto">
            {answeredCount}/{cards.length}
          </span>
        </div>
      )}

      <AnimatePresence mode="wait">
        <motion.div
          key={currentIdx}
          initial={{ opacity: 0, y: 12, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.98 }}
          transition={{ duration: 0.25 }}
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
                  value={textInputValue}
                  onChange={(e) => setTextInputValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") submitTextInput();
                  }}
                  placeholder={card.placeholder || "Digite sua resposta..."}
                  disabled={disabled}
                  className="flex-1 text-sm bg-transparent outline-none text-foreground placeholder:text-muted-foreground/50"
                />
                <button
                  onClick={submitTextInput}
                  disabled={disabled || !textInputValue.trim()}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  {isLast ? <Check className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
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
                  onClick={() => !disabled && selectAnswer(option)}
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
              {customInputIdx === currentIdx ? (
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
                    {isLast ? <Check className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => !disabled && setCustomInputIdx(currentIdx)}
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
      </AnimatePresence>
    </div>
  );
}

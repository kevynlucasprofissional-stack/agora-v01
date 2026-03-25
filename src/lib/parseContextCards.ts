/**
 * Parses [CONTEXT_OPTIONS] blocks from AI responses.
 * Supports:
 *   - Multiple choice: {"question":"...","options":["...",".."]}
 *   - Text input:      {"question":"...","type":"text","placeholder":"..."}
 */

export interface ContextCardData {
  question: string;
  /** If present, show multiple-choice options */
  options?: string[];
  /** "choice" (default) or "text" for open-ended input */
  type?: "choice" | "text";
  /** Placeholder for text inputs */
  placeholder?: string;
}

export interface ParsedContent {
  textWithoutCards: string;
  cards: ContextCardData[];
}

const CARD_REGEX = /\[CONTEXT_OPTIONS\]([\s\S]*?)\[\/CONTEXT_OPTIONS\]/g;

export function parseContextCards(content: string): ParsedContent {
  const cards: ContextCardData[] = [];
  let textWithoutCards = content;

  const matches = [...content.matchAll(CARD_REGEX)];
  for (const match of matches) {
    try {
      const parsed = JSON.parse(match[1].trim());
      if (!parsed.question) continue;

      const cardType = parsed.type === "text" ? "text" : "choice";

      if (cardType === "text") {
        cards.push({
          question: parsed.question,
          type: "text",
          placeholder: parsed.placeholder || "Digite sua resposta...",
        });
      } else if (Array.isArray(parsed.options) && parsed.options.length > 0) {
        cards.push({
          question: parsed.question,
          options: parsed.options,
          type: "choice",
        });
      }
    } catch {
      // Not valid JSON, skip
    }
    textWithoutCards = textWithoutCards.replace(match[0], "");
  }

  return { textWithoutCards: textWithoutCards.trim(), cards };
}

export function hasContextCards(content: string): boolean {
  return CARD_REGEX.test(content);
}

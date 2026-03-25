/**
 * Parses [CONTEXT_OPTIONS] blocks from AI responses.
 * Format: [CONTEXT_OPTIONS]{"question":"...","options":["...","..."]}[/CONTEXT_OPTIONS]
 */

export interface ContextCardData {
  question: string;
  options: string[];
}

export interface ParsedContent {
  /** Text before/after context cards, with the card block removed */
  textWithoutCards: string;
  /** Parsed context cards (may be empty) */
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
      if (parsed.question && Array.isArray(parsed.options) && parsed.options.length > 0) {
        cards.push({ question: parsed.question, options: parsed.options });
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

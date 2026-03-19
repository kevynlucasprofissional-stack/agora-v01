import { forwardRef, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface TypewriterMarkdownProps {
  content: string;
  isStreaming?: boolean;
  speed?: number;
  className?: string;
}

export const TypewriterMarkdown = forwardRef<HTMLDivElement, TypewriterMarkdownProps>(function TypewriterMarkdown(
  {
    content,
    isStreaming = false,
    speed = 12,
    className = "",
  },
  ref
) {
  const [displayedLength, setDisplayedLength] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const prevContentRef = useRef("");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // If content changed substantially (new message loaded from DB), show instantly
    if (prevContentRef.current === "" && content.length > 50 && !isStreaming) {
      setDisplayedLength(content.length);
      setIsComplete(true);
      prevContentRef.current = content;
      return;
    }

    prevContentRef.current = content;

    if (displayedLength >= content.length) {
      if (!isStreaming) setIsComplete(true);
      return;
    }

    // Calculate how many chars to reveal per tick based on pending chars
    const pending = content.length - displayedLength;
    const charsPerTick = pending > 100 ? Math.ceil(pending / 20) : pending > 30 ? 3 : 1;

    intervalRef.current = setInterval(() => {
      setDisplayedLength((prev) => {
        const next = Math.min(prev + charsPerTick, content.length);
        if (next >= content.length && intervalRef.current) {
          clearInterval(intervalRef.current);
        }
        return next;
      });
    }, speed);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [content, displayedLength, isStreaming, speed]);

  const visibleText = isComplete ? content : content.slice(0, displayedLength);

  return (
    <div ref={ref} className={`${className} markdown-prose`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{visibleText}</ReactMarkdown>
      {!isComplete && displayedLength < content.length && (
        <span className="inline-block w-[2px] h-[1em] bg-primary animate-pulse ml-0.5 align-text-bottom" />
      )}
    </div>
  );
});

import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

interface WordFlipProps {
  words: string[];
  /** Milliseconds each word stays on screen. */
  interval?: number;
  className?: string;
  /** Tailwind classes applied to the moving word itself. */
  wordClassName?: string;
}

/**
 * Cycles a list of words through the same slot of text with a vertical
 * roll-and-blur transition. Falls back to a plain static word when the user
 * prefers reduced motion, and always exposes the full list to screen readers.
 */
export function WordFlip({ words, interval = 1900, className, wordClassName }: WordFlipProps) {
  const [index, setIndex] = useState<number>(0);
  const [previous, setPrevious] = useState<number | null>(null);
  const [reduced, setReduced] = useState<boolean>(false);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent): void => setReduced(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (reduced || words.length < 2) return;
    timer.current = window.setInterval(() => {
      setIndex((i) => {
        setPrevious(i);
        return (i + 1) % words.length;
      });
    }, interval);
    return () => {
      if (timer.current !== null) window.clearInterval(timer.current);
    };
  }, [interval, reduced, words.length]);

  const longest = words.reduce((a, b) => (b.length > a.length ? b : a), "");

  if (reduced) {
    return <span className={cn(className, wordClassName)}>{words[0]}</span>;
  }

  return (
    <span className={cn("word-flip", className)}>
      {/* Reserves the width of the longest word so the line never reflows. */}
      <span aria-hidden="true" className={cn("word-flip-sizer", wordClassName)}>
        {longest}
      </span>
      {previous !== null && (
        <span key={`out-${previous}`} aria-hidden="true" className={cn("word-flip-item word-flip-out", wordClassName)}>
          {words[previous]}
        </span>
      )}
      <span key={`in-${index}`} aria-hidden="true" className={cn("word-flip-item word-flip-in", wordClassName)}>
        {words[index]}
      </span>
      <span className="sr-only">{words.join(", ")}</span>
    </span>
  );
}

/**
 * A slow horizontal marquee of short promises. Duplicated inline so the loop
 * is seamless, and paused entirely under reduced-motion preferences.
 */
export function PromiseTicker({ items, className }: { items: string[]; className?: string }) {
  return (
    <div className={cn("ticker", className)} role="list" aria-label="What NeverNote promises">
      <div className="ticker-track">
        {[0, 1].map((copy) => (
          <div key={copy} className="ticker-group" aria-hidden={copy === 1 ? "true" : undefined}>
            {items.map((item) => (
              <span key={`${copy}-${item}`} role={copy === 0 ? "listitem" : undefined} className="ticker-item">
                <span className="ticker-dot" />
                {item}
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

import { useCallback, useEffect, useRef, type ClipboardEvent, type KeyboardEvent } from "react";

import { cn } from "@/lib/utils";

/**
 * Six separate digit boxes that behave like one field: typing advances,
 * backspace retreats, and pasting a full code fills everything at once.
 */
export function CodeInput({
  value,
  onChange,
  onComplete,
  disabled = false,
  autoFocus = true,
  invalid = false,
}: {
  value: string;
  onChange: (next: string) => void;
  onComplete?: (code: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
  invalid?: boolean;
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = value.padEnd(6, " ").slice(0, 6).split("");

  useEffect(() => {
    if (autoFocus) refs.current[0]?.focus();
  }, [autoFocus]);

  const setDigit = useCallback(
    (index: number, char: string) => {
      const next = value.padEnd(6, " ").split("");
      next[index] = char;
      const joined = next.join("").replace(/\s/g, "");
      onChange(joined);
      if (char && index < 5) refs.current[index + 1]?.focus();
      if (joined.length === 6 && onComplete) onComplete(joined);
    },
    [onChange, onComplete, value],
  );

  const onPaste = useCallback(
    (e: ClipboardEvent<HTMLInputElement>) => {
      e.preventDefault();
      const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
      if (!pasted) return;
      onChange(pasted);
      refs.current[Math.min(pasted.length, 5)]?.focus();
      if (pasted.length === 6 && onComplete) onComplete(pasted);
    },
    [onChange, onComplete],
  );

  const onKeyDown = useCallback(
    (index: number) => (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Backspace") {
        e.preventDefault();
        if (value[index]) {
          setDigit(index, "");
        } else if (index > 0) {
          const next = value.split("");
          next[index - 1] = "";
          onChange(next.join("").replace(/\s/g, ""));
          refs.current[index - 1]?.focus();
        }
      }
      if (e.key === "ArrowLeft" && index > 0) refs.current[index - 1]?.focus();
      if (e.key === "ArrowRight" && index < 5) refs.current[index + 1]?.focus();
    },
    [onChange, setDigit, value],
  );

  return (
    <div className="flex gap-2" role="group" aria-label="Six digit authentication code">
      {digits.map((digit, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          maxLength={1}
          disabled={disabled}
          aria-label={`Digit ${i + 1}`}
          value={digit.trim()}
          onChange={(e) => setDigit(i, e.target.value.replace(/\D/g, "").slice(-1))}
          onKeyDown={onKeyDown(i)}
          onPaste={onPaste}
          className={cn(
            "h-14 w-full min-w-0 rounded-xl border bg-background text-center font-display text-2xl tabular-nums shadow-sm outline-none transition-all",
            "focus:border-primary focus:ring-4 focus:ring-primary/15",
            invalid ? "border-clay/70 bg-clay-soft/40" : "border-input",
            disabled && "opacity-60",
          )}
        />
      ))}
    </div>
  );
}

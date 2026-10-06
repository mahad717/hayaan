"use client";

// Star display + rating input (Task 85). Fractional averages render via a
// clipped overlay row (a 4.3 average shows a 30%-clipped 5th star) instead of
// rounding to whole stars, so the PDP summary matches the number next to it.

import { useState } from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

const FILL = "fill-[#f9c27d] text-[#f9c27d]";
const EMPTY = "fill-[#e6e2d4] text-[#e6e2d4]";
const HOVER = "fill-[#f9c27d] text-[#f9a13d]";

function StarRow({ filled, size, color }: { filled: boolean; size: number; color: string }) {
  return (
    <span className="flex" aria-hidden>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          style={{ width: size, height: size }}
          className={cn("shrink-0", filled ? color : EMPTY)}
        />
      ))}
    </span>
  );
}

/** Read-only star display. `value` may be fractional (e.g. 4.3). */
export function Stars({
  value,
  size = 14,
  className,
  label,
}: {
  value: number;
  size?: number;
  className?: string;
  /** Accessible description; defaults to the numeric value. */
  label?: string;
}) {
  const pct = Math.max(0, Math.min(100, (value / 5) * 100));
  return (
    <span
      className={cn("relative inline-flex align-middle", className)}
      role="img"
      aria-label={label ?? `Rated ${value} out of 5`}
    >
      <StarRow filled={false} size={size} color={FILL} />
      <span className="absolute inset-y-0 left-0 overflow-hidden" style={{ width: `${pct}%` }}>
        <StarRow filled={true} size={size} color={FILL} />
      </span>
    </span>
  );
}

/** Interactive 1..5 picker for the write-a-review form. */
export function StarInput({
  value,
  onChange,
  size = 28,
  ariaLabelFor,
}: {
  value: number;
  onChange: (n: number) => void;
  size?: number;
  ariaLabelFor?: (n: number) => string;
}) {
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  return (
    <div className="flex items-center gap-0.5" role="radiogroup" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={ariaLabelFor ? ariaLabelFor(n) : `Rate ${n} out of 5`}
          className="rounded-sm p-0.5 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f28c28]"
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onChange(n)}
        >
          <Star
            style={{ width: size, height: size }}
            className={cn(
              "shrink-0 transition-colors",
              n <= shown ? (hover ? HOVER : FILL) : EMPTY,
            )}
          />
        </button>
      ))}
    </div>
  );
}

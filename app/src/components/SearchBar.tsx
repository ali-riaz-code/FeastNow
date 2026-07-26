import { useRef, useState } from "react";
import { m, AnimatePresence } from "motion/react";
import { easeExpo, springSoft } from "../lib/motion";

interface SearchBarProps {
  readOnly?: boolean;
  value?: string;
  onChange?: (value: string) => void;
  onTap?: () => void;
  autoFocus?: boolean;
  placeholder?: string;
}

export function SearchBar({ readOnly, value, onChange, onTap, autoFocus, placeholder }: SearchBarProps) {
  const text = placeholder ?? "Search restaurants, cuisines, dishes...";
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const hasValue = value !== undefined && value.length > 0;
  const active = !readOnly && (focused || hasValue);

  return (
    <div
      className={`search-bar${active ? " search-bar--active" : ""}`}
      onClick={readOnly ? onTap : undefined}
    >
      <m.svg
        viewBox="0 0 24 24" width="18" height="18" fill="none"
        stroke="currentColor" strokeWidth="2" aria-hidden="true"
        animate={active ? { scale: 1.12, rotate: [0, -3, 3, 0] } : { scale: 1, rotate: 0 }}
        transition={{ duration: active ? 0.45 : 0.25, ease: easeExpo }}
      >
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </m.svg>

      <input
        ref={inputRef}
        type="search"
        placeholder={text}
        readOnly={readOnly}
        value={value}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        autoFocus={autoFocus}
        aria-label={text}
      />

      <AnimatePresence>
        {hasValue && !readOnly && (
          <m.button
            type="button"
            className="search-bar__clear"
            aria-label="Clear search"
            key="clear"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={springSoft}
            onClick={() => { onChange?.(""); inputRef.current?.focus(); }}
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
              <path d="M6 6l12 12M18 6l-12 12" />
            </svg>
          </m.button>
        )}
      </AnimatePresence>
    </div>
  );
}

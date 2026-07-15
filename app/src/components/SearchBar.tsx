interface SearchBarProps {
  readOnly?: boolean;
  value?: string;
  onChange?: (value: string) => void;
  onTap?: () => void;
  autoFocus?: boolean;
}

export function SearchBar({ readOnly, value, onChange, onTap, autoFocus }: SearchBarProps) {
  return (
    <div className="search-bar" onClick={readOnly ? onTap : undefined}>
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
      </svg>
      <input
        type="search"
        placeholder="Search restaurants, cuisines, dishes..."
        readOnly={readOnly}
        value={value}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        autoFocus={autoFocus}
        aria-label="Search restaurants, cuisines, dishes"
      />
    </div>
  );
}

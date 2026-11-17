import { useRef } from "react";
import { Search, X } from "lucide-react";

/** Controlled search for the records visible in its receiving view. */
export function SearchField({
  label,
  placeholder,
  value,
  onChange,
  className = "",
}: {
  label: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <div
      className={`flex min-w-0 items-center gap-2 rounded border border-[var(--sot-shell-border)] bg-[var(--sot-shell-raised)] px-2.5 py-1.5 focus-within:ring-1 focus-within:ring-[var(--sot-shell-focus)] ${className}`}
    >
      <Search
        size={12}
        aria-hidden="true"
        className="shrink-0 text-[var(--sot-shell-muted)]"
      />
      <input
        ref={input}
        type="search"
        aria-label={label}
        placeholder={placeholder ?? label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-w-0 flex-1 bg-transparent text-[11px] text-[var(--sot-shell-text)] placeholder:text-[var(--sot-shell-muted)] outline-none [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button
          type="button"
          onClick={() => {
            onChange("");
            input.current?.focus();
          }}
          aria-label="Clear search"
          className="shrink-0 rounded p-0.5 text-[var(--sot-shell-secondary)]"
        >
          <X size={12} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

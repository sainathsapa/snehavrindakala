"use client";

/**
 * A searchable select — the single input used for country, state and city.
 *
 * Why not a native `<select>`: the country list is short, but states run to 36
 * and cities to dozens per state. A native select on a phone opens a full-screen
 * wheel the buyer must scroll and read; there is no way to type. This component
 * lets them type two letters and press Enter, on a keyboard *or* a phone.
 *
 * Accessibility is the WAI-ARIA 1.2 `combobox` + `listbox` pattern:
 *   - the input keeps focus at all times, the highlight travels via
 *     `aria-activedescendant` (the pattern screen readers expect for this)
 *   - `aria-expanded` / `aria-controls` describe the popup
 *   - ArrowUp/Down move, Home/End jump, Enter selects, Escape closes,
 *     Tab commits the highlighted option before leaving
 *   - the count of matching options is announced through a live region
 *
 * The popup is rendered *inside* the field wrapper (not in a portal), so it
 * inherits the form's stacking context and cannot escape the viewport: it is
 * capped at 20rem and scrolls internally.
 */

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { rankOptions } from "@/lib/location/search";

export interface ComboboxProps {
  /** Visible label. */
  label: string;
  /** Current text in the field. */
  value: string;
  /**
   * Called with the committed option. Typing raises `onInputChange`, not this,
   * so a parent can keep the field editable while distinguishing "chosen" from
   * "typed".
   */
  onValueChange: (value: string) => void;
  /**
   * Called on every keystroke, for parents that keep the raw text separate from
   * the chosen value (city, where free text is allowed).
   */
  onInputChange?: (text: string) => void;
  options: string[];
  placeholder?: string;
  /** Shown when `options` is empty and the buyer is allowed to type instead. */
  allowFreeText?: boolean;
  /** Message under the field, e.g. a validation error. */
  error?: string;
  hint?: string;
  disabled?: boolean;
  loading?: boolean;
  required?: boolean;
  /** `postal-code` style autocomplete token, passed through to the input. */
  autoComplete?: string;
  name?: string;
  /** Rendered inside the field, before the text (e.g. a dial code). */
  prefix?: string;
  inputMode?: "text" | "numeric" | "tel" | "search";
  /** Reported to the parent so it can react to the popup opening. */
  onOpenChange?: (open: boolean) => void;
  /** Announced when a search returns nothing, replacing the default copy. */
  emptyMessage?: string;
  className?: string;
  /** Setting this forces the list open — used by the "clear" affordance. */
  inputRef?: React.RefObject<HTMLInputElement | null>;
}

export function Combobox({
  label,
  value,
  onValueChange,
  onInputChange,
  options,
  placeholder,
  allowFreeText = false,
  error,
  hint,
  disabled = false,
  loading = false,
  required = false,
  autoComplete = "off",
  name,
  prefix,
  inputMode = "text",
  onOpenChange,
  emptyMessage,
  className = "",
  inputRef: externalRef,
}: ComboboxProps) {
  const baseId = useId();
  const listboxId = `${baseId}-listbox`;
  const inputId = `${baseId}-input`;
  const errorId = `${baseId}-error`;
  const hintId = `${baseId}-hint`;

  const internalRef = useRef<HTMLInputElement | null>(null);
  const inputRef = externalRef ?? internalRef;

  const [text, setText] = useState(value);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  /** True once the buyer has typed since the last selection. */
  const [dirty, setDirty] = useState(false);

  // Keep the field in step with an external change (a prefill, an address the
  // buyer picked from their address book, the postal-code suggestion).
  useEffect(() => {
    setText(value);
    setDirty(false);
  }, [value]);

  const matches = useMemo(() => {
    // While the field still reads as the selected value, show the whole list
    // rather than a single-item list filtered by its own text.
    if (!dirty) return options.slice(0, 200);
    return rankOptions(options, text, 200);
  }, [options, text, dirty]);

  const setOpenState = useCallback(
    (next: boolean) => {
      setOpen(next);
      onOpenChange?.(next);
    },
    [onOpenChange]
  );

  const commit = useCallback(
    (option: string) => {
      setText(option);
      setDirty(false);
      setActiveIndex(-1);
      setOpenState(false);
      onValueChange(option);
    },
    [onValueChange, setOpenState]
  );

  const handleChange = (next: string) => {
    setText(next);
    setDirty(true);
    setActiveIndex(0);
    setOpenState(true);
    // For free-text fields the parent tracks the raw text immediately; for
    // closed lists the value only changes when an option is committed.
    if (allowFreeText) onInputChange?.(next);
    else onInputChange?.(next);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;

    const last = matches.length - 1;

    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        if (!open) {
          setOpenState(true);
          setActiveIndex(0);
        } else {
          setActiveIndex((current) => (current >= last ? 0 : current + 1));
        }
        break;
      case "ArrowUp":
        event.preventDefault();
        if (!open) {
          setOpenState(true);
        }
        setActiveIndex((current) => (current <= 0 ? last : current - 1));
        break;
      case "Home":
        if (open) {
          event.preventDefault();
          setActiveIndex(0);
        }
        break;
      case "End":
        if (open) {
          event.preventDefault();
          setActiveIndex(last);
        }
        break;
      case "Enter": {
        if (!open) break;
        event.preventDefault();
        const option = matches[activeIndex];
        if (option) commit(option);
        break;
      }
      case "Escape":
        if (open) {
          event.preventDefault();
          setOpenState(false);
          setActiveIndex(-1);
          // Restore the committed value so Escape is a true cancel.
          setText(value);
          setDirty(false);
        }
        break;
      case "Tab": {
        // Commit what is highlighted so a keyboard user can Tab through the form
        // without losing their choice — the behaviour of every native select.
        if (open && matches[activeIndex]) {
          commit(matches[activeIndex]);
        } else if (open) {
          setOpenState(false);
        }
        break;
      }
      default:
        break;
    }
  };

  const activeOption = open ? matches[activeIndex] : undefined;
  const showEmpty = open && !loading && matches.length === 0 && text.trim().length > 0;
  const showNoList = open && !loading && options.length === 0;

  const describedBy = [error ? errorId : null, hint ? hintId : null]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={`relative ${className}`}>
      <label
        htmlFor={inputId}
        className="mb-1.5 block font-sans text-[13px] font-medium text-deep-ink"
      >
        {label}
        {!required && (
          <span className="ml-1 font-normal text-muted-ink">(optional)</span>
        )}
      </label>

      <div
        className={`flex items-center gap-1 rounded-md border bg-surface transition-colors focus-within:ring-2 ${
          error
            ? "border-sindoor focus-within:ring-sindoor/40"
            : "border-sand-border focus-within:border-sindoor/60 focus-within:ring-sindoor/25"
        } ${disabled ? "opacity-60" : ""}`}
      >
        {prefix ? (
          <span className="shrink-0 border-r border-sand-border/70 py-2.5 pl-3 pr-2 font-sans text-sm text-muted-ink">
            {prefix}
          </span>
        ) : null}

        <input
          ref={inputRef}
          id={inputId}
          name={name}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={
            activeOption ? `${baseId}-option-${activeIndex}` : undefined
          }
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy || undefined}
          autoComplete={autoComplete}
          inputMode={inputMode}
          autoCapitalize={inputMode === "text" ? "words" : "off"}
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="done"
          disabled={disabled}
          required={required}
          placeholder={placeholder}
          value={text}
          onChange={(event) => handleChange(event.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            setOpenState(true);
            // Re-opening with the current value selected: start the highlight at
            // the top so Enter keeps the current choice instead of clearing it.
            setActiveIndex(-1);
          }}
          onBlur={() => {
            // Let a click on an option land before closing. The delay is a
            // pointer-only concern; keyboard uses Tab, which commits above.
            window.setTimeout(() => {
              setOpenState(false);
              setActiveIndex(-1);
              if (allowFreeText) {
                // Keep whatever they typed; the parent validates it with the
                // same rules as a chosen option.
                onValueChange(text);
                return;
              }
              // A closed list must end on a real option: snap back to the last
              // committed value if the text is not one of them.
              if (text !== value) setText(value);
            }, 140);
          }}
          className="w-full rounded-md bg-transparent px-3 py-2.5 font-sans text-sm text-deep-ink placeholder:text-muted-ink/60 focus:outline-none"
        />

        {loading ? (
          <span
            aria-hidden="true"
            className="mr-3 h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-sand-border border-t-terracotta"
          />
        ) : (
          <button
            type="button"
            tabIndex={-1}
            aria-hidden="true"
            onClick={() => {
              if (disabled) return;
              inputRef.current?.focus();
              setOpenState(!open);
            }}
            className="mr-2 shrink-0 rounded p-1 text-muted-ink transition-colors hover:text-deep-ink"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path
                d="M6 9l6 6 6-6"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        )}
      </div>

      {error ? (
        <p id={errorId} role="alert" className="mt-1.5 font-sans text-xs text-sindoor">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="mt-1.5 font-sans text-xs text-muted-ink">
          {hint}
        </p>
      ) : null}

      {/* Always present so the result count is announced as it changes. */}
      <span className="sr-only" aria-live="polite" role="status">
        {open && !loading
          ? `${matches.length} ${matches.length === 1 ? "option" : "options"} available`
          : ""}
      </span>

      {open && (
        <ul
          id={listboxId}
          role="listbox"
          aria-label={label}
          className="absolute left-0 right-0 z-40 mt-1 max-h-64 overflow-y-auto overscroll-contain rounded-md border border-sand-border bg-surface py-1 shadow-lifted"
        >
          {loading && (
            <li className="px-3 py-2.5 font-sans text-sm text-muted-ink">
              Searching…
            </li>
          )}

          {showNoList && !loading && (
            <li className="px-3 py-2.5 font-sans text-sm text-muted-ink">
              {allowFreeText
                ? "No list for this destination — type it instead."
                : "No options available."}
            </li>
          )}

          {showEmpty && !loading && (
            <li className="px-3 py-2.5 font-sans text-sm text-muted-ink">
              {emptyMessage ??
                (allowFreeText
                  ? `No match for “${text}” — you can still use what you typed.`
                  : `No match for “${text}”.`)}
            </li>
          )}

          {!loading &&
            matches.map((option, index) => {
              const selected = option === value;
              const active = index === activeIndex;
              return (
                <li
                  key={option}
                  id={`${baseId}-option-${index}`}
                  role="option"
                  aria-selected={selected}
                  // `onMouseDown` fires before the input's blur, so the click is
                  // not lost to the 140ms close timer.
                  onMouseDown={(event) => {
                    event.preventDefault();
                    commit(option);
                  }}
                  onMouseEnter={() => setActiveIndex(index)}
                  className={`flex cursor-pointer items-center justify-between gap-3 px-3 py-2 font-sans text-sm ${
                    active ? "bg-rang-paper text-deep-ink" : "text-deep-ink/90"
                  }`}
                >
                  <span className="truncate">{option}</span>
                  {selected && (
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      aria-hidden="true"
                      className="shrink-0 text-terracotta"
                    >
                      <path
                        d="M5 13l4 4L19 7"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </li>
              );
            })}
        </ul>
      )}
    </div>
  );
}

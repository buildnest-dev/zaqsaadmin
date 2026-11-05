import { useRef, useState, type ReactNode } from "react";
import { uploadImage } from "../lib/upload";

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

export function Text({
  label,
  value,
  onChange,
  hint,
  disabled,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
  disabled?: boolean;
  placeholder?: string;
}) {
  return (
    <Field label={label} hint={hint}>
      <input
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </Field>
  );
}

export function Area({
  label,
  value,
  onChange,
  hint,
  rows = 3,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
  rows?: number;
}) {
  return (
    <Field label={label} hint={hint}>
      <textarea rows={rows} value={value} onChange={(event) => onChange(event.target.value)} />
    </Field>
  );
}

/** Editable list of short strings with add, remove and reorder. */
export function ListEditor({
  label,
  items,
  onChange,
  hint,
}: {
  label: string;
  items: string[];
  onChange: (items: string[]) => void;
  hint?: string;
}) {
  const set = (index: number, value: string) =>
    onChange(items.map((x, i) => (i === index ? value : x)));
  const move = (index: number, by: number) => {
    const next = [...items];
    const target = index + by;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target]!, next[index]!];
    onChange(next);
  };
  return (
    <div className="field">
      <span className="field-label">{label}</span>
      <div className="list">
        {items.map((item, index) => (
          <div className="list-row" key={index}>
            <input value={item} onChange={(event) => set(index, event.target.value)} />
            <button type="button" className="icon-btn" onClick={() => move(index, -1)} aria-label="Move up">
              ↑
            </button>
            <button type="button" className="icon-btn" onClick={() => move(index, 1)} aria-label="Move down">
              ↓
            </button>
            <button
              type="button"
              className="icon-btn danger"
              onClick={() => onChange(items.filter((_, i) => i !== index))}
              aria-label="Remove"
            >
              ✕
            </button>
          </div>
        ))}
        <button type="button" className="btn small ghost" onClick={() => onChange([...items, ""])}>
          + Add
        </button>
      </div>
      {hint && <span className="field-hint">{hint}</span>}
    </div>
  );
}

export function FaqEditor({
  faqs,
  onChange,
}: {
  faqs: { q: string; a: string }[];
  onChange: (faqs: { q: string; a: string }[]) => void;
}) {
  const set = (index: number, patch: Partial<{ q: string; a: string }>) =>
    onChange(faqs.map((f, i) => (i === index ? { ...f, ...patch } : f)));
  return (
    <div className="field">
      <span className="field-label">FAQs</span>
      <div className="list">
        {faqs.map((faq, index) => (
          <div className="faq-row" key={index}>
            <input
              placeholder="Question"
              value={faq.q}
              onChange={(event) => set(index, { q: event.target.value })}
            />
            <textarea
              placeholder="Answer"
              rows={2}
              value={faq.a}
              onChange={(event) => set(index, { a: event.target.value })}
            />
            <button
              type="button"
              className="icon-btn danger"
              onClick={() => onChange(faqs.filter((_, i) => i !== index))}
              aria-label="Remove FAQ"
            >
              ✕
            </button>
          </div>
        ))}
        <button
          type="button"
          className="btn small ghost"
          onClick={() => onChange([...faqs, { q: "", a: "" }])}
        >
          + Add FAQ
        </button>
      </div>
    </div>
  );
}

/** Picks a file, uploads it to Cloudinary and hands back the final https URL. */
export function ImageField({
  label,
  value,
  onChange,
  fallbackNote,
}: {
  label: string;
  value?: string | undefined;
  onChange: (url: string) => void;
  fallbackNote?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pick = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      onChange(await uploadImage(file));
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Upload failed.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };
  return (
    <div className="field">
      <span className="field-label">{label}</span>
      <div className="image-field">
        <div className="image-preview">
          {value ? <img src={value} alt="" /> : <span>No photo</span>}
        </div>
        <div className="image-actions">
          <input
            ref={input}
            type="file"
            accept="image/*"
            hidden
            onChange={(event) => pick(event.target.files?.[0])}
          />
          <button type="button" className="btn small" disabled={busy} onClick={() => input.current?.click()}>
            {busy ? "Uploading…" : value ? "Replace photo" : "Upload photo"}
          </button>
          {value && (
            <button type="button" className="btn small ghost" onClick={() => onChange("")}>
              Remove
            </button>
          )}
          {!value && fallbackNote && <span className="field-hint">{fallbackNote}</span>}
          {error && <span className="error">{error}</span>}
        </div>
      </div>
    </div>
  );
}

import { useState, type ReactNode } from "react";

/** A list on the left with reorder / add / delete, and the selected item's form on the right. */
export function MasterDetail<T>({
  items,
  idOf,
  labelOf,
  subOf,
  onChange,
  makeNew,
  noun,
  children,
  filter,
}: {
  items: T[];
  idOf: (item: T) => string;
  labelOf: (item: T) => string;
  subOf?: (item: T) => string;
  onChange: (items: T[]) => void;
  makeNew: () => T;
  noun: string;
  children: (item: T, patch: (next: T) => void) => ReactNode;
  filter?: ReactNode;
}) {
  const [selected, setSelected] = useState<string>(items[0] ? idOf(items[0]) : "");
  const [query, setQuery] = useState("");
  const index = items.findIndex((item) => idOf(item) === selected);
  const current = index >= 0 ? items[index] : undefined;

  const move = (by: number) => {
    const target = index + by;
    if (index < 0 || target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target]!, next[index]!];
    onChange(next);
  };
  const add = () => {
    const created = makeNew();
    onChange([...items, created]);
    setSelected(idOf(created));
    setQuery("");
  };
  const remove = () => {
    if (!current || !window.confirm(`Delete this ${noun}? You can restore it only by re-adding it.`)) return;
    const next = items.filter((_, i) => i !== index);
    onChange(next);
    setSelected(next[Math.max(0, index - 1)] ? idOf(next[Math.max(0, index - 1)]!) : "");
  };

  const shown = items.filter((item) =>
    `${labelOf(item)} ${subOf?.(item) ?? ""}`.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <div className="md">
      <div className="md-list card">
        <div className="md-tools">
          <input placeholder={`Search ${noun}s…`} value={query} onChange={(event) => setQuery(event.target.value)} />
          <button type="button" className="btn small primary" onClick={add}>
            + New {noun}
          </button>
        </div>
        {filter}
        <ul>
          {shown.map((item) => (
            <li key={idOf(item)}>
              <button
                type="button"
                className={idOf(item) === selected ? "md-item active" : "md-item"}
                onClick={() => setSelected(idOf(item))}
              >
                <strong>{labelOf(item) || `(untitled ${noun})`}</strong>
                {subOf && <small>{subOf(item)}</small>}
              </button>
            </li>
          ))}
          {shown.length === 0 && <li className="muted pad">Nothing matches.</li>}
        </ul>
      </div>
      <div className="md-form">
        {current ? (
          <div className="card form">
            <div className="md-actions">
              <button type="button" className="btn small ghost" onClick={() => move(-1)} disabled={index === 0}>
                ↑ Move up
              </button>
              <button
                type="button"
                className="btn small ghost"
                onClick={() => move(1)}
                disabled={index === items.length - 1}
              >
                ↓ Move down
              </button>
              <span className="grow" />
              <button type="button" className="btn small danger-btn" onClick={remove}>
                Delete {noun}
              </button>
            </div>
            {children(current, (next) => onChange(items.map((item, i) => (i === index ? next : item))))}
          </div>
        ) : (
          <div className="card muted">Pick a {noun} on the left, or add a new one.</div>
        )}
      </div>
    </div>
  );
}

export const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export function SaveBar({
  dirty,
  state,
  message,
  published,
  onSave,
  onReset,
}: {
  dirty: boolean;
  state: string;
  message: string;
  published: boolean;
  onSave: () => void;
  onReset?: () => void;
}) {
  return (
    <div className="savebar">
      <div className="savebar-status">
        {state === "error" && <span className="error">{message}</span>}
        {state === "saved" && !dirty && (
          <span className="ok">Published. The website updates within a minute.</span>
        )}
        {dirty && state !== "saving" && <span className="warn">Unpublished changes</span>}
        {!dirty && state === "ready" && !published && (
          <span className="muted">
            Showing the website's built-in content. Publish to start managing it here.
          </span>
        )}
      </div>
      {onReset && (
        <button type="button" className="btn ghost" onClick={onReset}>
          Reset to website defaults
        </button>
      )}
      <button
        type="button"
        className="btn primary"
        disabled={!dirty || state === "saving"}
        onClick={onSave}
      >
        {state === "saving" ? "Publishing…" : "Publish changes"}
      </button>
    </div>
  );
}

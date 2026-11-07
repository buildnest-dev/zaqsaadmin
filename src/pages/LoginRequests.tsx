import { useEffect, useState } from "react";
import { useRequests } from "../components/Requests";
import { CODE_TTL_MS, approve, deny, type LoginRequest } from "../lib/loginRequests";

const ago = (date: Date | null, now: number) => {
  if (!date) return "just now";
  const seconds = Math.max(0, Math.round((now - date.getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} min ago`;
  return date.toLocaleString();
};

const LABEL: Record<string, string> = {
  pending: "Waiting",
  approved: "Code given",
  denied: "Rejected",
  used: "Signed in",
  locked: "Locked (too many wrong codes)",
};

export function LoginRequestsPage() {
  const { requests, pending, error, loaded } = useRequests();
  const [codes, setCodes] = useState<Record<string, { code: string; until: number }>>({});
  const [busy, setBusy] = useState("");
  const [problem, setProblem] = useState("");
  const [now, setNow] = useState(Date.now());
  const [permission, setPermission] = useState(
    "Notification" in window ? Notification.permission : "denied",
  );

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const confirm = async (request: LoginRequest) => {
    setBusy(request.id);
    setProblem("");
    try {
      const code = await approve(request.id);
      setCodes((current) => ({ ...current, [request.id]: { code, until: Date.now() + CODE_TTL_MS } }));
    } catch (failure) {
      setProblem(failure instanceof Error ? failure.message : "Could not create the code.");
    } finally {
      setBusy("");
    }
  };
  const reject = async (request: LoginRequest) => {
    if (!window.confirm(`Reject ${request.email}?`)) return;
    setBusy(request.id);
    setProblem("");
    try {
      await deny(request.id);
    } catch (failure) {
      setProblem(failure instanceof Error ? failure.message : "Could not reject.");
    } finally {
      setBusy("");
    }
  };

  // Requests with a code on screen stay visible here until the code is used or expires.
  const showing = requests.filter(
    (r) =>
      pending.some((p) => p.id === r.id) ||
      codes[r.id] ||
      (r.status === "approved" && !!r.expiresAt && r.expiresAt.getTime() > now),
  );
  const history = requests.filter((r) => !showing.some((s) => s.id === r.id));

  return (
    <>
      <header className="page-head">
        <h1>Team sign-in requests</h1>
        <p className="muted">
          When someone tries to sign in at team.schools.zaqsa.com it shows up here. If you know them,
          confirm and read them the code over the phone. Keep this page open to be alerted.
        </p>
      </header>

      {error && <p className="error">{error}</p>}
      {problem && <p className="error">{problem}</p>}
      {permission === "default" && (
        <p className="card">
          <button
            className="btn small"
            onClick={() => Notification.requestPermission().then(setPermission)}
          >
            Allow desktop alerts
          </button>{" "}
          <span className="muted">Get a pop-up when a request arrives.</span>
        </p>
      )}

      <div className="list">
        {!loaded && <p className="muted">Loading…</p>}
        {loaded && showing.length === 0 && <p className="card muted">No one is waiting to sign in.</p>}
        {showing.map((request) => {
          const issued = codes[request.id];
          const left = issued ? Math.max(0, Math.round((issued.until - now) / 1000)) : 0;
          return (
            <div key={request.id} className="card request">
              <div className="request-head">
                <div>
                  <h3>{request.name || request.email}</h3>
                  <p className="muted">{request.email}</p>
                </div>
                <span className="badge">{ago(request.createdAt, now)}</span>
              </div>
              <p className="muted small-text">
                {request.device || "Unknown device"} · IP {request.ip || "unknown"}
                {request.remember ? " · asked to be remembered" : ""}
              </p>

              {issued && left > 0 ? (
                <div className="code-box">
                  <span className="muted">Tell this code to the person (valid {Math.ceil(left / 60)} min)</span>
                  <strong className="code">{issued.code.replace(/^(\d{3})(\d{3})$/, "$1 $2")}</strong>
                  <div className="request-actions">
                    <button className="btn small" onClick={() => navigator.clipboard.writeText(issued.code)}>
                      Copy
                    </button>
                    <button className="btn small ghost" disabled={busy === request.id} onClick={() => confirm(request)}>
                      New code
                    </button>
                  </div>
                </div>
              ) : (
                <div className="request-actions">
                  <button className="btn primary" disabled={busy === request.id} onClick={() => confirm(request)}>
                    {request.status === "approved" ? "Make a new code" : "Yes, this is our team member: make code"}
                  </button>
                  <button className="btn danger-btn" disabled={busy === request.id} onClick={() => reject(request)}>
                    No, reject
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {history.length > 0 && (
        <>
          <h2 className="section-title">Recent</h2>
          <div className="card">
            <ul className="plain">
              {history.slice(0, 15).map((request) => (
                <li key={request.id}>
                  <span>
                    <strong>{request.name || request.email}</strong>{" "}
                    <span className="muted">{request.email}</span>
                  </span>
                  <span className="muted">
                    {LABEL[request.status] ?? request.status} · {ago(request.createdAt, now)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </>
  );
}

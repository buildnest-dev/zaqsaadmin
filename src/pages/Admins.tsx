import { useEffect, useState } from "react";
import { auth, OWNER_EMAIL } from "../lib/firebase";
import { addAdmin, listAdmins, removeAdmin } from "../lib/store";

export function AdminsPage() {
  const [admins, setAdmins] = useState<string[]>([]);
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");

  const refresh = () =>
    listAdmins()
      .then(setAdmins)
      .catch((problem: Error) => setError(problem.message));
  useEffect(() => {
    void refresh();
  }, []);

  const add = async () => {
    const clean = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clean)) return setError("Enter a valid Gmail / Google account email.");
    setError("");
    try {
      await addAdmin(clean);
      setEmail("");
      await refresh();
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Could not add.");
    }
  };
  const remove = async (target: string) => {
    if (!window.confirm(`Remove ${target} as an admin?`)) return;
    await removeAdmin(target);
    await refresh();
  };

  return (
    <>
      <header className="page-head">
        <h1>Admins</h1>
        <p className="muted">
          Anyone listed here can sign in with that Google account and edit the whole website.
        </p>
      </header>
      <div className="card form">
        <ul className="plain">
          <li>
            <strong>{OWNER_EMAIL}</strong> <span className="badge">Owner</span>
          </li>
          {admins
            .filter((a) => a !== OWNER_EMAIL)
            .map((a) => (
              <li key={a}>
                <strong>{a}</strong>
                {a !== auth.currentUser?.email && (
                  <button className="btn small danger-btn" onClick={() => remove(a)}>
                    Remove
                  </button>
                )}
              </li>
            ))}
        </ul>
        <div className="list-row">
          <input
            placeholder="new.admin@gmail.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <button className="btn primary" onClick={add}>
            Add admin
          </button>
        </div>
        {error && <p className="error">{error}</p>}
      </div>
    </>
  );
}

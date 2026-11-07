import { useState, type FormEvent } from "react";
import { signIn, type Me } from "../lib/store";

/** Only a return path into our own team hand-off is followed after sign-in. */
export const safeNext = (value: string | null) => (value?.startsWith("/sso/team?") ? value : null);

export function SignInPage({ onDone }: { onDone: (me: Me) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    const me = await signIn(email, password, code).catch(() => null);
    setBusy(false);
    if (!me) {
      setCode("");
      return setError("Sign-in failed. Check your details and try again.");
    }
    onDone(me);
  };

  return (
    <div className="login">
      <form className="login-card" onSubmit={submit}>
        <img src="/icon.png" alt="" width={56} height={56} />
        <h1>ZAQSA Admin</h1>
        <p className="muted">Sign in with your work email, password and the 6-digit code from your authenticator app.</p>
        <input
          type="email"
          placeholder="Email"
          autoComplete="username"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
        <input
          inputMode="numeric"
          placeholder="6-digit code"
          autoComplete="one-time-code"
          maxLength={7}
          value={code}
          onChange={(event) => setCode(event.target.value)}
          required
        />
        <button className="btn primary" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
        {error && <p className="error">{error}</p>}
      </form>
    </div>
  );
}

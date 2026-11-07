import { useEffect, useState } from "react";
import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import { onAuthStateChanged, signInWithPopup, signOut, type User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db, googleProvider, OWNER_EMAIL } from "./lib/firebase";
import { Dashboard } from "./pages/Dashboard";
import { ServicesPage } from "./pages/Services";
import { CorePage } from "./pages/Core";
import { TeamPage } from "./pages/Team";
import { CompanyPage } from "./pages/Company";
import { HomePage } from "./pages/Home";
import { AdminsPage } from "./pages/Admins";

type Session =
  | { status: "loading" }
  | { status: "out" }
  | { status: "denied"; user: User }
  | { status: "in"; user: User };

async function isAdmin(user: User): Promise<boolean> {
  const email = (user.email ?? "").toLowerCase();
  if (!email || !user.emailVerified) return false;
  if (email === OWNER_EMAIL) return true;
  try {
    return (await getDoc(doc(db, "admins", email))).exists();
  } catch {
    return false;
  }
}

const NAV = [
  { to: "/", label: "Overview", end: true },
  { to: "/home", label: "Landing page" },
  { to: "/services", label: "Services" },
  { to: "/showcase", label: "Home showcase" },
  { to: "/team", label: "Team" },
  { to: "/company", label: "Company & contact" },
  { to: "/admins", label: "Admins" },
];

export function App() {
  const [session, setSession] = useState<Session>({ status: "loading" });
  const [error, setError] = useState("");

  useEffect(
    () =>
      onAuthStateChanged(auth, async (user) => {
        if (!user) return setSession({ status: "out" });
        setSession((await isAdmin(user)) ? { status: "in", user } : { status: "denied", user });
      }),
    [],
  );

  const signIn = async () => {
    setError("");
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Sign-in failed.");
    }
  };

  if (session.status === "loading") return <div className="center muted">Loading…</div>;

  if (session.status !== "in") {
    return (
      <div className="login">
        <div className="login-card">
          <img src="/icon.png" alt="" width={56} height={56} />
          <h1>ZAQSA Admin</h1>
          {session.status === "denied" ? (
            <>
              <p className="error">
                {session.user.email} is not an admin. Ask an existing admin to add this email.
              </p>
              <button className="btn" onClick={() => signOut(auth)}>
                Use another account
              </button>
            </>
          ) : (
            <>
              <p className="muted">Sign in with an approved Google account to manage the website.</p>
              <button className="btn primary" onClick={signIn}>
                Continue with Google
              </button>
              {error && <p className="error">{error}</p>}
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="shell">
      <aside className="side">
        <div className="brand">
          <img src="/icon.png" alt="" width={34} height={34} />
          <span>
            ZAQSA <small>Admin</small>
          </span>
        </div>
        <nav>
          {NAV.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end}>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="side-foot">
          <span className="muted">{session.user.email}</span>
          <button className="btn small ghost" onClick={() => signOut(auth)}>
            Sign out
          </button>
        </div>
      </aside>
      <main className="main">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/home" element={<HomePage />} />
          <Route path="/services" element={<ServicesPage />} />
          <Route path="/showcase" element={<CorePage />} />
          <Route path="/team" element={<TeamPage />} />
          <Route path="/company" element={<CompanyPage />} />
          <Route path="/admins" element={<AdminsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

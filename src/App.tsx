import { useEffect, useState } from "react";
import { NavLink, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { currentUser, signOut, type Me } from "./lib/store";
import { Dashboard } from "./pages/Dashboard";
import { ServicesPage } from "./pages/Services";
import { CorePage } from "./pages/Core";
import { TeamPage } from "./pages/Team";
import { CompanyPage } from "./pages/Company";
import { HomePage } from "./pages/Home";
import { SignInPage, safeNext } from "./pages/SignIn";

type Session = { status: "loading" } | { status: "out" } | { status: "in"; me: Me };

const NAV = [
  { to: "/", label: "Overview", end: true },
  { to: "/home", label: "Landing page" },
  { to: "/services", label: "Services" },
  { to: "/showcase", label: "Home showcase" },
  { to: "/team", label: "Team" },
  { to: "/company", label: "Company & contact" },
];

export function App() {
  const [session, setSession] = useState<Session>({ status: "loading" });
  const location = useLocation();

  useEffect(() => {
    void currentUser()
      .catch(() => null)
      .then((me) => setSession(me ? { status: "in", me } : { status: "out" }));
  }, []);

  const next = safeNext(new URLSearchParams(location.search).get("next"));
  const signedIn = session.status === "in";

  // After signing in, carry on to the team hand-off if that is where the person was heading.
  useEffect(() => {
    if (signedIn && location.pathname === "/sign-in" && next) window.location.assign(next);
  }, [signedIn, location.pathname, next]);

  if (session.status === "loading") return <div className="center muted">Loading…</div>;
  if (session.status === "out") return <SignInPage onDone={(me) => setSession({ status: "in", me })} />;
  if (location.pathname === "/sign-in") return next ? <div className="center muted">Signing you in…</div> : <Navigate to="/" replace />;

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
          <span className="muted">{session.me.email}</span>
          <button
            className="btn small ghost"
            onClick={() => signOut().finally(() => setSession({ status: "out" }))}
          >
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
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

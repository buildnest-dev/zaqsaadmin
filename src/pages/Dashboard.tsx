import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { publishedKeys } from "../lib/store";

const AREAS = [
  { key: "home", to: "/home", title: "Landing page", text: "Hero text, buttons and the eight-areas section." },
  { key: "services", to: "/services", title: "Services", text: "Add, edit, reorder or remove any service." },
  { key: "core", to: "/showcase", title: "Home showcase", text: "The pinned core-services cards on the home page." },
  { key: "team", to: "/team", title: "Team", text: "Founders and engineers with their photos." },
  { key: "company", to: "/company", title: "Company & contact", text: "Phone, email, address and tagline." },
];

export function Dashboard() {
  const [published, setPublished] = useState<Record<string, Date | null> | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    publishedKeys()
      .then(setPublished)
      .catch((problem: Error) => setError(problem.message));
  }, []);

  return (
    <>
      <header className="page-head">
        <h1>Overview</h1>
        <p className="muted">
          Everything you publish here appears on the live website within about a minute. Areas you
          have not saved yet keep showing the content built into the website.
        </p>
      </header>
      {error && <p className="error">{error}</p>}
      <div className="cards">
        {AREAS.map((area) => {
          const at = published?.[area.key];
          return (
            <Link key={area.key} to={area.to} className="card link-card">
              <h3>{area.title}</h3>
              <p className="muted">{area.text}</p>
              <span className={at !== undefined ? "badge ok-badge" : "badge"}>
                {published === null
                  ? "…"
                  : at !== undefined
                    ? `Managed here${at ? ` · ${at.toLocaleDateString()}` : ""}`
                    : "Using website defaults"}
              </span>
            </Link>
          );
        })}
      </div>
    </>
  );
}

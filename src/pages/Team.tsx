import { MasterDetail, slugify } from "../components/MasterDetail";
import { SaveBar } from "../components/SaveBar";
import { ImageField, Text } from "../components/fields";
import { useSiteDoc } from "../components/useSiteDoc";
import type { Person } from "../lib/types";

const blank = (): Person => ({
  id: `new-person-${Date.now().toString(36)}`,
  name: "",
  role: "Software Engineer",
  group: "engineer",
});

export function TeamPage() {
  const doc = useSiteDoc("team");
  if (!doc.data) return <div className="muted">{doc.state === "error" ? doc.message : "Loading…"}</div>;
  return (
    <>
      <header className="page-head">
        <h1>Team</h1>
        <p className="muted">
          Founders appear in the About hero and the "Our founders" section, engineers in "Our
          engineering team". Order here is the order on the website.
        </p>
      </header>
      <MasterDetail
        items={doc.data.people}
        idOf={(p) => p.id}
        labelOf={(p) => p.name}
        subOf={(p) => `${p.group === "founder" ? "Founder" : "Engineer"} · ${p.role}`}
        noun="person"
        makeNew={blank}
        onChange={(people) => doc.update({ people })}
      >
        {(p, patch) => (
          <>
            <Text
              label="Full name"
              value={p.name}
              onChange={(name) =>
                patch({ ...p, name, id: p.id.startsWith("new-person-") ? slugify(name) || p.id : p.id })
              }
            />
            <div className="grid2">
              <Text label="Role / title" value={p.role} onChange={(role) => patch({ ...p, role })} />
              <label className="field">
                <span className="field-label">Shown under</span>
                <select
                  value={p.group}
                  onChange={(event) => patch({ ...p, group: event.target.value as Person["group"] })}
                >
                  <option value="founder">Founders</option>
                  <option value="engineer">Engineering team</option>
                </select>
              </label>
            </div>
            <ImageField
              label="Photo"
              value={p.photo}
              onChange={(photo) => patch({ ...p, photo })}
              fallbackNote="Portrait photos work best (4:5). Without one the website shows initials."
            />
          </>
        )}
      </MasterDetail>
      <SaveBar {...doc} onSave={doc.save} onReset={doc.reset} />
    </>
  );
}

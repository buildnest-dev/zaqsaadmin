import { MasterDetail, slugify } from "../components/MasterDetail";
import { SaveBar } from "../components/SaveBar";
import { Area, ListEditor, Text } from "../components/fields";
import { useSiteDoc } from "../components/useSiteDoc";
import type { CoreService } from "../lib/types";

const blank = (): CoreService => ({
  id: `new-card-${Date.now().toString(36)}`,
  number: "",
  label: "",
  title: "",
  blurb: "",
  builtFor: [],
  features: [],
});

export function CorePage() {
  const doc = useSiteDoc("core");
  if (!doc.data) return <div className="muted">{doc.state === "error" ? doc.message : "Loading…"}</div>;
  return (
    <>
      <header className="page-head">
        <h1>Home showcase</h1>
        <p className="muted">
          The pinned cards you scroll through right after the home page hero. Each card links to a
          service page, so its address must match a service slug exactly.
        </p>
      </header>
      <MasterDetail
        items={doc.data.items}
        idOf={(c) => c.id}
        labelOf={(c) => c.title}
        subOf={(c) => `/services/${c.id}`}
        noun="card"
        makeNew={blank}
        onChange={(items) => doc.update({ items })}
      >
        {(c, patch) => (
          <>
            <div className="grid2">
              <Text
                label="Tab label (short)"
                value={c.label}
                onChange={(label) => patch({ ...c, label })}
              />
              <Text label="Number (01, 02…)" value={c.number} onChange={(number) => patch({ ...c, number })} />
            </div>
            <Text
              label="Card title"
              value={c.title}
              onChange={(title) =>
                patch({ ...c, title, id: c.id.startsWith("new-card-") ? slugify(title) || c.id : c.id })
              }
            />
            <Text
              label="Links to service (slug)"
              value={c.id}
              onChange={(id) => patch({ ...c, id: slugify(id) })}
              hint="Must be the slug of an existing service, e.g. hospital-management."
            />
            <Area label="Description" value={c.blurb} onChange={(blurb) => patch({ ...c, blurb })} rows={3} />
            <ListEditor label="Built for" items={c.builtFor} onChange={(builtFor) => patch({ ...c, builtFor })} />
            <ListEditor label="Feature chips" items={c.features} onChange={(features) => patch({ ...c, features })} />
            <p className="field-hint">
              The picture beside each card comes from the matching service's photo.
            </p>
          </>
        )}
      </MasterDetail>
      <SaveBar {...doc} onSave={doc.save} onReset={doc.reset} />
    </>
  );
}

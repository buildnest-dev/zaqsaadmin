import { SaveBar } from "../components/SaveBar";
import { Area, Text } from "../components/fields";
import { useSiteDoc } from "../components/useSiteDoc";
import { HOME_DEFAULT } from "../lib/types";

export function HomePage() {
  const doc = useSiteDoc("home");
  if (!doc.data) return <div className="muted">{doc.state === "error" ? doc.message : "Loading…"}</div>;
  const h = { ...HOME_DEFAULT, ...doc.data };
  const set = (patch: Partial<typeof h>) => doc.update({ ...h, ...patch });
  return (
    <>
      <header className="page-head">
        <h1>Landing page</h1>
        <p className="muted">
          The top of the home page and the eight-areas section. Services in the pinned showcase are
          edited under "Home showcase".
        </p>
      </header>
      <div className="card form">
        <h3>Hero</h3>
        <Text label="Small line above the title" value={h.kicker} onChange={(kicker) => set({ kicker })} />
        <div className="grid2">
          <Text label="Title, first line" value={h.titleLine1} onChange={(titleLine1) => set({ titleLine1 })} />
          <Text
            label="Title, second line (highlighted)"
            value={h.titleLine2}
            onChange={(titleLine2) => set({ titleLine2 })}
          />
        </div>
        <Text
          label="Label above the quick links"
          value={h.audienceLabel}
          onChange={(audienceLabel) => set({ audienceLabel })}
        />
        <Area label="Description" value={h.description} onChange={(description) => set({ description })} />
        <Text label="Main button text" value={h.primaryCta} onChange={(primaryCta) => set({ primaryCta })} />
      </div>
      <div className="card form">
        <h3>"Eight ways to grow" section</h3>
        <Text label="Heading" value={h.familyTitle} onChange={(familyTitle) => set({ familyTitle })} />
        <Area label="Intro" value={h.familyIntro} onChange={(familyIntro) => set({ familyIntro })} />
      </div>
      <SaveBar {...doc} onSave={doc.save} onReset={doc.reset} />
    </>
  );
}

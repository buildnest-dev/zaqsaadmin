import { useState } from "react";
import { MasterDetail, slugify } from "../components/MasterDetail";
import { SaveBar } from "../components/SaveBar";
import { Area, FaqEditor, ImageField, ListEditor, Text } from "../components/fields";
import { useSiteDoc } from "../components/useSiteDoc";
import { CATEGORIES, type Category, type Service } from "../lib/types";

const blank = (): Service => ({
  id: `new-service-${Date.now().toString(36)}`,
  title: "",
  blurb: "",
  items: [],
  category: "Technology",
  intro: "",
  outcomes: [],
  detail: { who: "", engagements: [], faqs: [] },
});

export function ServicesPage() {
  const doc = useSiteDoc("services");
  const [category, setCategory] = useState<"All" | Category>("All");
  if (!doc.data) return <div className="muted">{doc.state === "error" ? doc.message : "Loading…"}</div>;
  const items = doc.data.items;
  const visible = category === "All" ? items : items.filter((s) => s.category === category);

  return (
    <>
      <header className="page-head">
        <h1>Services</h1>
        <p className="muted">
          Each service has its own page on the website. The address is built from the short name
          (slug), so change it only when creating a service.
        </p>
      </header>
      <MasterDetail
        items={items}
        idOf={(s) => s.id}
        labelOf={(s) => s.title}
        subOf={(s) => s.category}
        noun="service"
        makeNew={blank}
        onChange={(next) => doc.update({ items: next })}
        filter={
          <div className="chips">
            {(["All", ...CATEGORIES] as const).map((c) => (
              <button
                key={c}
                type="button"
                className={c === category ? "chip active" : "chip"}
                onClick={() => setCategory(c)}
              >
                {c}
              </button>
            ))}
          </div>
        }
      >
        {(s, patch) => {
          const isShown = visible.some((v) => v.id === s.id);
          return (
            <>
              {!isShown && <p className="warn">This service is hidden by the category filter.</p>}
              <div className="grid2">
                <Text
                  label="Title"
                  value={s.title}
                  onChange={(title) =>
                    patch({
                      ...s,
                      title,
                      id: s.id.startsWith("new-service-") ? slugify(title) || s.id : s.id,
                    })
                  }
                />
                <label className="field">
                  <span className="field-label">Category</span>
                  <select
                    value={s.category}
                    onChange={(event) => patch({ ...s, category: event.target.value as Category })}
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </label>
              </div>
              <Text
                label="Page address (slug)"
                value={s.id}
                onChange={(id) => patch({ ...s, id: slugify(id) })}
                hint={`Page: /services/${s.id}. Changing this breaks old links to the page.`}
              />
              <Area label="Short description (shown on cards)" value={s.blurb} onChange={(blurb) => patch({ ...s, blurb })} rows={2} />
              <Area label="Introduction (top of the service page)" value={s.intro} onChange={(intro) => patch({ ...s, intro })} rows={4} />
              <ImageField
                label="Photo"
                value={s.photo}
                onChange={(photo) => patch({ ...s, photo })}
                fallbackNote="Without a photo the website uses its built-in picture for this service, if it has one."
              />
              <ListEditor
                label="Capabilities (the list of what is included)"
                items={s.items}
                onChange={(items) => patch({ ...s, items })}
              />
              <ListEditor
                label="Outcomes (what the client gets)"
                items={s.outcomes}
                onChange={(outcomes) => patch({ ...s, outcomes })}
              />
              <Area
                label="Who it is for"
                value={s.detail.who}
                onChange={(who) => patch({ ...s, detail: { ...s.detail, who } })}
                rows={3}
              />
              <ListEditor
                label="Typical engagements"
                items={s.detail.engagements}
                onChange={(engagements) => patch({ ...s, detail: { ...s.detail, engagements } })}
              />
              <FaqEditor faqs={s.detail.faqs} onChange={(faqs) => patch({ ...s, detail: { ...s.detail, faqs } })} />
            </>
          );
        }}
      </MasterDetail>
      <SaveBar {...doc} onSave={doc.save} onReset={doc.reset} />
    </>
  );
}

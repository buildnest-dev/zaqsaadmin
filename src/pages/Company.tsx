import { SaveBar } from "../components/SaveBar";
import { Area, Text } from "../components/fields";
import { useSiteDoc } from "../components/useSiteDoc";

export function CompanyPage() {
  const doc = useSiteDoc("company");
  if (!doc.data) return <div className="muted">{doc.state === "error" ? doc.message : "Loading…"}</div>;
  const c = doc.data;
  const set = (patch: Partial<typeof c>) => doc.update({ ...c, ...patch });
  return (
    <>
      <header className="page-head">
        <h1>Company &amp; contact</h1>
        <p className="muted">Shown in the footer, contact page and search results.</p>
      </header>
      <div className="card form">
        <div className="grid2">
          <Text label="Company name" value={c.name} onChange={(name) => set({ name })} />
          <Text label="Phone" value={c.phone} onChange={(phone) => set({ phone })} />
          <Text
            label="Public email"
            value={c.email}
            onChange={(email) => set({ email })}
            hint="Shown on the site. Consultation requests are emailed to the address set in the website's form."
          />
          <Text label="Address" value={c.address} onChange={(address) => set({ address })} />
          <Text label="Lead person" value={c.founder} onChange={(founder) => set({ founder })} />
          <Text label="Lead person's role" value={c.role} onChange={(role) => set({ role })} />
        </div>
        <Area label="Tagline" value={c.tagline} onChange={(tagline) => set({ tagline })} rows={2} />
        <Area label="Support line" value={c.support} onChange={(support) => set({ support })} rows={2} />
      </div>
      <SaveBar {...doc} onSave={doc.save} onReset={doc.reset} />
    </>
  );
}

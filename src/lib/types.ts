export type Category = "Core" | "Marketing" | "Technology" | "Business" | "Consulting";
export const CATEGORIES: Category[] = ["Core", "Consulting", "Technology", "Business", "Marketing"];

export type Service = {
  id: string;
  title: string;
  blurb: string;
  items: string[];
  category: Category;
  intro: string;
  outcomes: string[];
  detail: { who: string; engagements: string[]; faqs: { q: string; a: string }[] };
  photo?: string;
};

export type CoreService = {
  id: string;
  number: string;
  label: string;
  title: string;
  blurb: string;
  builtFor: string[];
  features: string[];
};

export type Person = {
  id: string;
  name: string;
  role: string;
  group: "founder" | "engineer";
  slot?: string;
  photo?: string;
};

export type Company = {
  name: string;
  founder: string;
  role: string;
  address: string;
  email: string;
  phone: string;
  tagline: string;
  support: string;
};

/** Each editable area is one Firestore document in `site/{key}` that holds its data as JSON text. */
export type SiteDocs = {
  company: Company;
  team: { people: Person[] };
  services: { items: Service[] };
  core: { items: CoreService[] };
  home: HomeContent;
};

export type HomeContent = {
  kicker: string;
  titleLine1: string;
  titleLine2: string;
  description: string;
  audienceLabel: string;
  primaryCta: string;
  familyTitle: string;
  familyIntro: string;
};

export const HOME_DEFAULT: HomeContent = {
  kicker: "Software · AI · Cloud · Digital engineering",
  titleLine1: "We engineer ideas",
  titleLine2: "into scalable software.",
  description:
    "Software, websites, apps and digital marketing — planned, built and run by one accountable team.",
  audienceLabel: "Software & digital growth for",
  primaryCta: "Start a conversation",
  familyTitle: "One company, eight ways to grow.",
  familyIntro:
    "Pick the area closest to your work. Every ZAQSA team shares the same engineers, the same standards and the same accountable point of contact.",
};

export type DocKey = keyof SiteDocs;

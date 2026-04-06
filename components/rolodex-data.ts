import personalData from "@/personal_data.json";

export type RolodexItem = {
  id: string;
  src: string;
  title: string;
  description: string;
  href?: string;
  tags?: string[];
  meta?: string;
  darkBg?: boolean;
  imageScale?: number;
  imagePosition?: string;
};

const SVG_PATHS = [
  "/rolodex/amber-sprint.svg",
  "/rolodex/tidal-grid.svg",
  "/rolodex/afterglow-veil.svg",
  "/rolodex/velvet-orbit.svg",
  "/rolodex/frost-signal.svg",
  "/rolodex/solar-thread.svg",
  "/rolodex/cobalt-noise.svg",
  "/rolodex/rose-drift.svg",
  "/rolodex/lime-echo.svg",
];

const IMAGE_SCALE: Record<string, number> = {
  talyth: 1.35,
};

const IMAGE_POSITION: Record<string, string> = {};

const DARK_BG_PROJECTS = ["talyth"];

const projects: RolodexItem[] = personalData.projects.map((p, i) => ({
  id: `project-${p.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
  src: (p as any).image ?? SVG_PATHS[i % SVG_PATHS.length],
  title: p.title,
  description: p.description,
  href: (p as any).link,
  tags: (p as any).tags,
  meta: (p as any).year,
  imageScale: IMAGE_SCALE[p.title.toLowerCase()],
  imagePosition: IMAGE_POSITION[p.title.toLowerCase()],
  darkBg: DARK_BG_PROJECTS.includes(p.title.toLowerCase()),
}));

const DARK_BG_COMPANIES = ["distributive"];

const experience: RolodexItem[] = personalData.experience.map((e, i) => ({
  id: `exp-${e.company.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
  src: (e as any).image ?? SVG_PATHS[(projects.length + i) % SVG_PATHS.length],
  title: `${e.role} @ ${e.company}`,
  description: e.description,
  tags: e.tags,
  meta: e.period,
  darkBg: DARK_BG_COMPANIES.includes(e.company.toLowerCase()),
}));

const essays: RolodexItem[] = personalData.essays.map((e, i) => ({
  id: `essay-${e.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
  src: (e as any).image ?? SVG_PATHS[(projects.length + experience.length + i) % SVG_PATHS.length],
  title: e.title,
  description: e.excerpt,
  href: e.link,
  meta: e.date,
}));

export const ROLEDEX_ITEMS: RolodexItem[] = [...projects, ...experience, ...essays];

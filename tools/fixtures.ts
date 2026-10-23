import type { Activity, PageDataKind, PageImage, PageMedia, SettingValue } from "parousia";
import { matchesAny } from "./match-pattern";
import type { Metadata } from "./metadata";

/**
 * browser: seen on the real site, on the day in `observed`. source: read from the site's own code. synthetic: made up, or taken from how it was once called.
 * A fixture says what the Activity does with this input, not that the site works that way today.
 */

export const SOURCES = ["browser", "source", "synthetic"] as const;
export type Source = (typeof SOURCES)[number];

export interface Fixture {
  name: string;
  source: Source;

  observed?: string;
  url: string;
  title?: string;
  data?: {
    granted?: PageDataKind[];
    media?: PageMedia;
    thumbnail?: string;
    images?: PageImage[];
  };

  settings?: Record<string, SettingValue>;

  expect: Record<string, unknown> | null;
}

export interface Fixtures {
  cases?: Fixture[];

  for?: string[];

  notFor?: string[];
}

export const NO_FIXTURES: Fixtures = {};

export const CASE_KEYS = new Set([
  "name",
  "source",
  "observed",
  "url",
  "title",
  "data",
  "settings",
  "expect",
]);
export const FILE_KEYS = ["$schema", "cases", "for", "notFor"];
const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export function checkFixtures(
  raw: unknown,
  metadata: Pick<Metadata, "matches" | "settings">,
): string[] {
  if (!isObject(raw))
    return ["fixtures.json must be an object with `cases`, `for`, `notFor`, or some of them"];
  const problems: string[] = [];
  for (const key of Object.keys(raw)) {
    if (!FILE_KEYS.includes(key)) problems.push(`unknown key "${key}"`);
  }
  for (const key of ["for", "notFor"] as const) {
    const list = raw[key];
    if (list === undefined) continue;
    if (
      !Array.isArray(list) ||
      list.length === 0 ||
      !list.every((url) => typeof url === "string")
    ) {
      problems.push(`\`${key}\` must be a list of at least one address`);
      continue;
    }
    for (const url of list as string[]) {
      try {
        new URL(url);
      } catch {
        problems.push(`${key}: "${url}" isn't a URL`);
      }
    }
  }
  if (raw.cases === undefined && raw.for === undefined && raw.notFor === undefined) {
    return [...problems, "it needs `cases`, `for`, `notFor`, or some of them"];
  }
  if (raw.cases === undefined) return problems;
  if (!Array.isArray(raw.cases) || raw.cases.length === 0) {
    return [...problems, "`cases` must be a list of at least one case"];
  }
  const declared = new Set((metadata.settings ?? []).map((setting) => setting.id));
  const seen = new Set<string>();

  raw.cases.forEach((value: unknown, index) => {
    const at = isObject(value) && typeof value.name === "string" ? `"${value.name}"` : `#${index}`;
    if (!isObject(value)) {
      problems.push(`case ${at} must be an object`);
      return;
    }
    for (const key of Object.keys(value)) {
      if (!CASE_KEYS.has(key)) problems.push(`case ${at} has an unknown key "${key}"`);
    }
    if (typeof value.name !== "string" || value.name.trim() === "") {
      problems.push(`case ${at} needs a name`);
    } else if (seen.has(value.name)) {
      problems.push(`case ${at}: the name is used twice`);
    } else {
      seen.add(value.name);
    }
    if (!SOURCES.includes(value.source as Source)) {
      problems.push(`case ${at}: source must be ${SOURCES.join(", ")}`);
    }
    const dated = typeof value.observed === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.observed);
    if (value.source === "browser" && !dated) {
      problems.push(`case ${at}: a browser case needs \`observed\`, as YYYY-MM-DD`);
    }
    if (value.source !== "browser" && value.observed !== undefined) {
      problems.push(`case ${at}: only a browser case has \`observed\``);
    }
    try {
      const url = new URL(String(value.url));
      if (url.protocol !== "https:") problems.push(`case ${at}: url must be https`);
      else if (!matchesAny(metadata.matches, url)) {
        problems.push(`case ${at}: url isn't one the Activity runs on (see its matches)`);
      }
    } catch {
      problems.push(`case ${at}: url isn't a URL`);
    }
    if (value.title !== undefined && typeof value.title !== "string") {
      problems.push(`case ${at}: title must be text`);
    }
    if (value.data !== undefined && !isObject(value.data)) {
      problems.push(`case ${at}: data must be an object`);
    }
    if (value.settings !== undefined) {
      if (!isObject(value.settings)) problems.push(`case ${at}: settings must be an object`);
      else {
        for (const key of Object.keys(value.settings)) {
          if (!declared.has(key)) problems.push(`case ${at}: "${key}" isn't one of its settings`);
        }
      }
    }
    if (value.expect !== null && !isObject(value.expect)) {
      problems.push(`case ${at}: expect must be null or an object`);
    }
  });

  return problems;
}

/** Everything an Activity says that reaches Discord, except what every presence has: its id and name, its icon as the large image, and its name as that image's caption. Its `url` stays in the browser (Parousia drops it before sending), so it isn't pinned. */
export function said(
  result: Activity | null,
  icon: string | undefined,
): Record<string, unknown> | null {
  if (result === null) return null;
  const copy: Record<string, unknown> = JSON.parse(JSON.stringify(result));
  delete copy.id;
  delete copy.name;
  delete copy.url;
  const assets = copy.assets as Record<string, unknown> | undefined;
  if (assets) {
    if (assets.largeText === result.name) delete assets.largeText;
    if (assets.largeImage === icon) delete assets.largeImage;
    if (Object.keys(assets).length === 0) delete copy.assets;
  }

  return copy;
}

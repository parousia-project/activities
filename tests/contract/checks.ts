import type { Activity, Page, Settings } from "parousia";
import { compileMatchPattern, matchesAny } from "../../tools/match-pattern";
import type { Metadata } from "../../tools/metadata";
import { said, type Fixture } from "../../tools/fixtures";
import { ASSETS_URL, assetFile, checkActivity, defaults, page } from "../../tools/testing";
import { CANARY, PRIVATE, TITLES, pageData, settingsFor, urlsFor } from "./samples";

/**
 * structure: the Activity runs and says nothing Discord would refuse or a page shouldn't give away.
 * settings: the switches its metadata lists do what their names say.
 * Neither says it describes its site correctly. Fixtures pin what it does with an address and title someone saw.
 */

export type Tier = "structure" | "settings";

export interface Check {
  id: string;
  tier: Tier;
  says: string;

  applies?: (metadata: Pick<Metadata, "settings">) => boolean;
}

const has = (metadata: Pick<Metadata, "settings">, ...ids: string[]): boolean =>
  (metadata.settings ?? []).some((setting) => ids.includes(setting.id));

export const CHECKS: readonly Check[] = [
  {
    id: "scope",
    tier: "structure",
    says: "the addresses it lists match it, and lookalike addresses don't",
  },
  {
    id: "origin",
    tier: "structure",
    says: "the address it gives is on a site its patterns cover",
  },
  {
    id: "runs",
    tier: "structure",
    says: "it never throws, and gives nothing or an Activity",
  },
  {
    id: "data",
    tier: "structure",
    says: "it reads only the page data its metadata.json lists, which is all Parousia gives it",
  },
  { id: "limits", tier: "structure", says: "what it shows fits what Discord takes" },
  {
    id: "images",
    tier: "structure",
    says: "a small image has a large one, and an image of this repository's exists",
  },
  {
    id: "secrets",
    tier: "structure",
    says: "no query string or fragment reaches what it shows",
  },
  {
    id: "characters",
    tier: "structure",
    says: "no control or direction-override characters reach what it shows",
  },
  { id: "stateless", tier: "structure", says: "the same input gives the same output" },
  {
    id: "privacy",
    tier: "settings",
    says: "privacy mode hides what a page's title, media, and pictures said",
    applies: (metadata) => has(metadata, "privacyMode"),
  },
  {
    id: "timestamps",
    tier: "settings",
    says: "turning timestamps off hides the clock",
    applies: (metadata) => has(metadata, "showTimestamps"),
  },
  {
    id: "thumbnail",
    tier: "settings",
    says: "turning the picture off hides it",
    applies: (metadata) => has(metadata, "showThumbnail", "showCover"),
  },
];

export interface Subject {
  metadata: Pick<Metadata, "id" | "matches" | "data" | "settings" | "icon">;
  detect: (page: Page, settings: Settings) => Activity | null;
}

function onItsSites(patterns: readonly string[], href: string): boolean {
  try {
    const anyPath = patterns.map((pattern) =>
      pattern.replace(/^((?:\*|https?):\/\/[^/]+)\/.*$/, "$1/*"),
    );

    return matchesAny(anyPath, new URL(href));
  } catch {
    return false;
  }
}

export function overlaps(
  all: ReadonlyArray<{
    name: string;
    metadata: Pick<Metadata, "matches">;
    extra?: readonly string[];
  }>,
): string[] {
  const clashes = new Set<string>();
  for (const one of all) {
    for (const href of urlsFor(one.metadata, one.extra)) {
      for (const other of all) {
        if (other !== one && matchesAny(other.metadata.matches, new URL(href))) {
          clashes.add(`${one.name} and ${other.name} both match ${href.split("?")[0]}`);
        }
      }
    }
  }

  return [...clashes];
}

export function sayFor(subject: Subject, fixture: Fixture): ReturnType<typeof said> {
  const settings = { ...defaults(subject.metadata), ...fixture.settings };
  const result = subject.detect(
    page(fixture.url, fixture.title ?? "", fixture.data ?? {}),
    settings,
  );

  return said(result, subject.metadata.icon);
}

export interface Audit {
  problems: Map<string, string[]>;
}

const PAGE_DATA = new Map([
  ["media", "media"],
  ["thumbnail", "thumbnails"],
  ["images", "thumbnails"],
]);

const BAD = /[\p{Cc}\u202A-\u202E\u2066-\u2069]/u;

function holdsFunction(value: unknown): boolean {
  if (typeof value === "function") return true;
  if (typeof value !== "object" || value === null) return false;

  return Object.values(value).some(holdsFunction);
}

function* strings(value: unknown): Generator<string> {
  if (typeof value === "string") yield value;
  else if (Array.isArray(value)) for (const item of value) yield* strings(item);
  else if (typeof value === "object" && value !== null) {
    for (const item of Object.values(value)) yield* strings(item);
  }
}

const STRANGERS = ["com", "org", "net", "dev", "app", "io", "tv", "jp", "co.uk"].map(
  (ending) => `https://unrelated-site-for-tests.${ending}/`,
);

function lookalikes(patterns: readonly string[]): string[] {
  const out = new Set<string>(STRANGERS);
  for (const pattern of patterns) {
    const [, , , host] = /^(\*|https?):\/\/(\*\.)?([^/]+)\//.exec(pattern) ?? [];
    if (!host) continue;

    out.add(`http://${host}/`);
    out.add(`https://${host}.evil.test/`);
    out.add(`https://not${host}/`);
    out.add(`https://evil.test/${host}`);
  }

  return [...out];
}

export function audit(subject: Subject, extra: readonly string[] = []): Audit {
  const { metadata, detect } = subject;
  const problems = new Map<string, string[]>();
  const fail = (id: string, why: string): void => {
    const list = problems.get(id) ?? [];
    if (list.length < 3) list.push(why);
    problems.set(id, list);
  };

  for (const pattern of metadata.matches) {
    const matcher = compileMatchPattern(pattern);
    if (!matcher) fail("scope", `${pattern} isn't a match pattern`);
  }
  for (const href of lookalikes(metadata.matches)) {
    if (matchesAny(metadata.matches, new URL(href))) fail("scope", `it matches ${href}`);
  }

  const declared = new Set<string>(metadata.data ?? []);
  const undeclared = new Set<string>();
  const watch = (input: Page): Page =>
    new Proxy(input, {
      get(target, key) {
        const kind = typeof key === "string" ? PAGE_DATA.get(key) : undefined;
        if (kind !== undefined && !declared.has(kind)) {
          undeclared.add(`it reads page.${String(key)}, but data doesn't list "${kind}"`);
        }
        return Reflect.get(target, key);
      },
    });
  const watched = settingsFor(metadata);
  const data = pageData(metadata);
  const urls = urlsFor(metadata, extra);
  if (urls.length === 0) fail("scope", "no address could be made from its patterns");

  for (const href of urls) {
    if (!matchesAny(metadata.matches, new URL(href))) fail("scope", `it doesn't match ${href}`);
    for (const title of TITLES) {
      for (const { name: withData, sane, input } of data) {
        for (const { name: withSettings, value } of watched) {
          const where = `${new URL(href).host}${new URL(href).pathname} | ${withData} | ${withSettings}`;
          let result: Activity | null;
          try {
            result = detect(watch(page(href, title, input)), value);
          } catch (error) {
            fail(
              "runs",
              `${where}: ${error instanceof Error ? error.message.slice(0, 60) : "threw"}`,
            );
            continue;
          }
          if (result === null) continue;
          const json = JSON.stringify(result);

          if (holdsFunction(result)) {
            fail("runs", `${where}: it says a function`);
            continue;
          }
          if (result.url !== undefined && !onItsSites(metadata.matches, result.url)) {
            fail("origin", `${where}: it gives ${result.url}`);
          }
          if (sane) {
            const refused = checkActivity(result);
            if (refused.length > 0) fail("limits", `${where}: ${refused[0]}`);
          }
          const { largeImage, smallImage } = result.assets ?? {};
          if (smallImage !== undefined && largeImage === undefined) {
            fail("images", `${where}: a small image with no large one`);
          }
          for (const image of [largeImage, smallImage]) {
            if (image?.startsWith(ASSETS_URL) && assetFile(image) === null) {
              fail("images", `${image} isn't a file in assets/`);
            }
          }
          if (json.includes(CANARY.query) || json.includes(CANARY.fragment)) {
            fail("secrets", where);
          }
          for (const text of strings(result)) {
            if (BAD.test(text)) fail("characters", `${where}: "${text.slice(0, 30)}"`);
          }
          if (JSON.stringify(detect(page(href, title, input), value)) !== json) {
            fail("stateless", where);
          }
          if (value.privacyMode === true) {
            for (const secret of PRIVATE) {
              if (json.includes(secret)) fail("privacy", `${where}: shows ${secret}`);
            }
          }
          if (value.showTimestamps === false && value.privacyMode !== true && result.timestamps) {
            fail("timestamps", where);
          }
          if (
            (value.showThumbnail === false || value.showCover === false) &&
            json.includes(CANARY.thumbnail)
          ) {
            fail("thumbnail", where);
          }
        }
      }
    }
  }

  for (const why of undeclared) fail("data", why);

  return { problems };
}

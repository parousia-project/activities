import { describe, expect, test } from "bun:test";
import type { Activity, Page, Settings } from "parousia";
import { ASSETS_URL } from "../tools/testing";
import { CHECKS, audit, overlaps, sayFor, type Subject } from "./contract/checks";
import { checkFixtures } from "../tools/fixtures";

/**
 * The checks check Activities; these check the checks. Each must fail on an Activity built to break it.
 */

const metadata: Subject["metadata"] = {
  id: "fake",
  matches: ["https://fake.example/*"],
  data: ["media", "thumbnails"],
  settings: [
    { id: "privacyMode", title: "Privacy", type: "boolean", default: false },
    { id: "showTimestamps", title: "Clock", type: "boolean", default: true },
    { id: "showThumbnail", title: "Picture", type: "boolean", default: true },
  ],
};
const fine = (extra: Partial<Activity> = {}): Activity => ({
  id: "fake",
  name: "Fake",
  url: "https://fake.example/",
  details: "Browsing Fake",
  ...extra,
});
type Detect = Subject["detect"];
const failed = (detect: Detect, meta = metadata): string[] => [
  ...audit({ metadata: meta, detect }).problems.keys(),
];

const BROKEN: Array<[string, string, Detect, Subject["metadata"]?]> = [
  [
    "throws on a page with no title",
    "runs",
    (page) => {
      if (page.title === "") throw new Error("boom");
      return fine();
    },
  ],
  [
    "looks a page up in a plain object, so /constructor is a function",
    "runs",
    (page) => fine({ details: ({ a: "x" } as Record<string, string>)[page.url.pathname.slice(1)] }),
  ],
  [
    "reads a picture without listing thumbnails in data",
    "data",
    (page) => fine({ details: page.thumbnail ?? "Browsing" }),
    { ...metadata, data: ["media"] },
  ],
  [
    "reads the media without listing any data",
    "data",
    (page) => fine({ state: page.media?.title }),
    { ...metadata, data: undefined },
  ],
  ["gives an address on another site", "origin", () => fine({ url: "https://elsewhere.example/" })],
  ["gives an address that isn't one", "origin", () => fine({ url: "not a url" })],
  ["a state of one character", "limits", () => fine({ state: "x" })],
  ["a party with more people than its max", "limits", () => fine({ party: { size: 6, max: 5 } })],
  [
    "a button label over 32 characters",
    "limits",
    () => fine({ buttons: [{ label: "x".repeat(40), url: "https://fake.example/" }] }),
  ],
  [
    "a small image with no large one",
    "images",
    () => fine({ assets: { smallImage: "https://i.example/a.png" } }),
  ],
  [
    "an image of this repository's that was never added",
    "images",
    () => fine({ assets: { largeImage: `${ASSETS_URL}/status/never-added.png` } }),
  ],
  [
    "copies the query string",
    "secrets",
    (page) => fine({ url: `https://fake.example/${page.url.search}` }),
  ],
  [
    "copies the fragment into its text",
    "secrets",
    (page) => fine({ details: `On ${page.url.hash}` }),
  ],
  ["lets a direction override through", "characters", () => fine({ details: "Reading ‮abc" })],
  [
    "lets a control character through",
    "characters",
    (page) => fine({ details: `Reading ${page.title.slice(0, 40)}` }),
  ],
  [
    "keeps a count between calls",
    "stateless",
    (() => {
      let n = 0;
      return () => fine({ details: `Visit ${++n}` });
    })(),
  ],
  [
    "shows the page's title in privacy mode",
    "privacy",
    (page) => fine({ details: page.title || "Browsing" }),
  ],
  [
    "shows what the media said in privacy mode",
    "privacy",
    (page) => fine({ state: page.media?.title }),
  ],
  [
    "ignores the timestamps switch",
    "timestamps",
    () => fine({ timestamps: { start: 1_700_000_000_000 } }),
  ],
  [
    "ignores the picture switch",
    "thumbnail",
    (page) => fine({ assets: { largeImage: page.thumbnail ?? "https://i.example/logo.png" } }),
  ],
];

describe("each check fails on an Activity built to break it", () => {
  for (const [what, check, detect, meta] of BROKEN) {
    test(`${what}: "${check}"`, () => {
      expect(failed(detect, meta)).toContain(check);
    });
  }

  test("every check there is has a broken Activity here", () => {
    const covered = new Set<string>(BROKEN.map(([, check]) => check));
    for (const check of CHECKS) {
      if (check.id !== "scope") expect(covered.has(check.id)).toBe(true);
    }
  });

  test("scope: a pattern for every site with an ending, for http too, or one that isn't a pattern", () => {
    for (const matches of [
      ["https://*.com/*"],
      ["https://fake.example/*", "https://*.dev/*"],
      ["*://fake.example/*"],
      ["http://fake.example/*"],
      ["fake.example"],
    ]) {
      expect(failed(() => fine(), { ...metadata, matches })).toContain("scope");
    }
  });

  test("an Activity may leave out its url, which never leaves the browser", () => {
    expect(failed(() => fine({ url: undefined }))).toEqual([]);
  });

  test("a well-behaved Activity trips nothing, with a clock and a picture it may show", () => {
    const detect: Detect = (page: Page, settings: Settings) =>
      settings.showTimestamps === true &&
      page.media?.start !== undefined &&
      settings.privacyMode !== true
        ? fine({ timestamps: { start: page.media.start } })
        : fine();
    expect(failed(detect)).toEqual([]);
  });

  test("an Activity with no settings, and none the metadata lists, is not asked about them", () => {
    const bare = { id: "fake", matches: ["https://fake.example/*"] };
    expect(failed(() => fine(), bare)).toEqual([]);
  });
});

describe("a fixture is compared exactly", () => {
  const fixture = {
    name: "a page",
    source: "synthetic" as const,
    url: "https://fake.example/",
    expect: { details: "Browsing Fake" },
  };
  const say = (extra: Parameters<typeof fine>[0]) =>
    sayFor(
      {
        metadata: { ...metadata, icon: "https://fake.example/icon.png" },
        detect: () => fine(extra),
      },
      fixture,
    );

  test("what every presence has is left out, so it need not be written, and so is the address, which never leaves the browser", () => {
    expect(
      say({
        url: "https://fake.example/elsewhere",
        assets: { largeImage: "https://fake.example/icon.png", largeText: "Fake" },
      }),
    ).toEqual({ details: "Browsing Fake" });
  });

  test("a field that wasn't expected makes it differ, which a partial match would let through", () => {
    expect(
      say({ assets: { smallImage: "https://i.example/play.png", smallText: "Playing" } }),
    ).not.toEqual(fixture.expect);
    expect(say({ state: "Extra" })).not.toEqual(fixture.expect);
    expect(say({})).toEqual(fixture.expect);
  });
});

describe("two Activities for the same address", () => {
  const one = { name: "One", metadata: { matches: ["https://www.example.com/*"] } };

  test("are found, whichever way round, and siblings are not", () => {
    const wider = { name: "Wider", metadata: { matches: ["https://*.example.com/*"] } };
    const music = { name: "Music", metadata: { matches: ["https://music.example.com/*"] } };

    expect(overlaps([one, wider]).length).toBeGreaterThan(0);
    expect(overlaps([wider, music]).length).toBeGreaterThan(0);
    expect(overlaps([one, music])).toEqual([]);
  });

  test("an address from a fixture counts too", () => {
    const other = {
      name: "Other",
      metadata: { matches: ["https://other.example/*"] },
      extra: ["https://other.example/a"],
    };

    expect(
      overlaps([other, { name: "Same", metadata: { matches: ["https://other.example/a*"] } }])
        .length,
    ).toBeGreaterThan(0);
  });
});

describe("what passing does not mean", () => {
  test("an Activity that is wrong about its site passes every check", () => {
    expect(failed(() => fine({ details: "Reading a recipe", state: "Baking bread" }))).toEqual([]);
  });

  test("a host spelled wrong in its metadata is caught only because the Activity's code has it right", () => {
    expect(failed(() => fine(), { ...metadata, matches: ["https://faek.example/*"] })).toContain(
      "origin",
    );

    expect(
      failed(() => fine({ url: "https://faek.example/" }), {
        ...metadata,
        matches: ["https://faek.example/*"],
      }),
    ).toEqual([]);
  });
});

describe("a fixtures.json is checked before it's run", () => {
  const meta = { matches: ["https://fake.example/*"], settings: metadata.settings };
  const good = {
    name: "the home page",
    source: "browser",
    observed: "2026-10-23",
    url: "https://fake.example/",
    title: "Fake",
    expect: { details: "Browsing Fake" },
  };
  const problems = (cases: unknown[], more = {}) => checkFixtures({ cases, ...more }, meta);

  test("a good one has no problems, and a case may expect nothing", () => {
    expect(problems([good])).toEqual([]);
    expect(problems([{ ...good, name: "sign-in", expect: null }])).toEqual([]);
  });

  test("a misspelled or missing field is a problem, not ignored", () => {
    expect(problems([{ ...good, titel: "x" }])).toEqual([
      expect.stringContaining('unknown key "titel"'),
    ]);
    expect(problems([{ ...good, source: "guess", observed: undefined }])).toEqual([
      expect.stringContaining("source must be"),
    ]);
    expect(problems([{ ...good, name: "" }])).toEqual([expect.stringContaining("needs a name")]);
    expect(problems([], {})).toEqual([expect.stringContaining("at least one case")]);
    expect(problems([good], { extra: 1 })).toEqual([
      expect.stringContaining('unknown key "extra"'),
    ]);
  });

  test("a browser case says when it was seen, and nothing else does", () => {
    expect(problems([{ ...good, observed: undefined }])).toEqual([
      expect.stringContaining("needs `observed`"),
    ]);
    expect(problems([{ ...good, observed: "yesterday" }])).toEqual([
      expect.stringContaining("needs `observed`"),
    ]);
    expect(problems([{ ...good, source: "synthetic" }])).toEqual([
      expect.stringContaining("only a browser case"),
    ]);
  });

  test("its address is one the Activity runs on, over https", () => {
    expect(problems([{ ...good, url: "https://elsewhere.example/" }])).toEqual([
      expect.stringContaining("isn't one the Activity runs on"),
    ]);
    expect(problems([{ ...good, url: "http://fake.example/" }])).toEqual([
      expect.stringContaining("must be https"),
    ]);
    expect(problems([{ ...good, url: "not a url" }])).toEqual([
      expect.stringContaining("isn't a URL"),
    ]);
  });

  test("addresses it is for, and is deliberately not for, are lists of addresses", () => {
    expect(
      checkFixtures(
        { for: ["https://fake.example/a"], notFor: ["https://fake.example.evil.test/"] },
        meta,
      ),
    ).toEqual([]);
    expect(checkFixtures({ for: [] }, meta)).toEqual([
      expect.stringContaining("at least one address"),
    ]);
    expect(checkFixtures({ notFor: ["nope"] }, meta)).toEqual([
      expect.stringContaining("isn't a URL"),
    ]);
    expect(checkFixtures({}, meta)).toEqual([expect.stringContaining("it needs")]);
  });

  test("it only sets settings the Activity has, and a name is used once", () => {
    expect(problems([{ ...good, settings: { privacyMode: true } }])).toEqual([]);
    expect(problems([{ ...good, settings: { madeUp: true } }])).toEqual([
      expect.stringContaining('"madeUp" isn\'t one of its settings'),
    ]);
    expect(problems([good, good])).toEqual([expect.stringContaining("used twice")]);
  });
});

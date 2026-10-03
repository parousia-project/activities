import { describe, expect, test } from "bun:test";
import { checkActivity, matches, page } from "../../../tools/testing";
import netflix from "./activity";
import metadata from "./metadata.json";

const settings = { privacyMode: false, showTimestamps: true, showThumbnail: true };
const WATCH = "https://www.netflix.com/watch/80100172?trackId=14170287&tctx=1%2C0";
const LOGO = metadata.icon;
const granted = ["media" as const, "thumbnails" as const];
const playing = {
  granted,
  media: {
    kind: "video" as const,
    playing: true,
    duration: 3000,
    start: 1_700_000_000_000,
    end: 1_700_003_000_000,
  },
};
const detect = (href: string, title = "Netflix", data = {}, choice = {}) =>
  netflix.detect(page(href, title, data), { ...settings, ...choice });

describe("Netflix", () => {
  test("its settings start as the tests assume", () => {
    expect(
      Object.fromEntries(metadata.settings.map((setting) => [setting.id, setting.default])),
    ).toEqual(settings);
  });

  test("recognizes www.netflix.com over https only", () => {
    expect(matches(metadata, WATCH)).toBe(true);
    for (const href of [
      "http://www.netflix.com/",
      "https://www.netflix.com.example.com/",
      "https://notnetflix.com/",
      "https://example.com/www.netflix.com",
    ]) {
      expect(matches(metadata, href)).toBe(false);
    }
  });

  test("a watch page is Watching, with the clock and a link, and no title it doesn't have", () => {
    const result = detect(WATCH, "Netflix", playing);

    expect(result).toEqual({
      id: "netflix",
      name: "Netflix",
      url: "https://www.netflix.com/",
      type: "watching",
      details: "Watching Netflix",
      assets: { largeImage: LOGO, largeText: "Netflix" },
      buttons: [{ label: "Watch on Netflix", url: "https://www.netflix.com/watch/80100172" }],
      timestamps: { start: 1_700_000_000_000, end: 1_700_003_000_000 },
    });
    expect(result && checkActivity(result)).toEqual([]);
    expect(JSON.stringify(result)).not.toContain("trackId");
  });

  test("with page data not granted, it still says someone is watching", () => {
    const result = detect(WATCH);

    expect(result).toMatchObject({ type: "watching", details: "Watching Netflix" });
    expect(result?.timestamps).toBeUndefined();
  });

  test("a title in the Media Session is shown", () => {
    const result = detect(WATCH, "Netflix", {
      ...playing,
      media: { ...playing.media, title: "Dark", artist: "Season 1" },
    });

    expect(result).toMatchObject({ details: "Dark", state: "Season 1" });
  });

  test("paused: no clock, and it says so", () => {
    const paused = { granted, media: { ...playing.media, playing: false } };

    expect(detect(WATCH, "Netflix", paused)).toMatchObject({ state: "Paused" });
    expect(detect(WATCH, "Netflix", paused)?.timestamps).toBeUndefined();
  });

  test("the setting for the clock, the image, and privacy", () => {
    const withTitle = {
      granted,
      media: { ...playing.media, title: "Dark" },
      thumbnail: "https://occ-0.nflxso.net/art.jpg",
    };

    expect(
      detect(WATCH, "Netflix", playing, { showTimestamps: false })?.timestamps,
    ).toBeUndefined();
    expect(detect(WATCH, "Netflix", withTitle)?.assets?.largeImage).toBe(withTitle.thumbnail);
    expect(detect(WATCH, "Netflix", withTitle, { showThumbnail: false })?.assets?.largeImage).toBe(
      LOGO,
    );
    expect(detect(WATCH, "Netflix", withTitle, { privacyMode: true })).toEqual({
      id: "netflix",
      name: "Netflix",
      url: "https://www.netflix.com/",
      type: "watching",
      details: "Watching Netflix",
      assets: { largeImage: LOGO, largeText: "Netflix" },
    });
  });

  test("a title's page is named from the tab, with its picture", () => {
    const picture = "https://occ-0.nflxso.net/dark.jpg";
    const result = detect(
      "https://www.netflix.com/ca/title/80100172?s=i&trkid=1",
      "Watch Dark | Netflix Official Site",
      { granted, thumbnail: picture },
    );

    expect(result).toEqual({
      id: "netflix",
      name: "Netflix",
      url: "https://www.netflix.com/",
      details: "Looking at a title",
      state: "Dark",
      assets: { largeImage: picture, largeText: "Netflix" },
      buttons: [{ label: "View on Netflix", url: "https://www.netflix.com/title/80100172" }],
    });
    expect(detect("https://www.netflix.com/title/80100172", "Dark | Netflix")?.state).toBe("Dark");
    // A tab that doesn't say, or says something else, names nothing.
    expect(detect("https://www.netflix.com/title/80100172", "Netflix")?.state).toBeUndefined();
    expect(detect("https://www.netflix.com/title/80100172", "Loading…")?.state).toBeUndefined();
    expect(
      detect("https://www.netflix.com/title/80100172", "Dark | Netflix", {}, { privacyMode: true })
        ?.state,
    ).toBeUndefined();
  });

  test("other pages say where someone is, and never what they searched for", () => {
    const at = (path: string) => detect(`https://www.netflix.com${path}`)?.details;

    expect(at("/browse")).toBe("Browsing Netflix");
    expect(at("/ca/browse")).toBe("Browsing Netflix");
    expect(at("/browse/my-list")).toBe("Browsing My List");
    expect(at("/latest")).toBe("Browsing New & Popular");
    expect(at("/games")).toBe("Browsing games");
    expect(at("/search?q=secret")).toBe("Searching Netflix");
    expect(JSON.stringify(detect("https://www.netflix.com/search?q=secret"))).not.toContain(
      "secret",
    );
    expect(at("/watch/notanumber")).toBe("Browsing Netflix");
  });

  test("a title from the Media Session is cleaned and cut", () => {
    const result = detect(WATCH, "Netflix", {
      granted,
      media: { ...playing.media, title: `Show‮${"x".repeat(300)}`, artist: "S\u0000eason" },
    });

    expect(result?.details).not.toContain("‮");
    expect(result?.details?.length).toBeLessThanOrEqual(100);
    expect(result?.state).toBe("Season");
    expect(result && checkActivity(result)).toEqual([]);
  });

  test("every page it describes passes what Discord would refuse", () => {
    for (const href of [
      WATCH,
      "https://www.netflix.com/title/1",
      "https://www.netflix.com/browse",
    ]) {
      for (const choice of [{}, { showThumbnail: false }, { privacyMode: true }]) {
        const result = detect(href, "Dark | Netflix", playing, choice);
        expect(result && checkActivity(result)).toEqual([]);
      }
    }
  });
});

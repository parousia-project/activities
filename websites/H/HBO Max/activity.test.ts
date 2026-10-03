import { describe, expect, test } from "bun:test";
import { checkActivity, matches, page } from "../../../tools/testing";
import hbo from "./activity";
import metadata from "./metadata.json";

const settings = { privacyMode: false, showTimestamps: true, showThumbnail: true };
const WATCH = "https://play.hbomax.com/video/watch/ec2e4bd4-1b8a/9a1f33c2-77d0?t=30#x";
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
const detect = (href: string, title = "", data = {}, choice = {}) =>
  hbo.detect(page(href, title, data), { ...settings, ...choice });

describe("HBO Max", () => {
  test("its settings start as the tests assume", () => {
    expect(
      Object.fromEntries(metadata.settings.map((setting) => [setting.id, setting.default])),
    ).toEqual(settings);
  });

  test("recognizes the app and the site over https only", () => {
    for (const href of [WATCH, "https://www.hbomax.com/", "https://play.hbomax.com/show/x"]) {
      expect(matches(metadata, href)).toBe(true);
    }
    for (const href of [
      "http://play.hbomax.com/",
      "https://play.hbomax.com.example.com/",
      "https://nothbomax.com/",
      "https://example.com/play.hbomax.com",
    ]) {
      expect(matches(metadata, href)).toBe(false);
    }
  });

  test("a watch page is Watching, with the clock and a link, and no title it doesn't have", () => {
    const result = detect(WATCH, "", playing);

    expect(result).toEqual({
      id: "hbo-max",
      name: "HBO Max",
      url: "https://play.hbomax.com/",
      type: "watching",
      details: "Watching HBO Max",
      assets: { largeImage: LOGO, largeText: "HBO Max" },
      buttons: [
        {
          label: "Watch on HBO Max",
          url: "https://play.hbomax.com/video/watch/ec2e4bd4-1b8a/9a1f33c2-77d0",
        },
      ],
      timestamps: { start: 1_700_000_000_000, end: 1_700_003_000_000 },
    });
    expect(result && checkActivity(result)).toEqual([]);
    expect(JSON.stringify(result)).not.toContain("t=30");
  });

  test("a title in the Media Session is shown, and a pause says so", () => {
    const result = detect(WATCH, "", {
      granted,
      media: { ...playing.media, playing: false, title: "The Last of Us", artist: "Season 1" },
    });

    expect(result).toMatchObject({ details: "The Last of Us", state: "Season 1 (paused)" });
    expect(result?.timestamps).toBeUndefined();
  });

  test("an address that isn't a watch page's isn't one", () => {
    for (const href of [
      "https://play.hbomax.com/video/watch/",
      "https://play.hbomax.com/video/watch/a b",
      "https://play.hbomax.com/video/watch/a/b/c",
      "https://www.hbomax.com/video/watch/a/b",
    ]) {
      expect(detect(href)?.details).toBe("Browsing HBO Max");
      expect(detect(href)?.type).toBeUndefined();
    }
  });

  test("the setting for the clock, the image, and privacy", () => {
    const withTitle = {
      granted,
      media: { ...playing.media, title: "The Last of Us" },
      thumbnail: "https://art.example/tlou.jpg",
    };

    expect(detect(WATCH, "", playing, { showTimestamps: false })?.timestamps).toBeUndefined();
    expect(detect(WATCH, "", withTitle)?.assets?.largeImage).toBe(withTitle.thumbnail);
    expect(detect(WATCH, "", withTitle, { showThumbnail: false })?.assets?.largeImage).toBe(LOGO);
    expect(detect(WATCH, "", withTitle, { privacyMode: true })).toEqual({
      id: "hbo-max",
      name: "HBO Max",
      url: "https://play.hbomax.com/",
      type: "watching",
      details: "Watching HBO Max",
      assets: { largeImage: LOGO, largeText: "HBO Max" },
    });
  });

  test("a show's or movie's page is named from the tab, with its picture", () => {
    const picture = "https://art.example/show.jpg";

    expect(
      detect("https://play.hbomax.com/show/abc?x=1", "The Last of Us | HBO Max", {
        granted,
        thumbnail: picture,
      }),
    ).toEqual({
      id: "hbo-max",
      name: "HBO Max",
      url: "https://play.hbomax.com/",
      details: "Looking at a series",
      state: "The Last of Us",
      assets: { largeImage: picture, largeText: "HBO Max" },
    });
    expect(detect("https://play.hbomax.com/movie/abc", "Dune - Max")?.details).toBe(
      "Looking at a movie",
    );
    expect(detect("https://play.hbomax.com/movie/abc", "Dune - Max")?.state).toBe("Dune");
    // An empty tab, or one that says something else, names nothing.
    for (const tab of ["", "HBO Max", "Max", "Loading"]) {
      expect(detect("https://play.hbomax.com/movie/abc", tab)?.state).toBeUndefined();
    }
    expect(
      detect("https://play.hbomax.com/movie/abc", "Dune | HBO Max", {}, { privacyMode: true })
        ?.state,
    ).toBeUndefined();
  });

  test("everywhere else is browsing", () => {
    for (const href of [
      "https://play.hbomax.com/",
      "https://www.hbomax.com/",
      "https://play.hbomax.com/home",
    ]) {
      expect(detect(href)?.details).toBe("Browsing HBO Max");
    }
  });

  test("a title from the Media Session is cleaned and cut", () => {
    const result = detect(WATCH, "", {
      granted,
      media: { ...playing.media, title: `Show‮${"x".repeat(300)}`, artist: "S\u0000eason" },
    });

    expect(result?.details).not.toContain("‮");
    expect(result?.details?.length).toBeLessThanOrEqual(100);
    expect(result?.state).toBe("Season");
    expect(result && checkActivity(result)).toEqual([]);
  });

  test("every page it describes passes what Discord would refuse", () => {
    for (const href of [WATCH, "https://play.hbomax.com/show/a", "https://www.hbomax.com/"]) {
      for (const choice of [{}, { showThumbnail: false }, { privacyMode: true }]) {
        const result = detect(href, "Dune | HBO Max", playing, choice);
        expect(result && checkActivity(result)).toEqual([]);
      }
    }
  });
});

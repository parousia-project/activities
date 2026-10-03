import { describe, expect, test } from "bun:test";
import { checkActivity, matches, page } from "../../../tools/testing";
import emby from "./activity";
import metadata from "./metadata.json";

const settings = { privacyMode: false, showTimestamps: true };
const APP = "https://app.emby.media/web/index.html#!/videoosd";
const granted = ["media" as const];
const watching = {
  granted,
  media: {
    title: "S1:E2 - Pilot Part Two",
    artist: "A Show",
    kind: "video" as const,
    playing: true,
    duration: 2700,
    start: 1_700_000_000_000,
    end: 1_700_002_700_000,
  },
};

describe("Emby", () => {
  test("its settings start as the tests assume, and it asks for media only", () => {
    expect(
      Object.fromEntries(metadata.settings.map((setting) => [setting.id, setting.default])),
    ).toEqual(settings);
    expect(metadata.data).toEqual(["media"]);
  });

  test("recognizes app.emby.media over https only", () => {
    expect(matches(metadata, APP)).toBe(true);
    for (const href of [
      "http://app.emby.media/",
      "https://app.emby.media.example.com/",
      "https://emby.media/",
      "https://my-server.example/web/index.html",
      "https://example.com/app.emby.media",
    ]) {
      expect(matches(metadata, href)).toBe(false);
    }
  });

  test("an episode is Watching, with the series, the clock, and no cover art", () => {
    const result = emby.detect(page(APP, "Emby", watching), settings);

    expect(result).toEqual({
      id: "emby",
      name: "Emby",
      url: "https://app.emby.media/",
      type: "watching",
      details: "S1:E2 - Pilot Part Two",
      state: "A Show",
      assets: { largeImage: metadata.icon, largeText: "Emby" },
      timestamps: { start: 1_700_000_000_000, end: 1_700_002_700_000 },
    });
    expect(result && checkActivity(result)).toEqual([]);
  });

  test("a song is Listening", () => {
    const result = emby.detect(
      page(APP, "Emby", {
        granted,
        media: { title: "Song", artist: "Artist", kind: "audio", playing: true, start: 1 },
      }),
      settings,
    );

    expect(result).toMatchObject({ type: "listening", details: "Song", state: "Artist" });
  });

  test("an element that's neither is taken as a video", () => {
    const result = emby.detect(
      page(APP, "Emby", { granted, media: { title: "Something", playing: false } }),
      settings,
    );

    expect(result).toMatchObject({ type: "watching", details: "Something", state: "Paused" });
  });

  test("paused: no clock, and it says so", () => {
    const result = emby.detect(
      page(APP, "Emby", { granted, media: { ...watching.media, playing: false } }),
      settings,
    );

    expect(result?.state).toBe("A Show (paused)");
    expect(result?.timestamps).toBeUndefined();
  });

  test("the timestamps setting disables the clock", () => {
    const result = emby.detect(page(APP, "Emby", watching), { ...settings, showTimestamps: false });

    expect(result?.timestamps).toBeUndefined();
  });

  test("privacy mode keeps the title, series, and clock off, and keeps Watching or Listening", () => {
    const hidden = { ...settings, privacyMode: true };

    expect(emby.detect(page(APP, "Emby", watching), hidden)).toEqual({
      id: "emby",
      name: "Emby",
      url: "https://app.emby.media/",
      type: "watching",
      details: "Watching on Emby",
      assets: { largeImage: metadata.icon, largeText: "Emby" },
    });
    expect(
      emby.detect(page(APP, "Emby", { granted, media: { title: "Song", kind: "audio" } }), hidden)
        ?.details,
    ).toBe("Listening on Emby");
  });

  test("no session, or no page data, is browsing", () => {
    for (const data of [
      undefined,
      { granted },
      { granted, media: { playing: false, duration: 10 } },
    ]) {
      const result = emby.detect(page(APP, "Emby", data), settings);
      expect(result?.details).toBe("Browsing Emby");
      expect(result?.type).toBeUndefined();
    }
  });

  test("titles are cleaned and cut", () => {
    const result = emby.detect(
      page(APP, "Emby", {
        granted,
        media: { title: `Movie‮${"x".repeat(300)}`, artist: "A\u0000rtist", playing: true },
      }),
      settings,
    );

    expect(result?.details).not.toContain("‮");
    expect(result?.details?.length).toBeLessThanOrEqual(100);
    expect(result?.state).toBe("Artist");
    expect(result && checkActivity(result)).toEqual([]);
  });
});

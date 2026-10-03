import { describe, expect, test } from "bun:test";
import { checkActivity, matches, page } from "../../../tools/testing";
import animex, { animeTitle } from "./activity";
import metadata from "./metadata.json";

const settings = { privacyMode: false, showTimestamps: true, showCover: true };
const WATCH = "https://animex.one/watch/dan-da-dan-season-2-185660-episode-1";
const TAB = "DAN DA DAN Season 2 Episode 1 English Sub/Dub - AnimeX";
const ANIME = "https://animex.one/anime/dan-da-dan-season-2-185660";
const ANIME_TAB = "Watch DAN DA DAN Season 2 Episodes in English Sub/Dub Online for free - AnimeX";
const LOGO = "https://animex.one/icons/ios/180.png";
const COVER = "https://img.anili.st/media/185660";
const START = 1_700_000_000_000;
const END = START + 1_440_000;
const playing = {
  granted: ["media" as const],
  media: { kind: "video" as const, playing: true, duration: 1440, start: START, end: END },
};
const detect = (href: string, title = "AnimeX", data = {}, choice = {}) =>
  animex.detect(page(href, title, data), { ...settings, ...choice });

describe("AnimeX", () => {
  test("its settings start as the tests assume", () => {
    expect(
      Object.fromEntries(metadata.settings.map((setting) => [setting.id, setting.default])),
    ).toEqual(settings);
    expect(metadata.icon).toBe("https://animex.one/favicon.ico");
    expect(metadata.data).toEqual(["media"]);
  });

  test("recognizes animex.one over https only", () => {
    for (const href of [WATCH, ANIME, "https://animex.one/"]) {
      expect(matches(metadata, href)).toBe(true);
    }
    for (const href of [
      "http://animex.one/",
      "https://animex.one.example.com/",
      "https://notanimex.one/",
      "https://plyr.animex.one/e/185660/1",
      "https://example.com/animex.one",
    ]) {
      expect(matches(metadata, href)).toBe(false);
    }
  });

  test("a watch page names the anime and episode, with its cover and a link", () => {
    const result = detect(WATCH, TAB);

    expect(result).toEqual({
      id: "animex",
      name: "AnimeX",
      url: WATCH,
      type: "watching",
      details: "DAN DA DAN Season 2",
      detailsUrl: WATCH,
      state: "Episode 1",
      assets: { largeImage: COVER, largeText: "DAN DA DAN Season 2" },
      buttons: [{ label: "Watch on AnimeX", url: WATCH }],
    });
    expect(result && checkActivity(result)).toEqual([]);
  });

  test("timestamps are the player's clock while it plays, whichever Sub/Dub or provider it is", () => {
    // The title and address are the same for Sub, Dub and every provider; only the clock differs.
    const result = detect(WATCH, TAB, playing);
    expect(result?.timestamps).toEqual({ start: START, end: END });
    expect(result && checkActivity(result)).toEqual([]);

    // Switching Sub to Dub reloads the player at the same position: a new clock, the same Activity otherwise.
    const dub = detect(WATCH, TAB, {
      media: { ...playing.media, start: START + 3000, end: END + 3000 },
    });
    expect(dub?.timestamps).toEqual({ start: START + 3000, end: END + 3000 });
    expect({ ...dub, timestamps: undefined }).toEqual({ ...result, timestamps: undefined });
  });

  test("a pause or a seek follows the player; a pause has no clock", () => {
    const paused = detect(WATCH, TAB, { media: { ...playing.media, playing: false } });
    expect(paused?.timestamps).toBeUndefined();
    expect(paused?.state).toBe("Episode 1 (paused)");

    const seeked = detect(WATCH, TAB, {
      media: { ...playing.media, start: START - 600_000, end: END - 600_000 },
    });
    expect(seeked?.timestamps).toEqual({ start: START - 600_000, end: END - 600_000 });
  });

  test("without a clock it doesn't make one up", () => {
    // Player in another origin's frame, or page data not granted.
    expect(detect(WATCH, TAB)?.timestamps).toBeUndefined();
    expect(detect(WATCH, TAB, { media: { playing: true } })?.timestamps).toBeUndefined();
    expect(
      detect(WATCH, TAB, { media: { playing: true, start: 0 + START, end: START } })?.timestamps,
    ).toBeUndefined();
    expect(detect(WATCH, TAB, { media: { playing: true, start: START } })?.timestamps).toEqual({
      start: START,
    });
    expect(detect(WATCH, TAB)?.state).toBe("Episode 1");
  });

  test("'Show timestamps' off keeps the clock out", () => {
    expect(detect(WATCH, TAB, playing, { showTimestamps: false })?.timestamps).toBeUndefined();
  });

  test("the home page's background video is not playback", () => {
    for (const href of [
      "https://animex.one/",
      "https://animex.one/home",
      ANIME,
      "https://animex.one/catalog",
    ]) {
      expect(detect(href, "AnimeX", playing)?.timestamps).toBeUndefined();
      expect(detect(href, "AnimeX", playing)?.type).toBeUndefined();
    }
  });

  test("a new episode follows the address, and a title left from the last page isn't used", () => {
    const next = "https://animex.one/watch/dan-da-dan-season-2-185660-episode-2";
    // The address changed but the tab hasn't yet: the title is still episode 1's, and the home page's before that.
    expect(detect(next, TAB)).toMatchObject({
      details: "Dan Da Dan Season 2",
      state: "Episode 2",
      url: next,
    });
    expect(
      detect(next, "Watch Anime Online for Free with English Subbed & Dubbed - AnimeX"),
    ).toMatchObject({
      details: "Dan Da Dan Season 2",
      state: "Episode 2",
    });
    expect(detect(next, "Another Show Episode 2 English Sub/Dub - AnimeX")?.details).toBe(
      "Dan Da Dan Season 2",
    );
    expect(animeTitle(TAB, "dan-da-dan-season-2", "1")).toBe("DAN DA DAN Season 2");
    expect(animeTitle(TAB, "dan-da-dan-season-2", "2")).toBe("Dan Da Dan Season 2");
    expect(animeTitle(ANIME_TAB, "dan-da-dan-season-2")).toBe("DAN DA DAN Season 2");
  });

  test("an anime's page is Looking at it, without a player", () => {
    const result = detect(ANIME, ANIME_TAB);

    expect(result).toEqual({
      id: "animex",
      name: "AnimeX",
      url: ANIME,
      details: "Looking at DAN DA DAN Season 2",
      detailsUrl: ANIME,
      assets: { largeImage: COVER, largeText: "DAN DA DAN Season 2" },
      buttons: [{ label: "View on AnimeX", url: ANIME }],
    });
    expect(result && checkActivity(result)).toEqual([]);
  });

  test("other pages say what they are", () => {
    expect(detect("https://animex.one/")?.details).toBe("Browsing AnimeX");
    expect(detect("https://animex.one/home")?.details).toBe("Browsing AnimeX");
    expect(detect("https://animex.one/catalog?search=secret")).toMatchObject({
      details: "Browsing the catalog",
      url: "https://animex.one/catalog",
    });
    expect(detect("https://animex.one/schedule")?.details).toBe("Checking the release schedule");
    expect(detect("https://animex.one/settings")?.details).toBe("Changing settings");
    expect(detect("https://animex.one/user/1234")).toMatchObject({
      details: "Viewing a profile",
      url: "https://animex.one/",
    });
    expect(detect("https://animex.one/w2g/room-secret")).toMatchObject({
      details: "In a Watch Together room",
      url: "https://animex.one/",
    });
    expect(detect("https://animex.one/faq")?.details).toBe("Browsing AnimeX");
    expect(detect("https://animex.one/watch/not-an-episode")?.details).toBe("Browsing AnimeX");
  });

  test("'Show cover' off shows the logo instead", () => {
    expect(detect(WATCH, TAB, {}, { showCover: false })?.assets).toEqual({
      largeImage: LOGO,
      largeText: "DAN DA DAN Season 2",
    });
    expect(detect(ANIME, ANIME_TAB, {}, { showCover: false })?.assets?.largeImage).toBe(LOGO);
  });

  test("privacy mode hides the anime, the episode, the cover, the clock and every link to them", () => {
    const hidden = { privacyMode: true };
    const watching = detect(WATCH, TAB, playing, hidden);

    expect(watching).toEqual({
      id: "animex",
      name: "AnimeX",
      url: "https://animex.one/",
      type: "watching",
      details: "Watching anime",
      assets: { largeImage: LOGO, largeText: "AnimeX" },
    });
    expect(JSON.stringify(watching)).not.toMatch(/dan|185660|episode/i);

    const browsing = [
      detect(ANIME, ANIME_TAB, playing, hidden),
      detect("https://animex.one/catalog", "Catalog", {}, hidden),
      detect("https://animex.one/schedule", "Schedule", {}, hidden),
    ];
    for (const result of browsing) {
      expect(result?.details).toBe("Browsing AnimeX");
      expect(result?.url).toBe("https://animex.one/");
      expect(result?.assets).toEqual({ largeImage: LOGO, largeText: "AnimeX" });
      expect(JSON.stringify(result)).not.toMatch(/dan|185660/i);
    }
  });

  test("query strings and fragments never leave the browser", () => {
    for (const href of [
      `${WATCH}?t=600&c=secret#secret`,
      `${ANIME}?token=secret#secret`,
      "https://animex.one/?code=secret",
    ]) {
      expect(JSON.stringify(detect(href, TAB, playing))).not.toContain("secret");
    }
    expect(detect(`${WATCH}?t=600`, TAB)?.url).toBe(WATCH);
  });

  test("titles are cleaned and bounded, and lookalike addresses are nothing", () => {
    const long = "x".repeat(200);
    expect(animeTitle(`Che‮ss\u0007 Episode 1 English Sub/Dub - AnimeX`, "chess", "1")).toBe(
      "Chess",
    );
    expect(animeTitle(`${long} Episode 1 English Sub/Dub - AnimeX`, long, "1")).toHaveLength(100);
    expect(detect("https://animex.one/watch/%2e%2e-1-episode-1")?.details).toBe("Browsing AnimeX");
    expect(detect("https://animex.one/watch/a-b-1-episode-1/extra")?.details).toBe(
      "Browsing AnimeX",
    );
    expect(detect("https://animex.one/anime/")?.details).toBe("Browsing AnimeX");
  });

  test("nothing it returns would be refused or cut by Discord", () => {
    for (const [href, title] of [
      [WATCH, TAB],
      [WATCH, `${"x ".repeat(200)} Episode 1 English Sub/Dub - AnimeX`],
      [ANIME, ANIME_TAB],
      ["https://animex.one/", "AnimeX"],
      ["https://animex.one/watch/x-1-episode-1", ""],
    ] as const) {
      for (const choice of [{}, { privacyMode: true }]) {
        const result = detect(href, title, playing, choice);
        expect(result && checkActivity(result)).toEqual([]);
      }
    }
  });
});

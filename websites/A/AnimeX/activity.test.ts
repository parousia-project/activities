import { describe, expect, test } from "bun:test";
import { ASSETS_URL, assetFile, checkActivity, matches, page } from "../../../tools/testing";
import animex, { animeTitle, coverOf } from "./activity";
import metadata from "./metadata.json";

const settings = {
  privacyMode: false,
  showTimestamps: true,
  showCover: true,
  showAvatars: true,
  showButtons: true,
};
const WATCH = "https://animex.one/watch/dan-da-dan-season-2-185660-episode-1";
const TAB = "DAN DA DAN Season 2 Episode 1 English Sub/Dub - AnimeX";
const ANIME = "https://animex.one/anime/dan-da-dan-season-2-185660";
const ANIME_TAB = "Watch DAN DA DAN Season 2 Episodes in English Sub/Dub Online for free - AnimeX";
const LOGO = "https://animex.one/icons/ios/180.png";
const CDN = "https://s4.anilist.co/file/anilistcdn/media/anime/cover";
const COVER = `${CDN}/large/bx185660-uB8RUMBGovGr.jpg`;
const AVATAR = "https://cdn.animex.one/assets/avatars/oshi_no_ko/2.png";
const PLAY = `${ASSETS_URL}/status/play.png`;
const PAUSE = `${ASSETS_URL}/status/pause.png`;
/** What the collector hands over on a watch page (thumbnails granted): the page's loaded images, in order. */
const images = [
  { src: "https://animex.one/misc/full-logo.png", alt: "AnimeX" },
  { src: `${CDN}/medium/bx185660-uB8RUMBGovGr.jpg`, alt: "Dandadan 2nd Season" },
  { src: COVER, alt: "DAN DA DAN Season 2 cover" },
  { src: `${CDN}/medium/bx171018-60q1B6GK2Ghb.jpg`, alt: "Dandadan" },
];
const thumbnails = { granted: ["thumbnails" as const], images };
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
    expect(metadata.data).toEqual(["media", "thumbnails"]);
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

  test("a watch page names the anime and episode, with its cover and links", () => {
    const result = detect(WATCH, TAB, thumbnails);

    expect(result).toEqual({
      id: "animex",
      name: "AnimeX",
      url: WATCH,
      type: "watching",
      statusDisplayType: "details",
      details: "DAN DA DAN Season 2",
      detailsUrl: WATCH,
      state: "Episode 1",
      assets: {
        largeImage: COVER,
        largeText: "DAN DA DAN Season 2",
        smallImage: LOGO,
        smallText: "AnimeX",
      },
      buttons: [
        { label: "Watch Episode", url: WATCH },
        { label: "View Anime", url: ANIME },
      ],
    });
    expect(result && checkActivity(result)).toEqual([]);
  });

  test("the status in the member list is the anime, when there is one", () => {
    expect(detect(WATCH, TAB)?.statusDisplayType).toBe("details");
    // A one-letter title isn't one Discord takes: the status stays the name.
    const unnamed = detect("https://animex.one/watch/x-1-episode-1", "");
    expect(unnamed?.details).toBe("Watching anime");
    expect(unnamed?.statusDisplayType).toBeUndefined();
    expect(unnamed && checkActivity(unnamed)).toEqual([]);
    // Nothing else is "watching" an anime.
    for (const href of [ANIME, "https://animex.one/", "https://animex.one/user/Abadima"]) {
      expect(detect(href, "AnimeX", thumbnails)?.statusDisplayType).toBeUndefined();
    }
    expect(detect(WATCH, TAB, {}, { privacyMode: true })?.statusDisplayType).toBeUndefined();
  });

  test("the cover is the page's AniList cover for this anime: the largest, and no other anime's", () => {
    const cover = (list: Array<{ src: string; alt?: string }>) =>
      detect(WATCH, TAB, { images: list })?.assets?.largeImage;
    expect(cover(images)).toBe(COVER);
    // Only a medium one is loaded: that's the cover.
    expect(cover([{ src: `${CDN}/medium/bx185660-uB8RUMBGovGr.jpg` }])).toBe(
      `${CDN}/medium/bx185660-uB8RUMBGovGr.jpg`,
    );
    // Older covers have no letters before the id; another anime's cover, or an id that only ends the same, isn't this one's.
    expect(cover([{ src: `${CDN}/large/185660-AKxouF9BidMD.jpg` }])).toBe(
      `${CDN}/large/185660-AKxouF9BidMD.jpg`,
    );
    for (const src of [
      `${CDN}/large/bx171018-60q1B6GK2Ghb.jpg`,
      `${CDN}/large/bx1185660-uB8RUMBGovGr.jpg`,
      `${CDN}/large/bx85660-uB8RUMBGovGr.jpg`,
      `${CDN}/large/bx185660.jpg`,
      "https://serveproxy.com/?url=https%3A%2F%2Fs4.anilist.co%2Ffile%2Fanilistcdn%2Fmedia%2Fanime%2Fcover%2Flarge%2Fbx185660-uB8RUMBGovGr.jpg",
      "https://evil.example/file/anilistcdn/media/anime/cover/large/bx185660-uB8RUMBGovGr.jpg",
      "https://img.anili.st/media/185660",
    ]) {
      expect(cover([{ src }])).toBe(LOGO);
    }
    // Thumbnails not granted, or none loaded yet: the logo, never a guess.
    expect(detect(WATCH, TAB)?.assets?.largeImage).toBe(LOGO);
    expect(cover([])).toBe(LOGO);
    expect(coverOf(undefined, "185660")).toBeUndefined();
  });

  test("the pause icon says it's paused; the play icon is only for playing with no clock to show", () => {
    const icon = (data: object, choice = {}) => detect(WATCH, TAB, data, choice)?.assets;
    const withMedia = (media: object) => ({ ...thumbnails, media: { ...playing.media, ...media } });

    // Playing with a clock: the cover and the clock say it, so no icon (the logo stays small beside the cover).
    expect(icon(withMedia({}))).toMatchObject({ smallImage: LOGO, smallText: "AnimeX" });
    expect(detect(WATCH, TAB, withMedia({}))?.timestamps).toBeDefined();
    // Playing, but no clock to show (ZEN-style: no start; or the clock is off): the play icon.
    for (const [data, choice] of [
      [withMedia({ start: undefined, end: undefined }), {}],
      [withMedia({}), { showTimestamps: false }],
    ] as const) {
      expect(icon(data, choice)).toMatchObject({ smallImage: PLAY, smallText: "Playing" });
      expect(detect(WATCH, TAB, data, choice)?.timestamps).toBeUndefined();
    }
    // Paused: the pause icon, and the state doesn't say "(paused)".
    const paused = detect(WATCH, TAB, withMedia({ playing: false }));
    expect(paused?.assets).toMatchObject({ smallImage: PAUSE, smallText: "Paused" });
    expect(paused?.state).toBe("Episode 1");
    expect(paused && checkActivity(paused)).toEqual([]);
    // No word from the player (ZEN, or page data not granted): no play or pause, the logo, not a guess.
    expect(icon(thumbnails)).toMatchObject({ smallImage: LOGO, smallText: "AnimeX" });
    expect(icon({})).toEqual({ largeImage: LOGO, largeText: "DAN DA DAN Season 2" });
    // The icons are files in assets/.
    for (const url of [PLAY, PAUSE]) expect(assetFile(url)).not.toBeNull();
  });

  test("the icons it points at exist", async () => {
    for (const url of [PLAY, PAUSE]) {
      expect(await Bun.file(assetFile(url) ?? "").exists()).toBe(true);
    }
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
    expect(paused?.state).toBe("Episode 1");

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

  test("an anime's page is Looking at it, with its cover, without a player", () => {
    const result = detect(ANIME, ANIME_TAB, thumbnails);

    expect(result).toEqual({
      id: "animex",
      name: "AnimeX",
      url: ANIME,
      details: "Looking at DAN DA DAN Season 2",
      detailsUrl: ANIME,
      assets: {
        largeImage: COVER,
        largeText: "DAN DA DAN Season 2",
        smallImage: LOGO,
        smallText: "AnimeX",
      },
      buttons: [{ label: "View Anime", url: ANIME }],
    });
    expect(result && checkActivity(result)).toEqual([]);
  });

  test("a profile shows its name, its username, and its picture", () => {
    const user = "https://animex.one/user/Abadima";
    const tab = "Abadima.exe's Profile - AnimeX";
    const own = { src: "https://cdn.animex.one/assets/avatars/naruto/1.png", alt: "Someone" };
    const pictures = [
      own, // The signed-in person's own avatar, in the navigation bar.
      { src: AVATAR, alt: "Abadima" },
      { src: "https://cdn.animex.one/assets/decorations/exoborne.webp", alt: "Frame" },
    ];
    const result = detect(user, tab, { images: pictures });

    expect(result).toEqual({
      id: "animex",
      name: "AnimeX",
      url: user,
      details: "Viewing Abadima.exe's profile",
      detailsUrl: user,
      state: "@Abadima",
      assets: {
        largeImage: AVATAR,
        largeText: "Abadima.exe",
        smallImage: LOGO,
        smallText: "AnimeX",
      },
      buttons: [{ label: "View Profile", url: user }],
    });
    expect(result && checkActivity(result)).toEqual([]);

    // The username is matched however it's cased in the address.
    expect(
      detect("https://animex.one/user/abadima", tab, { images: pictures })?.assets?.largeImage,
    ).toBe(AVATAR);
    // Only the signed-in person's avatar on the page, or it not loaded yet: the logo, never theirs.
    expect(detect(user, tab, { images: [own] })?.assets).toEqual({
      largeImage: LOGO,
      largeText: "Abadima.exe",
    });
    expect(detect(user, tab)?.assets?.largeImage).toBe(LOGO);
    // A picture from anywhere but AnimeX's avatars isn't a profile picture, whatever its alt.
    expect(
      detect(user, tab, { images: [{ src: "https://evil.example/a.png", alt: "Abadima" }] })?.assets
        ?.largeImage,
    ).toBe(LOGO);
  });

  test("a profile without the tab's title, or reached by number, still says who", () => {
    // Before the tab's title arrives: the username.
    expect(detect("https://animex.one/user/Abadima", "AnimeX")).toMatchObject({
      details: "Viewing Abadima's profile",
    });
    expect(detect("https://animex.one/user/Abadima", "AnimeX")?.state).toBeUndefined();
    // By number, the number isn't a name: the tab's, if it has arrived.
    expect(detect("https://animex.one/user/1234", "Yxxxq's Profile - AnimeX")).toMatchObject({
      details: "Viewing Yxxxq's profile",
      url: "https://animex.one/user/1234",
    });
    expect(detect("https://animex.one/user/1234", "AnimeX")?.details).toBe("Viewing a profile");
    // Not the address of a profile (no username, an odd one, more path): just that it's a profile page, linked to nothing.
    for (const href of [
      "https://animex.one/user/",
      "https://animex.one/user/a%20b",
      "https://animex.one/user/a/b",
      "https://animex.one/profile",
    ]) {
      const result = detect(href, "Someone's Profile - AnimeX");
      expect(result).toMatchObject({ details: "Viewing a profile", url: "https://animex.one/" });
      expect(result?.state).toBeUndefined();
      expect(JSON.stringify(result)).not.toMatch(/someone|a%20b|\/a\/b/i);
    }
  });

  test("'Show buttons' off leaves them out everywhere; on, each page has its own", () => {
    for (const [href, title] of [
      [WATCH, TAB],
      [ANIME, ANIME_TAB],
      ["https://animex.one/user/Abadima", "Abadima.exe's Profile - AnimeX"],
      ["https://animex.one/", "AnimeX"],
    ] as const) {
      expect(detect(href, title, thumbnails, { showButtons: false })?.buttons).toBeUndefined();
      expect(detect(href, title, thumbnails)?.buttons?.length).toBeGreaterThan(0);
    }
    expect(detect("https://animex.one/", "AnimeX")?.buttons).toEqual([
      { label: "Open AnimeX", url: "https://animex.one/" },
    ]);
    expect(detect(WATCH, TAB, thumbnails, { showButtons: false })?.timestamps).toBeUndefined();
    expect(detect(WATCH, TAB, thumbnails)?.buttons?.map((button) => button.label)).toEqual([
      "Watch Episode",
      "View Anime",
    ]);
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
    expect(detect("https://animex.one/profile")).toMatchObject({
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

  test("'Show cover' leaves the anime's cover out; profile pictures are their own setting", () => {
    const off = { showCover: false };
    expect(detect(WATCH, TAB, thumbnails, off)?.assets).toEqual({
      largeImage: LOGO,
      largeText: "DAN DA DAN Season 2",
    });
    expect(detect(ANIME, ANIME_TAB, thumbnails, off)?.assets?.largeImage).toBe(LOGO);
    const user = { images: [{ src: AVATAR, alt: "Abadima" }] };
    const profile = "https://animex.one/user/Abadima";
    // Covers off doesn't hide a profile's picture, and pictures off doesn't hide a cover.
    expect(detect(profile, "AnimeX", user, off)?.assets?.largeImage).toBe(AVATAR);
    expect(detect(profile, "AnimeX", user, { showAvatars: false })?.assets).toEqual({
      largeImage: LOGO,
      largeText: "Abadima",
    });
    expect(detect(WATCH, TAB, thumbnails, { showAvatars: false })?.assets?.largeImage).toBe(COVER);
  });

  test("privacy mode hides the anime, the episode, the cover, the clock and every link to them", () => {
    const hidden = { privacyMode: true };
    const watching = detect(WATCH, TAB, { ...thumbnails, ...playing }, hidden);

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
      detect(ANIME, ANIME_TAB, thumbnails, hidden),
      detect(
        "https://animex.one/user/Abadima",
        "Abadima.exe's Profile - AnimeX",
        { images: [{ src: AVATAR, alt: "Abadima" }] },
        hidden,
      ),
      detect("https://animex.one/catalog", "Catalog", {}, hidden),
      detect("https://animex.one/schedule", "Schedule", {}, hidden),
    ];
    for (const result of browsing) {
      expect(result?.details).toBe("Browsing AnimeX");
      expect(result?.url).toBe("https://animex.one/");
      expect(result?.assets).toEqual({ largeImage: LOGO, largeText: "AnimeX" });
      expect(JSON.stringify(result)).not.toMatch(/dan|185660|abadima|avatars/i);
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
        const result = detect(href, title, { ...thumbnails, ...playing }, choice);
        expect(result && checkActivity(result)).toEqual([]);
      }
    }
  });
});

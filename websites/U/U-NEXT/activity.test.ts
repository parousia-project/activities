import { describe, expect, test } from "bun:test";
import { checkActivity, matches, page } from "../../../tools/testing";
import unext from "./activity";
import metadata from "./metadata.json";

const settings = {
  privacyMode: false,
  showBrowsingStatus: true,
  showCover: true,
  showTimestamps: true,
};
const PLAY = "https://video.unext.jp/play/SID0007456/ED00123456?playmode=dub#x";
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
  unext.detect(page(href, title, data), { ...settings, ...choice });

describe("U-NEXT", () => {
  test("its four settings start as the tests assume", () => {
    expect(
      Object.fromEntries(metadata.settings.map((setting) => [setting.id, setting.default])),
    ).toEqual(settings);
    expect(metadata.settings.map((setting) => setting.title)).toEqual([
      "Privacy mode",
      "Show browsing status",
      "Show cover",
      "Show timestamps",
    ]);
  });

  test("recognizes video.unext.jp and unext.jp over https only", () => {
    for (const href of [
      PLAY,
      "https://video.unext.jp/",
      "https://unext.jp/",
      "https://unext.jp/x",
    ]) {
      expect(matches(metadata, href)).toBe(true);
    }
    for (const href of [
      "http://video.unext.jp/",
      "https://video.unext.jp.example.com/",
      "https://notunext.jp/",
      "https://example.com/video.unext.jp",
      "https://evil.test/unext.jp/",
    ]) {
      expect(matches(metadata, href)).toBe(false);
    }
  });

  test("a watch page is Watching, with the clock and a link, and no title it doesn't have", () => {
    const result = detect(PLAY, "", playing);

    expect(result).toEqual({
      id: "u-next",
      name: "U-NEXT",
      url: "https://video.unext.jp/",
      type: "watching",
      details: "Watching U-NEXT",
      assets: { largeImage: LOGO, largeText: "U-NEXT" },
      buttons: [
        { label: "Watch on U-NEXT", url: "https://video.unext.jp/play/SID0007456/ED00123456" },
      ],
      timestamps: { start: 1_700_000_000_000, end: 1_700_003_000_000 },
    });
    expect(result && checkActivity(result)).toEqual([]);
    expect(JSON.stringify(result)).not.toContain("playmode");
  });

  test("a live stream is Watching too", () => {
    const result = detect("https://video.unext.jp/live/LIV0001234?x=1", "", playing);

    expect(result).toMatchObject({
      type: "watching",
      details: "Watching a live stream",
      buttons: [{ url: "https://video.unext.jp/live/LIV0001234" }],
    });
  });

  test("a title in the Media Session is shown, and a pause says so", () => {
    const result = detect(PLAY, "", {
      granted,
      media: { ...playing.media, playing: false, title: "進撃の巨人", artist: "第1話" },
    });

    expect(result).toMatchObject({ details: "進撃の巨人", state: "第1話 (paused)" });
    expect(result?.timestamps).toBeUndefined();
  });

  test("an address that isn't a watch page's isn't one", () => {
    for (const href of [
      "https://video.unext.jp/play/SID0007456",
      "https://video.unext.jp/play/SID0007456/bad id",
      "https://video.unext.jp/play/%0A/x",
      "https://video.unext.jp/live/",
    ]) {
      expect(detect(href)?.type).toBeUndefined();
    }
  });

  test("the setting for the clock, the cover, and privacy", () => {
    const withTitle = {
      granted,
      media: { ...playing.media, title: "Title" },
      thumbnail: "https://imgc.nxtv.jp/img/info/title/SID0007456.jpg",
    };

    expect(detect(PLAY, "", playing, { showTimestamps: false })?.timestamps).toBeUndefined();
    expect(detect(PLAY, "", withTitle)?.assets?.largeImage).toBe(withTitle.thumbnail);
    expect(detect(PLAY, "", withTitle, { showCover: false })?.assets?.largeImage).toBe(LOGO);
    expect(detect(PLAY, "", withTitle, { privacyMode: true })).toEqual({
      id: "u-next",
      name: "U-NEXT",
      url: "https://video.unext.jp/",
      type: "watching",
      details: "Watching U-NEXT",
      assets: { largeImage: LOGO, largeText: "U-NEXT" },
    });
  });

  test("the site's own share picture is no cover", () => {
    const result = detect(PLAY, "", {
      granted,
      media: playing.media,
      thumbnail: "https://video.unext.jp/resources/_next/static/media/ogp.75e95f86.png",
    });

    expect(result?.assets?.largeImage).toBe(LOGO);
  });

  test("a title's page is named from the tab, with its picture, also as a card over the browsing pages", () => {
    const picture = "https://imgc.nxtv.jp/img/info/title/SID0007456.jpg";
    const expected = {
      id: "u-next",
      name: "U-NEXT",
      url: "https://video.unext.jp/",
      details: "Looking at a title",
      state: "進撃の巨人",
      assets: { largeImage: picture, largeText: "U-NEXT" },
      buttons: [{ label: "View on U-NEXT", url: "https://video.unext.jp/title/SID0007456" }],
    };

    expect(
      detect("https://video.unext.jp/title/SID0007456?x=1", "進撃の巨人 | U-NEXT", {
        granted,
        thumbnail: picture,
      }),
    ).toEqual(expected);
    expect(
      detect("https://video.unext.jp/?td=SID0007456", "進撃の巨人｜U-NEXT（ユーネクスト）", {
        granted,
        thumbnail: picture,
      }),
    ).toEqual(expected);
  });

  test("the site's own title, or another kind of tab, names nothing", () => {
    for (const tab of [
      "U-NEXT（ユーネクスト）-映画 / ドラマ / アニメから、マンガや雑誌といった電子書籍まで-│31日間無料トライアル",
      "U-NEXT | U-NEXT",
      "",
      "Loading",
    ]) {
      expect(detect("https://video.unext.jp/title/SID0007456", tab)?.state).toBeUndefined();
    }
  });

  test("a live stream's page is a live stream's", () => {
    const result = detect("https://video.unext.jp/livedetail/LIV0001234", "Live name | U-NEXT");

    expect(result).toMatchObject({
      details: "Looking at a live stream",
      state: "Live name",
      buttons: [{ label: "Watch on U-NEXT", url: "https://video.unext.jp/livedetail/LIV0001234" }],
    });
    expect(detect("https://video.unext.jp/?lc=LIV0001234")?.details).toBe(
      "Looking at a live stream",
    );
  });

  test("browsing shows only that, and nothing when its setting is off or privacy mode is on", () => {
    for (const href of [
      "https://video.unext.jp/",
      "https://unext.jp/",
      "https://video.unext.jp/browse/genre/movie",
    ]) {
      expect(detect(href)).toMatchObject({ details: "Browsing U-NEXT" });
      expect(detect(href)?.type).toBeUndefined();
      expect(detect(href, "", {}, { showBrowsingStatus: false })).toBeNull();
      expect(detect(href, "", {}, { privacyMode: true })).toBeNull();
    }
    // A title's page is browsing too.
    const title = "https://video.unext.jp/title/SID0007456";
    expect(detect(title, "A | U-NEXT", {}, { showBrowsingStatus: false })).toBeNull();
    expect(detect(title, "A | U-NEXT", {}, { privacyMode: true })).toBeNull();
    // Watching isn't browsing.
    expect(detect(PLAY, "", playing, { showBrowsingStatus: false })?.type).toBe("watching");
  });

  test("an id that isn't one is no title", () => {
    for (const href of [
      "https://video.unext.jp/title/bad id",
      "https://video.unext.jp/?td=" + "A".repeat(40),
      "https://video.unext.jp/?lc=%0A",
    ]) {
      expect(detect(href)?.details).toBe("Browsing U-NEXT");
    }
  });

  test("a title from the Media Session is cleaned and cut", () => {
    const result = detect(PLAY, "", {
      granted,
      media: { ...playing.media, title: `題名‮${"x".repeat(300)}`, artist: "第\u00001話" },
    });

    expect(result?.details).not.toContain("‮");
    expect(result?.details?.length).toBeLessThanOrEqual(100);
    expect(result?.state).toBe("第1話");
    expect(result && checkActivity(result)).toEqual([]);
  });

  test("every page it describes passes what Discord would refuse", () => {
    for (const href of [PLAY, "https://video.unext.jp/title/SID1", "https://video.unext.jp/"]) {
      for (const choice of [{}, { showCover: false }, { privacyMode: true }]) {
        const result = detect(href, "Name | U-NEXT", playing, choice);
        expect(result === null || checkActivity(result).length === 0).toBe(true);
      }
    }
  });
});

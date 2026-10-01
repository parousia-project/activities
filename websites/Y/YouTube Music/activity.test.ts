import { describe, expect, test } from "bun:test";
import { checkActivity, matches, page } from "../../../tools/testing";
import music from "./activity";
import metadata from "./metadata.json";

const settings = {
  privacyMode: false,
  showCover: true,
  showTimestamps: true,
  showButtons: true,
};

const WATCH = "https://music.youtube.com/watch?v=dQw4w9WgXcQ&list=RDdQw4w9WgXcQ&si=secret";

const granted = ["media", "thumbnails"] as const;

describe("YouTube Music", () => {
  test("its settings start as the tests assume", () => {
    expect(
      Object.fromEntries(metadata.settings.map((setting) => [setting.id, setting.default])),
    ).toEqual(settings);
  });

  test("recognizes music.youtube.com over https only", () => {
    expect(matches(metadata, "https://music.youtube.com/watch?v=dQw4w9WgXcQ")).toBe(true);

    for (const href of [
      "http://music.youtube.com/",
      "https://www.youtube.com/",
      "https://music.youtube.com.example.com/",
      "https://example.com/music.youtube.com",
    ]) {
      expect(matches(metadata, href)).toBe(false);
    }
  });

  test("a playing song comes from the Media Session, with its clock, artwork, and buttons", () => {
    const result = music.detect(
      page(WATCH, "Never Gonna Give You Up", {
        granted: [...granted],
        media: {
          title: "Never Gonna Give You Up",
          artist: "Rick Astley",
          album: "Whenever You Need Somebody",
          playing: true,
          duration: 213,
          start: 1_700_000_000_000,
          end: 1_700_000_213_000,
        },
        thumbnail: "https://lh3.googleusercontent.com/cover=w512-h512",
      }),
      settings,
    );

    expect(result).toEqual({
      id: "youtube-music",
      name: "YouTube Music",
      url: "https://music.youtube.com/",
      details: "Never Gonna Give You Up",
      state: "Rick Astley",
      assets: {
        largeImage: "https://lh3.googleusercontent.com/cover=w512-h512",
        largeText: "Whenever You Need Somebody",
      },
      timestamps: {
        start: 1_700_000_000_000,
        end: 1_700_000_213_000,
      },
      buttons: [
        {
          label: "Listen Along",
          url: "https://music.youtube.com/watch?v=dQw4w9WgXcQ",
        },
      ],
    });

    expect(checkActivity(result ?? music.detect(page(WATCH), settings)!)).toEqual([]);

    // Nothing from the query string but the video.
    expect(JSON.stringify(result)).not.toContain("secret");
  });

  test("paused: no clock, and it says so", () => {
    const result = music.detect(
      page(WATCH, "Song", {
        granted: ["media"],
        media: {
          title: "Song",
          artist: "Artist",
          playing: false,
          duration: 100,
        },
      }),
      settings,
    );

    expect(result?.state).toBe("Artist (paused)");
    expect(result?.timestamps).toBeUndefined();
  });

  test("the song still shows when someone browses on from it", () => {
    const result = music.detect(
      page("https://music.youtube.com/explore", "Explore - YouTube Music", {
        granted: ["media"],
        media: {
          title: "Song",
          artist: "Artist",
          playing: true,
          start: 1_700_000_000_000,
        },
      }),
      settings,
    );

    expect(result?.details).toBe("Song");
    expect(result?.detailsUrl).toBeUndefined();
    expect(result?.buttons).toBeUndefined();
  });

  test("the settings turn off the cover and buttons", () => {
    const data = {
      granted: [...granted],
      media: {
        title: "Song",
        artist: "Artist",
        playing: true,
      },
      thumbnail: "https://img.example/a.jpg",
    };

    const result = music.detect(page(WATCH, "Song", data), {
      privacyMode: false,
      showCover: false,
      showTimestamps: true,
      showButtons: false,
    });

    expect(result?.assets).toBeUndefined();
    expect(result?.buttons).toBeUndefined();
    expect(result?.timestamps).toBeUndefined();
  });

  test("the timestamps setting disables the clock", () => {
    const result = music.detect(
      page(WATCH, "Song", {
        granted: [...granted],
        media: {
          title: "Song",
          artist: "Artist",
          playing: true,
          start: 1_700_000_000_000,
          end: 1_700_000_100_000,
        },
      }),
      {
        ...settings,
        showTimestamps: false,
      },
    );

    expect(result?.timestamps).toBeUndefined();
  });

  test("privacy mode hides song details, artwork, timestamps, and buttons", () => {
    const result = music.detect(
      page(WATCH, "Never Gonna Give You Up", {
        granted: [...granted],
        media: {
          title: "Never Gonna Give You Up",
          artist: "Rick Astley",
          album: "Whenever You Need Somebody",
          playing: true,
          start: 1_700_000_000_000,
          end: 1_700_000_213_000,
        },
        thumbnail: "https://lh3.googleusercontent.com/cover=w512-h512",
      }),
      {
        ...settings,
        privacyMode: true,
      },
    );

    expect(result).toEqual({
      id: "youtube-music",
      name: "YouTube Music",
      url: "https://music.youtube.com/",
      details: "Listening to YouTube Music",
    });
  });

  test("privacy mode also applies when paused", () => {
    const result = music.detect(
      page(WATCH, "Song", {
        granted: ["media"],
        media: {
          title: "Song",
          artist: "Artist",
          playing: false,
        },
      }),
      {
        ...settings,
        privacyMode: true,
      },
    );

    expect(result?.details).toBe("Listening to YouTube Music");
    expect(result?.state).toBeUndefined();
    expect(result?.assets).toBeUndefined();
    expect(result?.timestamps).toBeUndefined();
    expect(result?.buttons).toBeUndefined();
  });

  test("without page data, a watch page's title is the song", () => {
    expect(music.detect(page(WATCH, "Never Gonna Give You Up - YouTube Music"), settings)).toEqual({
      id: "youtube-music",
      name: "YouTube Music",
      url: "https://music.youtube.com/",
      details: "Never Gonna Give You Up",
      buttons: [
        {
          label: "Listen Along",
          url: "https://music.youtube.com/watch?v=dQw4w9WgXcQ",
        },
      ],
    });

    // Before the page has a title of its own, or at a lookalike address,
    // there's no song.
    expect(music.detect(page(WATCH, "YouTube Music"), settings)?.details).toBe(
      "Browsing YouTube Music",
    );

    expect(
      music.detect(page("https://music.youtube.com/watch?v=x", "Song"), settings)?.details,
    ).toBe("Browsing YouTube Music");
  });

  test("other pages say where someone is", () => {
    const at = (path: string) =>
      music.detect(page(`https://music.youtube.com${path}`, "YouTube Music"), settings)?.details;

    expect(at("/")).toBe("Browsing home");
    expect(at("/explore")).toBe("Browsing Explore");
    expect(at("/library/songs")).toBe("Browsing the library");
    expect(at("/search?q=private")).toBe("Searching YouTube Music");
    expect(at("/playlist?list=PL1")).toBe("Browsing a playlist");
    expect(at("/channel/UC1")).toBe("Browsing an artist");
    expect(at("/somewhere-new")).toBe("Browsing YouTube Music");
  });

  test("titles and artists are cleaned and cut", () => {
    const result = music.detect(
      page(WATCH, "", {
        granted: ["media"],
        media: {
          title: `Song‮${"x".repeat(300)}`,
          artist: "A\u0000rtist",
          playing: true,
        },
      }),
      settings,
    );

    expect(result?.details).not.toContain("‮");
    expect(result?.details?.length).toBeLessThanOrEqual(100);
    expect(result?.state).toBe("Artist");
    expect(checkActivity(result ?? music.detect(page(WATCH), settings)!)).toEqual([]);
  });
});

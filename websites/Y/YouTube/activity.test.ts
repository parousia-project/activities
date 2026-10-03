import { describe, expect, test } from "bun:test";
import { checkActivity, matches, page } from "../../../tools/testing";
import youtube from "./activity";
import metadata from "./metadata.json";

const settings = {
  privacyMode: false,
  showTimestamps: true,
  showThumbnail: true,
  showSearchActivity: true,
};

const WATCH = "https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=RDdQw4w9WgXcQ&si=secret";
const THUMBNAIL_URL = "https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg";
const LOGO_URL = "https://www.youtube.com/img/favicon_144.png";

const granted = ["media", "thumbnails"] as const;

const playing = {
  granted: [...granted],
  media: {
    title: "Never Gonna Give You Up",
    artist: "Rick Astley",
    playing: true,
    duration: 213,
    start: 1_700_000_000_000,
    end: 1_700_000_213_000,
  },
  thumbnail: THUMBNAIL_URL,
};

describe("YouTube", () => {
  test("its settings start as the tests assume", () => {
    expect(
      Object.fromEntries(metadata.settings.map((setting) => [setting.id, setting.default])),
    ).toEqual(settings);
  });

  test("its image setting is one switch, with no choices", () => {
    const image = metadata.settings.find((setting) => setting.id === "showThumbnail");
    expect(image).toMatchObject({ title: "Show video thumbnail", type: "boolean", default: true });
    expect(image).not.toHaveProperty("choices");
    expect(metadata.settings.map((setting) => setting.id)).not.toContain("image");
  });

  test("recognizes YouTube over https only", () => {
    expect(matches(metadata, "https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe(true);
    expect(matches(metadata, "https://m.youtube.com/watch?v=dQw4w9WgXcQ")).toBe(true);

    for (const href of [
      "http://www.youtube.com/",
      "http://m.youtube.com/",
      "https://music.youtube.com/",
      "https://www.youtube.com.example.com/",
      "https://example.com/www.youtube.com",
    ]) {
      expect(matches(metadata, href)).toBe(false);
    }
  });

  test("a playing video comes from the Media Session, with its clock, thumbnail, and button", () => {
    const result = youtube.detect(page(WATCH, "Never Gonna Give You Up", playing), settings);

    expect(result).toEqual({
      id: "youtube",
      name: "YouTube",
      url: "https://www.youtube.com/",
      details: "Never Gonna Give You Up",
      state: "Rick Astley",
      type: "watching",
      assets: { largeImage: THUMBNAIL_URL },
      timestamps: {
        start: 1_700_000_000_000,
        end: 1_700_000_213_000,
      },
      buttons: [
        {
          label: "Watch on YouTube",
          url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        },
      ],
    });

    expect(result && checkActivity(result)).toEqual([]);
    // The playlist and the share token stay in the browser.
    expect(JSON.stringify(result)).not.toContain("secret");
    expect(JSON.stringify(result)).not.toContain("RDdQw");
  });

  test("on m.youtube.com the link goes to the desktop site's watch page", () => {
    const result = youtube.detect(
      page("https://m.youtube.com/watch?v=dQw4w9WgXcQ&t=30", "Video - YouTube"),
      settings,
    );

    expect(result?.buttons?.[0]?.url).toBe("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  });

  test("paused: no clock, and it says so", () => {
    const result = youtube.detect(
      page(WATCH, "Video", {
        granted: ["media"],
        media: {
          title: "Video",
          artist: "Channel",
          playing: false,
          duration: 100,
          start: 1_700_000_000_000,
        },
      }),
      settings,
    );

    expect(result?.state).toBe("Channel (paused)");
    expect(result?.timestamps).toBeUndefined();
  });

  test("paused with no channel says only that", () => {
    const result = youtube.detect(
      page(WATCH, "Video", { granted: ["media"], media: { title: "Video", playing: false } }),
      settings,
    );

    expect(result?.state).toBe("Paused");
  });

  test("the video still shows when someone browses away from the watch page", () => {
    const result = youtube.detect(
      page("https://www.youtube.com/feed/subscriptions", "Subscriptions - YouTube", {
        granted: ["media"],
        media: {
          title: "Video",
          artist: "Channel",
          playing: true,
          start: 1_700_000_000_000,
        },
      }),
      settings,
    );

    expect(result?.details).toBe("Video");
    expect(result?.buttons).toBeUndefined();
  });

  test("the thumbnail is on by default, and turning it off shows the logo", () => {
    const largeImage = (showThumbnail: boolean, data = playing) =>
      youtube.detect(page(WATCH, "Video", data), { ...settings, showThumbnail })?.assets
        ?.largeImage;

    expect(largeImage(true)).toBe(THUMBNAIL_URL);
    expect(largeImage(false)).toBe(LOGO_URL);
  });

  test("the logo needs no page data, and the thumbnail is left out where there is none", () => {
    const titled = { granted: ["media" as const], media: { title: "Video" } };

    expect(
      youtube.detect(page(WATCH, "Video", titled), { ...settings, showThumbnail: false })?.assets,
    ).toEqual({ largeImage: LOGO_URL });
    expect(youtube.detect(page(WATCH, "Video", titled), settings)?.assets).toBeUndefined();
    expect(youtube.detect(page(WATCH, "Video - YouTube"), settings)?.assets).toBeUndefined();
  });

  test("a setting that isn't false is the default, the thumbnail", () => {
    for (const showThumbnail of [0, 1, "no", null]) {
      expect(
        youtube.detect(page(WATCH, "Video", playing), { ...settings, showThumbnail } as never)
          ?.assets,
      ).toEqual({ largeImage: THUMBNAIL_URL });
    }
  });

  test("a video is Watching; browsing is not", () => {
    expect(youtube.detect(page(WATCH, "Video", playing), settings)?.type).toBe("watching");
    expect(youtube.detect(page(WATCH, "Video - YouTube"), settings)?.type).toBe("watching");
    expect(
      youtube.detect(page(WATCH, "Video", playing), { ...settings, privacyMode: true })?.type,
    ).toBe("watching");
    expect(youtube.detect(page("https://www.youtube.com/", "YouTube"), settings)?.type).toBe(
      undefined,
    );
  });

  test("the timestamps setting disables the clock", () => {
    const result = youtube.detect(page(WATCH, "Video", playing), {
      ...settings,
      showTimestamps: false,
    });

    expect(result?.timestamps).toBeUndefined();
  });

  test("privacy mode hides video details, artwork, timestamps, and buttons", () => {
    const result = youtube.detect(page(WATCH, "Never Gonna Give You Up", playing), {
      ...settings,
      privacyMode: true,
    });

    expect(result).toEqual({
      id: "youtube",
      name: "YouTube",
      url: "https://www.youtube.com/",
      details: "Watching YouTube",
      type: "watching",
    });
  });

  test("privacy mode also applies when paused, and with the thumbnail off", () => {
    const result = youtube.detect(
      page(WATCH, "Video", {
        granted: ["media"],
        media: {
          title: "Video",
          artist: "Channel",
          playing: false,
        },
      }),
      {
        ...settings,
        showThumbnail: false,
        privacyMode: true,
      },
    );

    expect(result?.details).toBe("Watching YouTube");
    expect(result?.state).toBeUndefined();
    expect(result?.assets).toBeUndefined();
    expect(result?.timestamps).toBeUndefined();
    expect(result?.buttons).toBeUndefined();
  });

  test("without page data, a watch page's title is the video", () => {
    expect(youtube.detect(page(WATCH, "Never Gonna Give You Up - YouTube"), settings)).toEqual({
      id: "youtube",
      name: "YouTube",
      url: "https://www.youtube.com/",
      details: "Never Gonna Give You Up",
      type: "watching",
      buttons: [
        {
          label: "Watch on YouTube",
          url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        },
      ],
    });

    expect(youtube.detect(page(WATCH, "YouTube"), settings)?.details).toBe("Browsing YouTube");
  });

  test("the notification count in front of the title isn't part of the video's", () => {
    expect(youtube.detect(page(WATCH, "(3) Video title - YouTube"), settings)?.details).toBe(
      "Video title",
    );
    // A video that really is named like that keeps its name when the Media Session has it.
    expect(
      youtube.detect(
        page(WATCH, "(3) Video title - YouTube", {
          granted: ["media"],
          media: { title: "(3) Video title" },
        }),
        settings,
      )?.details,
    ).toBe("(3) Video title");
  });

  test("a video id that isn't one gives no link and no video from the title", () => {
    for (const href of [
      "https://www.youtube.com/watch?v=short",
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ%0Aextra",
      "https://www.youtube.com/watch",
      "https://www.youtube.com/embed/dQw4w9WgXcQ",
    ]) {
      const result = youtube.detect(page(href, "Video - YouTube"), settings);
      expect(result?.details).toBe("Browsing YouTube");
      expect(result?.buttons).toBeUndefined();
    }
  });

  test("search activity can be disabled", () => {
    const result = youtube.detect(
      page("https://www.youtube.com/results?search_query=secret+query", "secret query - YouTube"),
      {
        ...settings,
        showSearchActivity: false,
      },
    );

    expect(result?.details).toBe("Browsing YouTube");
  });

  test("search activity is shown when enabled, without what was searched for", () => {
    const result = youtube.detect(
      page("https://www.youtube.com/results?search_query=secret+query", "secret query - YouTube"),
      settings,
    );

    expect(result?.details).toBe("Searching YouTube");
    expect(JSON.stringify(result)).not.toContain("secret");
  });

  test("other pages say where someone is", () => {
    const at = (path: string) =>
      youtube.detect(page(`https://www.youtube.com${path}`, "YouTube"), settings)?.details;

    expect(at("/")).toBe("Browsing YouTube");
    expect(at("/feed/subscriptions")).toBe("Browsing your YouTube feed");
    expect(at("/shorts")).toBe("Browsing YouTube Shorts");
    expect(at("/playlist?list=PL1")).toBe("Browsing a playlist");
    expect(at("/channel/UC1")).toBe("Browsing a channel");
    expect(at("/@RickAstleyYT")).toBe("Browsing a channel");
    expect(at("/@RickAstleyYT/videos")).toBe("Browsing a channel");
    expect(at("/c/RickAstley")).toBe("Browsing a channel");
    expect(at("/user/RickAstley")).toBe("Browsing a channel");
    expect(at("/gaming")).toBe("Browsing YouTube Gaming");
    expect(at("/live")).toBe("Browsing YouTube Live");
    expect(at("/somewhere-new")).toBe("Browsing YouTube");
  });

  test("titles and artists are cleaned and cut", () => {
    const result = youtube.detect(
      page(WATCH, "", {
        granted: ["media"],
        media: {
          title: `Video‮${"x".repeat(300)}`,
          artist: "C\u0000hannel",
          playing: true,
        },
      }),
      settings,
    );

    expect(result?.details).not.toContain("‮");
    expect(result?.details?.length).toBeLessThanOrEqual(100);
    expect(result?.state).toBe("Channel");
    expect(result && checkActivity(result)).toEqual([]);
  });

  test("every page it describes passes what Discord would refuse", () => {
    for (const [href, data] of [
      [WATCH, playing],
      ["https://www.youtube.com/", undefined],
      ["https://www.youtube.com/results?search_query=a", undefined],
    ] as const) {
      for (const choice of [{}, { showThumbnail: false }, { privacyMode: true }]) {
        const result = youtube.detect(page(href, "Video - YouTube", data), {
          ...settings,
          ...choice,
        });
        expect(result && checkActivity(result)).toEqual([]);
      }
    }
  });
});

import type { Activity, NativeActivity, Page, Settings } from "parousia";

/**
 * YouTube (www.youtube.com, m.youtube.com). What's playing comes from the
 * page's Media Session, which Parousia reads for any site that declares
 * `media` (title, channel as the artist, whether it's playing, and the clock
 * as timestamps), and its thumbnail from `thumbnails`. Where those aren't
 * granted or the page sets no session, it falls back to the address and the
 * tab's title: on a watch page the title is the video's.
 *
 * It reads nothing from YouTube's markup, so a redesign can't break it. Its
 * image is the video's thumbnail, or YouTube's logo when that's turned off.
 */

const ORIGIN = "https://www.youtube.com";
const NAME = "YouTube";
/** A PNG: Discord shows these, and the .ico a favicon request returns it may not. */
const LOGO = `${ORIGIN}/img/favicon_144.png`;
/** Images this repository hosts (assets/), served by GitHub. */
const ASSETS = "https://raw.githubusercontent.com/parousia-project/activities/main/assets";
const PLAY = `${ASSETS}/status/play.png`;
const PAUSE = `${ASSETS}/status/pause.png`;
const MAX_TEXT = 100;
const VIDEO_ID = /^[\w-]{11}$/;

/** Titles and channel names are written by whoever uploads the video: no control or direction-override characters, and a length cap. */
function clean(value: string | undefined): string | undefined {
  const text = value
    ?.replace(/[\p{Cc}​-‏‪-‮�]/gu, "")
    .replace(/\s+/g, " ")
    .trim();

  return text && text.length >= 2 ? [...text].slice(0, MAX_TEXT).join("") : undefined;
}

/** A watch page's tab is titled "<video> - YouTube", with "(3) " in front while there are notifications, or just "YouTube" before it loads. */
function videoFromTitle(title: string): string | undefined {
  const video = clean(title.replace(/^\(\d+\)\s+/, "").replace(/\s+-\s+YouTube\s*$/i, ""));

  return video && video !== NAME ? video : undefined;
}

/** Where someone is when nothing is playing. The search itself is never shown, only that there is one. */
function browsing(pathname: string, search: URLSearchParams, settings: Settings): string {
  const [section = ""] = pathname.split("/").filter(Boolean);

  if (section.startsWith("@")) return "Browsing a channel";

  switch (section) {
    case "results":
      return search.has("search_query") && settings.showSearchActivity !== false
        ? "Searching YouTube"
        : "Browsing YouTube";
    case "feed":
      return "Browsing your YouTube feed";
    case "shorts":
      return "Browsing YouTube Shorts";
    case "playlist":
      return "Browsing a playlist";
    case "channel":
    case "c":
    case "user":
      return "Browsing a channel";
    case "gaming":
      return "Browsing YouTube Gaming";
    case "live":
      return "Browsing YouTube Live";
    default:
      return "Browsing YouTube";
  }
}

/** The logo when the thumbnail is turned off; otherwise the thumbnail, if there is one (not granted, or the page has none). */
function image(thumbnail: string | undefined, settings: Settings): string | undefined {
  return settings.showThumbnail === false ? LOGO : thumbnail;
}

function detect({ url, title, media, thumbnail }: Page, settings: Settings): Activity {
  const base: Activity = {
    id: "youtube",
    name: NAME,
    url: `${ORIGIN}/`,
  };

  const videoId = url.pathname === "/watch" ? url.searchParams.get("v") : null;

  const watch = videoId !== null && VIDEO_ID.test(videoId) ? `${ORIGIN}/watch?v=${videoId}` : null;

  // The session outlives the page it started on: the video still shows when
  // someone browses on.
  const video = clean(media?.title) ?? (watch ? videoFromTitle(title) : undefined);

  if (!video) {
    return {
      ...base,
      details: browsing(url.pathname, url.searchParams, settings),
    };
  }

  if (settings.privacyMode === true) {
    return { ...base, details: "Watching YouTube", type: "watching" };
  }

  const channel = clean(media?.artist);
  const paused = media?.playing === false;

  const activity: Activity = {
    ...base,
    details: video,
    type: "watching",
  };

  const clock =
    settings.showTimestamps === true && media?.playing === true && media.start !== undefined;
  const largeImage = image(thumbnail, settings);
  // The pause icon says it's paused. The play icon is for a playing video with no clock to show
  // (the page gave none, or it's off); with a clock, that says it. Nothing where the page said nothing.
  const status = paused
    ? { smallImage: PAUSE, smallText: "Paused" }
    : media?.playing === true && !clock
      ? { smallImage: PLAY, smallText: "Playing" }
      : undefined;

  if (largeImage !== undefined || status) {
    // A small image needs a large one beside it.
    activity.assets = { largeImage: largeImage ?? LOGO, ...status };
  }

  if (channel !== undefined) {
    activity.state = channel;
  }

  if (clock && media.start !== undefined) {
    activity.timestamps = {
      start: media.start,
      ...(media.end !== undefined && { end: media.end }),
    };
  }

  if (watch) {
    activity.buttons = [
      {
        label: "Watch on YouTube",
        url: watch,
      },
    ];
  }

  return activity;
}

const activity: NativeActivity = { detect };

export default activity;

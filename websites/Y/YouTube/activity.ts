import type { Activity, NativeActivity, Page, Settings } from "parousia";
import metadata from "./metadata.json";

/**
 * What's playing comes from the Media Session, falling back to the address and
 * the tab's title. Nothing is read from YouTube's markup, so a redesign can't
 * break it.
 */

const ORIGIN = "https://www.youtube.com";
const NAME = "YouTube";

const ASSETS = "https://raw.githubusercontent.com/parousia-project/activities/main/assets";
const PLAY = `${ASSETS}/status/play.png`;
const PAUSE = `${ASSETS}/status/pause.png`;
const MAX_TEXT = 100;
const VIDEO_ID = /^[\w-]{11}$/;

function clean(value: string | undefined): string | undefined {
  const text = value
    ?.replace(/[\p{Cc}​-‏‪-‮�]/gu, "")
    .replace(/\s+/g, " ")
    .trim();

  return text && text.length >= 2 ? [...text].slice(0, MAX_TEXT).join("") : undefined;
}

function videoFromTitle(title: string): string | undefined {
  const video = clean(title.replace(/^\(\d+\)\s+/, "").replace(/\s+-\s+YouTube\s*$/i, ""));

  return video && video !== NAME ? video : undefined;
}

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

function image(thumbnail: string | undefined, settings: Settings): string | undefined {
  return settings.showThumbnail === false ? metadata.icon : thumbnail;
}

function detect({ url, title, media, thumbnail }: Page, settings: Settings): Activity {
  const base: Activity = {
    id: "youtube",
    name: NAME,
    url: `${ORIGIN}/`,
  };

  const videoId = url.pathname === "/watch" ? url.searchParams.get("v") : null;

  const watch = videoId !== null && VIDEO_ID.test(videoId) ? `${ORIGIN}/watch?v=${videoId}` : null;

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

  const status = paused
    ? { smallImage: PAUSE, smallText: "Paused" }
    : media?.playing === true && !clock
      ? { smallImage: PLAY, smallText: "Playing" }
      : undefined;

  if (largeImage !== undefined || status) {
    activity.assets = { largeImage: largeImage ?? metadata.icon, ...status };
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

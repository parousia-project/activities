import type { Activity, NativeActivity, Page, Settings } from "parousia";
import metadata from "./metadata.json";

/**
 * Built on the Media Session, not the player bar's markup, which breaks when
 * YouTube Music changes it. A song's id is only in a watch page's address, so
 * the title links to the song there and not once someone has browsed on.
 */

const ORIGIN = "https://music.youtube.com";
const NAME = "YouTube Music";

const ASSETS = "https://raw.githubusercontent.com/parousia-project/activities/main/assets";
const PLAY = `${ASSETS}/status/play.png`;
const PAUSE = `${ASSETS}/status/pause.png`;
const MAX_TEXT = 100;
const VIDEO_ID = /^[\w-]{11}$/;

function clean(value: string | undefined): string | undefined {
  const text = value
    ?.replace(/[\p{Cc}\u200b-\u200f\u202a-\u202e\ufffd]/gu, "")
    .replace(/\s+/g, " ")
    .trim();

  return text && text.length >= 2 ? [...text].slice(0, MAX_TEXT).join("") : undefined;
}

function songFromTitle(title: string): string | undefined {
  const song = clean(title.replace(/\s+-\s+YouTube Music\s*$/i, ""));

  return song && song !== NAME ? song : undefined;
}

function browsing(pathname: string): string {
  const [section] = pathname.split("/").filter(Boolean);

  switch (section) {
    case undefined:
      return "Browsing home";
    case "explore":
      return "Browsing Explore";
    case "library":
      return "Browsing the library";
    case "search":
      return "Searching YouTube Music";
    case "playlist":
    case "browse":
      return "Browsing a playlist";
    case "channel":
      return "Browsing an artist";
    default:
      return "Browsing YouTube Music";
  }
}

function detect({ url, title, media, thumbnail }: Page, settings: Settings): Activity {
  const base: Activity = {
    id: "youtube-music",
    name: NAME,
    url: `${ORIGIN}/`,
  };

  const videoId = url.pathname === "/watch" ? url.searchParams.get("v") : null;

  const watch = videoId !== null && VIDEO_ID.test(videoId) ? `${ORIGIN}/watch?v=${videoId}` : null;

  const song = clean(media?.title) ?? (watch ? songFromTitle(title) : undefined);

  if (!song) {
    return {
      ...base,
      details: browsing(url.pathname),
    };
  }

  const artist = clean(media?.artist);
  const paused = media?.playing === false;
  const privacyMode = settings.privacyMode === true;

  const activity: Activity = {
    ...base,
    details: privacyMode ? "Listening to YouTube Music" : song,
    type: "listening",
    ...(!privacyMode && { statusDisplayType: "details" as const }),
  };

  if (!privacyMode && artist !== undefined) {
    activity.state = artist;
  }

  const clock =
    !privacyMode &&
    settings.showTimestamps === true &&
    media?.playing === true &&
    media.start !== undefined;

  const album = clean(media?.album);

  const cover =
    !privacyMode && settings.showCover === true && thumbnail !== undefined && media?.title
      ? thumbnail
      : undefined;

  const status = privacyMode
    ? undefined
    : paused
      ? { smallImage: PAUSE, smallText: "Paused" }
      : media?.playing === true && !clock
        ? { smallImage: PLAY, smallText: "Playing" }
        : undefined;

  if (cover !== undefined || status) {
    activity.assets = {
      largeImage: cover ?? metadata.icon,
      ...(cover !== undefined && album && { largeText: album }),
      ...status,
    };
  }

  if (clock && media.start !== undefined) {
    activity.timestamps = {
      start: media.start,
      ...(media.end !== undefined && { end: media.end }),
    };
  }

  if (watch && !privacyMode) {
    activity.detailsUrl = watch;
  }

  return activity;
}

const activity: NativeActivity = { detect };

export default activity;

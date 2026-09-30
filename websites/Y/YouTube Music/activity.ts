import type { Activity, NativeActivity, Page, Settings } from "parousia";

/**
 * YouTube Music (music.youtube.com). What's playing comes from the page's
 * Media Session, which Parousia reads for any site that declares `media`
 * (title, artist, album, whether it's playing, and the clock as timestamps),
 * and its artwork from `thumbnails`. Where those aren't granted or the page
 * sets no session, it falls back to the address and the tab's title: a song's
 * title is the tab's on a watch page, and the rest says where someone is.
 *
 * Written for Parousia against the Media Session API, not from PreMiD's
 * YouTube Music Activity, which reads the player bar's markup instead and
 * stops working when YouTube Music changes it.
 */

const ORIGIN = "https://music.youtube.com";
const NAME = "YouTube Music";
const MAX_TEXT = 100;
const VIDEO_ID = /^[\w-]{11}$/;

/** Titles and artists are written by whoever uploads the song: no control or direction-override characters, and a length cap. */
function clean(value: string | undefined): string | undefined {
  const text = value
    ?.replace(/[\p{Cc}\u200b-\u200f\u202a-\u202e\ufffd]/gu, "")
    .replace(/\s+/g, " ")
    .trim();

  return text && text.length >= 2 ? [...text].slice(0, MAX_TEXT).join("") : undefined;
}

/** A watch page's tab is titled with the song, or just "YouTube Music" before it loads. */
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

  // The session outlives the page it started on: the song still shows when
  // someone browses on.
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
  };

  if (!privacyMode) {
    const state = artist ? (paused ? `${artist} (paused)` : artist) : paused ? "Paused" : undefined;

    if (state !== undefined) {
      activity.state = state;
    }
  }

  const album = clean(media?.album);

  if (!privacyMode && settings.showCover === true && thumbnail !== undefined && media?.title) {
    activity.assets = {
      largeImage: thumbnail,
      ...(album && { largeText: album }),
    };
  }

  if (
    !privacyMode &&
    settings.showTimestamps === true &&
    media?.playing &&
    media.start !== undefined
  ) {
    activity.timestamps = {
      start: media.start,
      ...(media.end !== undefined && { end: media.end }),
    };
  }

  if (watch && !privacyMode && settings.showButtons === true) {
    activity.buttons = [
      {
        label: "Listen Along",
        url: watch,
      },
    ];
  }

  return activity;
}

const activity: NativeActivity = { detect };

export default activity;

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
/** A PNG: Discord shows these, and the .ico a favicon request returns it may not. */
const LOGO = `${ORIGIN}/img/favicon_144.png`;
/** Images this repository hosts (assets/), served by GitHub. */
const ASSETS = "https://raw.githubusercontent.com/parousia-project/activities/main/assets";
const PLAY = `${ASSETS}/status/play.png`;
const PAUSE = `${ASSETS}/status/pause.png`;
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
  // The pause icon says it's paused. The play icon is for a song playing with no clock to show
  // (the page gave none, or it's off); with a clock, that says it. Nothing where the page said nothing.
  const status = privacyMode
    ? undefined
    : paused
      ? { smallImage: PAUSE, smallText: "Paused" }
      : media?.playing === true && !clock
        ? { smallImage: PLAY, smallText: "Playing" }
        : undefined;

  if (cover !== undefined || status) {
    // A small image needs a large one beside it.
    activity.assets = {
      largeImage: cover ?? LOGO,
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

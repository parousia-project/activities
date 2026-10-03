import type { Activity, NativeActivity, Page, Settings } from "parousia";

/**
 * Emby's web app (app.emby.media). Its player publishes what's playing to the
 * page's Media Session (title, the series or artist, the album), which
 * Parousia reads for any site that declares `media`, along with the playing
 * element's clock and whether it's a video or an audio. Nothing is read from
 * Emby's markup, and nothing from your server: no cover art, since its
 * address is your own server's, which Discord can't reach and which doesn't
 * belong on your profile. When Emby clears its session (playback stopped),
 * this shows that you're browsing.
 *
 * Servers opened at their own address (anything but app.emby.media) aren't
 * covered: an Activity can only name particular sites.
 *
 * Written for Parousia against the Media Session API; it isn't derived from
 * PreMiD's Emby Activity, which reads Emby's page variables and API client.
 */

const NAME = "Emby";
const ICON = "https://app.emby.media/images/icon-192x192.png";
const MAX_TEXT = 100;

/** Titles are your library's, and can be anything: no control or direction-override characters, and a length cap. */
function clean(value: string | undefined): string | undefined {
  const text = value
    ?.replace(/[\p{Cc}​-‏‪-‮⁦-⁩﻿]/gu, "")
    .replace(/\s+/g, " ")
    .trim();

  return text && text.length >= 2 ? [...text].slice(0, MAX_TEXT).join("") : undefined;
}

function detect({ media }: Page, settings: Settings): Activity {
  const base: Activity = {
    id: "emby",
    name: NAME,
    url: "https://app.emby.media/",
    assets: { largeImage: ICON, largeText: NAME },
  };

  const title = clean(media?.title);

  // Emby clears its session when playback stops.
  if (!title) return { ...base, details: "Browsing Emby" };

  const listening = media?.kind === "audio";
  const type = listening ? "listening" : "watching";

  if (settings.privacyMode === true) {
    return { ...base, type, details: listening ? "Listening on Emby" : "Watching on Emby" };
  }

  const activity: Activity = { ...base, type, details: title };
  const by = clean(media?.artist);
  const paused = media?.playing === false;
  const state = by ? (paused ? `${by} (paused)` : by) : paused ? "Paused" : undefined;

  if (state !== undefined) activity.state = state;

  if (settings.showTimestamps !== false && media?.playing && media.start !== undefined) {
    activity.timestamps = {
      start: media.start,
      ...(media.end !== undefined && { end: media.end }),
    };
  }

  return activity;
}

const activity: NativeActivity = { detect };

export default activity;

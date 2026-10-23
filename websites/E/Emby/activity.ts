import type { Activity, NativeActivity, Page, Settings } from "parousia";
import metadata from "./metadata.json";

/**
 * Reads the Media Session the player publishes, never Emby's markup. No cover
 * art: its address is your own server's, which Discord can't reach and which
 * doesn't belong on your profile. Servers at their own address aren't covered,
 * as an Activity can only name particular sites.
 */

const NAME = "Emby";
const MAX_TEXT = 100;

const ASSETS = "https://raw.githubusercontent.com/parousia-project/activities/main/assets";
const PLAY = `${ASSETS}/status/play.png`;
const PAUSE = `${ASSETS}/status/pause.png`;

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
    assets: { largeImage: metadata.icon, largeText: NAME },
  };

  const title = clean(media?.title);

  if (!title) return { ...base, details: "Browsing Emby" };

  const listening = media?.kind === "audio";
  const type = listening ? "listening" : "watching";

  if (settings.privacyMode === true) {
    return { ...base, type, details: listening ? "Listening on Emby" : "Watching on Emby" };
  }

  const by = clean(media?.artist);
  const clock =
    settings.showTimestamps !== false && media?.playing === true && media.start !== undefined;

  const status =
    media?.playing === false
      ? { smallImage: PAUSE, smallText: "Paused" }
      : media?.playing === true && !clock
        ? { smallImage: PLAY, smallText: "Playing" }
        : undefined;
  const activity: Activity = {
    ...base,
    type,
    details: title,
    ...(status && { assets: { ...base.assets, ...status } }),
  };

  if (by !== undefined) activity.state = by;

  if (clock) {
    activity.timestamps = {
      start: media.start,
      ...(media.end !== undefined && { end: media.end }),
    };
  }

  return activity;
}

const activity: NativeActivity = { detect };

export default activity;

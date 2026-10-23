import type { Activity, NativeActivity, Page, Settings } from "parousia";
import metadata from "./metadata.json";

/**
 * The app leaves the tab's title empty until it has loaded something, so a
 * watch page shows that someone is watching and how far along, with a title
 * only if the Media Session has one. Nothing is read from HBO Max's markup or
 * API.
 */

const ORIGIN = "https://play.hbomax.com";
const NAME = "HBO Max";
const MAX_TEXT = 100;

const ASSETS = "https://raw.githubusercontent.com/parousia-project/activities/main/assets";
const PLAY = `${ASSETS}/status/play.png`;
const PAUSE = `${ASSETS}/status/pause.png`;

const WATCH_PATH = /^\/video\/watch\/[\w:.-]{1,64}(?:\/[\w:.-]{1,64})?$/;
const TITLE_SUFFIX = /\s+[|\-–]\s+(?:HBO\s+)?Max\s*$/i;

function clean(value: string | undefined): string | undefined {
  const text = value
    ?.replace(/[\p{Cc}​-‏‪-‮⁦-⁩﻿]/gu, "")
    .replace(/\s+/g, " ")
    .trim();

  return text && text.length >= 2 ? [...text].slice(0, MAX_TEXT).join("") : undefined;
}

function titleFromTab(tab: string): string | undefined {
  if (!TITLE_SUFFIX.test(tab)) return undefined;
  const title = clean(tab.replace(TITLE_SUFFIX, "").replace(/^Watch\s+/i, ""));

  return title !== NAME && title !== "Max" ? title : undefined;
}

function detect({ url, title, media, thumbnail }: Page, settings: Settings): Activity {
  const [section] = url.pathname.split("/").filter(Boolean);
  const hidden = settings.privacyMode === true;

  const base: Activity = { id: "hbo-max", name: NAME, url: `${ORIGIN}/` };
  const picture = (shown: string | undefined): Activity["assets"] => ({
    largeImage: (!hidden && settings.showThumbnail !== false ? shown : undefined) ?? metadata.icon,
    largeText: NAME,
  });

  if (url.hostname === "play.hbomax.com" && WATCH_PATH.test(url.pathname)) {
    const watched = hidden ? undefined : clean(media?.title);
    const clock =
      !hidden &&
      settings.showTimestamps !== false &&
      media?.playing === true &&
      media.start !== undefined;

    const status = hidden
      ? undefined
      : media?.playing === false
        ? { smallImage: PAUSE, smallText: "Paused" }
        : media?.playing === true && !clock
          ? { smallImage: PLAY, smallText: "Playing" }
          : undefined;
    const activity: Activity = {
      ...base,
      type: "watching",
      details: watched ?? "Watching HBO Max",
      assets: { ...picture(thumbnail), ...status },
    };

    if (!hidden) {
      const state = clean(media?.artist);
      if (state !== undefined) activity.state = state;
      activity.buttons = [{ label: "Watch on HBO Max", url: `${ORIGIN}${url.pathname}` }];
    }
    if (clock) {
      activity.timestamps = {
        start: media.start,
        ...(media.end !== undefined && { end: media.end }),
      };
    }

    return activity;
  }

  if (url.hostname === "play.hbomax.com" && (section === "show" || section === "movie")) {
    const named = hidden ? undefined : titleFromTab(title);

    return {
      ...base,
      details: section === "show" ? "Looking at a series" : "Looking at a movie",
      ...(named && { state: named }),
      assets: picture(thumbnail),
    };
  }

  return { ...base, details: "Browsing HBO Max" };
}

const activity: NativeActivity = { detect };

export default activity;

import type { Activity, NativeActivity, Page, Settings } from "parousia";
import metadata from "./metadata.json";

/**
 * A watch page shows that someone is watching and how far along, with a title
 * only if the Media Session has one. Nothing is read from U-NEXT's markup or
 * GraphQL API. Browsing shows nothing in privacy mode.
 */

const ORIGIN = "https://video.unext.jp";
const NAME = "U-NEXT";
const MAX_TEXT = 100;

const ASSETS = "https://raw.githubusercontent.com/parousia-project/activities/main/assets";
const PLAY = `${ASSETS}/status/play.png`;
const PAUSE = `${ASSETS}/status/pause.png`;

const ID = /^[A-Za-z0-9]{1,32}$/;
const TITLE_SUFFIX = /\s*[|｜]\s*U-NEXT(?:[（(][^)）]*[)）])?\s*$/i;

function clean(value: string | undefined): string | undefined {
  const text = value
    ?.replace(/[\p{Cc}​-‏‪-‮⁦-⁩﻿]/gu, "")
    .replace(/\s+/g, " ")
    .trim();

  return text && text.length >= 2 ? [...text].slice(0, MAX_TEXT).join("") : undefined;
}

function titleFromTab(tab: string): string | undefined {
  if (!TITLE_SUFFIX.test(tab)) return undefined;
  const title = clean(tab.replace(TITLE_SUFFIX, ""));

  return title && !title.startsWith(NAME) ? title : undefined;
}

const isSitePicture = (image: string): boolean => /\/static\/media\/ogp\./.test(image);

function detect({ url, title, media, thumbnail }: Page, settings: Settings): Activity | null {
  const [section, first, second] = url.pathname.split("/").filter(Boolean);
  const hidden = settings.privacyMode === true;
  const base: Activity = { id: "u-next", name: NAME, url: `${ORIGIN}/` };
  const picture = (shown: string | undefined): Activity["assets"] => ({
    largeImage:
      (!hidden && settings.showCover !== false && shown && !isSitePicture(shown)
        ? shown
        : undefined) ?? metadata.icon,
    largeText: NAME,
  });

  const playing =
    section === "play" && first !== undefined && second !== undefined
      ? { page: `/play/${first}/${second}`, ok: ID.test(first) && ID.test(second), live: false }
      : section === "live" && first !== undefined
        ? { page: `/live/${first}`, ok: ID.test(first), live: true }
        : null;

  if (playing?.ok) {
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
      details: watched ?? (playing.live ? "Watching a live stream" : "Watching U-NEXT"),
      assets: { ...picture(thumbnail), ...status },
    };

    if (!hidden) {
      const state = clean(media?.artist);
      if (state !== undefined) activity.state = state;
      activity.buttons = [{ label: "Watch on U-NEXT", url: `${ORIGIN}${playing.page}` }];
    }
    if (clock) {
      activity.timestamps = {
        start: media.start,
        ...(media.end !== undefined && { end: media.end }),
      };
    }

    return activity;
  }

  if (hidden || settings.showBrowsingStatus === false) return null;

  const titleId = section === "title" ? first : url.searchParams.get("td");
  const liveId = section === "livedetail" ? first : url.searchParams.get("lc");
  const isTitle = titleId !== null && titleId !== undefined && ID.test(titleId);
  const isLive = liveId !== null && liveId !== undefined && ID.test(liveId);

  if (isTitle || isLive) {
    const named = titleFromTab(title);
    const link = isTitle ? `${ORIGIN}/title/${titleId}` : `${ORIGIN}/livedetail/${liveId}`;

    return {
      ...base,
      details: isTitle ? "Looking at a title" : "Looking at a live stream",
      ...(named && { state: named }),
      assets: picture(thumbnail),
      buttons: [{ label: isTitle ? "View on U-NEXT" : "Watch on U-NEXT", url: link }],
    };
  }

  return { ...base, details: "Browsing U-NEXT", assets: picture(undefined) };
}

const activity: NativeActivity = { detect };

export default activity;

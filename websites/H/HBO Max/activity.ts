import type { Activity, NativeActivity, Page, Settings } from "parousia";

/**
 * HBO Max (play.hbomax.com, and the sign-up site www.hbomax.com). The app is a
 * single-page site that leaves the tab's title empty until it has loaded
 * something, so a watch page (`/video/watch/…`) shows that someone is
 * watching and how far along they are (the playing video's clock, which
 * Parousia reads for any site that declares `media`), and the title only if
 * the page's Media Session has one. A show's or movie's own page is named
 * from the tab's title ("Name | HBO Max") and its picture, when the page
 * gives them. Nothing is read from HBO Max's markup, and its page API, which
 * PreMiD's Activity calls for titles, is never called.
 *
 * Written for Parousia; it isn't derived from PreMiD's HBO Max Activity.
 */

const ORIGIN = "https://play.hbomax.com";
const NAME = "HBO Max";
const ICON = "https://www.hbomax.com/apple-touch-icon.png";
const MAX_TEXT = 100;
/** The ids in a watch page's address. */
const WATCH_PATH = /^\/video\/watch\/[\w:.-]{1,64}(?:\/[\w:.-]{1,64})?$/;
const TITLE_SUFFIX = /\s+[|\-–]\s+(?:HBO\s+)?Max\s*$/i;

/** Titles are HBO Max's, but a Media Session is a page's to fill: no control or direction-override characters, and a length cap. */
function clean(value: string | undefined): string | undefined {
  const text = value
    ?.replace(/[\p{Cc}​-‏‪-‮⁦-⁩﻿]/gu, "")
    .replace(/\s+/g, " ")
    .trim();

  return text && text.length >= 2 ? [...text].slice(0, MAX_TEXT).join("") : undefined;
}

/** "The Last of Us | HBO Max" is "The Last of Us"; a tab that's empty, or doesn't end like that, is nothing. */
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
    largeImage: (!hidden && settings.showThumbnail !== false ? shown : undefined) ?? ICON,
    largeText: NAME,
  });

  if (url.hostname === "play.hbomax.com" && WATCH_PATH.test(url.pathname)) {
    const watched = hidden ? undefined : clean(media?.title);
    const paused = media?.playing === false;
    const activity: Activity = {
      ...base,
      type: "watching",
      details: watched ?? "Watching HBO Max",
      assets: picture(thumbnail),
    };

    if (!hidden) {
      const state = clean(media?.artist);
      const shown = state ? (paused ? `${state} (paused)` : state) : paused ? "Paused" : undefined;
      if (shown !== undefined) activity.state = shown;
      activity.buttons = [{ label: "Watch on HBO Max", url: `${ORIGIN}${url.pathname}` }];
    }
    if (
      !hidden &&
      settings.showTimestamps !== false &&
      media?.playing &&
      media.start !== undefined
    ) {
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

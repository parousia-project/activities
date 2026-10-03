import type { Activity, NativeActivity, Page, Settings } from "parousia";

/**
 * Netflix (www.netflix.com). Netflix's player publishes no title to the page
 * and sets the tab's title to just "Netflix" while it plays, so a watch page
 * shows that someone is watching and how far along they are (the playing
 * video's clock, which Parousia reads for any site that declares `media`),
 * and the title only if the page's Media Session has one. A title's own page
 * (`/title/<id>`) is named from the tab's title ("Name | Netflix") and its
 * picture. Nothing is read from Netflix's markup, and Netflix's private API,
 * which PreMiD's Activity calls for titles, is never called.
 *
 * Written for Parousia; it isn't derived from PreMiD's Netflix Activity.
 */

const ORIGIN = "https://www.netflix.com";
const NAME = "Netflix";
const ICON = "https://assets.nflxext.com/us/ffe/siteui/common/icons/nficon2016.png";
const MAX_TEXT = 100;
/** Country paths like /ca/ or /us-fr/ come before the section. */
const LOCALE = /^[a-z]{2}(?:-[a-z]{2})?$/;
const ID = /^\d{1,12}$/;
const TITLE_SUFFIX = /\s+[|\-–]\s+Netflix(?:\s+Official Site)?\s*$/i;

/** Titles are Netflix's, but a Media Session is a page's to fill: no control or direction-override characters, and a length cap. */
function clean(value: string | undefined): string | undefined {
  const text = value
    ?.replace(/[\p{Cc}​-‏‪-‮⁦-⁩﻿]/gu, "")
    .replace(/\s+/g, " ")
    .trim();

  return text && text.length >= 2 ? [...text].slice(0, MAX_TEXT).join("") : undefined;
}

/** "Watch Dark | Netflix Official Site" and "Dark | Netflix" are "Dark"; a tab that's just "Netflix", or doesn't end like that, is nothing. */
function titleFromTab(tab: string): string | undefined {
  if (!TITLE_SUFFIX.test(tab)) return undefined;
  const title = clean(tab.replace(TITLE_SUFFIX, "").replace(/^Watch\s+/i, ""));

  return title !== NAME ? title : undefined;
}

function browsing(pathname: string): string {
  if (pathname.includes("/my-list")) return "Browsing My List";
  if (pathname.includes("/latest")) return "Browsing New & Popular";
  if (pathname.includes("/games")) return "Browsing games";
  if (pathname.includes("/search")) return "Searching Netflix";

  return "Browsing Netflix";
}

function detect({ url, title, media, thumbnail }: Page, settings: Settings): Activity {
  const path = url.pathname.split("/").filter(Boolean);
  if (LOCALE.test(path[0] ?? "")) path.shift();
  const [section, id] = path;
  const hidden = settings.privacyMode === true;

  const base: Activity = { id: "netflix", name: NAME, url: `${ORIGIN}/` };
  const picture = (shown: string | undefined): Activity["assets"] => ({
    largeImage: (!hidden && settings.showThumbnail !== false ? shown : undefined) ?? ICON,
    largeText: NAME,
  });

  if (section === "watch" && id !== undefined && ID.test(id)) {
    const watched = hidden ? undefined : clean(media?.title);
    const paused = media?.playing === false;
    const activity: Activity = {
      ...base,
      type: "watching",
      details: watched ?? "Watching Netflix",
      assets: picture(thumbnail),
    };

    if (!hidden) {
      const state = clean(media?.artist);
      const shown = state ? (paused ? `${state} (paused)` : state) : paused ? "Paused" : undefined;
      if (shown !== undefined) activity.state = shown;
      activity.buttons = [{ label: "Watch on Netflix", url: `${ORIGIN}/watch/${id}` }];
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

  if (section === "title" && id !== undefined && ID.test(id)) {
    const named = hidden ? undefined : titleFromTab(title);

    return {
      ...base,
      details: "Looking at a title",
      ...(named && { state: named }),
      assets: picture(thumbnail),
      ...(!hidden && { buttons: [{ label: "View on Netflix", url: `${ORIGIN}/title/${id}` }] }),
    };
  }

  return { ...base, details: hidden ? "Browsing Netflix" : browsing(url.pathname) };
}

const activity: NativeActivity = { detect };

export default activity;

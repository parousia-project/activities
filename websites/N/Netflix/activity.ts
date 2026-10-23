import type { Activity, NativeActivity, Page, Settings } from "parousia";
import metadata from "./metadata.json";

/**
 * A watch page's tab is just "Netflix", its Media Session is empty and it has
 * no og:image: the show's name and artwork exist only in the player's markup,
 * which this API doesn't read. So playback shows that someone is watching, how
 * far along and whether it is paused, with a title only if the page ever
 * publishes one, and the picture is always Netflix's own. A title's own page
 * is named from the tab ("Name | Netflix"). Nothing is read from Netflix's
 * markup or private API.
 */

const ORIGIN = "https://www.netflix.com";
const NAME = "Netflix";

const ASSETS = "https://raw.githubusercontent.com/parousia-project/activities/main/assets";
const PLAY = `${ASSETS}/status/play.png`;
const PAUSE = `${ASSETS}/status/pause.png`;
const MAX_TEXT = 100;

const LOCALE = /^[a-z]{2}(?:-[a-z]{2})?$/;
const ID = /^\d{1,12}$/;
const TITLE_SUFFIX = /\s+[|\-–]\s+Netflix(?:\s+Official Site)?\s*$/i;

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

  return title !== NAME ? title : undefined;
}

const SECTIONS = new Map([
  ["search", "Searching Netflix"],
  ["my-list", "Browsing My List"],
  ["latest", "Browsing New & Popular"],
  ["games", "Browsing games"],
  ["genre", "Browsing a genre"],
  ["youraccount", "Managing account"],
  ["manageprofiles", "Choosing a profile"],
  ["profilesgate", "Choosing a profile"],
]);

function browsing(path: readonly string[]): string {
  const [first = "", second = ""] = path.map((segment) => segment.toLowerCase());

  return SECTIONS.get(first === "browse" ? second : first) ?? "Browsing Netflix";
}

function detect({ url, title, media }: Page, settings: Settings): Activity {
  const path = url.pathname.split("/").filter(Boolean);
  if (LOCALE.test(path[0] ?? "")) path.shift();
  const [section, id] = path;
  const hidden = settings.privacyMode === true;

  const base: Activity = { id: "netflix", name: NAME, url: `${ORIGIN}/` };
  const picture = { largeImage: metadata.icon, largeText: NAME };

  if (section === "watch" && id !== undefined && ID.test(id)) {
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
      details: watched ?? "Watching Netflix",
      assets: { ...picture, ...status },
    };

    if (!hidden) {
      const state = clean(media?.artist) ?? (media?.playing === false ? "Paused" : undefined);
      if (state !== undefined) activity.state = state;
      activity.buttons = [{ label: "Watch on Netflix", url: `${ORIGIN}/watch/${id}` }];
    }
    if (clock) {
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
      assets: picture,
      ...(!hidden && { buttons: [{ label: "View on Netflix", url: `${ORIGIN}/title/${id}` }] }),
    };
  }

  return { ...base, details: hidden ? "Browsing Netflix" : browsing(path) };
}

const activity: NativeActivity = { detect };

export default activity;

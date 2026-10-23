import type { Activity, NativeActivity, Page, Settings } from "parousia";
import metadata from "./metadata.json";

/**
 * What you read is yours to share, so a headline shows only with "Show
 * headlines" on. A game is public and always named.
 */

const ORIGIN = "https://www.nytimes.com";
const NAME = "The New York Times";

const ASSETS = "https://raw.githubusercontent.com/parousia-project/activities/main/assets";
const GAMEPAD = `${ASSETS}/status/gamepad.png`;
const MAX_HEADLINE_CHARS = 100;
const SLUG = /^[a-z][a-z0-9-]{0,40}$/;
const TITLE_SUFFIX = /\s+[-–|]\s+The New York Times\s*$/i;

function headline(title: string): string | null {
  const cleaned = title
    .replace(TITLE_SUFFIX, "")
    .replace(/[\p{Cc}​-‏‪-‮⁦-⁩﻿]/gu, "")
    .trim();
  if (cleaned.length < 2 || /^(the )?new york times$/i.test(cleaned)) return null;
  return [...cleaned].slice(0, MAX_HEADLINE_CHARS).join("");
}

function titleCase(slug: string | undefined): string | null {
  if (!slug || !SLUG.test(slug)) return null;
  return slug
    .split("-")
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(" ");
}

const isYear = (value: string | undefined): boolean => /^(19|20)\d\d$/.test(value ?? "");

function detect({ url, title }: Page, settings: Settings): Activity {
  const [first, second, third, fourth] = url.pathname.split("/").filter(Boolean);
  const base: Activity = {
    id: "the-new-york-times",
    name: NAME,
    url: `${ORIGIN}/`,
    assets: { largeImage: metadata.icon, largeText: NAME },
    buttons: [{ label: "Open The New York Times", url: `${ORIGIN}/` }],
  };

  if (first === "games" || first === "crosswords") {
    const game = first === "games" ? titleCase(second) : "Crossword";
    const page = game && first === "games" ? `${ORIGIN}/games/${second}` : `${ORIGIN}/${first}`;
    return {
      ...base,
      url: page,
      assets: { ...base.assets, smallImage: GAMEPAD, smallText: "Games" },
      details: game ? `Playing ${game}` : "Browsing the games",
      state: "New York Times Games",
      buttons: [{ label: game ? `Play ${game}` : "Play the games", url: page }],
    };
  }
  if (isYear(first) && second && third && /^\d\d$/.test(second) && /^\d\d$/.test(third)) {
    const section = titleCase(fourth);
    const activity: Activity = { ...base, details: "Reading an article" };
    if (section) activity.state = section;
    if (settings.showHeadlines === true) {
      const text = headline(title);
      if (text) activity.details = `Reading ${text}`.slice(0, 128);
    }
    return activity;
  }
  const section = titleCase(first);
  if (section && second === undefined) {
    return { ...base, url: `${ORIGIN}/${first}`, details: `Browsing ${section}` };
  }
  return { ...base, details: "Browsing the news" };
}

const activity: NativeActivity = { detect };
export default activity;

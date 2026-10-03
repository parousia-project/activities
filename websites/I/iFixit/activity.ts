import type { Activity, NativeActivity, Page, Settings } from "parousia";

/**
 * iFixit (www.ifixit.com and its language sites). It reads the page's address
 * and the tab's title, which iFixit sets on the server for every page, and,
 * where `thumbnails` is granted, the page's own picture (the guide's or
 * device's). It never reads iFixit's markup or calls its API, so a redesign
 * can't break it and nothing here depends on which step of a guide is on
 * screen.
 *
 * Written for Parousia from the site's own pages; it isn't derived from
 * PreMiD's iFixit Activity, which reads the API and the page's markup.
 */

const NAME = "iFixit";
const ICON = "https://assets.cdn.ifixit.com/static/icons/ifixit/apple-touch-icon-180x180.png";
const MAX_TEXT = 100;
const MAX_BUTTON_URL = 512;
/** iFixit's own language paths, like /en-us/, come before the section. */
const LOCALE = /^[a-z]{2}-[a-z]{2}$/;

/** Titles are written by whoever contributes the guide or question: no control or direction-override characters, and a length cap. */
function clean(value: string | undefined): string | undefined {
  const text = value
    ?.replace(/[\p{Cc}​-‏‪-‮⁦-⁩﻿]/gu, "")
    .replace(/\s+/g, " ")
    .trim();

  return text && text.length >= 2 ? [...text].slice(0, MAX_TEXT).join("") : undefined;
}

/** "iPhone 14 Battery Replacement - iFixit Repair Guide" is "iPhone 14 Battery Replacement"; "SOLVED: " in front of a question's title is dropped too. */
function subject(title: string): string | undefined {
  const text = clean(
    title
      .replace(/\s+[-–|]\s+iFixit(?:\s+Repair Guide)?\s*$/i, "")
      .replace(/^(?:SOLVED|UNSOLVED):\s+/i, ""),
  );

  // Before the page has loaded, the tab is just "iFixit".
  return text !== NAME ? text : undefined;
}

/** A path segment as words: "iPhone_14" and "Won%27t+Turn+On" are "iPhone 14" and "Won't Turn On". */
function words(segment: string | undefined): string | undefined {
  if (!segment) return undefined;
  try {
    return clean(decodeURIComponent(segment).replace(/[_+]/g, " "));
  } catch {
    return undefined;
  }
}

interface Described {
  /** What kind of page, as a line that names no one's guide or question. */
  details: string;
  /** Which guide, question, or device. */
  state?: string;
  /** The page's picture says something about it (a guide's, a device's). */
  picture?: boolean;
  /** A button to this page. */
  button?: string;
}

function describe(path: string[], title: string): Described {
  const [section, second, third] = path;

  switch (section) {
    case undefined:
      return { details: "Browsing iFixit" };
    case "Guide":
      return third
        ? {
            details: "Following a repair guide",
            state: subject(title),
            picture: true,
            button: "View Guide",
          }
        : { details: "Browsing repair guides" };
    case "Teardown":
      return third
        ? {
            details: "Reading a teardown",
            state: subject(title),
            picture: true,
            button: "View Teardown",
          }
        : { details: "Browsing teardowns" };
    case "Device":
      return second
        ? {
            details: "Looking at a device",
            state: words(second),
            picture: true,
            button: "View Device",
          }
        : { details: "Browsing devices" };
    case "Troubleshooting":
      return third
        ? { details: "Troubleshooting a device", state: words(second), button: "View Page" }
        : { details: "Browsing troubleshooting guides" };
    case "Answers":
      return second === "View" && path[3]
        ? {
            details: "Reading a question",
            state: subject(title),
            picture: true,
            button: "View Question",
          }
        : { details: "Browsing the forums" };
    case "Wiki":
      return second === "Edit"
        ? { details: "Editing a wiki article" }
        : { details: "Reading a wiki article", state: words(second) };
    case "Search":
      // What was searched for is never shown.
      return { details: "Searching iFixit" };
    case "Store":
    case "products":
    case "Parts":
    case "Tools":
      return { details: "Browsing the iFixit store" };
    case "News":
      return { details: "Reading the iFixit blog" };
    case "User":
      return { details: "Viewing a profile" };
    case "Team":
      return { details: "Viewing a team" };
    default:
      return { details: "Browsing iFixit" };
  }
}

function detect({ url, title, thumbnail }: Page, settings: Settings): Activity {
  const path = url.pathname.split("/").filter(Boolean);
  if (LOCALE.test(path[0] ?? "")) path.shift();

  const origin = url.origin;
  const base: Activity = {
    id: "ifixit",
    name: NAME,
    url: `${origin}/`,
    assets: { largeImage: ICON, largeText: NAME },
  };
  const page = describe(path, title);
  const activity: Activity = { ...base, details: page.details };

  if (settings.privacyMode === true) return activity;

  if (page.state) activity.state = page.state;
  if (page.picture && thumbnail !== undefined && settings.showThumbnail !== false) {
    activity.assets = { largeImage: thumbnail, largeText: NAME };
  }
  // Rebuilt from the path: the query string and fragment stay in the browser.
  const link = `${origin}${url.pathname}`;
  if (page.button && link.length <= MAX_BUTTON_URL) {
    activity.buttons = [{ label: page.button, url: link }];
  }

  return activity;
}

const activity: NativeActivity = { detect };

export default activity;

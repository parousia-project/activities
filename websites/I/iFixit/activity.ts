import type { Activity, NativeActivity, Page, Settings } from "parousia";
import metadata from "./metadata.json";

/**
 * Reads the address, the tab's title (iFixit sets it on the server for every
 * page), and the page's picture where `thumbnails` is granted. Never its
 * markup or API, so a redesign can't break it.
 */

const NAME = "iFixit";
const MAX_TEXT = 100;
const MAX_BUTTON_URL = 512;

const LOCALE = /^[a-z]{2}-[a-z]{2}$/;

function clean(value: string | undefined): string | undefined {
  const text = value
    ?.replace(/[\p{Cc}​-‏‪-‮⁦-⁩﻿]/gu, "")
    .replace(/\s+/g, " ")
    .trim();

  return text && text.length >= 2 ? [...text].slice(0, MAX_TEXT).join("") : undefined;
}

function subject(title: string): string | undefined {
  const text = clean(
    title
      .replace(/\s+[-–|]\s+iFixit(?:\s+Repair Guide)?\s*$/i, "")
      .replace(/^(?:SOLVED|UNSOLVED):\s+/i, ""),
  );

  return text !== NAME ? text : undefined;
}

function words(segment: string | undefined): string | undefined {
  if (!segment) return undefined;
  try {
    return clean(decodeURIComponent(segment).replace(/[_+]/g, " "));
  } catch {
    return undefined;
  }
}

interface Described {
  details: string;

  state?: string;

  picture?: boolean;

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
    assets: { largeImage: metadata.icon, largeText: NAME },
  };
  const page = describe(path, title);
  const activity: Activity = { ...base, details: page.details };

  if (settings.privacyMode === true) return activity;

  if (page.state) activity.state = page.state;
  if (page.picture && thumbnail !== undefined && settings.showThumbnail !== false) {
    activity.assets = { largeImage: thumbnail, largeText: NAME };
  }

  const link = `${origin}${url.pathname}`;
  if (page.button && link.length <= MAX_BUTTON_URL) {
    activity.buttons = [{ label: page.button, url: link }];
  }

  return activity;
}

const activity: NativeActivity = { detect };

export default activity;

import type { Activity, NativeActivity, Page, Settings } from "parousia";
import metadata from "./metadata.json";

/**
 * What you read is yours to share: the headline shows only with "Show
 * headlines" on, the section otherwise. Links are rebuilt from the path.
 */

const ORIGIN = "https://www.latimes.com";
const NAME = "Los Angeles Times";
const MAX_HEADLINE_CHARS = 100;
const SECTION = /^[a-z][a-z0-9-]{0,40}$/;
const TITLE_SUFFIX = /\s+[-–|]\s+Los Angeles Times\s*$/i;

function headline(title: string): string | null {
  const cleaned = title
    .replace(TITLE_SUFFIX, "")
    .replace(/[\p{Cc}​-‏‪-‮⁦-⁩﻿]/gu, "")
    .trim();
  if (cleaned.length < 2 || /^los angeles times$/i.test(cleaned)) return null;
  return [...cleaned].slice(0, MAX_HEADLINE_CHARS).join("");
}

function sectionName(slug: string | undefined): string | null {
  if (!slug || !SECTION.test(slug)) return null;
  const words = slug.replaceAll("-", " ");
  return `${words.charAt(0).toUpperCase()}${words.slice(1)}`.replace(" nation", " & nation");
}

function detect({ url, title }: Page, settings: Settings): Activity {
  const [first, second] = url.pathname.split("/").filter(Boolean);
  const base: Activity = {
    id: "los-angeles-times",
    name: NAME,
    assets: { largeImage: metadata.icon, largeText: NAME },
    url: `${ORIGIN}/`,
    buttons: [{ label: "Open the Los Angeles Times", url: `${ORIGIN}/` }],
  };
  const section = sectionName(first);

  if (first && second === "story") {
    const activity: Activity = { ...base, details: "Reading an article" };
    if (section) {
      activity.state = section;
      activity.url = `${ORIGIN}/${first}`;
    }
    if (settings.showHeadlines === true) {
      const text = headline(title);
      if (text) {
        activity.details = `Reading ${text}`.slice(0, 128);
        if (section) activity.state = section;
      }
    }
    return activity;
  }
  if (section && second === undefined) {
    return { ...base, url: `${ORIGIN}/${first}`, details: `Browsing ${section}` };
  }
  return { ...base, details: "Browsing the news" };
}

const activity: NativeActivity = { detect };
export default activity;

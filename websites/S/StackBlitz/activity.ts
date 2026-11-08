import type { Activity, ActivityButton, NativeActivity, Page, Settings } from "parousia";
import metadata from "./metadata.json";

/**
 * Every page that is about something names it in the tab: a project (with
 * or without a repository behind it) ends in " - StackBlitz", which the
 * editor sets at runtime and writes "Untitled" for a project that has no
 * name; a fork adds "(duplicated)" there, so repositories go by their
 * owner and repo from the address. A profile says only the account name
 * and a collection's list page says "Collections by <user>". The
 * dashboard and the 404 page both say just "StackBlitz", and marketing
 * pages slot their section into a fixed title, so either kind falls back
 * to "Browsing StackBlitz". A project's share image is served from its
 * own host under an address holding a hash, so no page data is declared.
 */

const ORIGIN = "https://stackblitz.com";
const MAX_TEXT = 100;

const SUFFIX = " - StackBlitz";
const SECTION = /^StackBlitz \| ([^|]+) \| Instant Dev Environments \| Click\. Code\. Done\.$/;
const COLLECTION = /^Collections by (.+)$/;
const OWNER = /^[A-Za-z0-9-]{1,39}$/;
const REPO = /^[A-Za-z0-9._-]{1,100}$/;
const UNSAFE = /[\p{Cc}\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/gu;

/**
 * What a page says: its details line, what it's about (also the state line
 * and the large image's caption), and a button. `named` marks the pages
 * that put their address in the details line.
 */
interface Said {
  details: string;
  name?: string;
  named?: boolean;
  button?: ActivityButton;
}

function plain(text: string | undefined): string | undefined {
  if (text === undefined) return undefined;
  const clean = text.replace(UNSAFE, "").replace(/\s+/g, " ").trim();
  return clean.length >= 2 ? [...clean].slice(0, MAX_TEXT).join("") : undefined;
}

function project(title: string): string | undefined {
  return title.endsWith(SUFFIX) ? plain(title.slice(0, title.length - SUFFIX.length)) : undefined;
}

function fromTitle(expression: RegExp, title: string): string | undefined {
  return plain(expression.exec(title)?.[1]);
}

function repository(segments: readonly string[], at: number): string | undefined {
  const owner = segments[at] ?? "";
  const repo = segments[at + 1] ?? "";

  return OWNER.test(owner) && REPO.test(repo) ? `${owner}/${repo}` : undefined;
}

function look(head: string, title: string, segments: readonly string[], page: string): Said {
  if (head === "edit" && segments.length === 2) {
    return {
      details: "In the project editor",
      name: project(title),
      named: true,
      button: { label: "Open project", url: page },
    };
  }
  if (head === "github" && segments.length >= 3) {
    return {
      details: "In the editor, from GitHub",
      name: repository(segments, 1),
      named: true,
      button: { label: "Open on StackBlitz", url: page },
    };
  }
  if (head === "fork" && segments[1] === "github" && segments.length >= 4) {
    return {
      details: "In the editor, from GitHub",
      name: repository(segments, 2),
      named: true,
      button: { label: "Open on StackBlitz", url: page },
    };
  }
  if (head.startsWith("@") && head.length > 1) {
    if (segments.length === 1) {
      return {
        details: "Looking at a profile",
        name: plain(title),
        named: true,
        button: { label: "View profile", url: page },
      };
    }
    if (segments[1] === "collections") {
      if (segments.length === 2) {
        return {
          details: "Browsing collections",
          name: fromTitle(COLLECTION, title),
          named: true,
          button: { label: "View collections", url: page },
        };
      }
      return {
        details: "Looking at a collection",
        named: true,
        button: { label: "View collection", url: page },
      };
    }
  }
  return { details: "Browsing StackBlitz", name: fromTitle(SECTION, title) };
}

function detect({ url, title }: Page, settings: Settings): Activity | null {
  const segments = url.pathname.split("/").filter(Boolean);
  const [head = ""] = segments;
  const page = `${ORIGIN}${url.pathname}`;
  const privacy = settings.privacyMode === true;
  const said = look(head, title, segments, page);

  const activity: Activity = {
    id: metadata.id,
    name: metadata.name,
    url: page,
    details: said.details,
  };
  if (!privacy) {
    if (said.name !== undefined) {
      activity.state = said.name;
      activity.assets = { largeText: said.name };
    }
    if (said.button !== undefined) activity.buttons = [said.button];
    if (said.named === true) activity.detailsUrl = page;
  }

  return activity;
}

const activity: NativeActivity = { detect };

export default activity;

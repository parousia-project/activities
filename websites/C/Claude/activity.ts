import type { Activity, NativeActivity, Page, Settings } from "parousia";
import metadata from "./metadata.json";

/**
 * Says what you're doing, not what you're saying: a chat's title is often
 * private, so it shows only with "Show chat titles" on. Links never carry a
 * chat's or project's id.
 */

const ORIGIN = "https://claude.ai";
const NAME = "Claude";

const ASSETS = "https://raw.githubusercontent.com/parousia-project/activities/main/assets";
const COMMENTS = `${ASSETS}/status/comments.png`;
const MAX_TITLE_CHARS = 64;

const PAGES: Readonly<Record<string, string>> = {
  "": "Starting a chat",
  new: "Starting a chat",
  chat: "Chatting with Claude",
  chats: "Browsing chats",
  recents: "Browsing chats",
  project: "Working in a project",
  projects: "Browsing projects",
  artifacts: "Browsing artifacts",
  code: "Using Claude Code",
  settings: "Changing settings",
};

const TITLE_SUFFIX = /\s+[-–|]\s+Claude\s*$/i;

const CHATTING = new Set(["", "new", "chat"]);

function chatTitle(title: string): string | null {
  const cleaned = title
    .replace(TITLE_SUFFIX, "")
    .replace(/[\p{Cc}​-‏‪-‮⁦-⁩﻿]/gu, "")
    .trim();
  if (cleaned.length < 2 || /^(claude|new chat|untitled)$/i.test(cleaned)) return null;
  return [...cleaned].slice(0, MAX_TITLE_CHARS).join("");
}

function detect({ url, title }: Page, settings: Settings): Activity {
  const [section = ""] = url.pathname.split("/").filter(Boolean);
  const known = Object.hasOwn(PAGES, section);
  const details = known ? (PAGES[section] ?? "Using Claude") : "Using Claude";
  const activity: Activity = {
    id: "claude",
    name: NAME,
    assets: {
      largeImage: metadata.icon,
      largeText: NAME,
      ...(known && CHATTING.has(section) && { smallImage: COMMENTS, smallText: "Chat" }),
    },
    url: known && section !== "" ? `${ORIGIN}/${section}` : `${ORIGIN}/`,
    details,
    buttons: [{ label: "Open Claude", url: `${ORIGIN}/` }],
  };
  if (section === "chat" && settings.showChatTitle === true) {
    const named = chatTitle(title);
    if (named) activity.state = named;
  }
  return activity;
}

const activity: NativeActivity = { detect };
export default activity;

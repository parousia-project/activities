import type { Activity, NativeActivity, Page, Settings } from "parousia";

/**
 * Claude (claude.ai). It reads only the page's URL and title, and says what
 * you're doing, not what you're saying: a chat is "Chatting with Claude"
 * unless "Show chat titles" is on, since a chat's title is often private.
 * Links never include a chat's or project's id.
 *
 * Written for Parousia from claude.ai's own page structure; it isn't derived
 * from PreMiD's Claude Activity.
 */
const ORIGIN = "https://claude.ai";
const NAME = "Claude";
const MAX_TITLE_CHARS = 64;

/** What each top-level page is, for the details line. */
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

/** "Planning a trip - Claude" is "Planning a trip"; a title that's only the app's name says nothing. */
export function chatTitle(title: string): string | null {
  // Control and direction-override characters could make one title look like another.
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

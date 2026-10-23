import type { Activity, NativeActivity, Page, Settings } from "parousia";
import metadata from "./metadata.json";

/**
 * The web app puts what's open in the tab's title ("Fluxer | #general | My
 * Server", "Fluxer | @Sam"), so channels and direct messages are named from
 * it. Every other page is decided by its address, because those titles are
 * localized. No buttons: a link to a channel would tell anyone viewing your
 * profile where you are.
 */

const WEBSITES = new Set(["fluxer.app", "canary.fluxer.app"]);
const NAME = "Fluxer";

const ASSETS = "https://raw.githubusercontent.com/parousia-project/activities/main/assets";

const STATUS = {
  chat: { smallImage: `${ASSETS}/status/comments.png`, smallText: "Chatting" },
  direct: { smallImage: `${ASSETS}/status/user.png`, smallText: "Direct message" },
  profile: { smallImage: `${ASSETS}/status/user.png`, smallText: "Profile" },
  people: { smallImage: `${ASSETS}/status/users.png`, smallText: "Members" },
} as const;
const MAX_TEXT = 100;

const ID = /^[1-9]\d{0,19}$/;

const BADGE = /^(?:\([^)]*\)|•)\s+/u;

const QUIET = new Set([
  "login",
  "register",
  "forgot",
  "reset",
  "recover",
  "verify",
  "authorize-ip",
  "wasntme",
  "pending",
  "oauth2",
  "auth",
  "invite",
  "gift",
  "theme",
  "theme-studio",
  "migrate",
  "report",
  "premium-callback",
  "age-verification-callback",
  "connection-callback",
]);
const SECTIONS = new Map([
  ["notifications", "Browsing notifications"],
  ["mentions", "Browsing mentions"],
  ["bookmarks", "Browsing bookmarks"],
]);
const OWNERS = new Map([
  ["@favorites", "Browsing favorites"],
  ["@discover", "Browsing server discovery"],
]);

function clean(value: string | undefined, min = 2): string | undefined {
  const text = value
    ?.replace(/[\p{Cc}​-‏‪-‮⁦-⁩﻿]/gu, "")
    .replace(/\s+/g, " ")
    .trim();

  return text && text.length >= min ? [...text].slice(0, MAX_TEXT).join("") : undefined;
}

function titleParts(title: string): string[] {
  const rest = title.replace(BADGE, "");

  return rest.startsWith(`${NAME} | `) ? rest.slice(`${NAME} | `.length).split(" | ") : [];
}

function channel(title: string): { details: string; state?: string; chat: boolean } {
  const [first, ...server] = titleParts(title);
  const text = first?.startsWith("#") === true;
  const name = clean(text ? first?.slice(1) : first, 1);
  if (name === undefined) return { details: "Browsing a server", chat: false };

  const serverName = clean(server.join(" | "));

  return {
    details: text ? `Chatting in #${name}` : `Viewing voice channel ${name}`,
    ...(serverName && { state: serverName }),
    chat: text,
  };
}

function detect({ url, title }: Page, settings: Settings): Activity | null {
  const website = WEBSITES.has(url.hostname);

  const base: Activity = {
    id: "fluxer",
    name: NAME,
    url: `${url.origin}/`,
    assets: { largeImage: metadata.icon, largeText: NAME },
  };
  const say = (details: string, status?: keyof typeof STATUS): Activity => ({
    ...base,
    details,
    ...(status && { assets: { ...base.assets, ...STATUS[status] } }),
  });
  const path = url.pathname.split("/").filter(Boolean);
  const [section = "", owner, target] = path;

  if (website) {
    return {
      ...base,
      details:
        section === "download" ? "Looking at Fluxer downloads" : "Browsing the Fluxer website",
    };
  }
  if (QUIET.has(section)) return null;

  const hidden = settings.privacyMode === true;

  if (section === "channels" && owner === "@me") {
    if (target === undefined || !ID.test(target)) return say("Browsing direct messages", "direct");
    const person = hidden ? undefined : clean(titleParts(title)[0]?.replace(/^@/, ""), 1);

    return say(person ? `Chatting with ${person}` : "Chatting in direct messages", "direct");
  }
  if (section === "channels" && owner !== undefined && OWNERS.has(owner)) {
    return { ...base, details: OWNERS.get(owner) };
  }
  if (section === "channels" && owner !== undefined && ID.test(owner)) {
    if (target === "members") return say("Browsing a server's members", "people");
    if (target === undefined || !ID.test(target) || hidden) return say("Browsing a server");

    const { chat, ...named } = channel(title);

    return {
      ...say(named.details, chat ? "chat" : undefined),
      ...(named.state && { state: named.state }),
    };
  }
  if (section === "users" && owner !== undefined && ID.test(owner)) {
    return say("Looking at a profile", "profile");
  }

  return { ...base, details: SECTIONS.get(section) ?? "Browsing Fluxer" };
}

const activity: NativeActivity = { detect };

export default activity;

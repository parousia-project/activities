import type { Activity, NativeActivity, Page, Settings } from "parousia";

/**
 * Ram dashboard and Ram Activities (rambot.xyz). URL and title only.
 * Privacy mode is the default, so a page, game, or server name shows only
 * when that setting is on. Links are the public home or the activities
 * lobby, never a settings path or a query string.
 */

const ORIGIN = "https://rambot.xyz";
const ACTIVITIES = `${ORIGIN}/activity/`;
const NAME = "Ram Bot";
const ICON =
  "https://rambot.xyz/ram-api-images/ram/ram-icon.png";

const ACTIVITY_SUFFIX = /\s+[—–-]\s+Ram Activities$/i;
const DASHBOARD_SUFFIX = /\s+[—–-]\s+Ram Dashboard$/i;

function clean(value: string, max: number): string {
  const text = value.replace(/[\p{Cc}\u200b-\u200f\u202a-\u202e\ufffd]/gu, "").replace(/\s+/g, " ").trim();
  return [...text].slice(0, max).join("");
}

function isId(value: string): boolean {
  return /\d{17,20}/.test(value);
}

function isActivities(url: URL): boolean {
  return (
    url.hostname === "activity.rambot.xyz" ||
    url.pathname === "/activity" ||
    url.pathname.startsWith("/activity/")
  );
}

/** "Spite Your Neighbor — Ram Activities". Lobby / "In a game" are not a game. */
export function activityGame(title: string): string | null {
  if (!ACTIVITY_SUFFIX.test(title)) return null;
  const name = clean(title.replace(ACTIVITY_SUFFIX, ""), 64);
  if (!name || /^(lobby|in a game|ram activities)$/i.test(name) || isId(name)) return null;
  return name;
}

/** "Server · Page — Ram Dashboard", or the older "Ram Dashboard | Page | Server". */
export function dashboardParts(title: string): { page?: string; server?: string } {
  if (DASHBOARD_SUFFIX.test(title)) {
    const head = clean(title.replace(DASHBOARD_SUFFIX, ""), 120);
    const [first, ...rest] = head.split(/\s+·\s+/);
    if (rest.length) {
      const server = clean(first ?? "", 64);
      const page = clean(rest.join(" · "), 64);
      return {
        server: server && !isId(server) ? server : undefined,
        page: page && !isId(page) ? page : undefined,
      };
    }
    return { page: head && !isId(head) ? head : undefined };
  }

  const parts = title
    .split(/\s*\|\s*/)
    .map((part) => clean(part, 64))
    .filter(Boolean);
  if (!parts[0] || !/ram dashboard/i.test(parts[0])) return {};
  return {
    page: parts[1] && !isId(parts[1]) ? parts[1] : undefined,
    server: parts[2] && !isId(parts[2]) ? parts[2] : undefined,
  };
}

function detect({ url, title }: Page, settings: Settings): Activity | null {
  const host = url.hostname;
  if (host !== "rambot.xyz" && host !== "www.rambot.xyz" && host !== "activity.rambot.xyz") {
    return null;
  }

  const activities = isActivities(url);
  const home = activities ? ACTIVITIES : `${ORIGIN}/`;
  const privacy = settings.privacyMode !== false;
  const activity: Activity = {
    id: "ram-bot",
    name: NAME,
    url: home,
    assets: { largeImage: ICON, largeText: NAME },
  };

  if (activities) activity.type = "playing";
  if (settings.showButton === true) {
    activity.buttons = [{ label: activities ? "Open Activities" : "Open Ram", url: home }];
  }
  if (privacy) {
    activity.details = activities ? "Playing Ram Activities" : "On the Ram dashboard";
    return activity;
  }

  if (activities) {
    const game = settings.showGame !== false ? activityGame(title) : null;
    activity.details = game ?? "Playing Ram Activities";
    if (settings.showPage !== false && ACTIVITY_SUFFIX.test(title)) {
      const head = clean(title.replace(ACTIVITY_SUFFIX, ""), 64);
      activity.state = game || /^in a game$/i.test(head) ? "In a game" : "In the lobby";
    }
    return activity;
  }

  const parts = dashboardParts(title);
  const showPage = settings.showPage !== false;
  activity.details = showPage && parts.page ? parts.page : "On the Ram dashboard";
  if (showPage && settings.showServer === true && parts.server) activity.state = parts.server;
  return activity;
}

const activity: NativeActivity = { detect };
export default activity;

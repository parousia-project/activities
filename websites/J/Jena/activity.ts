import type { Activity, NativeActivity, Page } from "parousia";

/**
 * Jena Hub (jena.systems): arcade games, Discord bot commands, and
 * communities. It reads the page's URL and title, with thumbnails used for
 * profile avatars.
 *
 * Links are rebuilt from the path alone, so a query string or fragment (a
 * sign-in token, say) never leaves the browser.
 */

const ORIGIN = "https://jena.systems";
const NAME = "Jena Hub";
const ICON = `${ORIGIN}/icons/icon-512.png`;
const MAX_GAME_CHARS = 64;
const MAX_USERNAME_CHARS = 32;

/** What each top-level page is, for the details line. */
const PAGES: Readonly<Record<string, string>> = {
  "": "On the home page",
  apps: "Browsing the Arcade",
  commands: "Browsing bot commands",
  communities: "Browsing communities",
  profile: "Viewing a profile",
  status: "Checking the status page",
};

const TITLE_SUFFIX = /\s+[-–|]\s+Jena(?:\s+(?:V\d+|Hub))?\s*$/i;

/** "Chess - Jena V3" is "Chess"; a title without Jena's suffix says nothing. */
export function gameName(title: string): string | null {
  if (!TITLE_SUFFIX.test(title)) return null;

  const name = title
    .replace(TITLE_SUFFIX, "")
    .replace(/[\p{Cc}\u200b-\u200f\u202a-\u202e\ufffd]/gu, "")
    .trim();

  if (!name || name.toLowerCase() === "arcade") return null;

  return [...name].slice(0, MAX_GAME_CHARS).join("");
}

/** Extracts a profile username from a Jena page title such as "abadima - Jena V3". */
export function profileName(title: string): string | null {
  if (!TITLE_SUFFIX.test(title)) return null;

  const name = title
    .replace(TITLE_SUFFIX, "")
    .replace(/[\p{Cc}\u200b-\u200f\u202a-\u202e\ufffd]/gu, "")
    .trim();

  if (!name) return null;

  return [...name].slice(0, MAX_USERNAME_CHARS).join("");
}

function detect({ url, title, thumbnail }: Page): Activity {
  const [section = "", id, ...rest] = url.pathname.split("/").filter(Boolean);

  const base: Activity = {
    id: "jena",
    name: NAME,
    url: `${ORIGIN}/${section}`,
    assets: {
      largeImage: ICON,
      largeText: NAME,
    },
    buttons: [{ label: "Open Jena Hub", url: `${ORIGIN}/` }],
  };

  if (section === "apps" && id && rest.length === 0 && /^\d{1,20}$/.test(id)) {
    const game = gameName(title);
    const page = `${ORIGIN}/apps/${id}`;

    return {
      ...base,
      url: page,
      details: game ? `Playing ${game}` : "Playing a game",
      detailsUrl: page,
      state: "In the Arcade",
      stateUrl: `${ORIGIN}/apps`,
      buttons: [{ label: game ? `Play ${game}` : "Open the game", url: page }],
    };
  }

  if (section === "u" && id && rest.length === 0) {
    const username = profileName(title);
    const page = `${ORIGIN}/u/${id}`;

    return {
      ...base,
      url: page,
      details: username ? `Viewing ${username}'s profile` : "Viewing a profile",
      detailsUrl: page,
      state: username ? `@${username}` : undefined,
      stateUrl: page,
      assets: {
        largeImage: thumbnail ?? ICON,
        largeText: username ?? NAME,
        smallImage: ICON,
        smallText: NAME,
      },
      buttons: [{ label: "View Profile", url: page }],
    };
  }

  return {
    ...base,
    details: PAGES[section] ?? "Browsing Jena Hub",
  };
}

const jena: NativeActivity = { detect };

export default jena;

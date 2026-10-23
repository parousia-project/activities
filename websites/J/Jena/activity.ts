import type { Activity, NativeActivity, Page } from "parousia";
import metadata from "./metadata.json";

/**
 * Links are rebuilt from the path alone, so a query string or fragment (a
 * sign-in token, say) never leaves the browser.
 */

const ORIGIN = "https://jena.systems";
const NAME = "Jena Hub";

const ASSETS = "https://raw.githubusercontent.com/parousia-project/activities/main/assets";
const GAMEPAD = `${ASSETS}/status/gamepad.png`;
const MAX_GAME_CHARS = 64;
const MAX_USERNAME_CHARS = 32;

const PAGES = new Map([
  ["", "On the home page"],
  ["apps", "Browsing the Arcade"],
  ["commands", "Browsing bot commands"],
  ["communities", "Browsing communities"],
  ["profile", "Viewing a profile"],
  ["status", "Checking the status page"],
]);

const TITLE_SUFFIX = /\s+[-–|]\s+Jena(?:\s+(?:V\d+|Hub))?\s*$/i;

function gameName(title: string): string | null {
  if (!TITLE_SUFFIX.test(title)) return null;

  const name = title
    .replace(TITLE_SUFFIX, "")
    .replace(/[\p{Cc}\u200b-\u200f\u202a-\u202e\ufffd]/gu, "")
    .trim();

  if (!name || name.toLowerCase() === "arcade") return null;

  return [...name].slice(0, MAX_GAME_CHARS).join("");
}

function profileName(title: string): string | null {
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
      largeImage: metadata.icon,
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
      assets: { ...base.assets, smallImage: GAMEPAD, smallText: "Arcade" },
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
        largeImage: thumbnail ?? metadata.icon,
        largeText: username ?? NAME,
        smallImage: metadata.icon,
        smallText: NAME,
      },
      buttons: [{ label: "View Profile", url: page }],
    };
  }

  return {
    ...base,
    details: PAGES.get(section) ?? "Browsing Jena Hub",
  };
}

const jena: NativeActivity = { detect };

export default jena;

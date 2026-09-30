import type { Activity, NativeActivity, Page } from "parousia";

/**
 * Jena Hub (jena.systems): arcade games, Discord bot commands, and
 * communities. It reads only the page's URL and title: a game's page is
 * titled like "Chess - Jena V3".
 *
 * Links are rebuilt from the path alone, so a query string or fragment (a
 * sign-in token, say) never leaves the browser.
 */
const ORIGIN = "https://jena.systems";
const NAME = "Jena Hub";
const ICON = `${ORIGIN}/icons/icon-512.png`;
const MAX_GAME_CHARS = 64;

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

/** "Chess - Jena V3" is "Chess"; a title without Jena's suffix, or the Arcade's own, says nothing. */
export function gameName(title: string): string | null {
  if (!TITLE_SUFFIX.test(title)) return null;
  // Control and direction-override characters could make one name look like another.
  const name = title
    .replace(TITLE_SUFFIX, "")
    .replace(/[\p{Cc}​-‏‪-‮⁦-⁩﻿]/gu, "")
    .trim();
  if (!name || name.toLowerCase() === "arcade") return null;
  return [...name].slice(0, MAX_GAME_CHARS).join("");
}

function detect({ url, title }: Page): Activity {
  const [section = "", id, ...rest] = url.pathname.split("/").filter(Boolean);
  const base: Activity = {
    id: "jena",
    name: NAME,
    url: `${ORIGIN}/${section}`,
    assets: { largeImage: ICON, largeText: NAME },
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
  return { ...base, details: PAGES[section] ?? "Browsing Jena Hub" };
}

const jena: NativeActivity = { detect };
export default jena;

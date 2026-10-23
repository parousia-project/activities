import type { Activity, NativeActivity, Page, Settings } from "parousia";

/**
 * A whole game, from first round to summary, is one address and one tab title,
 * so there is no round or score to show: the address says the mode and the
 * title names the game or map. The in-game page has no og:image, so artwork
 * would come and go within one game; no page data is declared.
 */

const ORIGIN = "https://lostgamer.io";
const NAME = "Lostgamer";
const MAX_TEXT = 100;

const QUIET = new Set(["login", "signup", "settings", "admin", "api", "prototype"]);
const SUFFIX = /\s+-\s+Lostgamer\s*$/i;

const GAME = /^(.+?)\s+(?:Guessr(?::.*)?|Interactive Map|Daily Guessr Challenge)$/;

function clean(value: string | undefined): string | undefined {
  const text = value
    ?.replace(/[\p{Cc}​-‏‪-‮⁦-⁩﻿]/gu, "")
    .replace(/\s+/g, " ")
    .trim();

  return text && text.length >= 2 ? [...text].slice(0, MAX_TEXT).join("") : undefined;
}

function gameFromTitle(title: string): string | undefined {
  if (!SUFFIX.test(title)) return undefined;

  return clean(GAME.exec(title.replace(SUFFIX, ""))?.[1]);
}

function detect({ url, title }: Page, settings: Settings): Activity | null {
  const [section = "", second, third] = url.pathname.split("/").filter(Boolean);
  if (QUIET.has(section)) return null;

  const game = settings.privacyMode === true ? undefined : gameFromTitle(title);
  const base: Activity = { id: "lostgamer", name: NAME, url: `${ORIGIN}/` };
  const plain = (details: string): Activity => ({ ...base, details });
  const named = (details: string): Activity => ({ ...base, details, ...(game && { state: game }) });

  if (section === "guessr") {
    switch (second) {
      case "singleplayer":
        return third ? named("Playing a solo game") : plain("Browsing Guessr");
      case "multiplayer":
        return plain(third ? "In a multiplayer party" : "Browsing multiplayer");
      case "duels":
        return plain(third ? "In a duel" : "Browsing duels");
      case "daily":
        return third ? named("Browsing the daily challenge") : plain("Browsing daily challenges");
      case "maps":
        return third ? named("Setting up a game") : plain("Browsing Guessr maps");
      case "create":
        return plain("Making a Guessr map");
      case "my-maps":
        return plain("Browsing their maps");
      default:
        return plain("Browsing Guessr");
    }
  }
  if (section === "maps") {
    return second ? named("Exploring an interactive map") : plain("Browsing interactive maps");
  }
  if (section === "profile") return plain("Looking at a profile");
  if (section === "premium") return plain("Looking at Premium");

  if (second === "guessr") return named("Choosing how to play");
  if (second === undefined && game !== undefined) return named("Looking at a game");

  return plain("Browsing Lostgamer");
}

const activity: NativeActivity = { detect };

export default activity;

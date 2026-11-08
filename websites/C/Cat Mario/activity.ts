import type { Activity, NativeActivity, Page } from "parousia";
import metadata from "./metadata.json";

/**
 * The site is one page and the game inside is silent about itself: it runs
 * as compiled SDL-backed code on a canvas, whose bootstrapping script
 * (`script.js`) reads nothing but the canvas. F1 restarts, O self-destructs
 * and levels change inside the compiled code, and none of it surfaces: the
 * module's only title-writing path is the SDL caption (which the title
 * string "Cat Mario", the only one in its data file, fills), and the
 * address, the DOM and the Media Session are left alone. Whatever moment
 * of the game it is in, the tab says the game itself is open — which the
 * presence shows only while the tab still names it, keeping the server's
 * 404 pages out.
 */

const ORIGIN = "https://catmario.eu";
const PAGE = `${ORIGIN}/`;
const TITLE = "Cat Mario";
const UNSAFE = /[\p{Cc}\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/gu;

function plain(title: string): string {
  return title.replace(UNSAFE, "").replace(/\s+/g, " ").trim();
}

function detect({ title }: Page): Activity | null {
  if (plain(title) !== TITLE) return null;

  return {
    id: metadata.id,
    name: metadata.name,
    url: PAGE,
    details: "HTML5 port in the browser",
    buttons: [{ label: "Play Cat Mario", url: PAGE }],
  };
}

const activity: NativeActivity = { detect };

export default activity;

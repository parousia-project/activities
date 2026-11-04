import type { Activity, NativeActivity, Page } from "parousia";
import metadata from "./metadata.json";

/**
 * A game plays on the catalogue's own address with `#game` as its hash, and the
 * tab takes the game's ROM name as its title. Catalogue pages are titled "Play
 * Online ...", which a `#game` address keeps when no game has loaded, so those
 * don't count as playing.
 */

const ORIGIN = "https://gam.onl";
const PLAYING = "#game";
const CATALOGUE_TITLE = "Play Online";
const STATE = "PlayStation 1 in the browser";
const LOGOS = `${ORIGIN}/user/psx/logos/`;
const MAX_TEXT = 100;

const UNSAFE = /[\p{Cc}​-‏‪-‮�]/gu;
const GROUP = /\s*\(([^()]*)\)|\s*\[[^[\]]*\]/g;

/**
 * Region, language and revision tags. A parenthesised group made only of these
 * is dropped; any other group is part of the title ("Beta 2", "Disc 2", a
 * subtitle). Square brackets hold fan translations and dump checks, so they go.
 */
const METADATA =
  /^(?:USA|Europe|Japan|Asia|Australia|World|Korea|Brazil|China|Taiwan|Hong Kong|Russia|Sweden|Germany|France|Spain|Italy|Canada|Netherlands|Scandinavia|Latin America|Oceania|Unknown|Mexico|Argentina|Poland|Greece|Portugal|Rev \d+|v\d+(?:\.\d+)*|[A-Z][a-z])$/;

function plain(text: string): string {
  return text.replace(UNSAFE, "").replace(/\s+/g, " ").trim();
}

function isMetadata(group: string): boolean {
  return group
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .every((part) => METADATA.test(part));
}

function gameName(title: string): string {
  const name = plain(
    title.replace(GROUP, (_tag, group: string | undefined) =>
      group !== undefined && !isMetadata(group) ? ` (${group})` : "",
    ),
  );
  return [...(name.length > 1 ? name : plain(title))].slice(0, MAX_TEXT).join("");
}

function detect({ url, title }: Page): Activity | null {
  if (url.hash !== PLAYING || title.startsWith(CATALOGUE_TITLE)) return null;

  const game = gameName(title);
  if (!game) return null;

  const page = `${ORIGIN}${url.pathname}`;

  return {
    id: metadata.id,
    name: metadata.name,
    details: game,
    state: STATE,
    url: page,
    detailsUrl: page,
    assets: {
      largeImage: `${LOGOS}${encodeURIComponent(title.replace(UNSAFE, ""))}.png`,
      largeText: game,
      smallImage: metadata.icon,
      smallText: metadata.name,
    },
  };
}

const activity: NativeActivity = { detect };

export default activity;

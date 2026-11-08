import type { Activity, ActivityButton, NativeActivity, Page, PageImage, Settings } from "parousia";
import metadata from "./metadata.json";

/**
 * Worlds (/places/<id>), guilds (/guilds/<id>), store items (/store/<id>),
 * threads (/forum/post/<id>) and profiles (/u/<name> and /users/<id>) each
 * name themselves in the tab as "<name> - Polytoria"; the store and forum
 * pages list themselves as "Polytoria Store" and "Polytoria Forum" without
 * the suffix, so a name is only taken where the suffix held. Worlds play in
 * the desktop client, so on the site a person is looking and reading, not
 * playing.
 *
 * A page's picture: each kind is served from its own folder on the site's CDN
 * (a world's under places/icons/, a guild's under guilds/icons/, an item's
 * under thumbnails/assets/), so the first picture the page loaded from there
 * is the page's own.
 */

const ORIGIN = "https://polytoria.com";
const MAX_TEXT = 100;

const SUFFIX = " - Polytoria";
const PROFILE = /^(.+)'s Profile - Polytoria$/;
const NUMERIC = /^\d+$/;
const UNSAFE = /[\p{Cc}\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/gu;

const CDN = "https://cdn.polytoria.com";
/** What's on the page: its details lines and where its picture lives. */
const PAGE: Readonly<
  Record<string, { word: string; details: string; browsing: string; art: string }>
> = {
  places: {
    word: "world",
    details: "Looking at a world",
    browsing: "Browsing worlds",
    art: `${CDN}/places/icons/`,
  },
  guilds: {
    word: "guild",
    details: "Looking at a guild",
    browsing: "Browsing guilds",
    art: `${CDN}/guilds/icons/`,
  },
  store: {
    word: "item",
    details: "Looking at an item",
    browsing: "Browsing the store",
    art: `${CDN}/thumbnails/assets/`,
  },
};

function clean(value: string | undefined): string | undefined {
  const text = value?.replace(UNSAFE, "").replace(/\s+/g, " ").trim();
  return text !== undefined && text.length >= 2 ? [...text].slice(0, MAX_TEXT).join("") : undefined;
}

/** A page's own name, when the tab carried the site's suffix. */
function tabName(title: string): string | undefined {
  if (!title.endsWith(SUFFIX)) return undefined;
  return clean(title.slice(0, -SUFFIX.length));
}

/** The first picture the page loaded from the folder its kind lives in. */
function artOf(images: readonly PageImage[] | undefined, folder: string): string | undefined {
  return images?.find((image) => image.src.startsWith(folder))?.src;
}

interface Described {
  details: string;

  name?: string;
  link?: string;
  art?: string;
  button?: ActivityButton;
}

function lookingAt(
  head: string,
  kind: { word: string; details: string; art: string },
  id: string,
  title: string,
  images: readonly PageImage[] | undefined,
): Described {
  const link = `${ORIGIN}/${head}/${id}`;

  return {
    details: kind.details,
    name: tabName(title),
    link,
    art: artOf(images, kind.art),
    button: { label: `View ${kind.word}`, url: link },
  };
}

function describe(
  path: string[],
  pathname: string,
  title: string,
  images: readonly PageImage[] | undefined,
): Described {
  const [head = "", second = "", third = ""] = path;

  const kind = PAGE[head];
  if (kind !== undefined) {
    return NUMERIC.test(second)
      ? lookingAt(head, kind, second, title, images)
      : { details: kind.browsing };
  }

  if (head === "forum") {
    if (second === "category") return { details: "Browsing a forum category" };
    if (second === "post" && NUMERIC.test(third)) {
      const link = `${ORIGIN}/forum/post/${third}`;

      return {
        details: "Reading a thread",
        name: tabName(title),
        link,
        button: { label: "View thread", url: link },
      };
    }
    return { details: "Browsing the forum" };
  }

  if (head === "users" || head === "u") {
    // The same profile is /u/<name> and /users/<id>; the people pages are
    // /users and its find-people views (/users/friends, /users/global).
    if (second === "" || (head === "users" && !NUMERIC.test(second)))
      return { details: "Browsing people" };

    const link = `${ORIGIN}${pathname}`;

    return {
      details: "Looking at a profile",
      name: clean(PROFILE.exec(title)?.[1]),
      link,
      button: { label: "View profile", url: link },
    };
  }

  if (head === "rules") return { details: "Reading the rules" };
  if (head === "create") return { details: "In the Creator" };

  return { details: "Browsing Polytoria" };
}

const site: Activity = {
  id: metadata.id,
  name: metadata.name,
  url: `${ORIGIN}/`,
  assets: { largeImage: metadata.icon, largeText: metadata.name },
};

function detect({ url, title, images }: Page, settings: Settings): Activity {
  const page = describe(url.pathname.split("/").filter(Boolean), url.pathname, title, images);
  if (settings.privacyMode === true) return { ...site, details: page.details };

  const { name, link, art, button } = page;
  const picture = settings.showThumbnail !== false ? art : undefined;

  return {
    ...site,
    ...(link !== undefined && { url: link, detailsUrl: link }),
    details: page.details,
    ...(name !== undefined && { state: name }),
    ...(button !== undefined && { buttons: [button] }),
    assets:
      picture !== undefined
        ? {
            largeImage: picture,
            largeText: name ?? metadata.name,
            smallImage: metadata.icon,
            smallText: metadata.name,
          }
        : { ...site.assets, ...(name !== undefined && { largeText: name }) },
  };
}

const activity: NativeActivity = { detect };

export default activity;

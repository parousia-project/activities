import type { Activity, NativeActivity, Page, Settings } from "parousia";
import metadata from "./metadata.json";

/**
 * The blog and projects pages show one item at a time from `?page=<slug>` and
 * never change the tab's title, so the slug is the only signal. The lists
 * below mirror the pages' sidebars: the site loads nothing for a slug that
 * isn't in them, and neither does this.
 */

const ORIGIN = "https://abadima.dev";
const NAME = "Abadima";

const ASSETS = "https://raw.githubusercontent.com/parousia-project/activities/main/assets";
const USER = `${ASSETS}/status/user.png`;
const COMMENTS = `${ASSETS}/status/comments.png`;
const MAX_TITLE_CHARS = 64;

const PAGES = new Map([
  ["/", "On the portfolio landing page"],
  ["/home", "Browsing the portfolio"],
  ["/pages/about", "Reading about Abadima"],
  ["/pages/projects", "Browsing projects"],
  ["/pages/blog", "Browsing the blog"],
  ["/pages/contact", "Viewing the contact page"],
]);

const STATUS = new Map([
  ["/pages/about", { smallImage: USER, smallText: "About" }],
  ["/pages/contact", { smallImage: COMMENTS, smallText: "Contact" }],
]);

interface Section {
  index: string;
  own: RegExp;
  items: ReadonlyMap<string, string>;

  doing: (name: string) => string;
  state: string;
  open: string;
  list: string;

  fromTitle: (title: string) => string | undefined;
}

const BLOG = new Map([
  ["changelogs", "Changelogs"],
  ["identity", "You Exist Everywhere, Yet Nowhere."],
  ["roblox-renaissance", "Let us Play Roblox"],
  ["solstice", "Intro to Solstice"],
]);

const PROJECTS = new Map([
  ["discord-rpc", "Discord RPC"],
  ["jena", "Jena"],
  ["password-generator", "Password Generator"],
  ["logena", "Logena"],
  ["follow-explodinator", "Follow Explodinator 9000"],
  ["portfolio", "Portfolio (This Site)"],
  ["status-page", "Status Page"],
]);

const SITE_TITLES = new Set([
  "Abadima",
  "Abadima's Portfolio",
  "Abadima's Blog",
  "Abadima's Projects",
]);

function cleanTitle(title: string): string {
  return title.replace(/[\p{Cc}​-‏‪-‮�]/gu, "").trim();
}

function shortTitle(title: string): string | undefined {
  const text = [...cleanTitle(title)].slice(0, MAX_TITLE_CHARS).join("");

  return text && !SITE_TITLES.has(text) ? text : undefined;
}

const SECTIONS: readonly Section[] = [
  {
    index: "/pages/blog",
    own: /^\/pages\/blogs\/([\w-]{1,80})$/,
    items: BLOG,
    doing: (name) => `Reading “${name}”`,
    state: "Reading the blog",
    open: "Open Abadima's Blog",
    list: "Read the post",
    fromTitle: shortTitle,
  },
  {
    index: "/pages/projects",
    own: /^\/pages\/projets\/([\w-]{1,80})$/,
    items: PROJECTS,
    doing: (name) => `Looking at “${name}”`,
    state: "Exploring projects",
    open: "Open Abadima's Projects",
    list: "View the project",
    fromTitle: (title) => shortTitle(title.replace(/^Project:\s*/, "")),
  },
];

function itemAt(path: string, page: string | null, title: string) {
  for (const section of SECTIONS) {
    const listed = path === section.index && page !== null ? section.items.get(page) : undefined;
    if (listed !== undefined && page !== null) {
      return { section, name: listed, page: `${ORIGIN}${section.index}?page=${page}` };
    }

    const own = section.own.exec(path)?.[1];
    if (own === undefined) continue;
    const known = section.items.get(own);
    if (known !== undefined) {
      return { section, name: known, page: `${ORIGIN}${section.index}?page=${own}` };
    }

    return { section, name: section.fromTitle(title), page: `${ORIGIN}${path}` };
  }

  return undefined;
}

function detect({ url, title }: Page, settings: Settings): Activity {
  const path = url.pathname.replace(/\.html$/, "").replace(/\/+$/, "") || "/";
  const hidden = settings.privacyMode === true;

  const base: Activity = {
    id: "abadima",
    name: NAME,
    url: `${ORIGIN}${path}`,
    assets: { largeImage: metadata.icon, largeText: NAME },
    buttons: [{ label: "Open Abadima's Portfolio", url: `${ORIGIN}/` }],
  };

  const item = itemAt(path, url.searchParams.get("page"), title);
  if (item) {
    const { section, name, page } = item;

    if (hidden) {
      return {
        ...base,
        url: `${ORIGIN}${section.index}`,
        details: PAGES.get(section.index),
        state: "Exploring the portfolio",
      };
    }

    return {
      ...base,
      url: page,
      details: name ? section.doing(name) : PAGES.get(section.index),
      detailsUrl: page,
      state: section.state,
      stateUrl: `${ORIGIN}${section.index}`,
      buttons: [
        { label: section.list, url: page },
        { label: section.open, url: `${ORIGIN}${section.index}` },
      ],
    };
  }

  const details = PAGES.get(path);
  if (details) {
    return {
      ...base,
      details,
      detailsUrl: `${ORIGIN}${path}`,
      state: path.startsWith("/pages/") ? "Exploring the portfolio" : "On abadima.dev",
      ...(STATUS.has(path) && { assets: { ...base.assets, ...STATUS.get(path) } }),
    };
  }

  return {
    ...base,
    details: "Browsing abadima.dev",
    state: "Exploring the portfolio",
  };
}

const abadima: NativeActivity = { detect };

export default abadima;

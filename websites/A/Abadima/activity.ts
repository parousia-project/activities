import type { Activity, NativeActivity, Page } from "parousia";

/**
 * Abadima's Portfolio (abadima.dev): a personal portfolio covering projects,
 * writing, and contact/about pages. It uses only the page URL and title.
 *
 * Routes are matched from the pathname, and query strings/fragments are never
 * included in the activity URL.
 */

const ORIGIN = "https://abadima.dev";
const NAME = "Abadima";
const ICON = `${ORIGIN}/assets/imgs/abadima_fav.ico`;

const PAGES: Readonly<Record<string, string>> = {
  "/": "On the portfolio landing page",
  "/home": "Browsing the portfolio",
  "/pages/about": "Reading about Abadima",
  "/pages/projects": "Browsing projects",
  "/pages/blog": "Browsing the blog",
  "/pages/contact": "Viewing the contact page",
};

const BLOG_TITLES: Readonly<Record<string, string>> = {
  changelogs: "Reading the changelogs",
  identity: "Reading “You Exist Everywhere, Yet Nowhere.”",
  "roblox-renaissance": "Reading “Let us Play Roblox”",
  solstice: "Reading “Intro to Solstice”",
};

const MAX_TITLE_CHARS = 64;

/** Removes control/direction-override characters before using a page title. */
function cleanTitle(title: string): string {
  return title.replace(/[\p{Cc}\u200b-\u200f\u202a-\u202e\ufffd]/gu, "").trim();
}

function shortTitle(title: string): string {
  return [...cleanTitle(title)].slice(0, MAX_TITLE_CHARS).join("");
}

function detect({ url, title }: Page): Activity {
  const pathname = url.pathname.replace(/\/+$/, "") || "/";

  const base: Activity = {
    id: "abadima",
    name: NAME,
    url: `${ORIGIN}${pathname}`,
    assets: { largeImage: ICON, largeText: NAME },
    buttons: [{ label: "Open Abadima's Portfolio", url: `${ORIGIN}/` }],
  };

  const blogMatch = pathname.match(/^\/pages\/blogs\/([^/]+)$/);

  if (blogMatch) {
    const slug = blogMatch[1]!;

    const page = `${ORIGIN}${pathname}`;
    const details = BLOG_TITLES[slug] ?? `Reading ${shortTitle(title) || "a blog post"}`;

    return {
      ...base,
      url: page,
      details,
      detailsUrl: page,
      state: "Reading the blog",
      stateUrl: `${ORIGIN}/pages/blog`,
      buttons: [
        { label: "Read the post", url: page },
        {
          label: "Open Abadima's Blog",
          url: `${ORIGIN}/pages/blog`,
        },
      ],
    };
  }

  const details = PAGES[pathname];

  if (details) {
    return {
      ...base,
      details,
      detailsUrl: `${ORIGIN}${pathname}`,
      state: pathname.startsWith("/pages/") ? "Exploring the portfolio" : "On abadima.dev",
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

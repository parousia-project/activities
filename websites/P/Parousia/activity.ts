import type { Activity, NativeActivity, Page } from "parousia";

/**
 * Parousia (parousia.abadima.dev): the project website for Parousia's
 * browser extension, Desktop client, Activities, and documentation.
 *
 * It uses only the page URL and title. Query strings and fragments are never
 * copied into the presence.
 */

const ORIGIN = "https://parousia.abadima.dev";
const NAME = "Parousia";
const ICON = `${ORIGIN}/pwa/icons/icon-512.png`;

const PAGES: Readonly<Record<string, string>> = {
  "/": "Browsing the Parousia homepage",
  "/download": "Looking at downloads",
  "/docs": "Reading the documentation",
  "/docs/installation": "Reading installation instructions",
  "/docs/configuration": "Reading configuration docs",
  "/docs/activities": "Reading about Activities",
  "/docs/compatibility": "Checking compatibility",
  "/docs/privacy": "Reading the privacy and security docs",
  "/docs/development": "Reading development docs",
};

/** Documentation pages shown in the state line. */
const DOC_SECTIONS: Readonly<Record<string, string>> = {
  "/docs": "Documentation",
  "/docs/installation": "Installation",
  "/docs/configuration": "Configuration",
  "/docs/activities": "Activities",
  "/docs/compatibility": "Compatibility",
  "/docs/privacy": "Privacy & security",
  "/docs/development": "Development",
};

function cleanTitle(title: string): string {
  return title.replace(/[\p{Cc}\u200b-\u200f\u202a-\u202e\ufffd]/gu, "").trim();
}

function detect({ url, title }: Page): Activity {
  const pathname = url.pathname.replace(/\/+$/, "") || "/";

  const base: Activity = {
    id: "parousia",
    name: NAME,
    url: `${ORIGIN}${pathname}`,
    assets: { largeImage: ICON, largeText: NAME },
    buttons: [{ label: "Open Parousia", url: `${ORIGIN}/` }],
  };

  if (DOC_SECTIONS[pathname]) {
    const page = `${ORIGIN}${pathname}`;

    return {
      ...base,
      url: page,
      details: `Reading ${DOC_SECTIONS[pathname]}`,
      detailsUrl: page,
      state: "Reading the documentation",
      stateUrl: `${ORIGIN}/docs/`,
      buttons: [
        { label: "Read the docs", url: `${ORIGIN}/docs/` },
        { label: "Open Parousia", url: `${ORIGIN}/` },
      ],
    };
  }

  const details = PAGES[pathname];
  if (details) {
    return {
      ...base,
      details,
      detailsUrl: `${ORIGIN}${pathname}`,
      state: pathname === "/download" ? "Getting Parousia" : "On parousia.abadima.dev",
    };
  }

  return {
    ...base,
    details: "Browsing Parousia",
    state: `${cleanTitle(title)}`.slice(0, 128),
  };
}

const parousia: NativeActivity = { detect };

export default parousia;

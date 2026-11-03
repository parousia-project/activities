import type { Activity, NativeActivity, Page, PageImage, Settings } from "parousia";
import metadata from "./metadata.json";

/**
 * Addresses start with a locale (`/de/apps/...`) and titles are translated, so
 * an app's name is read only from the English title and its id, which every
 * address holds, stands in otherwise. The page shows the app's icon through an
 * image proxy whose address carries the original's in base64; the original is
 * a PNG at a fixed size that Discord can show, so that is what's used.
 */

const ORIGIN = "https://flathub.org";
const NAME = "Flathub";
const MAX_TEXT = 100;
const MAX_ID = 128;

const LOCALE = /^[a-z]{2,3}(?:-[A-Za-z]{2,4})?$/;
const APP_ID = /^[A-Za-z_][\w-]*(?:\.[\w-]+)+$/;
const APP_TITLE = /^Install\s+(?<name>.+?)\s+on Linux\s*\|\s*Flathub\s*$/i;
const PROXIED =
  /^https:\/\/imgproxy\.flathub\.org\/insecure\/(?:[^/]+\/)*(?<encoded>[\w-]+)(?:\.\w+)?$/;
const ICON =
  /^https:\/\/dl\.flathub\.org\/media\/(?:[\w./-]+\/)?icons\/\d+x\d+\/(?<id>[\w.-]+)\.png$/;

const CATEGORIES: Readonly<Record<string, string>> = {
  audiovideo: "Audio & Video",
  development: "Developer Tools",
  education: "Education",
  game: "Games",
  graphics: "Graphics & Photography",
  healthfitness: "Health & Fitness",
  network: "Networking",
  office: "Productivity",
  science: "Science",
  system: "System",
  utility: "Utilities",
};

const COLLECTIONS: Readonly<Record<string, string>> = {
  popular: "Browsing popular apps",
  trending: "Browsing trending apps",
  "recently-updated": "Browsing recently updated apps",
  "recently-added": "Browsing new apps",
  verified: "Browsing verified apps",
  mobile: "Browsing mobile apps",
};

const SECTIONS: Readonly<Record<string, string>> = {
  about: "Reading about Flathub",
  statistics: "Looking at Flathub's statistics",
  builds: "Checking build status",
};

function clean(value: string): string | undefined {
  const text = value
    .replace(/[\p{Cc}​-‏‪-‮⁦-⁩﻿]/gu, "")
    .replace(/\s+/g, " ")
    .trim();

  return text.length >= 2 ? [...text].slice(0, MAX_TEXT).join("") : undefined;
}

function words(segment: string | undefined): string | undefined {
  if (!segment) return undefined;
  try {
    return clean(decodeURIComponent(segment));
  } catch {
    return undefined;
  }
}

const tabName = (title: string): string | undefined =>
  clean(title.replace(/\s*\|\s*Flathub\s*$/i, ""));

const isApp = (segment: string | undefined): segment is string =>
  segment !== undefined && segment.length <= MAX_ID && APP_ID.test(segment);

function iconOf(images: readonly PageImage[] | undefined, id: string): string | undefined {
  for (const { src } of images ?? []) {
    const encoded = PROXIED.exec(src)?.groups?.encoded;
    if (!encoded) continue;
    let original: string;
    try {
      original = atob(encoded.replace(/-/g, "+").replace(/_/g, "/"));
    } catch {
      continue;
    }
    if (ICON.exec(original)?.groups?.id === id) return original;
  }
  return undefined;
}

interface Described {
  details: string;

  kind?: string;
  state?: string;
  link?: string;
  app?: string;
  name?: string;
}

function describeApps([kind, first, second, third]: string[], title: string): Described {
  if (kind === "search") return { details: "Searching Flathub" };

  if (kind === "category") {
    const key = first?.toLowerCase() ?? "";
    const label = Object.hasOwn(CATEGORIES, key) ? CATEGORIES[key] : undefined;
    if (!label) return { details: "Browsing Flathub" };
    const sub = second === "subcategories" && third ? tabName(title) : undefined;

    return {
      details: `Browsing ${label}`,
      kind: "Browsing a category",
      link: `${ORIGIN}/apps/category/${first}`,
      ...(sub && { state: sub }),
    };
  }

  if (kind === "collection") {
    if (first !== undefined && Object.hasOwn(COLLECTIONS, first)) {
      return {
        details: COLLECTIONS[first] ?? "Browsing Flathub",
        link: `${ORIGIN}/apps/collection/${first}`,
      };
    }
    const value = words(second);
    if (first === "developer" && value) {
      return {
        details: "Browsing a developer's apps",
        state: value,
        link: `${ORIGIN}/apps/collection/developer/${second}`,
      };
    }
    if (first === "tag" && value) {
      return {
        details: "Browsing apps by tag",
        state: value,
        link: `${ORIGIN}/apps/collection/tag/${second}`,
      };
    }
    return { details: "Browsing Flathub" };
  }

  if (isApp(kind)) {
    const link = `${ORIGIN}/apps/${kind}`;
    if (first === "install") {
      return {
        details: "Installing an app",
        state: kind,
        link,
        app: kind,
      };
    }
    const name = clean(APP_TITLE.exec(title)?.groups?.name ?? "");

    return {
      details: name ? `Looking at ${name}` : "Looking at an app",
      kind: "Looking at an app",
      state: kind,
      link,
      app: kind,
      name,
    };
  }

  return { details: "Browsing Flathub" };
}

function describe(path: string[], title: string): Described {
  const [section, second] = path;

  if (title.startsWith("404")) return { details: "Browsing Flathub" };
  if (section === "apps") return describeApps(path.slice(1), title);
  if (section === "setup") {
    const distro = words(second);

    return {
      details: "Setting up Flathub",
      link: `${ORIGIN}/setup${distro ? `/${second}` : ""}`,
      ...(distro && { state: distro }),
    };
  }
  if (section !== undefined && Object.hasOwn(SECTIONS, section)) {
    return { details: SECTIONS[section] ?? "Browsing Flathub", link: `${ORIGIN}/${section}` };
  }
  return { details: "Browsing Flathub" };
}

function detect({ url, title, images }: Page, settings: Settings): Activity {
  const path = url.pathname.split("/").filter(Boolean);
  if (LOCALE.test(path[0] ?? "")) path.shift();

  const base: Activity = {
    id: "flathub",
    name: NAME,
    url: `${ORIGIN}/`,
    assets: { largeImage: metadata.icon, largeText: NAME },
  };
  const page = describe(path, title);
  if (settings.privacyMode === true) return { ...base, details: page.kind ?? page.details };

  const icon =
    page.app !== undefined && settings.showThumbnail !== false
      ? iconOf(images, page.app)
      : undefined;

  return {
    ...base,
    ...(page.link && { url: page.link, detailsUrl: page.link }),
    details: page.details,
    ...(page.state && { state: page.state }),
    ...(page.name && { statusDisplayType: "details" as const }),
    assets: {
      largeImage: icon ?? metadata.icon,
      largeText: page.name ?? NAME,
      ...(icon && { smallImage: metadata.icon, smallText: NAME }),
    },
  };
}

const activity: NativeActivity = { detect };

export default activity;

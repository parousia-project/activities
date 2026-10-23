import type { Activity, NativeActivity, Page } from "parousia";

/**
 * Only the `id` is kept from the query string, and only if it looks like a
 * package name. A search says that you searched, never what for.
 */

const ORIGIN = "https://play.google.com";
const NAME = "Google Play";
const MAX_NAME_CHARS = 64;
const PACKAGE = /^[A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z0-9_]+)*$/;

const KINDS: Readonly<Record<string, { title: RegExp; plural: string }>> = {
  apps: { title: /\s+-\s+Apps on Google Play\s*$/i, plural: "Apps" },
  movies: { title: /\s+-\s+Movies on Google Play\s*$/i, plural: "Movies" },
  books: { title: /\s+-\s+Books on Google Play\s*$/i, plural: "Books" },
};

function itemName(title: string, kind: { title: RegExp }): string | null {
  if (!kind.title.test(title)) return null;
  const name = title
    .replace(kind.title, "")
    .replace(/[\p{Cc}​-‏‪-‮⁦-⁩﻿]/gu, "")
    .trim();
  return name.length >= 2 ? [...name].slice(0, MAX_NAME_CHARS).join("") : null;
}

function detect({ url, title }: Page): Activity {
  const [store, kindKey = "", view] = url.pathname.split("/").filter(Boolean);
  const base: Activity = {
    id: "google-play",
    name: NAME,
    url: `${ORIGIN}/store`,
    buttons: [{ label: "Open Google Play", url: `${ORIGIN}/store` }],
  };
  if (store !== "store") return { ...base, details: "Browsing Google Play" };

  const kind = Object.hasOwn(KINDS, kindKey) ? KINDS[kindKey] : undefined;
  const id = url.searchParams.get("id");
  if (kind && view === "details" && id && PACKAGE.test(id) && id.length <= 128) {
    const page = `${ORIGIN}/store/${kindKey}/details?id=${id}`;
    const name = itemName(title, kind);
    return {
      ...base,
      url: page,
      details: name
        ? `Viewing ${name}`
        : `Viewing ${kind.plural.toLowerCase().slice(0, -1)} details`,
      detailsUrl: page,
      state: `${kind.plural} on Google Play`,
      buttons: [{ label: "View on Google Play", url: page }],
    };
  }
  if (view === "search" || kindKey === "search") {
    return { ...base, details: "Searching Google Play" };
  }
  if (kind)
    return {
      ...base,
      url: `${ORIGIN}/store/${kindKey}`,
      details: `Browsing ${kind.plural.toLowerCase()}`,
    };
  return { ...base, details: "Browsing Google Play" };
}

const activity: NativeActivity = { detect };
export default activity;

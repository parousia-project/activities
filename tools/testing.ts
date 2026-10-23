import type { Activity, Page, PageDataKind, PageImage, PageMedia, Settings } from "parousia";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { Metadata } from "./metadata";

/**
 * A page as Parousia hands it to `detect`: by default with no page data, as
 * where its site isn't granted. Pass what it's granted, and what was read.
 */
export function page(
  href: string,
  title = "",
  data: {
    granted?: PageDataKind[];
    media?: PageMedia;
    thumbnail?: string;
    images?: PageImage[];
  } = {},
): Page {
  return { url: new URL(href), title, granted: data.granted ?? [], ...data };
}

/** Where this repository's `assets/` folder is served from: GitHub is the image host. */
export const ASSETS_URL =
  "https://raw.githubusercontent.com/parousia-project/activities/main/assets";

/**
 * The file under `assets/` that `url` serves, or `null` if it isn't one of
 * ours or isn't there. A test can check it's not null, so an Activity never
 * points at an image that was never added.
 */
export function assetFile(url: string | undefined): string | null {
  if (!url?.startsWith(`${ASSETS_URL}/`)) return null;
  const name = url.slice(ASSETS_URL.length + 1);
  if (!/^[\w-]+(?:\/[\w-]+)*\.png$/.test(name)) return null;
  const file = join(import.meta.dir, "..", "assets", name);

  return existsSync(file) ? file : null;
}

/** Every setting at its default, as `detect` receives them until someone changes one. */
export function defaults(metadata: Pick<Metadata, "id" | "settings">): Settings {
  return Object.fromEntries(
    (metadata.settings ?? []).map((setting) => [setting.id, setting.default]),
  );
}

const MIN_TEXT = 2;
const MAX_TEXT = 128;
const MAX_IMAGE = 256;
const MAX_LINK = 256;
const MAX_BUTTON_LABEL = 32;
const MAX_BUTTON_URL = 512;
const MAX_TIME = 2_147_483_647_000;
const MAX_PARTY = 10_000;

const isWeb = (value: string): boolean => /^https?:\/\//.test(value);
const isHttps = (value: string): boolean => value.startsWith("https://");

/**
 * What Discord would refuse or cut in `activity`, the same limits Parousia
 * applies before showing it (text of 2 to 128 characters, `http(s)` links,
 * `https` images, at most two buttons, a party that adds up, and so on).
 * Empty when everything fits.
 */
export function checkActivity(activity: Activity): string[] {
  const problems: string[] = [];
  const text = (field: string, value: string | undefined): void => {
    if (value === undefined) return;
    const length = value.trim().length;
    if (length < MIN_TEXT)
      problems.push(`${field} is under ${MIN_TEXT} characters, so it's left out`);
    if (length > MAX_TEXT) problems.push(`${field} is over ${MAX_TEXT} characters, so it's cut`);
  };
  const link = (field: string, value: string | undefined, max: number): void => {
    if (value === undefined) return;
    if (!isWeb(value)) problems.push(`${field} isn't an http(s) link`);
    if (value.length > max) problems.push(`${field} is over ${max} characters`);
  };

  text("name", activity.name);
  text("details", activity.details);
  text("state", activity.state);
  text("assets.largeText", activity.assets?.largeText);
  text("assets.smallText", activity.assets?.smallText);
  link("url", activity.url, 512);
  link("detailsUrl", activity.detailsUrl, MAX_LINK);
  link("stateUrl", activity.stateUrl, MAX_LINK);
  link("assets.largeUrl", activity.assets?.largeUrl, MAX_LINK);
  link("assets.smallUrl", activity.assets?.smallUrl, MAX_LINK);
  for (const field of ["largeImage", "smallImage"] as const) {
    const image = activity.assets?.[field];
    if (image !== undefined && (!isHttps(image) || image.length > MAX_IMAGE)) {
      problems.push(
        `assets.${field} must be an https image URL of at most ${MAX_IMAGE} characters, or Parousia swaps in the site's logo`,
      );
    }
  }
  for (const field of ["start", "end"] as const) {
    const time = activity.timestamps?.[field];
    if (time !== undefined && (!Number.isInteger(time) || time < 1 || time > MAX_TIME)) {
      problems.push(`timestamps.${field} must be whole Unix milliseconds`);
    }
  }
  // Discord falls back to the name when the line it's pointed at is missing.
  if (activity.statusDisplayType === "state" && activity.state === undefined) {
    problems.push(`statusDisplayType is "state", but there is no state`);
  }
  if (activity.statusDisplayType === "details" && activity.details === undefined) {
    problems.push(`statusDisplayType is "details", but there are no details`);
  }
  const { party } = activity;
  if (party !== undefined) {
    const { size, max } = party;
    if (
      !Number.isInteger(size) ||
      !Number.isInteger(max) ||
      size < 1 ||
      size > max ||
      max > MAX_PARTY
    ) {
      problems.push(
        `party must be a size of 1 or more, at most its max, which is at most ${MAX_PARTY}, or the whole activity is refused`,
      );
    }
    if (activity.type !== undefined && activity.type !== "playing") {
      problems.push(`party is shown only on a "playing" Activity`);
    }
  }
  const buttons = activity.buttons ?? [];
  if (buttons.length > 2) problems.push("there are more than two buttons");
  for (const [index, button] of buttons.entries()) {
    const label = button.label.trim().length;
    if (label < 1 || label > MAX_BUTTON_LABEL) {
      problems.push(`buttons[${index}].label must be 1 to ${MAX_BUTTON_LABEL} characters`);
    }
    link(`buttons[${index}].url`, button.url, MAX_BUTTON_URL);
  }
  return problems;
}

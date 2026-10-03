import type { Activity, Page, PageDataKind, PageMedia, Settings } from "parousia";
import { matchesAny } from "./match-pattern";
import type { Metadata } from "./metadata";

/**
 * A page as Parousia hands it to `detect`: by default with no page data, as
 * where its site isn't granted. Pass what it's granted, and what was read.
 */
export function page(
  href: string,
  title = "",
  data: { granted?: PageDataKind[]; media?: PageMedia; thumbnail?: string } = {},
): Page {
  return { url: new URL(href), title, granted: data.granted ?? [], ...data };
}

/** Whether Parousia would run this Activity on `href`, going by its metadata.json. */
export function matches(metadata: Pick<Metadata, "matches">, href: string): boolean {
  return matchesAny(metadata.matches, new URL(href));
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

const isWeb = (value: string): boolean => /^https?:\/\//.test(value);

/**
 * What Discord would refuse or cut in `activity`, the same limits Parousia
 * applies before showing it (text of 2 to 128 characters, `http(s)` links,
 * at most two buttons, and so on). Empty when everything fits.
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
  for (const field of ["largeImage", "smallImage"] as const) {
    const image = activity.assets?.[field];
    if (image !== undefined && (!isWeb(image) || image.length > MAX_IMAGE)) {
      problems.push(
        `assets.${field} must be an http(s) image URL of at most ${MAX_IMAGE} characters`,
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

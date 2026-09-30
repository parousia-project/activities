import type { SettingValue } from "parousia";
import { compileMatchPattern } from "./match-pattern";

/** metadata.json, as schemas/metadata.json describes it. */
export interface Metadata {
  apiVersion: 1;
  id: string;
  name: string;
  description: string;
  version: string;
  authors: Array<{ name: string; github?: string }>;
  matches: string[];
  discordClientId?: string;
  icon?: string;
  data?: Array<"media" | "thumbnails">;
  settings?: Setting[];
}

export interface Setting {
  id: string;
  title: string;
  description?: string;
  type: "boolean" | "choice" | "text" | "number";
  default: SettingValue;
  choices?: string[];
  placeholder?: string;
  when?: Record<string, SettingValue>;
}

const TOP_KEYS = new Set([
  "$schema",
  "apiVersion",
  "id",
  "name",
  "description",
  "version",
  "authors",
  "matches",
  "discordClientId",
  "icon",
  "data",
  "settings",
]);
const SETTING_KEYS = new Set([
  "id",
  "title",
  "description",
  "type",
  "default",
  "choices",
  "placeholder",
  "when",
]);

/**
 * Where a website's Activity lives: `websites/<letter>/<Name>/`. The letter is
 * the name's first letter, `0-9` for a digit, `#` for anything else (the same
 * rule as PreMiD's Activities, cli/src/util/getFolderLetter.ts).
 */
export function folderLetter(name: string): string {
  const first = name.trim().charAt(0).toUpperCase();
  if (/[A-Z]/.test(first)) return first;
  if (/\d/.test(first)) return "0-9";
  return "#";
}

/** A website folder's name: letters, digits, spaces, and `. ' & + _ -`, at most 64 characters. */
export const FOLDER_NAME = /^[\p{L}\p{N}](?:[\p{L}\p{N} .'&+_-]{0,62}[\p{L}\p{N}'_+-])?$/u;

/** An Activity's id: its folder's name in lowercase, words joined by "-" (`YouTube Music` is `youtube-music`). */
export function activityId(folder: string): string {
  return folder
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

type Json = Record<string, unknown>;
const isObject = (value: unknown): value is Json =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const isText = (value: unknown, max: number): value is string =>
  typeof value === "string" && value.trim().length > 0 && value.length <= max;
const isPrimitive = (value: unknown): value is SettingValue =>
  typeof value === "string" || typeof value === "number" || typeof value === "boolean";

function checkSetting(value: unknown, index: number, problems: string[]): string | null {
  const at = `settings[${index}]`;
  if (!isObject(value)) {
    problems.push(`${at} must be an object`);
    return null;
  }
  for (const key of Object.keys(value)) {
    if (!SETTING_KEYS.has(key)) problems.push(`${at} has an unknown key "${key}"`);
  }
  const id =
    typeof value.id === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(value.id) ? value.id : null;
  if (!id) problems.push(`${at}.id must be 1 to 64 letters, digits, "-" or "_"`);
  if (!isText(value.title, 64)) problems.push(`${at}.title must be 1 to 64 characters`);
  if (value.description !== undefined && !isText(value.description, 256)) {
    problems.push(`${at}.description must be 1 to 256 characters`);
  }
  if (value.placeholder !== undefined && !isText(value.placeholder, 128)) {
    problems.push(`${at}.placeholder must be 1 to 128 characters`);
  }
  switch (value.type) {
    case "boolean":
      if (typeof value.default !== "boolean") problems.push(`${at}.default must be true or false`);
      break;
    case "choice": {
      const choices = value.choices;
      const valid =
        Array.isArray(choices) &&
        choices.length >= 2 &&
        choices.length <= 32 &&
        choices.every((choice) => isText(choice, 64));
      if (!valid) problems.push(`${at}.choices must be 2 to 32 labels of 1 to 64 characters`);
      const count = Array.isArray(choices) ? choices.length : 0;
      const index = value.default;
      if (typeof index !== "number" || !Number.isInteger(index) || index < 0 || index >= count) {
        problems.push(`${at}.default must be the index of one of its choices`);
      }
      break;
    }
    case "text":
      if (typeof value.default !== "string" || value.default.length > 256) {
        problems.push(`${at}.default must be text of at most 256 characters`);
      }
      break;
    case "number":
      if (typeof value.default !== "number" || !Number.isFinite(value.default)) {
        problems.push(`${at}.default must be a number`);
      }
      break;
    default:
      problems.push(`${at}.type must be "boolean", "choice", "text", or "number"`);
  }
  if (value.type !== "choice" && value.choices !== undefined) {
    problems.push(`${at}.choices is only for "choice" settings`);
  }
  if (value.when !== undefined) {
    if (!isObject(value.when) || !Object.values(value.when).every(isPrimitive)) {
      problems.push(`${at}.when must map setting ids to values`);
    }
  }
  return id;
}

/**
 * Every way `value` (a parsed metadata.json from `websites/<letter>/<folder>/`)
 * breaks the format; empty when it's valid.
 */
export function checkMetadata(value: unknown, folder: string): string[] {
  const problems: string[] = [];
  if (!isObject(value)) return ["metadata.json must be a JSON object"];

  for (const key of Object.keys(value)) {
    if (!TOP_KEYS.has(key)) problems.push(`unknown key "${key}"`);
  }
  if (value.apiVersion !== 1) problems.push("apiVersion must be 1");
  const id = activityId(folder);
  if (!id) {
    problems.push(`the folder name "${folder}" needs Latin letters or digits to make an id from`);
  } else if (value.id !== id) {
    problems.push(`id must be "${id}", its folder's name in lowercase with words joined by "-"`);
  }
  if (!isText(value.name, 64)) problems.push("name must be 1 to 64 characters");
  if (!isText(value.description, 256)) problems.push("description must be 1 to 256 characters");
  if (typeof value.version !== "string" || !/^\d+\.\d+\.\d+$/.test(value.version)) {
    problems.push("version must be MAJOR.MINOR.PATCH");
  }

  const authors = value.authors;
  if (
    !Array.isArray(authors) ||
    authors.length === 0 ||
    !authors.every(
      (author) =>
        isObject(author) &&
        isText(author.name, 64) &&
        (author.github === undefined ||
          (typeof author.github === "string" && /^[A-Za-z0-9-]{1,39}$/.test(author.github))) &&
        Object.keys(author).every((key) => key === "name" || key === "github"),
    )
  ) {
    problems.push('authors must list at least one { "name", "github"? }');
  }

  const matches = value.matches;
  if (!Array.isArray(matches) || matches.length === 0 || matches.length > 32) {
    problems.push("matches must list 1 to 32 match patterns");
  } else {
    for (const pattern of matches) {
      if (typeof pattern !== "string" || compileMatchPattern(pattern) === null) {
        problems.push(
          `matches: "${String(pattern)}" isn't a match pattern for particular sites, like "https://example.com/*"`,
        );
      }
    }
  }

  if (
    value.discordClientId !== undefined &&
    (typeof value.discordClientId !== "string" || !/^\d{17,20}$/.test(value.discordClientId))
  ) {
    problems.push("discordClientId must be a Discord application id (17 to 20 digits)");
  }

  const icon = value.icon;
  if (
    icon !== undefined &&
    (typeof icon !== "string" || !icon.startsWith("https://") || icon.length > 256)
  ) {
    problems.push("icon must be an https image URL of at most 256 characters");
  }
  const data = value.data;
  if (data !== undefined) {
    const kinds = ["media", "thumbnails"];
    if (!Array.isArray(data) || data.length === 0 || !data.every((kind) => kinds.includes(kind))) {
      problems.push(`data must list the page data it takes, from: ${kinds.join(", ")}`);
    }
  }

  if (value.settings !== undefined) {
    if (!Array.isArray(value.settings) || value.settings.length > 32) {
      problems.push("settings must be a list of at most 32 settings");
    } else {
      const ids = value.settings.map((setting, index) => checkSetting(setting, index, problems));
      const known = new Set<string>();
      for (const id of ids) {
        if (id === null) continue;
        if (known.has(id)) problems.push(`settings: "${id}" is listed twice`);
        known.add(id);
      }
      for (const [index, setting] of value.settings.entries()) {
        if (!isObject(setting) || !isObject(setting.when)) continue;
        for (const other of Object.keys(setting.when)) {
          if (!known.has(other))
            problems.push(`settings[${index}].when names "${other}", which isn't a setting`);
        }
      }
    }
  }
  return problems;
}

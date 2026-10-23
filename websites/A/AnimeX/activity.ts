import type { Activity, NativeActivity, Page, PageImage, Settings } from "parousia";
import metadata from "./metadata.json";

/**
 * Title and episode come from the address, whose slug is the title in
 * lowercase; the tab's title only supplies the capitals. Covers and avatars
 * are picked from `page.images`, because their addresses hold a hash only the
 * page knows. The player runs in an iframe, so playback comes from
 * `page.media` and is left out where the player reports nothing, never
 * invented.
 */

const ORIGIN = "https://animex.one";
const NAME = "AnimeX";

const ASSETS = "https://raw.githubusercontent.com/parousia-project/activities/main/assets";
const PLAY = `${ASSETS}/status/play.png`;
const PAUSE = `${ASSETS}/status/pause.png`;
const USER_ICON = `${ASSETS}/status/user.png`;
const USERS_ICON = `${ASSETS}/status/users.png`;
const MAX_TEXT = 100;

const COVER_SIZES = ["large", "extraLarge", "medium"] as const;
const AVATAR = "https://cdn.animex.one/assets/avatars/";

const USER = /^[\w.-]{1,64}$/;

const WATCH = /^(?<slug>[a-z0-9]+(?:-[a-z0-9]+)*)-(?<id>\d{1,9})-episode-(?<episode>\d{1,5})$/;
const ANIME = /^(?<slug>[a-z0-9]+(?:-[a-z0-9]+)*)-(?<id>\d{1,9})$/;
const WATCH_TITLE =
  /^(?<title>.+?)\s+Episode\s+(?<episode>\d+)\s+English Sub\/Dub\s+[-–|]\s+AnimeX\s*$/i;
const PROFILE_TITLE = /^(?<name>.+?)['’]s Profile\s+[-–|]\s+AnimeX\s*$/i;
const ANIME_TITLE =
  /^Watch\s+(?<title>.+?)\s+Episodes in English Sub\/Dub Online for free\s+[-–|]\s+AnimeX\s*$/i;

const PAGES: Readonly<Record<string, string>> = {
  "": "Browsing AnimeX",
  home: "Browsing AnimeX",
  catalog: "Browsing the catalog",
  schedule: "Checking the release schedule",
  community: "Browsing the community",
  w2g: "In a Watch Together room",
  settings: "Changing settings",
  profile: "Viewing a profile",
  user: "Viewing a profile",
};

const PEOPLE = new Map([
  ["w2g", { smallImage: USERS_ICON, smallText: "Watch Together" }],
  ["profile", { smallImage: USER_ICON, smallText: "Profile" }],
  ["user", { smallImage: USER_ICON, smallText: "Profile" }],
]);

const LINKED = new Set(["catalog", "schedule", "community"]);

function clean(value: string): string | undefined {
  const text = value
    .replace(/[\p{Cc}​-‏‪-‮⁦-⁩﻿]/gu, "")
    .replace(/\s+/g, " ")
    .trim();

  return text.length >= 2 ? [...text].slice(0, MAX_TEXT).join("") : undefined;
}

const slugOf = (title: string): string =>
  title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

function fromSlug(slug: string): string {
  const text = slug
    .split("-")
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(" ");

  return [...text].slice(0, MAX_TEXT).join("");
}

function animeTitle(title: string, slug: string, episode?: string): string {
  const found = episode === undefined ? ANIME_TITLE.exec(title) : WATCH_TITLE.exec(title);
  const named = found?.groups?.title;
  const matching =
    found?.groups?.episode === undefined || Number(found.groups.episode) === Number(episode);
  const text = named !== undefined && matching ? clean(named) : undefined;

  return text !== undefined && slugOf(text) === slug ? text : fromSlug(slug);
}

function coverOf(images: readonly PageImage[] | undefined, id: string): string | undefined {
  const pattern = new RegExp(
    `^https://s4\\.anilist\\.co/file/anilistcdn/media/anime/cover/(?<size>[A-Za-z]+)/[a-z]*${id}-[\\w-]+\\.(?:jpg|png)$`,
  );
  let best: { src: string; rank: number } | undefined;
  for (const { src } of images ?? []) {
    const size = pattern.exec(src)?.groups?.size;
    const rank = COVER_SIZES.findIndex((wanted) => wanted === size);
    if (rank >= 0 && (best === undefined || rank < best.rank)) best = { src, rank };
  }
  return best?.src;
}

function avatarOf(images: readonly PageImage[] | undefined, user: string): string | undefined {
  return images?.find(
    (image) => image.src.startsWith(AVATAR) && image.alt?.toLowerCase() === user.toLowerCase(),
  )?.src;
}

const shown = (name: string): string | undefined => (name.length >= 2 ? name : undefined);

function detect({ url, title, media, images }: Page, settings: Settings): Activity {
  const path = url.pathname.split("/").filter(Boolean);
  const [section = "", segment, ...rest] = path;
  const hidden = settings.privacyMode === true;
  const covers = !hidden && settings.showCover !== false;
  const avatars = !hidden && settings.showAvatars !== false;
  const buttons = !hidden && settings.showButtons !== false;

  const base: Activity = { id: "animex", name: NAME, url: `${ORIGIN}/` };

  const picture = (large?: string, text?: string, shown = covers): Activity["assets"] => ({
    largeImage: shown && large !== undefined ? large : metadata.icon,
    largeText: text !== undefined && !hidden ? text : NAME,
    ...(shown && large !== undefined && { smallImage: metadata.icon, smallText: NAME }),
  });

  const watch =
    section === "watch" && rest.length === 0 ? WATCH.exec(segment ?? "")?.groups : undefined;
  if (watch?.slug && watch.id && watch.episode) {
    const { slug, id, episode } = watch;
    const number = String(Number(episode));
    const anime = `${ORIGIN}/anime/${slug}-${id}`;
    const page = `${ORIGIN}/watch/${slug}-${id}-episode-${number}`;
    const activity: Activity = {
      ...base,
      type: "watching",
      details: "Watching anime",
      assets: picture(),
    };
    if (hidden) return activity;

    const name = shown(animeTitle(title, slug, episode));
    const paused = media?.playing === false;

    activity.url = page;
    activity.details = name ?? "Watching anime";
    activity.detailsUrl = page;
    activity.state = `Episode ${number}`;

    if (name) activity.statusDisplayType = "details";
    activity.assets = picture(coverOf(images, id), name);
    const clock =
      settings.showTimestamps !== false &&
      media?.playing === true &&
      media.start !== undefined &&
      (media.end === undefined || media.end > media.start);

    if (paused) {
      activity.assets = { ...activity.assets, smallImage: PAUSE, smallText: "Paused" };
    } else if (media?.playing === true && !clock) {
      activity.assets = { ...activity.assets, smallImage: PLAY, smallText: "Playing" };
    }
    if (buttons) {
      activity.buttons = [
        { label: "Watch Episode", url: page },
        { label: "View Anime", url: anime },
      ];
    }
    if (clock && media.start !== undefined) {
      activity.timestamps = {
        start: media.start,
        ...(media.end !== undefined && { end: media.end }),
      };
    }

    return activity;
  }

  const anime =
    section === "anime" && rest.length === 0 ? ANIME.exec(segment ?? "")?.groups : undefined;
  if (anime?.slug && anime.id) {
    if (hidden) return { ...base, details: "Browsing AnimeX", assets: picture() };
    const { slug, id } = anime;
    const page = `${ORIGIN}/anime/${slug}-${id}`;
    const name = shown(animeTitle(title, slug));

    return {
      ...base,
      url: page,
      details: name ? `Looking at ${name}` : "Looking at an anime",
      detailsUrl: page,
      assets: picture(coverOf(images, id), name),
      ...(buttons && { buttons: [{ label: "View Anime", url: page }] }),
    };
  }

  if (section === "user" && segment !== undefined && USER.test(segment) && rest.length === 0) {
    if (hidden) return { ...base, details: "Browsing AnimeX", assets: picture() };

    const shownAs = clean(PROFILE_TITLE.exec(title)?.groups?.name ?? "");
    const username = /^\d+$/.test(segment) ? undefined : segment;
    const name = shownAs ?? username;
    const page = `${ORIGIN}/user/${segment}`;
    const assets = picture(avatarOf(images, segment), name, avatars);

    return {
      ...base,
      url: page,
      details: name ? `Viewing ${name}'s profile` : "Viewing a profile",
      detailsUrl: page,
      ...(username && username !== name && { state: `@${username}` }),

      assets: assets?.smallImage ? assets : { ...assets, ...PEOPLE.get("user") },
      ...(buttons && { buttons: [{ label: "View Profile", url: page }] }),
    };
  }

  const known = Object.hasOwn(PAGES, section);
  return {
    ...base,
    ...(known && !hidden && LINKED.has(section) && { url: `${ORIGIN}/${section}` }),
    details: hidden || !known ? "Browsing AnimeX" : (PAGES[section] ?? "Browsing AnimeX"),
    assets: { ...picture(), ...(known && !hidden && PEOPLE.get(section)) },
    ...(buttons && { buttons: [{ label: "Open AnimeX", url: `${ORIGIN}/` }] }),
  };
}

const activity: NativeActivity = { detect };

export default activity;

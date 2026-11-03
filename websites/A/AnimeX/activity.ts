import type { Activity, NativeActivity, Page, PageImage, PageMedia, Settings } from "parousia";
import metadata from "./metadata.json";

/**
 * A watch page's address holds the anime's slug and the episode; the tab's
 * title only supplies the capitals. A Watch Together room's address holds just
 * the room, so its anime and episode come from the tab's title and the
 * anime's id from its cover. The player runs in an iframe, so playback comes
 * from `page.media` and is left out where the player reports nothing.
 */

const ORIGIN = "https://animex.one";
const NAME = "AnimeX";
const ROOM_NAME = "Watch Together Room";

const ASSETS = "https://raw.githubusercontent.com/parousia-project/activities/main/assets";
const MAX_TEXT = 100;

const PAUSED = { smallImage: `${ASSETS}/status/pause.png`, smallText: "Paused" };
const PLAYING = { smallImage: `${ASSETS}/status/play.png`, smallText: "Playing" };
const IN_ROOM = { smallImage: `${ASSETS}/status/users.png`, smallText: ROOM_NAME };
const PROFILE = { smallImage: `${ASSETS}/status/user.png`, smallText: "Profile" };
const BRAND = { smallImage: metadata.icon, smallText: NAME };
const PLAIN = { largeImage: metadata.icon, largeText: NAME };

const COVER =
  /^https:\/\/s4\.anilist\.co\/file\/anilistcdn\/media\/anime\/cover\/(?<size>[A-Za-z]+)\/[a-z]*(?<id>\d{1,9})-[\w-]+\.(?:jpg|png)$/;
const COVER_SIZES = ["large", "extraLarge", "medium"] as const;
const AVATAR = "https://cdn.animex.one/assets/avatars/";

const USER = /^[\w.-]{1,64}$/;
const ROOM = /^[\w-]{3,32}$/;
const WATCH = /^(?<slug>[a-z0-9]+(?:-[a-z0-9]+)*)-(?<id>\d{1,9})-episode-(?<episode>\d{1,5})$/;
const ANIME = /^(?<slug>[a-z0-9]+(?:-[a-z0-9]+)*)-(?<id>\d{1,9})$/;
const WATCH_TITLE =
  /^(?<title>.+?)\s+Episode\s+(?<episode>\d+)\s+English Sub\/Dub\s+[-–|]\s+AnimeX\s*$/i;
const ROOM_TITLE =
  /^Watch Together\s+[-–|]\s+(?<title>.+?)\s+[-–|]\s+Episode\s*(?<episode>\d{0,5})\s*$/i;
const PROFILE_TITLE = /^(?<name>.+?)['’]s Profile\s+[-–|]\s+AnimeX\s*$/i;
const ANIME_TITLE =
  /^Watch\s+(?<title>.+?)\s+Episodes in English Sub\/Dub Online for free\s+[-–|]\s+AnimeX\s*$/i;

const PAGES: Readonly<Record<string, string>> = {
  "": "Browsing AnimeX",
  home: "Browsing AnimeX",
  catalog: "Browsing the catalog",
  schedule: "Checking the release schedule",
  community: "Browsing the community",
  "community/forums": "Browsing the forums",
  "community/w2g": "Browsing Watch Together rooms",
  settings: "Changing settings",
  profile: "Viewing a profile",
  "profile/account": "Changing settings",
  faq: "Reading the FAQ",
  changelog: "Reading the changelog",
};

const BADGES: Readonly<Record<string, typeof IN_ROOM>> = {
  "community/w2g": IN_ROOM,
  profile: PROFILE,
};

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

function coverOf(
  images: readonly PageImage[] | undefined,
  fits: (id: string, alt: string | undefined) => boolean,
): { src: string; id: string } | undefined {
  let best: { src: string; id: string; rank: number } | undefined;
  for (const { src, alt } of images ?? []) {
    const found = COVER.exec(src)?.groups;
    const rank = COVER_SIZES.findIndex((wanted) => wanted === found?.size);
    if (found?.id && rank >= 0 && fits(found.id, alt) && (best === undefined || rank < best.rank)) {
      best = { src, id: found.id, rank };
    }
  }
  return best;
}

function avatarOf(images: readonly PageImage[] | undefined, user: string): string | undefined {
  return images?.find(
    (image) => image.src.startsWith(AVATAR) && image.alt?.toLowerCase() === user.toLowerCase(),
  )?.src;
}

const shown = (name: string): string | undefined => (name.length >= 2 ? name : undefined);

function links(slug: string, id: string, number?: string): { anime: string; episode?: string } {
  const key = `${slug}-${id}`;

  return {
    anime: `${ORIGIN}/anime/${key}`,
    ...(number !== undefined && { episode: `${ORIGIN}/watch/${key}-episode-${number}` }),
  };
}

function playback(media: PageMedia | undefined, timestamps: boolean) {
  const start = timestamps && media?.playing === true ? media.start : undefined;
  const end = media?.end;
  const clock = start !== undefined && (end === undefined || end > start);

  return {
    timestamps: clock ? { start, ...(end !== undefined && { end }) } : undefined,
    status:
      media?.playing === false ? PAUSED : media?.playing === true && !clock ? PLAYING : undefined,
  };
}

interface Watched {
  name?: string;
  number?: string;
  anime?: string;
  episode?: string;
  cover?: string;
  room?: string;
}

function watching(
  base: Activity,
  { name, number, anime, episode, cover, room }: Watched,
  media: PageMedia | undefined,
  settings: Settings,
): Activity {
  const { timestamps, status } = playback(media, settings.showTimestamps !== false);
  const picture = settings.showCover !== false ? cover : undefined;
  const state = [number === undefined ? undefined : `Episode ${number}`, room && ROOM_NAME]
    .filter((part) => part)
    .join(" · ");
  const small = status ?? (room ? IN_ROOM : picture ? BRAND : undefined);

  return {
    ...base,
    type: "watching",
    url: room ?? episode ?? base.url,
    details: name ?? "Watching anime",
    ...(anime && { detailsUrl: anime }),
    ...(state && { state }),
    ...(episode && { stateUrl: episode }),
    ...(name && { statusDisplayType: "details" as const }),
    assets: { largeImage: picture ?? metadata.icon, largeText: name ?? NAME, ...small },
    ...(timestamps && { timestamps }),
    ...(room &&
      settings.showJoinButton !== false && { buttons: [{ label: "Join Party", url: room }] }),
  };
}

function detect({ url, title, media, images }: Page, settings: Settings): Activity {
  const path = url.pathname.split("/").filter(Boolean);
  const [section = "", segment, ...rest] = path;
  const hidden = settings.privacyMode === true;

  const base: Activity = { id: "animex", name: NAME, url: `${ORIGIN}/` };
  const generic: Activity = { ...base, details: "Browsing AnimeX", assets: PLAIN };
  const privateWatch: Activity = {
    ...base,
    type: "watching",
    details: "Watching anime",
    assets: PLAIN,
  };

  const watch =
    section === "watch" && rest.length === 0 ? WATCH.exec(segment ?? "")?.groups : undefined;
  if (watch?.slug && watch.id && watch.episode) {
    if (hidden) return privateWatch;
    const { slug, id } = watch;
    const number = String(Number(watch.episode));

    return watching(
      base,
      {
        name: shown(animeTitle(title, slug, watch.episode)),
        number,
        ...links(slug, id, number),
        cover: coverOf(images, (found) => found === id)?.src,
      },
      media,
      settings,
    );
  }

  if (section === "w2g" && segment !== undefined && ROOM.test(segment) && rest.length === 0) {
    if (hidden) return privateWatch;
    const room = `${ORIGIN}/w2g/${segment}`;
    const found = ROOM_TITLE.exec(title)?.groups;
    const named = clean(found?.title ?? "");
    const name = named === "Watch Together" ? undefined : named;
    if (name === undefined) {
      return {
        ...base,
        type: "watching",
        url: room,
        details: "Joining a Watch Together room",
        assets: { ...PLAIN, ...IN_ROOM },
      };
    }

    const number = found?.episode ? String(Number(found.episode)) : undefined;
    const slug = slugOf(name);
    const cover = coverOf(images, (_, alt) => alt !== undefined && slugOf(alt) === slug);

    return watching(
      base,
      {
        name,
        number,
        room,
        cover: cover?.src,
        ...(cover && links(slug || "anime", cover.id, number)),
      },
      media,
      settings,
    );
  }

  const anime =
    section === "anime" && rest.length === 0 ? ANIME.exec(segment ?? "")?.groups : undefined;
  if (anime?.slug && anime.id) {
    if (hidden) return generic;
    const { slug, id } = anime;
    const page = links(slug, id).anime;
    const name = shown(animeTitle(title, slug));
    const cover =
      settings.showCover !== false ? coverOf(images, (found) => found === id) : undefined;

    return {
      ...base,
      url: page,
      details: name ? `Looking at ${name}` : "Looking at an anime",
      detailsUrl: page,
      assets: {
        largeImage: cover?.src ?? metadata.icon,
        largeText: name ?? NAME,
        ...(cover && BRAND),
      },
    };
  }

  if (section === "user" && segment !== undefined && USER.test(segment) && rest.length === 0) {
    if (hidden) return generic;

    const display = clean(PROFILE_TITLE.exec(title)?.groups?.name ?? "");
    const username = /^\d+$/.test(segment) ? undefined : segment;
    const name = display ?? username;
    const page = `${ORIGIN}/user/${segment}`;
    const avatar = avatarOf(images, segment);

    return {
      ...base,
      url: page,
      details: name ? `Viewing ${name}'s profile` : "Viewing a profile",
      detailsUrl: page,
      ...(username && username !== name && { state: `@${username}` }),
      assets: {
        largeImage: avatar ?? metadata.icon,
        largeText: name ?? NAME,
        ...(avatar ? BRAND : PROFILE),
      },
    };
  }

  const pair = `${section}/${segment ?? ""}`;
  const key = Object.hasOwn(PAGES, pair) ? pair : section;
  const details = Object.hasOwn(PAGES, key) ? PAGES[key] : undefined;
  if (hidden || details === undefined) return generic;

  return {
    ...base,
    details,
    assets: { ...PLAIN, ...(Object.hasOwn(BADGES, key) && BADGES[key]) },
  };
}

const activity: NativeActivity = { detect };

export default activity;

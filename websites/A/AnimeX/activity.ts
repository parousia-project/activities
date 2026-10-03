import type { Activity, NativeActivity, Page, PageImage, Settings } from "parousia";

/**
 * AnimeX (animex.one). A watch page is `/watch/<slug>-<AniList id>-episode-<n>`
 * and an anime's own page `/anime/<slug>-<AniList id>`; the slug is the
 * title in lowercase, so the title and episode come from the address, and
 * the tab's title ("DAN DA DAN Season 2 Episode 1 English Sub/Dub - AnimeX")
 * only supplies the title's capitals.
 *
 * The cover is the AniList cover AnimeX shows on the page: its address has a
 * hash in it that nothing but the page knows, so it's one of the page's loaded
 * images (`page.images`, with `thumbnails` granted), the one whose address
 * names this anime's id. The same goes for a profile's picture, on AnimeX's
 * own CDN, picked by the alt text that names the profile. Without them the
 * AnimeX logo shows. (og:image is no help: it's a banner card, or an episode
 * still.)
 *
 * AnimeX plays in an iframe (plyr.animex.one, or another provider's embed),
 * and which of Sub or Dub and which provider is playing is state of the
 * page: it's in neither the address nor the title, so it isn't shown. The
 * playback clock is `page.media`, which Parousia's collector takes from what
 * the player tells the page: exact for AnimeX's own player (pause, seeks and
 * speed included, the same whichever of Sub or Dub it is), and for KOTO a
 * stream that stops when it's paused. ZEN reports no time at all, so on it,
 * and wherever the collector hears nothing, there are no timestamps rather
 * than invented ones. A pause shows as the pause icon; the play icon is only for
 * an episode that's playing with no clock to show, and a player that says
 * nothing gets neither. The home page plays a muted
 * background video, so `media` counts on watch pages only.
 *
 * Links are rebuilt from the slug, id and episode, never the query or
 * fragment (`?t=` is where someone's position is, `?c=` a comment).
 */
const ORIGIN = "https://animex.one";
const NAME = "AnimeX";
/** A PNG: Discord shows these, and a favicon request returns an .ico it may not. */
const LOGO = `${ORIGIN}/icons/ios/180.png`;
/** Images this repository hosts (assets/), served by GitHub. */
const ASSETS = "https://raw.githubusercontent.com/parousia-project/activities/main/assets";
const PLAY = `${ASSETS}/status/play.png`;
const PAUSE = `${ASSETS}/status/pause.png`;
const MAX_TEXT = 100;
/** Sizes of AniList cover to take, best first. */
const COVER_SIZES = ["large", "extraLarge", "medium"] as const;
const AVATAR = "https://cdn.animex.one/assets/avatars/";
/** What a profile's address names: a username or an id. */
const USER = /^[\w.-]{1,64}$/;

const WATCH = /^(?<slug>[a-z0-9]+(?:-[a-z0-9]+)*)-(?<id>\d{1,9})-episode-(?<episode>\d{1,5})$/;
const ANIME = /^(?<slug>[a-z0-9]+(?:-[a-z0-9]+)*)-(?<id>\d{1,9})$/;
const WATCH_TITLE =
  /^(?<title>.+?)\s+Episode\s+(?<episode>\d+)\s+English Sub\/Dub\s+[-–|]\s+AnimeX\s*$/i;
const PROFILE_TITLE = /^(?<name>.+?)['’]s Profile\s+[-–|]\s+AnimeX\s*$/i;
const ANIME_TITLE =
  /^Watch\s+(?<title>.+?)\s+Episodes in English Sub\/Dub Online for free\s+[-–|]\s+AnimeX\s*$/i;

/** What each top-level page is, for the details line. */
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
/** Pages whose address is the same for everyone, so it's safe to link. */
const LINKED = new Set(["catalog", "schedule", "community"]);

/** Titles are AnimeX's, but a stale or odd tab shouldn't get through: no control or direction-override characters, and a length cap. */
function clean(value: string): string | undefined {
  const text = value
    .replace(/[\p{Cc}​-‏‪-‮⁦-⁩﻿]/gu, "")
    .replace(/\s+/g, " ")
    .trim();

  return text.length >= 2 ? [...text].slice(0, MAX_TEXT).join("") : undefined;
}

/** "DAN DA DAN Season 2" is "dan-da-dan-season-2", the way AnimeX writes its addresses. */
const slugOf = (title: string): string =>
  title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

/** "dan-da-dan-season-2" is "Dan Da Dan Season 2": all the address says of the capitals. */
function fromSlug(slug: string): string {
  const text = slug
    .split("-")
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(" ");

  return [...text].slice(0, MAX_TEXT).join("");
}

/**
 * The anime's title: the tab's when it's this page's, else the slug's. A
 * single-page site sets its title a moment after the address changes, so the
 * tab can still be the last page's; its title only counts if it spells this
 * slug (and, on a watch page, this episode).
 */
export function animeTitle(title: string, slug: string, episode?: string): string {
  const found = episode === undefined ? ANIME_TITLE.exec(title) : WATCH_TITLE.exec(title);
  const named = found?.groups?.title;
  const matching =
    found?.groups?.episode === undefined || Number(found.groups.episode) === Number(episode);
  const text = named !== undefined && matching ? clean(named) : undefined;

  return text !== undefined && slugOf(text) === slug ? text : fromSlug(slug);
}

/**
 * The AniList cover of anime `id` among the page's images: its address names
 * the id (`bx185660-<hash>.jpg`), so another anime's cover on the page (a
 * recommendation, a sequel) can't be taken for it.
 */
export function coverOf(images: readonly PageImage[] | undefined, id: string): string | undefined {
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

/**
 * The profile picture of `user` among the page's images: AnimeX's own CDN
 * avatar whose alt text is the username. The signed-in person's own avatar
 * is on the page too, so one that isn't named for this profile is never it.
 */
export function avatarOf(
  images: readonly PageImage[] | undefined,
  user: string,
): string | undefined {
  return images?.find(
    (image) => image.src.startsWith(AVATAR) && image.alt?.toLowerCase() === user.toLowerCase(),
  )?.src;
}

/** A one-letter title is under what Discord takes, so it's no title. */
const shown = (name: string): string | undefined => (name.length >= 2 ? name : undefined);

function detect({ url, title, media, images }: Page, settings: Settings): Activity {
  const path = url.pathname.split("/").filter(Boolean);
  const [section = "", segment, ...rest] = path;
  const hidden = settings.privacyMode === true;
  const covers = !hidden && settings.showCover !== false;
  const avatars = !hidden && settings.showAvatars !== false;
  const buttons = !hidden && settings.showButtons !== false;

  const base: Activity = { id: "animex", name: NAME, url: `${ORIGIN}/` };
  /** The large image (a cover or a picture, when `shown`, else the logo), captioned; the logo is small beside a picture. */
  const picture = (large?: string, text?: string, shown = covers): Activity["assets"] => ({
    largeImage: shown && large !== undefined ? large : LOGO,
    largeText: text !== undefined && !hidden ? text : NAME,
    ...(shown && large !== undefined && { smallImage: LOGO, smallText: NAME }),
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
    // The status in the member list is the anime, not "AnimeX".
    if (name) activity.statusDisplayType = "details";
    activity.assets = picture(coverOf(images, id), name);
    const clock =
      settings.showTimestamps !== false &&
      media?.playing === true &&
      media.start !== undefined &&
      (media.end === undefined || media.end > media.start);
    // The pause icon says it's paused. The play icon is for a playing episode with no clock to show
    // (the player gave none, as ZEN doesn't, or it's off); with a clock, that says it. Nothing
    // where the player said nothing.
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
    // "Abadima.exe's Profile - AnimeX": the name they go by; the address has the username.
    const shownAs = clean(PROFILE_TITLE.exec(title)?.groups?.name ?? "");
    const username = /^\d+$/.test(segment) ? undefined : segment;
    const name = shownAs ?? username;
    const page = `${ORIGIN}/user/${segment}`;

    return {
      ...base,
      url: page,
      details: name ? `Viewing ${name}'s profile` : "Viewing a profile",
      detailsUrl: page,
      ...(username && username !== name && { state: `@${username}` }),
      assets: picture(avatarOf(images, segment), name, avatars),
      ...(buttons && { buttons: [{ label: "View Profile", url: page }] }),
    };
  }

  const known = Object.hasOwn(PAGES, section);
  return {
    ...base,
    ...(known && !hidden && LINKED.has(section) && { url: `${ORIGIN}/${section}` }),
    details: hidden || !known ? "Browsing AnimeX" : (PAGES[section] ?? "Browsing AnimeX"),
    assets: picture(),
    ...(buttons && { buttons: [{ label: "Open AnimeX", url: `${ORIGIN}/` }] }),
  };
}

const activity: NativeActivity = { detect };

export default activity;

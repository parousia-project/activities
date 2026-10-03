import type { Activity, NativeActivity, Page, Settings } from "parousia";

/**
 * AnimeX (animex.one). A watch page is `/watch/<slug>-<AniList id>-episode-<n>`
 * and an anime's own page `/anime/<slug>-<AniList id>`; the slug is the
 * title in lowercase, so the title and episode come from the address, and
 * the tab's title ("DAN DA DAN Season 2 Episode 1 English Sub/Dub - AnimeX")
 * only supplies the title's capitals. The cover is AniList's, the same
 * `img.anili.st/media/<id>` AnimeX gives as an anime page's og:image.
 *
 * AnimeX plays in an iframe (plyr.animex.one, or another provider's embed),
 * and which of Sub or Dub and which provider is playing is state of the
 * page: it's in neither the address nor the title, so it isn't shown. The
 * playback clock is `page.media`, which Parousia's collector takes from what
 * the player tells the page: exact for AnimeX's own player (pause, seeks and
 * speed included, the same whichever of Sub or Dub it is), and for KOTO a
 * stream that stops when it's paused. ZEN reports no time at all, so on it,
 * and wherever the collector hears nothing, there are no timestamps rather
 * than invented ones. The home page plays a muted background video, so
 * `media` counts on watch pages only.
 *
 * Links are rebuilt from the slug, id and episode, never the query or
 * fragment (`?t=` is where someone's position is, `?c=` a comment).
 */
const ORIGIN = "https://animex.one";
const NAME = "AnimeX";
/** A PNG: Discord shows these, and a favicon request returns an .ico it may not. */
const LOGO = `${ORIGIN}/icons/ios/180.png`;
const COVER = "https://img.anili.st/media";
const MAX_TEXT = 100;

const WATCH = /^(?<slug>[a-z0-9]+(?:-[a-z0-9]+)*)-(?<id>\d{1,9})-episode-(?<episode>\d{1,5})$/;
const ANIME = /^(?<slug>[a-z0-9]+(?:-[a-z0-9]+)*)-(?<id>\d{1,9})$/;
const WATCH_TITLE =
  /^(?<title>.+?)\s+Episode\s+(?<episode>\d+)\s+English Sub\/Dub\s+[-–|]\s+AnimeX\s*$/i;
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

/** A one-letter title is under what Discord takes, so it's no title. */
const shown = (name: string): string | undefined => (name.length >= 2 ? name : undefined);

function detect({ url, title, media }: Page, settings: Settings): Activity {
  const path = url.pathname.split("/").filter(Boolean);
  const [section = "", segment, ...rest] = path;
  const hidden = settings.privacyMode === true;

  const base: Activity = { id: "animex", name: NAME, url: `${ORIGIN}/` };
  const picture = (id?: string, text?: string): Activity["assets"] => ({
    largeImage:
      id !== undefined && !hidden && settings.showCover !== false ? `${COVER}/${id}` : LOGO,
    largeText: text !== undefined && !hidden ? text : NAME,
  });

  const watch =
    section === "watch" && rest.length === 0 ? WATCH.exec(segment ?? "")?.groups : undefined;
  if (watch?.slug && watch.id && watch.episode) {
    const { slug, id, episode } = watch;
    const number = String(Number(episode));
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
    activity.state = paused ? `Episode ${number} (paused)` : `Episode ${number}`;
    activity.assets = picture(id, name);
    activity.buttons = [{ label: "Watch on AnimeX", url: page }];
    if (
      settings.showTimestamps !== false &&
      media?.playing === true &&
      media.start !== undefined &&
      (media.end === undefined || media.end > media.start)
    ) {
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
      assets: picture(id, name),
      buttons: [{ label: "View on AnimeX", url: page }],
    };
  }

  const known = Object.hasOwn(PAGES, section);
  return {
    ...base,
    ...(known && !hidden && LINKED.has(section) && { url: `${ORIGIN}/${section}` }),
    details: hidden || !known ? "Browsing AnimeX" : (PAGES[section] ?? "Browsing AnimeX"),
    assets: picture(),
    buttons: [{ label: "Open AnimeX", url: `${ORIGIN}/` }],
  };
}

const activity: NativeActivity = { detect };

export default activity;

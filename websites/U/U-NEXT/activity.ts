import type { Activity, NativeActivity, Page, Settings } from "parousia";

/**
 * U-NEXT (video.unext.jp, unext.jp). A watch page (`/play/<title>/<episode>`,
 * or `/live/<code>` for a live stream) shows that someone is watching and
 * how far along they are: the playing video's clock, which Parousia reads for
 * any site that declares `media`, and a title only if the page's Media
 * Session has one. A title's or live stream's own page (`/title/<id>`,
 * `/livedetail/<code>`, or the same id as `?td=` or `?lc=` over the
 * browsing pages) is named from the tab's title ("Name | U-NEXT") and its
 * picture, when the page gives them. Nothing is read from U-NEXT's markup,
 * and its GraphQL API, which PreMiD's Activity calls for titles, is never
 * called.
 *
 * Written for Parousia; it isn't derived from PreMiD's U-NEXT Activity.
 */

const ORIGIN = "https://video.unext.jp";
const NAME = "U-NEXT";
const ICON = "https://video.unext.jp/apple-touch-icon.png";
const MAX_TEXT = 100;
/** The ids in an address: a title's `SID…`, an episode's `ED…`, a live stream's code. */
const ID = /^[A-Za-z0-9]{1,32}$/;
const TITLE_SUFFIX = /\s*[|｜]\s*U-NEXT(?:[（(][^)）]*[)）])?\s*$/i;

/** Titles are U-NEXT's, but a Media Session is a page's to fill: no control or direction-override characters, and a length cap. */
function clean(value: string | undefined): string | undefined {
  const text = value
    ?.replace(/[\p{Cc}​-‏‪-‮⁦-⁩﻿]/gu, "")
    .replace(/\s+/g, " ")
    .trim();

  return text && text.length >= 2 ? [...text].slice(0, MAX_TEXT).join("") : undefined;
}

/**
 * "Name | U-NEXT" is "Name". The site's own title, which every page has
 * before it loads one ("U-NEXT（ユーネクスト）-映画 / ドラマ…"), and a tab that
 * doesn't end like that, name nothing.
 */
function titleFromTab(tab: string): string | undefined {
  if (!TITLE_SUFFIX.test(tab)) return undefined;
  const title = clean(tab.replace(TITLE_SUFFIX, ""));

  return title && !title.startsWith(NAME) ? title : undefined;
}

/** The site's own share picture is on every page, so it's no picture of anything. */
const isSitePicture = (image: string): boolean => /\/static\/media\/ogp\./.test(image);

function detect({ url, title, media, thumbnail }: Page, settings: Settings): Activity | null {
  const [section, first, second] = url.pathname.split("/").filter(Boolean);
  const hidden = settings.privacyMode === true;
  const base: Activity = { id: "u-next", name: NAME, url: `${ORIGIN}/` };
  const picture = (shown: string | undefined): Activity["assets"] => ({
    largeImage:
      (!hidden && settings.showCover !== false && shown && !isSitePicture(shown)
        ? shown
        : undefined) ?? ICON,
    largeText: NAME,
  });

  const playing =
    section === "play" && first !== undefined && second !== undefined
      ? { page: `/play/${first}/${second}`, ok: ID.test(first) && ID.test(second), live: false }
      : section === "live" && first !== undefined
        ? { page: `/live/${first}`, ok: ID.test(first), live: true }
        : null;

  if (playing?.ok) {
    const watched = hidden ? undefined : clean(media?.title);
    const paused = media?.playing === false;
    const activity: Activity = {
      ...base,
      type: "watching",
      details: watched ?? (playing.live ? "Watching a live stream" : "Watching U-NEXT"),
      assets: picture(thumbnail),
    };

    if (!hidden) {
      const state = clean(media?.artist);
      const shown = state ? (paused ? `${state} (paused)` : state) : paused ? "Paused" : undefined;
      if (shown !== undefined) activity.state = shown;
      activity.buttons = [{ label: "Watch on U-NEXT", url: `${ORIGIN}${playing.page}` }];
    }
    if (
      !hidden &&
      settings.showTimestamps !== false &&
      media?.playing &&
      media.start !== undefined
    ) {
      activity.timestamps = {
        start: media.start,
        ...(media.end !== undefined && { end: media.end }),
      };
    }

    return activity;
  }

  // Everything but watching is browsing: nothing at all when that's turned off, and in privacy mode, as PreMiD's is.
  if (hidden || settings.showBrowsingStatus === false) return null;

  // A title or live stream's page, or its card over the browsing pages.
  const titleId = section === "title" ? first : url.searchParams.get("td");
  const liveId = section === "livedetail" ? first : url.searchParams.get("lc");
  const isTitle = titleId !== null && titleId !== undefined && ID.test(titleId);
  const isLive = liveId !== null && liveId !== undefined && ID.test(liveId);

  if (isTitle || isLive) {
    const named = titleFromTab(title);
    const link = isTitle ? `${ORIGIN}/title/${titleId}` : `${ORIGIN}/livedetail/${liveId}`;

    return {
      ...base,
      details: isTitle ? "Looking at a title" : "Looking at a live stream",
      ...(named && { state: named }),
      assets: picture(thumbnail),
      buttons: [{ label: isTitle ? "View on U-NEXT" : "Watch on U-NEXT", url: link }],
    };
  }

  return { ...base, details: "Browsing U-NEXT", assets: picture(undefined) };
}

const activity: NativeActivity = { detect };

export default activity;

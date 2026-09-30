/**
 * The Activity API, version 1 (`"apiVersion": 1` in metadata.json): what a
 * native Activity is handed and what it gives back. Parousia's browser
 * extension implements it (github.com/Abadima/RPC, `browser/src/core/api.ts`)
 * and checks every Activity here against its own copy when it builds, so the
 * two can't drift apart unnoticed.
 */
declare module "parousia" {
  /**
   * Page data an Activity can declare in metadata.json's `data`: what it may
   * take from the page itself, beyond its URL and title. Each needs access to
   * the site, which people grant explicitly, and can be switched off.
   */
  export type PageDataKind = "media" | "thumbnails";

  /**
   * What's playing on a page: its Media Session (title, artist, album, and its
   * own say on whether it's playing), and its media element for the clock.
   */
  export interface PageMedia {
    title?: string;
    artist?: string;
    album?: string;
    playing?: boolean;
    /** Seconds. */
    duration?: number;
    /**
     * While playing, when the item started and will end if it plays straight
     * through, in Unix milliseconds: an Activity's `timestamps` as they are.
     * They change only when playback is seeked or restarted, not as it plays.
     */
    start?: number;
    end?: number;
  }

  /**
   * What an Activity sees of a page: its URL and title (both come from the
   * browser's `tabs` permission), and, if it declares page data, what
   * Parousia read of it. Parousia reads only what it declares, only once the
   * site is granted, and only what the user left on: `granted` says which it
   * has here, and without them an Activity works from the URL and title.
   */
  export interface Page {
    readonly url: URL;
    readonly title: string;
    readonly granted: readonly PageDataKind[];
    /** With `media` granted: what's playing, when the page says. */
    readonly media?: PageMedia;
    /** With `thumbnails` granted: an `https` image of what's shown, when the page has one. */
    readonly thumbnail?: string;
  }

  export type SettingValue = string | number | boolean;

  /**
   * The Activity's settings from metadata.json, each as the user set it or at
   * its default. A `choice` setting is the index of the chosen option.
   */
  export type Settings = Readonly<Record<string, SettingValue>>;

  export interface ActivityAssets {
    /** An `https` image URL. */
    largeImage?: string;
    largeText?: string;
    smallImage?: string;
    smallText?: string;
  }

  export interface ActivityTimestamps {
    /** Unix milliseconds. Shown as time elapsed. */
    start?: number;
    /** Unix milliseconds. Shown as time left. */
    end?: number;
  }

  export interface ActivityButton {
    label: string;
    /** `http(s)` only. */
    url: string;
  }

  export interface Activity {
    /** The Activity's id from metadata.json. */
    id: string;
    name: string;
    details?: string;
    state?: string;
    /** The page, without its query string or fragment unless those name what's shown. */
    url: string;
    assets?: ActivityAssets;
    timestamps?: ActivityTimestamps;
    /** Links for the details and state lines; `http(s)` only. */
    detailsUrl?: string;
    stateUrl?: string;
    /** At most two. Discord shows them to others, not to you. */
    buttons?: ActivityButton[];
  }

  /** What `activity.ts` exports as its default. */
  export interface NativeActivity {
    /**
     * Called for each page matching metadata.json's `matches`, and again when
     * its title changes. `null`: nothing to show on this page.
     */
    detect(page: Page, settings: Settings): Activity | null;
  }
}

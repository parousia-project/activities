import type { PageDataKind, PageImage, PageMedia, Settings } from "parousia";
import { matchesAny } from "../../tools/match-pattern";
import type { Metadata } from "../../tools/metadata";

/**
 * Letters-only strings no Activity may copy from an address or a title: if one comes out, something leaked.
 */

export const CANARY = {
  query: "CANARYQUERY",
  fragment: "CANARYFRAGMENT",
  title: "CANARYTITLE",
  media: "CANARYMEDIA",
  artist: "CANARYARTIST",
  album: "CANARYALBUM",
  thumbnail: "CANARYTHUMBNAIL",
} as const;

export const PRIVATE: readonly string[] = [
  CANARY.title,
  CANARY.media,
  CANARY.artist,
  CANARY.album,
  CANARY.thumbnail,
];

export interface PageInput {
  granted?: PageDataKind[];
  media?: PageMedia;
  thumbnail?: string;
  images?: PageImage[];
}

const PATTERN = /^(\*|https?):\/\/(\*\.)?([^/]+)(\/.*)$/;

export function urlsFor(
  metadata: Pick<Metadata, "matches">,
  extra: readonly string[] = [],
): string[] {
  const urls = new Set<string>();
  const tail = (url: string): string => {
    const bare = url.replace(/#.*$/, "");

    return `${bare}${bare.includes("?") ? "&" : "?"}zz_canary=${CANARY.query}#${CANARY.fragment}`;
  };
  for (const pattern of metadata.matches) {
    const [, scheme, subdomains, host, path] = PATTERN.exec(pattern) ?? [];
    if (!host || !path) continue;
    const own = path.replace(/\*+/g, "") || "/";

    const hosts = subdomains ? [`www.${host}`, `zz-subdomain.${host}`] : [host];
    for (const name of hosts) {
      const origin = `${scheme === "http" ? "http" : "https"}://${name}`;
      for (const route of [
        own,
        "/",
        "/a",
        "/a/b/c",
        "/constructor",
        "/toString",
        "/search",
        "/watch?v=dQw4w9WgXcQ",
        "/title/80100172",
      ]) {
        const url = new URL(`${origin}${route}`);

        if (matchesAny(metadata.matches, url)) urls.add(tail(url.href));
      }
    }
  }
  for (const url of extra) urls.add(tail(url));

  return [...urls];
}

export const TITLES: readonly string[] = [
  "",
  `${CANARY.title} - Site`,
  `(3) ${CANARY.title}‮\u0000 | `.padEnd(260, "y"),
];

const playing: PageMedia = {
  kind: "video",
  playing: true,
  duration: 3000,
  start: 1_700_000_000_000,
  end: 1_700_003_000_000,
};

export function pageData(
  metadata: Pick<Metadata, "data">,
): Array<{ name: string; sane: boolean; input: PageInput }> {
  const media = metadata.data?.includes("media") ?? false;
  const thumbnails = metadata.data?.includes("thumbnails") ?? false;
  const out: Array<{ name: string; sane: boolean; input: PageInput }> = [
    { name: "no page data", sane: true, input: {} },
  ];
  if (media) {
    out.push(
      { name: "a clock, nothing named", sane: true, input: { granted: ["media"], media: playing } },
      {
        name: "names",
        sane: true,
        input: {
          granted: ["media"],
          media: { ...playing, title: CANARY.media, artist: CANARY.artist, album: CANARY.album },
        },
      },
      {
        name: "paused",
        sane: true,
        input: { granted: ["media"], media: { ...playing, playing: false, title: CANARY.media } },
      },
      {
        name: "empty and missing fields",
        sane: true,
        input: { granted: ["media"], media: { title: "", artist: "", playing: undefined } },
      },
      {
        name: "a start with no end",
        sane: true,
        input: {
          granted: ["media"],
          media: { playing: true, start: 1_700_000_000_000, title: CANARY.media },
        },
      },
      {
        name: "long names, control and direction characters",
        sane: false,
        input: {
          granted: ["media"],
          media: {
            ...playing,
            title: `${CANARY.media}‮\u0000${"m".repeat(300)}`,
            artist: `${CANARY.artist}\u0007${"a".repeat(300)}`,
          },
        },
      },
    );
  }
  if (thumbnails) {
    out.push(
      {
        name: "a thumbnail and pictures",
        sane: true,
        input: {
          granted: [...(media ? (["media"] as const) : []), "thumbnails"],
          ...(media && { media: { ...playing, title: CANARY.media, artist: CANARY.artist } }),
          thumbnail: `https://img.example/${CANARY.thumbnail}.jpg`,
          images: [{ src: `https://img.example/${CANARY.thumbnail}2.jpg`, alt: CANARY.thumbnail }],
        },
      },
      { name: "no pictures", sane: true, input: { granted: ["thumbnails"], images: [] } },
    );
  }

  return out;
}

export function settingsFor(
  metadata: Pick<Metadata, "settings">,
): Array<{ name: string; value: Settings }> {
  const list = metadata.settings ?? [];
  const base = Object.fromEntries(list.map((setting) => [setting.id, setting.default]));
  const out: Array<{ name: string; value: Settings }> = [{ name: "defaults", value: base }];
  const switches = list.filter((setting) => setting.type === "boolean");
  if (switches.length > 0) {
    out.push(
      {
        name: "all on",
        value: { ...base, ...Object.fromEntries(switches.map((s) => [s.id, true])) },
      },
      {
        name: "all off",
        value: { ...base, ...Object.fromEntries(switches.map((s) => [s.id, false])) },
      },
    );
  }
  for (const setting of list.filter((s) => s.type === "choice")) {
    for (let index = 0; index < (setting.choices?.length ?? 0); index++) {
      out.push({
        name: `${setting.id} = choice ${index}`,
        value: { ...base, [setting.id]: index },
      });
    }
  }

  return out;
}

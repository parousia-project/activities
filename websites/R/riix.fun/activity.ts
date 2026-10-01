import type { Activity, NativeActivity, Page } from "parousia";

const ORIGIN = "https://riix.fun";
const NAME = "riix's Slayers 2 Wiki";
const ICON = `${ORIGIN}/favicon-180.png`;

const SAFE_SLUG = /^[a-z0-9-]{1,64}$/;

const GUIDE_NAMES: Readonly<Record<string, string>> = {
  "fishing-macro": "Midnytes Fishing Macro Setup",
  "black-marketer": "Black Marketer",
  "getting-started": "Getting Started",
  "final-selection": "Final Selection",
  "become-demon": "How to Become a Demon",
  trainers: "Breathing Trainer Locations",
  "breathing-boost": "Breathing Boost & Slayer Progress",
  "demon-fighting-styles": "Demon Fighting Styles: Soryu & Reaper",
  "tai-chi": "Tai Chi Fighting Style",
  "mushroom-lit-lantern": "How to Get the Mushroom Lit Lantern",
};

const BREATHING_NAMES: Readonly<Record<string, string>> = {
  water: "Water Breathing",
  thunder: "Thunder Breathing",
  serpent: "Serpent Breathing",
  flame: "Flame Breathing",
  sound: "Sound Breathing",
  insect: "Insect Breathing",
  wind: "Wind Breathing",
  stone: "Stone Breathing",
  beast: "Beast Breathing",
};

const DEMON_ART_NAMES: Readonly<Record<string, string>> = {
  "ice-manipulation": "Ice Manipulation",
  shockwave: "Shockwave",
  tamari: "Tamari Manipulation",
  "dream-manipulation": "Dream Manipulation",
  "blood-manipulation": "Blood Manipulation",
  "arrow-manipulation": "Arrow Manipulation",
  reaper: "Reaper",
  "explosive-blood": "Explosive Blood",
  "obi-manipulation": "Obi Manipulation",
};

const GEAR_NAMES: Readonly<Record<string, string>> = {
  "ouwigahara-tower-gear": "Ouwigahara Tower Gear (V2)",
  "nightfall-katana": "Nightfall Katana",
  "firstlight-katana": "Firstlight Katana",
  "nightfall-sickles": "Nightfall Sickles",
  "legendary-fishing-rod": "Legendary Fishing Rod",
};

function cleanSlug(slug: string | undefined): string | null {
  if (!slug || !SAFE_SLUG.test(slug)) return null;

  return slug
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function knownName(
  slug: string | undefined,
  names: Readonly<Record<string, string>>,
): string | null {
  if (!slug || !SAFE_SLUG.test(slug)) return null;
  return names[slug] ?? cleanSlug(slug);
}

function detect({ url }: Page): Activity {
  const [section, slug] = url.pathname.split("/").filter(Boolean);

  const base: Activity = {
    id: "riix-fun",
    name: NAME,
    url: ORIGIN,
    assets: {
      largeImage: ICON,
      largeText: NAME,
    },
    buttons: [
      {
        label: "Open Slayers 2 Best Wiki",
        url: ORIGIN,
      },
    ],
  };

  // Home
  if (!section) {
    return {
      ...base,
      details: "Browsing the Slayers 2 Wiki",
    };
  }

  // Codes
  if (section === "codes") {
    return {
      ...base,
      url: `${ORIGIN}/codes`,
      details: "Viewing Slayers 2 Codes",
    };
  }

  // Tier List
  if (section === "tier-list") {
    return {
      ...base,
      url: `${ORIGIN}/tier-list`,
      details: "Viewing the Tier List",
    };
  }

  // Guides + individual guide pages
  if (section === "guides") {
    const name = knownName(slug, GUIDE_NAMES);

    if (name && slug) {
      const pageUrl = `${ORIGIN}/guides/${slug}`;

      return {
        ...base,
        url: pageUrl,
        details: "Viewing Guides",
        state: name,
        detailsUrl: `${ORIGIN}/guides`,
        stateUrl: pageUrl,
      };
    }

    return {
      ...base,
      url: `${ORIGIN}/guides`,
      details: "Viewing Guides",
    };
  }

  // Breathing + individual styles
  if (section === "breathing") {
    const name = knownName(slug, BREATHING_NAMES);

    if (name && slug) {
      const pageUrl = `${ORIGIN}/breathing/${slug}`;

      return {
        ...base,
        url: pageUrl,
        details: "Viewing Breathing Styles",
        state: name,
        detailsUrl: `${ORIGIN}/breathing`,
        stateUrl: pageUrl,
      };
    }

    return {
      ...base,
      url: `${ORIGIN}/breathing`,
      details: "Viewing Breathing Styles",
    };
  }

  // Blood Demon Arts + individual arts
  if (section === "demon-arts") {
    const name = knownName(slug, DEMON_ART_NAMES);

    if (name && slug) {
      const pageUrl = `${ORIGIN}/demon-arts/${slug}`;

      return {
        ...base,
        url: pageUrl,
        details: "Viewing Blood Demon Arts",
        state: name,
        detailsUrl: `${ORIGIN}/demon-arts`,
        stateUrl: pageUrl,
      };
    }

    return {
      ...base,
      url: `${ORIGIN}/demon-arts`,
      details: "Viewing Blood Demon Arts",
    };
  }

  // Clans
  if (section === "clans") {
    return {
      ...base,
      url: `${ORIGIN}/clans`,
      details: "Viewing Clans",
      state: "Clan Stats & Spin Odds",
    };
  }

  // Gear + individual items
  if (section === "gear") {
    const name = knownName(slug, GEAR_NAMES);

    if (name && slug) {
      const pageUrl = `${ORIGIN}/gear/${slug}`;

      return {
        ...base,
        url: pageUrl,
        details: "Viewing Gear",
        state: name,
        detailsUrl: `${ORIGIN}/gear`,
        stateUrl: pageUrl,
      };
    }

    return {
      ...base,
      url: `${ORIGIN}/gear`,
      details: "Viewing Gear",
    };
  }

  // Builds
  if (section === "builds") {
    return {
      ...base,
      url: `${ORIGIN}/builds`,
      details: "Viewing Builds",
      state: "Slayer & Demon Builds",
    };
  }

  // NPC Directory
  if (section === "npcs") {
    return {
      ...base,
      url: `${ORIGIN}/npcs`,
      details: "Browsing the NPC Directory",
    };
  }

  // Titles
  if (section === "titles") {
    return {
      ...base,
      url: `${ORIGIN}/titles`,
      details: "Viewing Titles",
    };
  }

  // Updates
  if (section === "updates") {
    return {
      ...base,
      url: `${ORIGIN}/updates`,
      details: "Reading Slayers 2 Updates",
    };
  }

  // Saved / Bookmarks
  if (section === "bookmarks") {
    return {
      ...base,
      url: `${ORIGIN}/bookmarks`,
      details: "Viewing Saved Pages",
    };
  }

  // Any future page we haven't explicitly added yet
  return {
    ...base,
    details: "Browsing riix.fun",
  };
}

const activity: NativeActivity = { detect };
export default activity;

import type { Activity, NativeActivity, Page } from "parousia";

const ORIGIN = "https://riix.fun";
const NAME = "riix's Slayers 2 Wiki";
const ICON = `${ORIGIN}/favicon-180.png`;

const SAFE_SLUG = /^[a-z0-9-]{1,64}$/;

function cleanSlug(slug: string | undefined): string | null {
  if (!slug || !SAFE_SLUG.test(slug)) return null;

  return slug
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function detect({ url }: Page): Activity {
  const [section, slug] = url.pathname.split("/").filter(Boolean);

  const base: Activity = {
    id: "riix.fun",
    name: NAME,
    url: ORIGIN,
    assets: {
      largeImage: ICON,
      largeText: NAME,
    },
    buttons: [
      {
        label: "Open riix.fun",
        url: ORIGIN,
      },
    ],
  };

  if (!section) {
    return {
      ...base,
      details: "Browsing the Slayers 2 Wiki",
    };
  }

  if (section === "codes") {
    return {
      ...base,
      url: `${ORIGIN}/codes`,
      details: "Viewing Slayers 2 Codes",
    };
  }

  if (section === "tier-list") {
    return {
      ...base,
      url: `${ORIGIN}/tier-list`,
      details: "Viewing the Tier List",
    };
  }

  if (section === "breathing") {
    const name = cleanSlug(slug);

    if (name) {
      return {
        ...base,
        url: `${ORIGIN}/breathing/${slug}`,
        details: `Viewing ${name} Breathing`,
        state: "Breathing Styles",
        detailsUrl: `${ORIGIN}/breathing/${slug}`,
        stateUrl: `${ORIGIN}/breathing`,
      };
    }

    return {
      ...base,
      url: `${ORIGIN}/breathing`,
      details: "Viewing Breathing Styles",
    };
  }

  if (section === "demon-arts") {
    const name = cleanSlug(slug);

    if (name) {
      return {
        ...base,
        url: `${ORIGIN}/demon-arts/${slug}`,
        details: `Viewing ${name}`,
        state: "Blood Demon Arts",
        detailsUrl: `${ORIGIN}/demon-arts/${slug}`,
        stateUrl: `${ORIGIN}/demon-arts`,
      };
    }

    return {
      ...base,
      url: `${ORIGIN}/demon-arts`,
      details: "Viewing Blood Demon Arts",
    };
  }

  if (section === "guides") {
    const name = cleanSlug(slug);

    if (name) {
      return {
        ...base,
        url: `${ORIGIN}/guides/${slug}`,
        details: `Reading ${name} Guide`,
        state: "Guides",
        detailsUrl: `${ORIGIN}/guides/${slug}`,
        stateUrl: `${ORIGIN}/guides`,
      };
    }

    return {
      ...base,
      url: `${ORIGIN}/guides`,
      details: "Browsing Guides",
    };
  }

  if (section === "clans") {
    return {
      ...base,
      url: `${ORIGIN}/clans`,
      details: "Viewing Clans",
      state: "Clan Stats & Spin Odds",
    };
  }

  if (section === "gear") {
    const name = cleanSlug(slug);

    if (name) {
      return {
        ...base,
        url: `${ORIGIN}/gear/${slug}`,
        details: `Viewing ${name}`,
        state: "Gear",
        detailsUrl: `${ORIGIN}/gear/${slug}`,
        stateUrl: `${ORIGIN}/gear`,
      };
    }

    return {
      ...base,
      url: `${ORIGIN}/gear`,
      details: "Viewing Gear",
    };
  }

  if (section === "builds") {
    return {
      ...base,
      url: `${ORIGIN}/builds`,
      details: "Viewing Builds",
    };
  }

  if (section === "npcs") {
    return {
      ...base,
      url: `${ORIGIN}/npcs`,
      details: "Browsing the NPC Directory",
    };
  }

  if (section === "updates") {
    return {
      ...base,
      url: `${ORIGIN}/updates`,
      details: "Reading Slayers 2 Updates",
    };
  }

  if (section === "bookmarks") {
    return {
      ...base,
      url: `${ORIGIN}/bookmarks`,
      details: "Viewing Saved Pages",
    };
  }

  return {
    ...base,
    details: "Browsing riix.fun",
  };
}

const activity: NativeActivity = { detect };
export default activity;

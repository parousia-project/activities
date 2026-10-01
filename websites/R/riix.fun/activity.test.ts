import { describe, expect, test } from "bun:test";
import { checkActivity, defaults, matches, page } from "../../../tools/testing";
import activity from "./activity";
import metadata from "./metadata.json";

const detect = (href: string) => activity.detect(page(href, ""), defaults(metadata));

describe("riix.fun", () => {
  test("recognizes riix.fun over https only", () => {
    for (const href of [
      "https://riix.fun/",
      "https://riix.fun/breathing",
      "https://riix.fun/breathing/water",
      "https://riix.fun/demon-arts/ice-manipulation",
      "https://riix.fun/guides/fishing-macro",
      "https://riix.fun/gear/nightfall-katana",
    ]) {
      expect(matches(metadata, href)).toBe(true);
    }

    for (const href of [
      "http://riix.fun/",
      "https://riix.fun.example.com/",
      "https://notriix.fun/",
      "https://example.com/riix.fun",
    ]) {
      expect(matches(metadata, href)).toBe(false);
    }
  });

  test("home page shows the wiki", () => {
    expect(detect("https://riix.fun/")?.details).toBe("Browsing the Slayers 2 Wiki");
  });

  test("guide pages use their real names", () => {
    const fishing = detect("https://riix.fun/guides/fishing-macro");

    expect(fishing?.details).toBe("Viewing Guides");
    expect(fishing?.state).toBe("Midnytes Fishing Macro Setup");

    const blackMarketer = detect("https://riix.fun/guides/black-marketer");

    expect(blackMarketer?.details).toBe("Viewing Guides");
    expect(blackMarketer?.state).toBe("Black Marketer");

    const lantern = detect("https://riix.fun/guides/mushroom-lit-lantern");

    expect(lantern?.state).toBe("How to Get the Mushroom Lit Lantern");
  });

  test("breathing pages use their real style names", () => {
    const water = detect("https://riix.fun/breathing/water");

    expect(water?.details).toBe("Viewing Breathing Styles");
    expect(water?.state).toBe("Water Breathing");

    const serpent = detect("https://riix.fun/breathing/serpent");

    expect(serpent?.state).toBe("Serpent Breathing");
  });

  test("demon art pages use their real names", () => {
    const ice = detect("https://riix.fun/demon-arts/ice-manipulation");

    expect(ice?.details).toBe("Viewing Blood Demon Arts");
    expect(ice?.state).toBe("Ice Manipulation");

    const tamari = detect("https://riix.fun/demon-arts/tamari");

    expect(tamari?.state).toBe("Tamari Manipulation");
  });

  test("gear pages use their real item names", () => {
    const nightfall = detect("https://riix.fun/gear/nightfall-katana");

    expect(nightfall?.details).toBe("Viewing Gear");
    expect(nightfall?.state).toBe("Nightfall Katana");

    const tower = detect("https://riix.fun/gear/ouwigahara-tower-gear");

    expect(tower?.state).toBe("Ouwigahara Tower Gear (V2)");

    const rod = detect("https://riix.fun/gear/legendary-fishing-rod");

    expect(rod?.state).toBe("Legendary Fishing Rod");
  });

  test("main wiki pages are recognized", () => {
    expect(detect("https://riix.fun/codes")?.details).toBe("Viewing Slayers 2 Codes");

    expect(detect("https://riix.fun/tier-list")?.details).toBe("Viewing the Tier List");

    expect(detect("https://riix.fun/clans")?.details).toBe("Viewing Clans");

    expect(detect("https://riix.fun/builds")?.details).toBe("Viewing Builds");

    expect(detect("https://riix.fun/npcs")?.details).toBe("Browsing the NPC Directory");

    expect(detect("https://riix.fun/titles")?.details).toBe("Viewing Titles");

    expect(detect("https://riix.fun/updates")?.details).toBe("Reading Slayers 2 Updates");

    expect(detect("https://riix.fun/bookmarks")?.details).toBe("Viewing Saved Pages");
  });

  test("unknown future slugs still get a safe fallback name", () => {
    const guide = detect("https://riix.fun/guides/future-guide");

    expect(guide?.details).toBe("Viewing Guides");
    expect(guide?.state).toBe("Future Guide");
  });

  test("query strings and fragments never leak", () => {
    const result = detect("https://riix.fun/guides/black-marketer?token=secret#private");

    const json = JSON.stringify(result);

    expect(json).not.toContain("secret");
    expect(json).not.toContain("private");
  });

  test("everything returned fits Discord limits", () => {
    for (const href of [
      "https://riix.fun/",
      "https://riix.fun/codes",
      "https://riix.fun/tier-list",
      "https://riix.fun/guides/fishing-macro",
      "https://riix.fun/guides/black-marketer",
      "https://riix.fun/guides/mushroom-lit-lantern",
      "https://riix.fun/breathing/water",
      "https://riix.fun/breathing/thunder",
      "https://riix.fun/demon-arts/ice-manipulation",
      "https://riix.fun/demon-arts/shockwave",
      "https://riix.fun/clans",
      "https://riix.fun/gear/nightfall-katana",
      "https://riix.fun/gear/legendary-fishing-rod",
      "https://riix.fun/builds",
      "https://riix.fun/npcs",
      "https://riix.fun/titles",
      "https://riix.fun/updates",
      "https://riix.fun/bookmarks",
    ]) {
      const result = detect(href);

      expect(result && checkActivity(result)).toEqual([]);
    }
  });
});

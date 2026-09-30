import { describe, expect, test } from "bun:test";
import { checkActivity, defaults, matches, page } from "../../../tools/testing";
import jena, { gameName } from "./activity";
import metadata from "./metadata.json";

const detect = (href: string, title = "") => jena.detect(page(href, title), defaults(metadata));

describe("Jena Hub", () => {
  test("recognizes jena.systems over https only", () => {
    for (const href of ["https://jena.systems/", "https://jena.systems/apps/3851919"]) {
      expect(matches(metadata, href)).toBe(true);
    }
    for (const href of [
      "http://jena.systems/",
      "https://jena.systems.example.com/",
      "https://notjena.systems/",
      "https://example.com/jena.systems",
    ]) {
      expect(matches(metadata, href)).toBe(false);
    }
  });

  test("a game page shows the game from its title, with a link to it", () => {
    expect(detect("https://jena.systems/apps/3851919", "Chess - Jena V3")).toEqual({
      id: "jena",
      name: "Jena Hub",
      url: "https://jena.systems/apps/3851919",
      details: "Playing Chess",
      detailsUrl: "https://jena.systems/apps/3851919",
      state: "In the Arcade",
      stateUrl: "https://jena.systems/apps",
      assets: { largeImage: "https://jena.systems/icons/icon-512.png", largeText: "Jena Hub" },
      buttons: [{ label: "Play Chess", url: "https://jena.systems/apps/3851919" }],
    });
  });

  test("before the game's title arrives, it's still a game", () => {
    // Single-page navigation: the Arcade's title lingers for a moment.
    const activity = detect("https://jena.systems/apps/3851919", "Arcade - Jena V3");
    expect(activity?.details).toBe("Playing a game");
    expect(activity?.buttons).toEqual([
      { label: "Open the game", url: "https://jena.systems/apps/3851919" },
    ]);
  });

  test("other pages say what they are", () => {
    expect(detect("https://jena.systems/", "Home")?.details).toBe("On the home page");
    expect(detect("https://jena.systems/apps", "Arcade - Jena V3")?.details).toBe(
      "Browsing the Arcade",
    );
    expect(detect("https://jena.systems/commands")?.details).toBe("Browsing bot commands");
    expect(detect("https://jena.systems/communities")?.details).toBe("Browsing communities");
    expect(detect("https://jena.systems/tos")?.details).toBe("Browsing Jena Hub");
    expect(detect("https://jena.systems/apps/not-a-game")?.details).toBe("Browsing the Arcade");
  });

  test("query strings and fragments never leave the browser", () => {
    const activity = detect(
      "https://jena.systems/apps/3851919?token=secret#state=x",
      "Chess - Jena V3",
    );
    expect(JSON.stringify(activity)).not.toContain("secret");
    expect(JSON.stringify(detect("https://jena.systems/login?code=secret"))).not.toContain(
      "secret",
    );
  });

  test("game names are cleaned and bounded", () => {
    expect(gameName("Tablut - Jena V3")).toBe("Tablut");
    expect(gameName("Tablut | Jena Hub")).toBe("Tablut");
    expect(gameName("Che‮ss\u0007 - Jena V3")).toBe("Chess");
    expect(gameName(`${"x".repeat(100)} - Jena V3`)).toHaveLength(64);
    for (const title of ["Chess", "Arcade - Jena V3", " - Jena V3", ""]) {
      expect(gameName(title)).toBeNull();
    }
  });

  test("everything it shows fits what Discord takes", () => {
    for (const [href, title] of [
      ["https://jena.systems/apps/3851919", "Chess - Jena V3"],
      ["https://jena.systems/apps/3851919", ""],
      ["https://jena.systems/communities", ""],
    ] as const) {
      const activity = detect(href, title);
      expect(activity && checkActivity(activity)).toEqual([]);
    }
  });
});

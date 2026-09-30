import { describe, expect, test } from "bun:test";
import { checkActivity, matches, page } from "../../../tools/testing";
import nyt, { headline, titleCase } from "./activity";
import metadata from "./metadata.json";

/** Its one setting at its default, which the metadata says is off. */
const OFF = { showHeadlines: false };
const detect = (href: string, title = "", settings = OFF) =>
  nyt.detect(page(href, title), settings);
const ARTICLE = "https://www.nytimes.com/2026/09/29/climate/storm-hits-the-coast.html";
const SHOW = { showHeadlines: true };

describe("The New York Times", () => {
  test("its one setting is off until someone turns it on", () => {
    expect(metadata.settings).toEqual([
      expect.objectContaining({ id: "showHeadlines", type: "boolean", default: false }),
    ]);
  });

  test("has an icon, and shows it", () => {
    expect(metadata.icon).toStartWith("https://");
    expect(detect("https://www.nytimes.com/")?.assets?.largeImage).toBe(metadata.icon);
  });

  test("recognizes www.nytimes.com over https only", () => {
    for (const href of [
      ARTICLE,
      "https://www.nytimes.com/",
      "https://www.nytimes.com/games/wordle",
    ]) {
      expect(matches(metadata, href)).toBe(true);
    }
    for (const href of [
      "http://www.nytimes.com/",
      "https://www.nytimes.com.example.com/",
      "https://notnytimes.com/",
      "https://example.com/nytimes.com",
    ]) {
      expect(matches(metadata, href)).toBe(false);
    }
  });

  test("an article says it's an article and its section, and keeps the headline private by default", () => {
    const activity = detect(ARTICLE, "Storm Hits the Coast - The New York Times");
    expect(activity).toEqual({
      id: "the-new-york-times",
      name: "The New York Times",
      url: "https://www.nytimes.com/",
      assets: {
        largeImage: "https://static01.nyt.com/apple-touch-icon.png",
        largeText: "The New York Times",
      },
      details: "Reading an article",
      state: "Climate",
      buttons: [{ label: "Open The New York Times", url: "https://www.nytimes.com/" }],
    });
    expect(JSON.stringify(activity)).not.toContain("Storm");
    expect(JSON.stringify(activity)).not.toContain("storm-hits");
  });

  test("with 'Show headlines' on, the details line is the headline", () => {
    expect(detect(ARTICLE, "Storm Hits the Coast - The New York Times", SHOW)).toMatchObject({
      details: "Reading Storm Hits the Coast",
      state: "Climate",
    });
    expect(detect(ARTICLE, "The New York Times", SHOW)?.details).toBe("Reading an article");
  });

  test("a game is named, because a game is public", () => {
    expect(detect("https://www.nytimes.com/games/wordle/index.html")).toMatchObject({
      details: "Playing Wordle",
      state: "New York Times Games",
      url: "https://www.nytimes.com/games/wordle",
      buttons: [{ label: "Play Wordle", url: "https://www.nytimes.com/games/wordle" }],
    });
    expect(detect("https://www.nytimes.com/games/spelling-bee")?.details).toBe(
      "Playing Spelling Bee",
    );
    expect(detect("https://www.nytimes.com/crosswords/game/daily")?.details).toBe(
      "Playing Crossword",
    );
    expect(detect("https://www.nytimes.com/games")?.details).toBe("Browsing the games");
  });

  test("section and front pages say what they are", () => {
    expect(detect("https://www.nytimes.com/section/world")?.details).toBe("Browsing the news");
    expect(detect("https://www.nytimes.com/")?.details).toBe("Browsing the news");
    expect(detect("https://www.nytimes.com/spotlight")?.details).toBe("Browsing Spotlight");
  });

  test("query strings and fragments never leave the browser", () => {
    const json = JSON.stringify(
      detect(`${ARTICLE}?smid=secret#comments=secret`, "Headline - The New York Times", SHOW),
    );
    expect(json).not.toContain("secret");
    expect(
      JSON.stringify(detect("https://www.nytimes.com/games/wordle?token=secret")),
    ).not.toContain("secret");
  });

  test("headlines are cleaned and bounded", () => {
    expect(headline("Big News - The New York Times")).toBe("Big News");
    expect(headline("The New York Times")).toBeNull();
    expect(headline(`${"a".repeat(300)} - The New York Times`)).toHaveLength(100);
    expect(headline("a‮b\u0000c - The New York Times")).toBe("abc");
    expect(titleCase("spelling-bee")).toBe("Spelling Bee");
    expect(titleCase("../x")).toBeNull();
  });

  test("nothing it returns would be refused or cut by Discord", () => {
    for (const href of [
      ARTICLE,
      "https://www.nytimes.com/",
      "https://www.nytimes.com/games/wordle",
    ]) {
      const activity = detect(href, `${"x".repeat(200)} - The New York Times`, SHOW);
      expect(activity && checkActivity(activity)).toEqual([]);
    }
  });
});

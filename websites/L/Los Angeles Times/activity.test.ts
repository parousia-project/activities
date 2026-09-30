import { describe, expect, test } from "bun:test";
import { checkActivity, matches, page } from "../../../tools/testing";
import latimes, { headline, sectionName } from "./activity";
import metadata from "./metadata.json";

/** Its one setting at its default, which the metadata says is off. */
const OFF = { showHeadlines: false };
const detect = (href: string, title = "", settings = OFF) =>
  latimes.detect(page(href, title), settings);
const STORY = "https://www.latimes.com/california/story/2026-09-29/wildfire-crews-gain-ground";
const SHOW = { showHeadlines: true };

describe("Los Angeles Times", () => {
  test("its one setting is off until someone turns it on", () => {
    expect(metadata.settings).toEqual([
      expect.objectContaining({ id: "showHeadlines", type: "boolean", default: false }),
    ]);
  });

  test("recognizes latimes.com over https only", () => {
    for (const href of [STORY, "https://latimes.com/", "https://www.latimes.com/sports"]) {
      expect(matches(metadata, href)).toBe(true);
    }
    for (const href of [
      "http://www.latimes.com/",
      "https://www.latimes.com.example.com/",
      "https://notlatimes.com/",
      "https://example.com/latimes.com",
    ]) {
      expect(matches(metadata, href)).toBe(false);
    }
  });

  test("an article says it's an article and its section, and keeps the headline private by default", () => {
    const activity = detect(STORY, "Crews gain ground on the fire - Los Angeles Times");
    expect(activity).toEqual({
      id: "los-angeles-times",
      name: "Los Angeles Times",
      url: "https://www.latimes.com/california",
      details: "Reading an article",
      state: "California",
      buttons: [{ label: "Open the Los Angeles Times", url: "https://www.latimes.com/" }],
    });
    expect(JSON.stringify(activity)).not.toContain("fire");
    expect(JSON.stringify(activity)).not.toContain("wildfire-crews");
  });

  test("with 'Show headlines' on, the details line is the headline", () => {
    expect(detect(STORY, "Crews gain ground on the fire - Los Angeles Times", SHOW)).toMatchObject({
      details: "Reading Crews gain ground on the fire",
      state: "California",
    });
    expect(detect(STORY, "Los Angeles Times", SHOW)?.details).toBe("Reading an article");
  });

  test("section and front pages say what they are", () => {
    expect(detect("https://www.latimes.com/world-nation")?.details).toBe("Browsing World & nation");
    expect(detect("https://www.latimes.com/sports")?.details).toBe("Browsing Sports");
    expect(detect("https://www.latimes.com/")?.details).toBe("Browsing the news");
    expect(detect("https://www.latimes.com/search?q=secret")?.details).toBe("Browsing Search");
    expect(detect("https://www.latimes.com/Bad_Section!/x")?.details).toBe("Browsing the news");
  });

  test("query strings and fragments never leave the browser", () => {
    const json = JSON.stringify(
      detect(`${STORY}?utm_source=secret#comments=secret`, "Headline - Los Angeles Times", SHOW),
    );
    expect(json).not.toContain("secret");
  });

  test("headlines are cleaned and bounded", () => {
    expect(headline("Big news - Los Angeles Times")).toBe("Big news");
    expect(headline("Los Angeles Times")).toBeNull();
    expect(headline(`${"a".repeat(300)} - Los Angeles Times`)).toHaveLength(100);
    expect(headline("a‮b\u0000c - Los Angeles Times")).toBe("abc");
    expect(sectionName("entertainment-arts")).toBe("Entertainment arts");
    expect(sectionName("../x")).toBeNull();
  });

  test("nothing it returns would be refused or cut by Discord", () => {
    for (const href of [STORY, "https://www.latimes.com/", "https://www.latimes.com/sports"]) {
      const activity = detect(href, `${"x".repeat(200)} - Los Angeles Times`, SHOW);
      expect(activity && checkActivity(activity)).toEqual([]);
    }
  });
});

import { describe, expect, test } from "bun:test";
import { checkActivity, defaults, matches, page } from "../../../tools/testing";
import parousia from "./activity";
import metadata from "./metadata.json";

const detect = (href: string, title = "") => parousia.detect(page(href, title), defaults(metadata));

describe("Parousia", () => {
  test("recognizes parousia.abadima.dev over https only", () => {
    for (const href of ["https://parousia.abadima.dev/", "https://parousia.abadima.dev/docs"]) {
      expect(matches(metadata, href)).toBe(true);
    }
    for (const href of [
      "http://parousia.abadima.dev/",
      "https://parousia.abadima.dev.example.com/",
      "https://abadima.dev/",
      "https://example.com/parousia.abadima.dev",
    ]) {
      expect(matches(metadata, href)).toBe(false);
    }
  });

  test("has an icon, and shows it", () => {
    expect(metadata.icon).toStartWith("https://");
    expect(detect("https://parousia.abadima.dev/")?.assets?.largeImage).toBe(metadata.icon);
  });

  test("the homepage and downloads say what they are", () => {
    expect(detect("https://parousia.abadima.dev/")).toEqual({
      id: "parousia",
      name: "Parousia",
      url: "https://parousia.abadima.dev/",
      assets: { largeImage: metadata.icon, largeText: "Parousia" },
      details: "Browsing the Parousia homepage",
      detailsUrl: "https://parousia.abadima.dev/",
      state: "On parousia.abadima.dev",
      buttons: [{ label: "Open Parousia", url: "https://parousia.abadima.dev/" }],
    });
    expect(detect("https://parousia.abadima.dev/download/")).toMatchObject({
      url: "https://parousia.abadima.dev/download",
      details: "Looking at downloads",
      state: "Getting Parousia",
    });
  });

  test("documentation pages name the section, with a button to the docs", () => {
    expect(detect("https://parousia.abadima.dev/docs/privacy")).toMatchObject({
      url: "https://parousia.abadima.dev/docs/privacy",
      details: "Reading Privacy & security",
      state: "Reading the documentation",
      buttons: [
        { label: "Read the docs", url: "https://parousia.abadima.dev/docs/" },
        { label: "Open Parousia", url: "https://parousia.abadima.dev/" },
      ],
    });
    expect(detect("https://parousia.abadima.dev/docs")?.details).toBe("Reading Documentation");
  });

  test("other pages use their cleaned, bounded title", () => {
    const activity = detect("https://parousia.abadima.dev/blog", "News‮\u0007 " + "x".repeat(200));
    expect(activity?.details).toBe("Browsing Parousia");
    expect(activity?.state).toHaveLength(128);
    expect(activity?.state).toStartWith("News xxx");
  });

  test("query strings and fragments never leave the browser", () => {
    for (const href of [
      "https://parousia.abadima.dev/docs/privacy?token=secret#secret",
      "https://parousia.abadima.dev/?code=secret",
    ]) {
      expect(JSON.stringify(detect(href))).not.toContain("secret");
    }
  });

  test("everything it shows fits what Discord takes", () => {
    for (const [href, title] of [
      ["https://parousia.abadima.dev/", ""],
      ["https://parousia.abadima.dev/download", ""],
      ["https://parousia.abadima.dev/docs/activities", ""],
      ["https://parousia.abadima.dev/other", "x".repeat(300)],
    ] as const) {
      const activity = detect(href, title);
      expect(activity && checkActivity(activity)).toEqual([]);
    }
  });
});

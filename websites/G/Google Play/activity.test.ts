import { describe, expect, test } from "bun:test";
import { checkActivity, defaults, matches, page } from "../../../tools/testing";
import googlePlay, { itemName } from "./activity";
import metadata from "./metadata.json";

const detect = (href: string, title = "") =>
  googlePlay.detect(page(href, title), defaults(metadata));
const SPOTIFY = "https://play.google.com/store/apps/details?id=com.spotify.music";
const TITLE = "Spotify: Music and Podcasts - Apps on Google Play";

describe("Google Play", () => {
  test("recognizes play.google.com over https only", () => {
    for (const href of [
      SPOTIFY,
      "https://play.google.com/",
      "https://play.google.com/store/movies",
    ]) {
      expect(matches(metadata, href)).toBe(true);
    }
    for (const href of [
      "http://play.google.com/",
      "https://play.google.com.example.com/",
      "https://notplay.google.com/",
      "https://example.com/play.google.com",
    ]) {
      expect(matches(metadata, href)).toBe(false);
    }
  });

  test("an app's page shows the app from its title, with a link to it", () => {
    expect(detect(`${SPOTIFY}&hl=en&gl=US`, TITLE)).toEqual({
      id: "google-play",
      name: "Google Play",
      url: SPOTIFY,
      details: "Viewing Spotify: Music and Podcasts",
      detailsUrl: SPOTIFY,
      state: "Apps on Google Play",
      buttons: [{ label: "View on Google Play", url: SPOTIFY }],
    });
  });

  test("movies and books are told apart, and a title that hasn't arrived is still an item", () => {
    expect(
      detect(
        "https://play.google.com/store/movies/details?id=abc123",
        "Dune - Movies on Google Play",
      ),
    ).toMatchObject({ details: "Viewing Dune", state: "Movies on Google Play" });
    expect(
      detect("https://play.google.com/store/books/details?id=xyz", "Emma - Books on Google Play"),
    ).toMatchObject({ details: "Viewing Emma", state: "Books on Google Play" });
    expect(detect(SPOTIFY, "Google Play")?.details).toBe("Viewing app details");
  });

  test("other pages say what they are", () => {
    expect(detect("https://play.google.com/store/apps")?.details).toBe("Browsing apps");
    expect(detect("https://play.google.com/store/games")?.details).toBe("Browsing Google Play");
    expect(detect("https://play.google.com/store/search?q=secret+thing&c=apps")?.details).toBe(
      "Searching Google Play",
    );
    expect(detect("https://play.google.com/")?.details).toBe("Browsing Google Play");
    expect(detect("https://play.google.com/console")?.details).toBe("Browsing Google Play");
  });

  test("only a real package name leaves the browser, and never the rest of the query", () => {
    for (const id of ["bad id", "<script>", "../x", "a".repeat(200), ""]) {
      const href = `https://play.google.com/store/apps/details?id=${encodeURIComponent(id)}`;
      expect(detect(href, TITLE)?.detailsUrl).toBeUndefined();
    }
    const json = JSON.stringify(
      detect(
        "https://play.google.com/store/search?q=secret&token=secret#state=secret",
        "secret - Google Play",
      ),
    );
    expect(json).not.toContain("secret");
    expect(JSON.stringify(detect(`${SPOTIFY}&token=secret#x`, TITLE))).not.toContain("secret");
  });

  test("names are cleaned and bounded", () => {
    const apps = { title: /\s+-\s+Apps on Google Play\s*$/i };
    expect(itemName("Maps - Apps on Google Play", apps)).toBe("Maps");
    expect(itemName("Google Play", apps)).toBeNull();
    expect(itemName(`${"a".repeat(200)} - Apps on Google Play`, apps)).toHaveLength(64);
    expect(itemName("a‮b\u0000c - Apps on Google Play", apps)).toBe("abc");
  });

  test("nothing it returns would be refused or cut by Discord", () => {
    for (const href of [
      SPOTIFY,
      "https://play.google.com/",
      "https://play.google.com/store/apps",
    ]) {
      const activity = detect(href, TITLE);
      expect(activity && checkActivity(activity)).toEqual([]);
    }
  });
});

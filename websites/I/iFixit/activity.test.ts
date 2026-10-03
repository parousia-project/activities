import { describe, expect, test } from "bun:test";
import { checkActivity, matches, page } from "../../../tools/testing";
import ifixit from "./activity";
import metadata from "./metadata.json";

const settings = { privacyMode: false, showThumbnail: true };
const GUIDE = "https://www.ifixit.com/Guide/iPhone+14+Battery+Replacement/152966";
const GUIDE_TITLE = "iPhone 14 Battery Replacement - iFixit Repair Guide";
const PICTURE = "https://guide-images.cdn.ifixit.com/igi/2qpgDse6XOHTCuJY.full";
const thumbs = { granted: ["thumbnails" as const], thumbnail: PICTURE };
const detect = (href: string, title = "iFixit", data = {}, choice = {}) =>
  ifixit.detect(page(href, title, data), { ...settings, ...choice });

describe("iFixit", () => {
  test("its settings start as the tests assume, and it asks for no more page data than thumbnails", () => {
    expect(
      Object.fromEntries(metadata.settings.map((setting) => [setting.id, setting.default])),
    ).toEqual(settings);
    expect(metadata.data).toEqual(["thumbnails"]);
  });

  test("recognizes iFixit and its language sites over https only", () => {
    for (const href of [
      "https://www.ifixit.com/",
      "https://de.ifixit.com/Guide/x/1",
      "https://ifixit.com/",
    ]) {
      expect(matches(metadata, href)).toBe(true);
    }
    for (const href of [
      "http://www.ifixit.com/",
      "https://www.ifixit.com.example.com/",
      "https://notifixit.com/",
      "https://example.com/www.ifixit.com",
    ]) {
      expect(matches(metadata, href)).toBe(false);
    }
  });

  test("a guide says so, names itself from the tab's title, and shows its picture and a link", () => {
    const result = detect(`${GUIDE}?utm_source=x#Step3`, GUIDE_TITLE, thumbs);

    expect(result).toEqual({
      id: "ifixit",
      name: "iFixit",
      url: "https://www.ifixit.com/",
      details: "Following a repair guide",
      state: "iPhone 14 Battery Replacement",
      assets: { largeImage: PICTURE, largeText: "iFixit" },
      buttons: [{ label: "View Guide", url: GUIDE }],
    });
    expect(result && checkActivity(result)).toEqual([]);
    expect(JSON.stringify(result)).not.toContain("utm_source");
    expect(JSON.stringify(result)).not.toContain("Step3");
  });

  test("a guide with no page data still works from the title, with the logo", () => {
    const result = detect(GUIDE, GUIDE_TITLE);

    expect(result?.state).toBe("iPhone 14 Battery Replacement");
    expect(result?.assets?.largeImage).toStartWith("https://assets.cdn.ifixit.com/");
  });

  test("the page image can be turned off", () => {
    const result = detect(GUIDE, GUIDE_TITLE, thumbs, { showThumbnail: false });

    expect(result?.assets?.largeImage).not.toBe(PICTURE);
    expect(result?.state).toBe("iPhone 14 Battery Replacement");
  });

  test("privacy mode says only the kind of page", () => {
    for (const href of [GUIDE, "https://www.ifixit.com/Device/iPhone_14"]) {
      const result = detect(href, GUIDE_TITLE, thumbs, { privacyMode: true });

      expect(result?.state).toBeUndefined();
      expect(result?.buttons).toBeUndefined();
      expect(result?.assets?.largeImage).not.toBe(PICTURE);
    }
    expect(detect(GUIDE, GUIDE_TITLE, thumbs, { privacyMode: true })?.details).toBe(
      "Following a repair guide",
    );
  });

  test("a device is named from its path", () => {
    const result = detect(
      "https://www.ifixit.com/Device/iPhone_14",
      "iPhone 14 Repair Help",
      thumbs,
    );

    expect(result).toMatchObject({
      details: "Looking at a device",
      state: "iPhone 14",
      buttons: [{ label: "View Device", url: "https://www.ifixit.com/Device/iPhone_14" }],
    });
  });

  test("a question loses its SOLVED label and the site's name", () => {
    const result = detect(
      "https://www.ifixit.com/Answers/View/896587/How+to+remove+broken+back+glass+iPhone+14",
      "SOLVED: How to remove broken back glass iPhone 14 - iPhone 14 - iFixit",
    );

    expect(result?.details).toBe("Reading a question");
    expect(result?.state).toBe("How to remove broken back glass iPhone 14 - iPhone 14");
    expect(detect("https://www.ifixit.com/Answers", "Answers Forum - iFixit")?.details).toBe(
      "Browsing the forums",
    );
  });

  test("a search never shows what was searched for", () => {
    const result = detect(
      "https://www.ifixit.com/Search?query=secret+thing",
      "secret thing — Search - iFixit",
    );

    expect(result?.details).toBe("Searching iFixit");
    expect(JSON.stringify(result)).not.toContain("secret");
  });

  test("troubleshooting, wiki, store, blog, and the rest say where someone is", () => {
    const at = (path: string) => detect(`https://www.ifixit.com${path}`)?.details;

    expect(at("/")).toBe("Browsing iFixit");
    expect(at("/Guide")).toBe("Browsing repair guides");
    expect(at("/Teardown")).toBe("Browsing teardowns");
    expect(at("/Device")).toBe("Browsing devices");
    expect(at("/Troubleshooting/iPhone_14/Won%27t+Turn+On")).toBe("Troubleshooting a device");
    expect(at("/Wiki/Tool_Types")).toBe("Reading a wiki article");
    expect(at("/Wiki/Edit/Tool_Types")).toBe("Editing a wiki article");
    expect(at("/Store")).toBe("Browsing the iFixit store");
    expect(at("/products/pro-tech-toolkit")).toBe("Browsing the iFixit store");
    expect(at("/News")).toBe("Reading the iFixit blog");
    expect(at("/User/1/iRobot")).toBe("Viewing a profile");
    expect(at("/Team/5")).toBe("Viewing a team");
    expect(at("/somewhere-new")).toBe("Browsing iFixit");
    expect(detect("https://www.ifixit.com/Wiki/Tool_Types")?.state).toBe("Tool Types");
  });

  test("a language path in front is skipped, and a language site keeps its own host in the links", () => {
    expect(detect("https://www.ifixit.com/en-us/Device/iPhone_14")?.state).toBe("iPhone 14");
    expect(detect("https://de.ifixit.com/Device/iPhone_14")?.buttons?.[0]?.url).toBe(
      "https://de.ifixit.com/Device/iPhone_14",
    );
  });

  test("titles are cleaned and cut, and a bad path word is nothing", () => {
    const result = detect(GUIDE, `Guide‮${"x".repeat(300)} - iFixit Repair Guide`);

    expect(result?.state).not.toContain("‮");
    expect(result?.state?.length).toBeLessThanOrEqual(100);
    expect(detect("https://www.ifixit.com/Device/%E0%A4%A")?.state).toBeUndefined();
    expect(detect(GUIDE, "iFixit")?.state).toBeUndefined();
  });

  test("every page it describes passes what Discord would refuse", () => {
    for (const href of [
      GUIDE,
      "https://www.ifixit.com/",
      "https://www.ifixit.com/Device/iPhone_14",
      "https://www.ifixit.com/Answers/View/1/q",
      "https://www.ifixit.com/Search?query=a",
    ]) {
      for (const choice of [{}, { showThumbnail: false }, { privacyMode: true }]) {
        const result = detect(href, GUIDE_TITLE, thumbs, choice);
        expect(result && checkActivity(result)).toEqual([]);
      }
    }
  });
});

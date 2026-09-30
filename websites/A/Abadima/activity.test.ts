import { describe, expect, test } from "bun:test";
import { checkActivity, defaults, matches, page } from "../../../tools/testing";
import abadima from "./activity";
import metadata from "./metadata.json";

const detect = (href: string, title = "") => abadima.detect(page(href, title), defaults(metadata));

describe("Abadima's Portfolio", () => {
  test("recognizes abadima.dev over https only", () => {
    for (const href of ["https://abadima.dev/", "https://abadima.dev/pages/blogs/solstice"]) {
      expect(matches(metadata, href)).toBe(true);
    }
    for (const href of [
      "http://abadima.dev/",
      "https://abadima.dev.example.com/",
      "https://notabadima.dev/",
      "https://example.com/abadima.dev",
    ]) {
      expect(matches(metadata, href)).toBe(false);
    }
  });

  test("has an icon, and shows it", () => {
    expect(metadata.icon).toStartWith("https://");
    expect(detect("https://abadima.dev/")?.assets?.largeImage).toBe(metadata.icon);
  });

  test("the landing page links to the landing page, without a stray space", () => {
    expect(detect("https://abadima.dev/")).toEqual({
      id: "abadima",
      name: "Abadima",
      url: "https://abadima.dev/",
      assets: { largeImage: metadata.icon, largeText: "Abadima" },
      details: "On the portfolio landing page",
      detailsUrl: "https://abadima.dev/",
      state: "On abadima.dev",
      buttons: [{ label: "Open Abadima's Portfolio", url: "https://abadima.dev/" }],
    });
  });

  test("portfolio pages say what they are", () => {
    expect(detect("https://abadima.dev/home")?.details).toBe("Browsing the portfolio");
    expect(detect("https://abadima.dev/pages/about/")).toMatchObject({
      url: "https://abadima.dev/pages/about",
      details: "Reading about Abadima",
      state: "Exploring the portfolio",
    });
    expect(detect("https://abadima.dev/pages/projects")?.details).toBe("Browsing projects");
    expect(detect("https://abadima.dev/pages/blog")?.details).toBe("Browsing the blog");
    expect(detect("https://abadima.dev/pages/contact")?.details).toBe("Viewing the contact page");
    expect(detect("https://abadima.dev/elsewhere")).toMatchObject({
      url: "https://abadima.dev/elsewhere",
      details: "Browsing abadima.dev",
    });
  });

  test("a known blog post is named, with buttons to it and the blog", () => {
    expect(detect("https://abadima.dev/pages/blogs/solstice", "Whatever")).toMatchObject({
      url: "https://abadima.dev/pages/blogs/solstice",
      details: "Reading “Intro to Solstice”",
      state: "Reading the blog",
      stateUrl: "https://abadima.dev/pages/blog",
      buttons: [
        { label: "Read the post", url: "https://abadima.dev/pages/blogs/solstice" },
        { label: "Open Abadima's Blog", url: "https://abadima.dev/pages/blog" },
      ],
    });
  });

  test("an unknown blog post uses its cleaned, bounded title", () => {
    const details = (title: string) =>
      detect("https://abadima.dev/pages/blogs/new", title)?.details;
    expect(details("Fresh‮ post\u0007")).toBe("Reading Fresh post");
    expect(details("")).toBe("Reading a blog post");
    expect(details("x".repeat(100))).toBe(`Reading ${"x".repeat(64)}`);
  });

  test("query strings and fragments never leave the browser", () => {
    for (const href of [
      "https://abadima.dev/pages/projects?page=secret#secret",
      "https://abadima.dev/pages/blogs/solstice?token=secret#secret",
      "https://abadima.dev/?code=secret",
    ]) {
      expect(JSON.stringify(detect(href))).not.toContain("secret");
    }
  });

  test("everything it shows fits what Discord takes", () => {
    for (const [href, title] of [
      ["https://abadima.dev/", ""],
      ["https://abadima.dev/pages/projects", ""],
      ["https://abadima.dev/pages/blogs/solstice", ""],
      ["https://abadima.dev/pages/blogs/new", "x".repeat(200)],
      ["https://abadima.dev/nowhere", ""],
    ] as const) {
      const activity = detect(href, title);
      expect(activity && checkActivity(activity)).toEqual([]);
    }
  });
});

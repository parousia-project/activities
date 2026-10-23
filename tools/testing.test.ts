import { describe, expect, test } from "bun:test";
import { ASSETS_URL, assetFile, checkActivity } from "./testing";

const base = { id: "a", name: "Example", url: "https://example.com/" };

describe("checkActivity", () => {
  test("an image must be https, or Parousia swaps in the site's logo", () => {
    const image = (largeImage: string) => checkActivity({ ...base, assets: { largeImage } });
    expect(image("https://example.com/a.png")).toEqual([]);
    expect(image("http://example.com/a.png")).toHaveLength(1);
    expect(image(`https://example.com/${"a".repeat(260)}.png`)).toHaveLength(1);
  });

  test("a link on an image is http(s), and a party adds up and goes with a playing Activity", () => {
    const assets = (extra: object) => checkActivity({ ...base, assets: extra });
    expect(
      assets({ largeUrl: "https://example.com/album", smallUrl: "http://example.com/" }),
    ).toEqual([]);
    expect(assets({ largeUrl: "javascript:alert(1)" })).toHaveLength(1);
    expect(assets({ smallUrl: `https://example.com/${"a".repeat(260)}` })).toHaveLength(1);
    const party = (size: number, max: number, type?: "listening") =>
      checkActivity({ ...base, party: { size, max }, ...(type && { type }) });
    expect(party(2, 5)).toEqual([]);
    for (const [size, max] of [
      [0, 5],
      [6, 5],
      [1, 10_001],
      [1.5, 5],
    ] as const) {
      expect(party(size, max)).toHaveLength(1);
    }
    expect(party(2, 5, "listening")).toHaveLength(1);
  });

  test("a status line must point at a line that exists", () => {
    expect(checkActivity({ ...base, details: "Song", statusDisplayType: "details" })).toEqual([]);
    expect(checkActivity({ ...base, state: "Artist", statusDisplayType: "state" })).toEqual([]);
    expect(checkActivity({ ...base, statusDisplayType: "name" })).toEqual([]);
    expect(checkActivity({ ...base, statusDisplayType: "details" })).toHaveLength(1);
    expect(checkActivity({ ...base, details: "Song", statusDisplayType: "state" })).toHaveLength(1);
  });
});

describe("assetFile", () => {
  test("names the file under assets/ that a URL serves, and nothing else", async () => {
    const file = assetFile(`${ASSETS_URL}/status/pause.png`);
    expect(file?.endsWith("/assets/status/pause.png")).toBe(true);
    expect(await Bun.file(file ?? "").exists()).toBe(true);
    for (const url of [
      undefined,
      "https://example.com/assets/status/pause.png",
      `${ASSETS_URL}/../package.json`,
      `${ASSETS_URL}/status/pause.svg`,
      `${ASSETS_URL}/status/`,
      // The right shape, but no such file: a test that asks must hear so.
      `${ASSETS_URL}/status/never-added.png`,
    ]) {
      expect(assetFile(url)).toBeNull();
    }
  });

  test("every image in assets/ is a PNG Discord shows (square, 128 pixels or more)", async () => {
    const files = [...new Bun.Glob("**/*.png").scanSync(`${import.meta.dir}/../assets`)];
    expect(files.length).toBeGreaterThan(0);
    for (const name of files) {
      const bytes = new Uint8Array(
        await Bun.file(`${import.meta.dir}/../assets/${name}`).arrayBuffer(),
      );
      expect(Array.from(bytes.slice(0, 8))).toEqual([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      ]);
      const view = new DataView(bytes.buffer);
      const [width, height] = [view.getUint32(16), view.getUint32(20)];
      expect(width).toBe(height);
      expect(width).toBeGreaterThanOrEqual(128);
    }
  });
});

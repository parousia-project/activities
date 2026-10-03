import { describe, expect, test } from "bun:test";
import { ASSETS_URL, assetFile, checkActivity } from "./testing";

const base = { id: "a", name: "Example", url: "https://example.com/" };

describe("checkActivity", () => {
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
    ]) {
      expect(assetFile(url)).toBeNull();
    }
  });

  test("the status icons are there, as PNGs Discord shows (square, 128 pixels or more)", async () => {
    for (const name of ["play", "pause"]) {
      const bytes = new Uint8Array(
        await Bun.file(assetFile(`${ASSETS_URL}/status/${name}.png`) ?? "").arrayBuffer(),
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

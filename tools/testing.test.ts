import { describe, expect, test } from "bun:test";
import { checkActivity } from "./testing";

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

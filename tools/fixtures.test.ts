import { describe, expect, test } from "bun:test";
import { CASE_KEYS, FILE_KEYS } from "./fixtures";

const schema = await Bun.file(`${import.meta.dir}/../schemas/fixtures.json`).json();

describe("schemas/fixtures.json", () => {
  test("lists the keys the checker accepts, so an editor and `bun run validate` agree", () => {
    expect(Object.keys(schema.properties).sort()).toEqual([...FILE_KEYS].sort());
    expect(Object.keys(schema.definitions.case.properties).sort()).toEqual([...CASE_KEYS].sort());
  });

  test("names the same sources as the checker", () => {
    expect(schema.definitions.case.properties.source.enum).toEqual([
      "browser",
      "source",
      "synthetic",
    ]);
  });
});

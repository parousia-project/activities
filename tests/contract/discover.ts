import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { checkMetadata, type Metadata } from "../../tools/metadata";
import type { Subject } from "./checks";
import { NO_FIXTURES, checkFixtures, type Fixtures } from "../../tools/fixtures";

export interface Found extends Subject {
  path: string;

  name: string;
  metadata: Metadata;

  metadataProblems: string[];

  fixtures: Fixtures;

  fixtureProblems: string[];
}

const WEBSITES = join(import.meta.dir, "..", "..", "websites");

export async function discover(root = WEBSITES): Promise<Found[]> {
  const found: Found[] = [];
  const folders = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();

  for (const letter of folders(root)) {
    for (const name of folders(join(root, letter))) {
      const dir = join(root, letter, name);
      const raw: unknown = JSON.parse(readFileSync(join(dir, "metadata.json"), "utf8"));
      const metadata = raw as Metadata;
      const module: { default: { detect: Found["detect"] } } = await import(
        join(dir, "activity.ts")
      );
      const fixturesFile = join(dir, "fixtures.json");
      const rawFixtures: unknown = existsSync(fixturesFile)
        ? JSON.parse(readFileSync(fixturesFile, "utf8"))
        : null;
      const fixtureProblems = rawFixtures === null ? [] : checkFixtures(rawFixtures, metadata);

      found.push({
        path: `websites/${letter}/${name}`,
        name,
        metadata,
        metadataProblems: checkMetadata(raw, name),
        detect: module.default.detect,
        fixtures:
          rawFixtures !== null && fixtureProblems.length === 0
            ? (rawFixtures as Fixtures)
            : NO_FIXTURES,
        fixtureProblems,
      });
    }
  }

  return found;
}

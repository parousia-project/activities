import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { FOLDER_NAME, activityId, checkMetadata, folderLetter } from "./metadata";

/**
 * Checks every Activity under websites/<letter>/<Name>/: that it's in the
 * right letter folder, its metadata.json against the format, and that
 * activity.ts exports a `detect` function as its default. Parousia's own
 * build checks the same things again before including one.
 */
const root = join(import.meta.dir, "..", "websites");
const failures: string[] = [];
const ids = new Map<string, string>();

const folders = async (dir: string): Promise<string[]> =>
  (await readdir(dir, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

for (const letter of await folders(root)) {
  for (const name of await folders(join(root, letter))) {
    const path = `websites/${letter}/${name}`;
    const dir = join(root, letter, name);
    const problems: string[] = [];

    if (!FOLDER_NAME.test(name)) {
      problems.push(
        "the folder name must be letters, digits, spaces, and . ' & + _ -, at most 64 characters",
      );
    }
    if (letter !== folderLetter(name)) problems.push(`it goes in websites/${folderLetter(name)}/`);
    const id = activityId(name);
    const other = ids.get(id);
    if (id && other) problems.push(`its id, "${id}", is also ${other}'s`);
    ids.set(id, path);

    const metadataFile = Bun.file(join(dir, "metadata.json"));
    if (await metadataFile.exists()) {
      try {
        problems.push(...checkMetadata(await metadataFile.json(), name));
      } catch {
        problems.push("metadata.json isn't valid JSON");
      }
    } else {
      problems.push("metadata.json is missing");
    }

    const modulePath = join(dir, "activity.ts");
    if (await Bun.file(modulePath).exists()) {
      const module: unknown = await import(modulePath);
      const exported =
        typeof module === "object" && module !== null && "default" in module
          ? module.default
          : null;
      const detect =
        typeof exported === "object" && exported !== null && "detect" in exported
          ? exported.detect
          : null;
      if (typeof detect !== "function") {
        problems.push("activity.ts must export { detect } as its default");
      }
    } else {
      problems.push("activity.ts is missing");
    }

    for (const problem of problems) failures.push(`${path}: ${problem}`);
  }
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log(`${ids.size} ${ids.size === 1 ? "Activity" : "Activities"} valid`);

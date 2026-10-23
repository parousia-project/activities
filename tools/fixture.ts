import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { said } from "./fixtures";
import { defaults, page } from "./testing";

const [folder, url, title = "", ...overrides] = process.argv.slice(2);
if (!folder || !url) {
  console.error('usage: bun run fixture "<Activity folder>" <url> [title] [setting=value ...]');
  process.exit(1);
}

const root = join(import.meta.dir, "..", "websites");
const letter = readdirSync(root).find((entry) => readdirSync(join(root, entry)).includes(folder));
if (!letter) {
  console.error(`no Activity folder named "${folder}"`);
  process.exit(1);
}
const dir = join(root, letter, folder);
const metadata = JSON.parse(readFileSync(join(dir, "metadata.json"), "utf8"));
const { detect } = (await import(join(dir, "activity.ts"))).default;

const settings = Object.fromEntries(
  overrides.map((pair) => {
    const [key = "", value = ""] = pair.split("=");
    return [
      key,
      value === "true"
        ? true
        : value === "false"
          ? false
          : Number.isNaN(Number(value)) || value === ""
            ? value
            : Number(value),
    ];
  }),
);
const result = detect(page(url, title), { ...defaults(metadata), ...settings });

console.log(
  JSON.stringify(
    {
      name: "",
      source: "synthetic",
      url,
      ...(title && { title }),
      ...(overrides.length > 0 && { settings }),
      expect: said(result, metadata.icon),
    },
    null,
    2,
  ),
);

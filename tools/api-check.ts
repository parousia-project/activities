import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

/**
 * Compares types/parousia.d.ts with the Activity API Parousia implements
 * (`browser/src/core/api.ts` in https://github.com/Abadima/RPC): every type it
 * exports must exist here, and be exactly the same. Four differences are on
 * purpose, listed in NARROWED: an Activity sets its Discord Application in
 * metadata.json, and metadata.json can only declare `media` and `thumbnails`.
 * Without a checkout of Parousia, it stops with exit code 2 and checks nothing.
 */
const NARROWED: Record<string, [parousia: string, here: string]> = {
  Activity: ['Omit<R.Activity, "discordClientId">', "L.Activity"],
  Page: ['Omit<R.Page, "granted">', 'Omit<L.Page, "granted">'],
  PageDataKind: ['Exclude<R.PageDataKind, "creatorIcons">', "L.PageDataKind"],
  NativeActivity: ["keyof R.NativeActivity", "keyof L.NativeActivity"],
};

const root = join(import.meta.dir, "..");
const checkout = resolve(process.env.PAROUSIA_RPC_DIR ?? join(root, "..", "RPC"));
const api = join(checkout, "browser", "src", "core", "api.ts");
if (!existsSync(api)) {
  console.error(
    `no Parousia checkout at ${checkout}: set PAROUSIA_RPC_DIR to a clone of Abadima/RPC`,
  );
  process.exit(2);
}

const source = readFileSync(api, "utf8");
const names = [
  ...[...source.matchAll(/export\s+type\s*\{([^}]*)\}/g)].flatMap(([, list = ""]) =>
    list.split(",").map(
      (entry) =>
        entry
          .trim()
          .split(/\s+as\s+/)
          .pop() ?? "",
    ),
  ),
  ...[...source.matchAll(/export\s+(?:interface|type)\s+(\w+)/g)].map(([, name = ""]) => name),
].filter((name) => name !== "");

const header = [
  'import type * as R from "parousia-api";',
  'import type * as L from "parousia";',
  "type Equal<X, Y> = (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y ? 1 : 2 ? true : false;",
  "type Is<T extends true> = T;",
];
const lines = names.map((name) => {
  const [theirs, ours] = NARROWED[name] ?? [`R.${name}`, `L.${name}`];

  return `export type ${name}_ = Is<Equal<${theirs}, ${ours}>>;`;
});

const dir = mkdtempSync(join(tmpdir(), "api-check-"));
try {
  const drift = join(dir, "drift.ts");
  const config = join(dir, "tsconfig.json");
  writeFileSync(drift, [...header, ...lines].join("\n"));
  writeFileSync(
    config,
    JSON.stringify({
      compilerOptions: {
        lib: ["ESNext", "DOM", "DOM.Iterable"],
        target: "ESNext",
        module: "ESNext",
        moduleResolution: "bundler",
        verbatimModuleSyntax: true,
        noEmit: true,
        strict: true,
        skipLibCheck: true,
        noUncheckedIndexedAccess: true,
        types: [],
        paths: { "parousia-api": [api] },
      },
      files: [drift, join(root, "types", "parousia.d.ts")],
    }),
  );
  const tsc = Bun.spawnSync([
    join(root, "node_modules", ".bin", "tsc"),
    "-p",
    config,
    "--pretty",
    "false",
  ]);
  const output = `${tsc.stdout}${tsc.stderr}`.trim();
  if (tsc.exitCode === 0) {
    console.log(`types/parousia.d.ts matches Parousia's API (${names.length} types)`);
  } else {
    const found = new Set<string>();
    for (const line of output.split("\n")) {
      const at = /drift\.ts\((\d+),/.exec(line);
      const name = at ? names[Number(at[1]) - header.length - 1] : undefined;
      if (name) found.add(name);
      else console.error(line);
    }
    for (const name of found) {
      console.error(`${name}: types/parousia.d.ts differs from Parousia's, or doesn't have it`);
    }
    process.exit(1);
  }
} finally {
  rmSync(dir, { recursive: true, force: true });
}

import { lookup } from "node:dns/promises";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Only an NXDOMAIN-style answer makes a host "missing". A timeout or a
 * resolver failure says nothing about the site, so it is "unknown" and
 * changes no issue.
 */
export type Verdict = "resolves" | "missing" | "unknown";
export type Resolver = (host: string) => Promise<unknown>;

export interface Checked {
  name: string;
  id: string;
  hosts: Array<{ host: string; verdict: Verdict }>;
  status: "ok" | "failing" | "unknown";
}

export interface Issue {
  number: number;
  title: string;
  body: string;
}

export interface Plan {
  open: Array<{ title: string; body: string }>;
  close: Array<{ number: number; comment: string }>;
}

const PATTERN = /^(?:\*|https?):\/\/(\*\.)?([^/]+)\//;

export function hostGroups(matches: readonly string[]): string[][] {
  const groups = new Map<string, string[]>();
  for (const pattern of matches) {
    const [, wildcard, host] = PATTERN.exec(pattern) ?? [];
    if (host) groups.set(host, wildcard ? [host, `www.${host}`] : [host]);
  }

  return [...groups.values()];
}

const marker = (id: string): string => `<!-- dns-check:${id} -->`;

async function verdictFor(group: string[], resolve: Resolver, wait: number): Promise<Verdict> {
  let missing = 0;
  for (const host of group) {
    let answer: "resolves" | "missing" | "unknown" = "unknown";
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await resolve(host);
        return "resolves";
      } catch (error) {
        answer = (error as { code?: string }).code === "ENOTFOUND" ? "missing" : "unknown";
      }
      if (attempt < 2) await new Promise((done) => setTimeout(done, wait));
    }
    if (answer === "missing") missing++;
  }

  return missing === group.length ? "missing" : "unknown";
}

export async function check(
  activities: ReadonlyArray<{ name: string; id: string; matches: readonly string[] }>,
  resolve: Resolver = lookup,
  wait = 1000,
): Promise<Checked[]> {
  return Promise.all(
    activities.map(async ({ name, id, matches }) => {
      const hosts = await Promise.all(
        hostGroups(matches).map(async (group) => ({
          host: group[0] ?? "",
          verdict: await verdictFor(group, resolve, wait),
        })),
      );
      const status = hosts.some((entry) => entry.verdict === "missing")
        ? "failing"
        : hosts.every((entry) => entry.verdict === "resolves")
          ? "ok"
          : "unknown";

      return { name, id, hosts, status } satisfies Checked;
    }),
  );
}

export function plan(results: readonly Checked[], issues: readonly Issue[], today: string): Plan {
  const actions: Plan = { open: [], close: [] };
  const known = new Set(results.map((result) => result.id));
  const issueFor = (id: string): Issue | undefined =>
    issues.find((issue) => issue.body.includes(marker(id)));

  for (const result of results) {
    const issue = issueFor(result.id);
    if (result.status === "failing" && !issue) {
      const missing = result.hosts.filter((entry) => entry.verdict === "missing");
      actions.open.push({
        title: `DNS check failed: ${result.name}`,
        body: [
          `These hosts of **${result.name}** didn't resolve on ${today}:`,
          "",
          ...missing.map((entry) => `- \`${entry.host}\``),
          "",
          "The site may be gone or may have moved. This is checked every week: the issue closes itself once every host resolves again, and you can close it earlier if you see it working.",
          "",
          marker(result.id),
        ].join("\n"),
      });
    }
    if (result.status === "ok" && issue) {
      actions.close.push({
        number: issue.number,
        comment: `Every host of ${result.name} resolved on ${today}, so this is closing itself.`,
      });
    }
  }
  for (const issue of issues) {
    const id = /<!-- dns-check:([\w-]+) -->/.exec(issue.body)?.[1];
    if (id && !known.has(id)) {
      actions.close.push({
        number: issue.number,
        comment: "This Activity is no longer in the repository, so there is nothing to check.",
      });
    }
  }

  return actions;
}

function activities(): Array<{ name: string; id: string; matches: string[] }> {
  const root = join(import.meta.dir, "..", "websites");
  const names = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);

  return names(root).flatMap((letter) =>
    names(join(root, letter)).map((name) => {
      const metadata = JSON.parse(readFileSync(join(root, letter, name, "metadata.json"), "utf8"));
      return { name, id: metadata.id as string, matches: metadata.matches as string[] };
    }),
  );
}

async function gh(...args: string[]): Promise<string> {
  const run = Bun.spawn(["gh", ...args], { stdout: "pipe", stderr: "pipe" });
  const [out, error] = await Promise.all([
    new Response(run.stdout).text(),
    new Response(run.stderr).text(),
  ]);
  if ((await run.exited) !== 0)
    throw new Error(`gh ${args[0]} ${args[1] ?? ""} failed: ${error.trim()}`);

  return out;
}

if (import.meta.main) {
  const results = await check(activities());
  const today = new Date().toISOString().slice(0, 10);
  for (const result of results) {
    const detail = result.hosts.map((entry) => `${entry.host} ${entry.verdict}`).join(", ");
    console.log(`${result.status.padEnd(8)} ${result.name.padEnd(22)} ${detail}`);
  }

  if (process.argv.includes("--issues")) {
    await gh(
      "label",
      "create",
      "dns-check",
      "--color",
      "D93F0B",
      "--description",
      "A host stopped resolving",
      "--force",
    );
    const issues: Issue[] = JSON.parse(
      await gh(
        "issue",
        "list",
        "--label",
        "dns-check",
        "--state",
        "open",
        "--limit",
        "200",
        "--json",
        "number,title,body",
      ),
    );
    const actions = plan(results, issues, today);
    for (const issue of actions.open) {
      await gh(
        "issue",
        "create",
        "--title",
        issue.title,
        "--body",
        issue.body,
        "--label",
        "dns-check",
      );
      console.log(`opened: ${issue.title}`);
    }
    for (const issue of actions.close) {
      await gh(
        "issue",
        "close",
        String(issue.number),
        "--reason",
        "completed",
        "--comment",
        issue.comment,
      );
      console.log(`closed: #${issue.number}`);
    }
  }
}

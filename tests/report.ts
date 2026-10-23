import { CHECKS, audit, overlaps } from "./contract/checks";
import { discover } from "./contract/discover";

const activities = await discover();
const rows: string[] = [];
const failures: string[] = [];
const totals = { browser: 0, source: 0, synthetic: 0 };

for (const activity of activities) {
  const cases = activity.fixtures.cases ?? [];
  const { problems } = audit(
    activity,
    cases.map((fixture) => fixture.url),
  );
  const applicable = CHECKS.filter((check) => check.applies?.(activity.metadata) !== false);
  const tier = (name: "structure" | "settings"): string => {
    const these = applicable.filter((check) => check.tier === name);
    const passed = these.filter((check) => !problems.has(check.id)).length;

    return these.length === 0 ? "-" : `${passed}/${these.length}`;
  };
  const by = (source: string): number =>
    cases.filter((fixture) => fixture.source === source).length;
  for (const source of ["browser", "source", "synthetic"] as const) totals[source] += by(source);
  const pins = (activity.fixtures.for?.length ?? 0) + (activity.fixtures.notFor?.length ?? 0);
  const seen =
    cases.length === 0
      ? "-"
      : `${cases.length} (${by("browser")} browser, ${by("source")} source, ${by("synthetic")} synthetic)`;

  rows.push(
    `| ${activity.name} | ${activity.metadataProblems.length === 0 ? "ok" : "**invalid**"} | ${tier("structure")} | ${tier("settings")} | ${seen} | ${pins || "-"} |`,
  );

  for (const check of applicable) {
    const found = problems.get(check.id);
    if (found)
      failures.push(
        `- **${activity.name}**, ${check.tier}: ${check.says}\n${found.map((example) => `  - ${example}`).join("\n")}`,
      );
  }
  for (const problem of activity.metadataProblems)
    failures.push(`- **${activity.name}**, metadata.json: ${problem}`);
  for (const problem of activity.fixtureProblems)
    failures.push(`- **${activity.name}**, fixtures.json: ${problem}`);
}
const clashes = overlaps(
  activities.map((activity) => ({
    name: activity.name,
    metadata: activity.metadata,
    extra: (activity.fixtures.cases ?? []).map((fixture) => fixture.url),
  })),
);
for (const clash of clashes) failures.push(`- ${clash}`);

console.log(
  `## Activities: ${activities.length} checked, ${failures.length === 0 ? "none failing" : `${failures.length} to look at`}`,
);
console.log("");
console.log("| Activity | Metadata | Structure | Settings | Fixtures | Scope pins |");
console.log("| --- | --- | --- | --- | --- | --- |");
for (const row of rows) console.log(row);
console.log("");
if (failures.length > 0) {
  console.log("### Failing");
  console.log("");
  for (const failure of failures) console.log(failure);
  console.log("");
}
console.log(
  [
    "### What these mean",
    "",
    "- **Structure** and **Settings**: checks every Activity gets without writing anything. It runs, reads only the page data it declares, shows nothing Discord would refuse, doesn't copy a query string or fragment, and its switches (privacy, timestamps, picture) do what their names say. They run on addresses made from its own match patterns, so they would pass for an Activity that is wrong about its site.",
    `- **Fixtures**: optional regression. What it did with an address and title (${totals.browser} seen on the real site, ${totals.source} read from a site's own code, ${totals.synthetic} made up). A \`browser\` case carries its date and a site can change after it; a made-up one only keeps the Activity from changing, and can't say it was right.`,
    "- **Scope pins**: addresses it must, and must not, run on.",
    "",
    "Nothing here checks that an Activity describes its site correctly today. Open the site and look.",
  ].join("\n"),
);

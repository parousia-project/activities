import { describe, expect, test } from "bun:test";
import { matchesAny } from "../tools/match-pattern";
import { CHECKS, audit, overlaps, sayFor } from "./contract/checks";
import { discover } from "./contract/discover";

/**
 * Every Activity in websites/ gets the same checks without a test file of its own.
 * A failure's name starts with its folder.
 */

const activities = await discover();

test("there are Activities to check", () => {
  expect(activities.length).toBeGreaterThan(0);
});

test("no address is claimed by two Activities", () => {
  const all = activities.map((activity) => ({
    name: activity.name,
    metadata: activity.metadata,
    extra: (activity.fixtures.cases ?? []).map((fixture) => fixture.url),
  }));
  expect(overlaps(all)).toEqual([]);
});

for (const activity of activities) {
  describe(activity.name, () => {
    test("metadata.json is valid", () => {
      expect(activity.metadataProblems).toEqual([]);
    });

    test("fixtures.json, if it has one, is valid", () => {
      expect(activity.fixtureProblems).toEqual([]);
    });

    const cases = activity.fixtures.cases ?? [];
    const { problems } = audit(
      activity,
      cases.map((fixture) => fixture.url),
    );
    for (const check of CHECKS) {
      if (check.applies?.(activity.metadata) === false) continue;
      test(`${check.tier}: ${check.says}`, () => {
        expect(problems.get(check.id) ?? []).toEqual([]);
      });
    }

    for (const href of activity.fixtures.for ?? []) {
      test(`it runs on ${href}`, () => {
        expect(matchesAny(activity.metadata.matches, new URL(href))).toBe(true);
      });
    }

    for (const href of activity.fixtures.notFor ?? []) {
      test(`it is deliberately not for ${href}`, () => {
        expect(matchesAny(activity.metadata.matches, new URL(href))).toBe(false);
      });
    }

    for (const fixture of cases) {
      test(`regression (${fixture.source}): ${fixture.name}`, () => {
        expect(sayFor(activity, fixture)).toEqual(fixture.expect);
      });
    }
  });
}

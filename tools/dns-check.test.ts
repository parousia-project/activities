import { describe, expect, test } from "bun:test";
import { check, hostGroups, plan, type Checked, type Issue } from "./dns-check";

const error = (code: string) => Object.assign(new Error(code), { code });
const resolver = (answers: Record<string, string[]>) => {
  const calls: Record<string, number> = {};
  return Object.assign(
    async (host: string) => {
      const list = answers[host] ?? ["ENOTFOUND"];
      const call = (calls[host] = (calls[host] ?? 0) + 1);
      const code = list[Math.min(call, list.length) - 1];
      if (code !== "ok") throw error(code ?? "ENOTFOUND");
    },
    { calls },
  );
};
const one = (matches: string[]) => [{ name: "Example", id: "example", matches }];

describe("hostGroups", () => {
  test("a host is checked as it is, and a wildcard also as www", () => {
    expect(hostGroups(["https://example.com/*"])).toEqual([["example.com"]]);
    expect(hostGroups(["https://*.example.com/*"])).toEqual([["example.com", "www.example.com"]]);
  });

  test("a host listed twice is checked once", () => {
    expect(hostGroups(["https://example.com/a*", "https://example.com/b*"])).toEqual([
      ["example.com"],
    ]);
  });
});

describe("check", () => {
  test("every host resolving is ok", async () => {
    const [result] = await check(
      one(["https://a.example/*", "https://b.example/*"]),
      resolver({ "a.example": ["ok"], "b.example": ["ok"] }),
      0,
    );
    expect(result?.status).toBe("ok");
  });

  test("a host that doesn't exist is failing, even when another resolves", async () => {
    const [result] = await check(
      one(["https://a.example/*", "https://b.example/*"]),
      resolver({ "a.example": ["ok"] }),
      0,
    );
    expect(result?.status).toBe("failing");
    expect(result?.hosts).toEqual([
      { host: "a.example", verdict: "resolves" },
      { host: "b.example", verdict: "missing" },
    ]);
  });

  test("a timeout or resolver failure is unknown, not failing", async () => {
    for (const code of ["ETIMEOUT", "ECONNREFUSED", "EAI_AGAIN"]) {
      const [result] = await check(
        one(["https://a.example/*"]),
        resolver({ "a.example": [code] }),
        0,
      );
      expect(result?.status).toBe("unknown");
    }
  });

  test("a host that fails once and then resolves is ok", async () => {
    const dns = resolver({ "a.example": ["ENOTFOUND", "ETIMEOUT", "ok"] });
    const [result] = await check(one(["https://a.example/*"]), dns, 0);
    expect(result?.status).toBe("ok");
    expect(dns.calls["a.example"]).toBe(3);
  });

  test("a wildcard domain with no address of its own is ok if www resolves", async () => {
    const [result] = await check(
      one(["https://*.example.com/*"]),
      resolver({ "www.example.com": ["ok"] }),
      0,
    );
    expect(result?.status).toBe("ok");
    const [gone] = await check(one(["https://*.example.com/*"]), resolver({}), 0);
    expect(gone?.status).toBe("failing");
  });
});

describe("plan", () => {
  const result = (status: Checked["status"], id = "example"): Checked => ({
    name: "Example",
    id,
    status,
    hosts: [{ host: "a.example", verdict: status === "failing" ? "missing" : "resolves" }],
  });
  const open = (id = "example"): Issue => ({
    number: 7,
    title: "DNS check failed: Example",
    body: `a.example didn't resolve\n\n<!-- dns-check:${id} -->`,
  });
  const today = "2026-10-26";

  test("a failing Activity with no issue gets one, naming the hosts", () => {
    const actions = plan([result("failing")], [], today);
    expect(actions.close).toEqual([]);
    expect(actions.open).toHaveLength(1);
    expect(actions.open[0]?.title).toBe("DNS check failed: Example");
    expect(actions.open[0]?.body).toContain("`a.example`");
    expect(actions.open[0]?.body).toContain("<!-- dns-check:example -->");
    expect(actions.open[0]?.body).toContain(today);
  });

  test("a failing Activity that has an issue open gets no second one", () => {
    expect(plan([result("failing")], [open()], today)).toEqual({ open: [], close: [] });
  });

  test("an issue closes itself, with a comment, once every host resolves again", () => {
    const actions = plan([result("ok")], [open()], today);
    expect(actions.open).toEqual([]);
    expect(actions.close).toEqual([{ number: 7, comment: expect.stringContaining(today) }]);
  });

  test("a check that couldn't tell changes nothing", () => {
    expect(plan([result("unknown")], [open()], today)).toEqual({ open: [], close: [] });
    expect(plan([result("unknown")], [], today)).toEqual({ open: [], close: [] });
  });

  test("a healthy Activity with no issue changes nothing", () => {
    expect(plan([result("ok")], [], today)).toEqual({ open: [], close: [] });
  });

  test("an issue for an Activity that has been removed is closed", () => {
    const actions = plan([result("ok", "other")], [open("gone")], today);
    expect(actions.close).toEqual([{ number: 7, comment: expect.stringContaining("no longer") }]);
  });

  test("an issue you closed yourself isn't listed, so a host still failing next week opens a new one", () => {
    expect(plan([result("failing")], [], today).open).toHaveLength(1);
  });

  test("each Activity's issue is found by its own marker", () => {
    const issues = [open("example"), { ...open("other"), number: 8 }];
    const actions = plan([result("ok", "example"), result("failing", "other")], issues, today);
    expect(actions.close.map((entry) => entry.number)).toEqual([7]);
    expect(actions.open).toEqual([]);
  });
});

import { describe, expect, test } from "bun:test";
import { checkActivity, matches, page } from "../../../tools/testing";
import ram, { activityGame, dashboardParts } from "./activity";
import metadata from "./metadata.json";

const settings = {
  privacyMode: true,
  showPage: true,
  showGame: true,
  showServer: false,
  showButton: false,
};

const open = { ...settings, privacyMode: false };

const detect = (href: string, title = "", choice = settings) => ram.detect(page(href, title), choice);

const GUILD = "1533177824037572618";
const SETTINGS_URL = `https://rambot.xyz/settings/${GUILD}/twpings`;

describe("Ram Bot", () => {
  test("settings match what the tests assume", () => {
    expect(Object.fromEntries(metadata.settings.map((setting) => [setting.id, setting.default]))).toEqual(
      settings,
    );
  });

  test("recognizes rambot.xyz over https only", () => {
    for (const href of [
      "https://rambot.xyz/",
      "https://www.rambot.xyz/servers",
      "https://rambot.xyz/activity/",
      "https://activity.rambot.xyz/",
    ]) {
      expect(matches(metadata, href)).toBe(true);
    }
    for (const href of [
      "http://rambot.xyz/",
      "https://rambot.xyz.evil.test/",
      "https://not-rambot.xyz/",
      "https://example.com/rambot.xyz",
    ]) {
      expect(matches(metadata, href)).toBe(false);
    }
  });

  test("privacy mode hides the page, the server, and anything in the url", () => {
    const activity = detect(`${SETTINGS_URL}?token=secret#x`, "Ram Dashboard | Twitch Pings | Game Night");
    expect(activity?.details).toBe("On the Ram dashboard");
    expect(activity?.state).toBeUndefined();
    expect(activity?.url).toBe("https://rambot.xyz/");
    const json = JSON.stringify(activity);
    expect(json).not.toContain("secret");
    expect(json).not.toContain(GUILD);
    expect(json).not.toContain("Game Night");
    expect(json).not.toContain("Twitch");
  });

  test("the game name shows only with privacy mode off", () => {
    expect(detect("https://rambot.xyz/activity/", "Spite Your Neighbor — Ram Activities", open)?.details).toBe(
      "Spite Your Neighbor",
    );
    expect(detect("https://activity.rambot.xyz/", "Spite Your Neighbor — Ram Activities", open)?.state).toBe(
      "In a game",
    );
    expect(
      detect("https://rambot.xyz/activity/", "Spite Your Neighbor — Ram Activities", {
        ...open,
        showGame: false,
      })?.details,
    ).toBe("Playing Ram Activities");
  });

  test("lobby and an unnamed game are not a game title", () => {
    expect(detect("https://rambot.xyz/activity/", "Lobby — Ram Activities", open)?.details).toBe(
      "Playing Ram Activities",
    );
    expect(detect("https://rambot.xyz/activity/", "Lobby — Ram Activities", open)?.state).toBe("In the lobby");
    expect(detect("https://rambot.xyz/activity/", "In a game — Ram Activities", open)?.state).toBe("In a game");
    expect(detect("https://rambot.xyz/activity/", "Ram Activities", open)?.state).toBeUndefined();
  });

  test("the server name stays off until that setting is on", () => {
    const title = "Game Night · Twitch Pings — Ram Dashboard";
    const hidden = detect(SETTINGS_URL, title, open);
    expect(hidden?.details).toBe("Twitch Pings");
    expect(hidden?.state).toBeUndefined();
    expect(hidden?.url).toBe("https://rambot.xyz/");
    expect(JSON.stringify(hidden)).not.toContain(GUILD);

    expect(detect(SETTINGS_URL, title, { ...open, showServer: true })?.state).toBe("Game Night");
  });

  test("the button is the public site, not the settings url", () => {
    const activity = detect("https://rambot.xyz/activity/?code=secret", "Ram Activities", {
      ...settings,
      showButton: true,
    });
    expect(activity?.buttons).toEqual([{ label: "Open Activities", url: "https://rambot.xyz/activity/" }]);
    expect(JSON.stringify(activity)).not.toContain("secret");
  });

  test("titles are cleaned, and ids are dropped", () => {
    expect(activityGame("Spite Your Neighbor — Ram Activities")).toBe("Spite Your Neighbor");
    expect(activityGame("Lobby — Ram Activities")).toBeNull();
    expect(activityGame("Che\u0007ss — Ram Activities")).toBe("Chess");
    expect(activityGame(`${GUILD} — Ram Activities`)).toBeNull();
    expect(dashboardParts("Game Night · Twitch Pings — Ram Dashboard")).toEqual({
      server: "Game Night",
      page: "Twitch Pings",
    });
    expect(dashboardParts(`Ram Dashboard | Twitch Pings | ${GUILD}`).server).toBeUndefined();
  });

  test("what it returns fits Discord", () => {
    const samples = [
      detect("https://rambot.xyz/", "Ram Dashboard"),
      detect("https://rambot.xyz/activity/", "Spite Your Neighbor — Ram Activities", open),
      detect("https://www.rambot.xyz/docs", "Docs — Ram Dashboard", open),
    ];
    for (const activity of samples) expect(activity && checkActivity(activity)).toEqual([]);
  });
});

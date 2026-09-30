import { describe, expect, test } from "bun:test";
import { checkActivity, matches, page } from "../../../tools/testing";
import claude, { chatTitle } from "./activity";
import metadata from "./metadata.json";

/** Its one setting at its default, which the metadata says is off. */
const OFF = { showChatTitle: false };
const detect = (href: string, title = "", settings = OFF) =>
  claude.detect(page(href, title), settings);
const CHAT = "https://claude.ai/chat/0d5c7e7a-1b2c-4d3e-8f90-a1b2c3d4e5f6";

describe("Claude", () => {
  test("its one setting is off until someone turns it on", () => {
    expect(metadata.settings).toEqual([
      expect.objectContaining({ id: "showChatTitle", type: "boolean", default: false }),
    ]);
  });

  test("recognizes claude.ai over https only", () => {
    for (const href of ["https://claude.ai/", CHAT, "https://claude.ai/new"]) {
      expect(matches(metadata, href)).toBe(true);
    }
    for (const href of [
      "http://claude.ai/",
      "https://claude.ai.example.com/",
      "https://notclaude.ai/",
      "https://example.com/claude.ai",
    ]) {
      expect(matches(metadata, href)).toBe(false);
    }
  });

  test("a chat is 'Chatting with Claude', and its title stays private by default", () => {
    const activity = detect(CHAT, "Planning my thesis defense - Claude");
    expect(activity).toEqual({
      id: "claude",
      name: "Claude",
      url: "https://claude.ai/chat",
      assets: { largeImage: "https://claude.ai/apple-touch-icon.png", largeText: "Claude" },
      details: "Chatting with Claude",
      buttons: [{ label: "Open Claude", url: "https://claude.ai/" }],
    });
    expect(JSON.stringify(activity)).not.toContain("thesis");
    expect(JSON.stringify(activity)).not.toContain("0d5c7e7a");
  });

  test("with 'Show chat titles' on, the title is the state line, cleaned", () => {
    const on = { showChatTitle: true };
    expect(detect(CHAT, "Planning a trip - Claude", on)?.state).toBe("Planning a trip");
    expect(detect(CHAT, "Claude", on)?.state).toBeUndefined();
    expect(detect(CHAT, "", on)?.state).toBeUndefined();
    expect(detect("https://claude.ai/recents", "Chats - Claude", on)?.state).toBeUndefined();
  });

  test("other pages say what they are", () => {
    expect(detect("https://claude.ai/")?.details).toBe("Starting a chat");
    expect(detect("https://claude.ai/new")?.details).toBe("Starting a chat");
    expect(detect("https://claude.ai/recents")?.details).toBe("Browsing chats");
    expect(detect("https://claude.ai/projects")?.details).toBe("Browsing projects");
    expect(detect("https://claude.ai/project/abc")?.details).toBe("Working in a project");
    expect(detect("https://claude.ai/artifacts")?.details).toBe("Browsing artifacts");
    expect(detect("https://claude.ai/code")?.details).toBe("Using Claude Code");
    expect(detect("https://claude.ai/settings/profile")?.details).toBe("Changing settings");
    expect(detect("https://claude.ai/login")?.details).toBe("Using Claude");
    // Names that exist on every object aren't pages.
    expect(detect("https://claude.ai/constructor")?.details).toBe("Using Claude");
    expect(detect("https://claude.ai/__proto__")?.url).toBe("https://claude.ai/");
  });

  test("ids, query strings, and fragments never leave the browser", () => {
    for (const href of [
      "https://claude.ai/project/3f2a9c10-aaaa-bbbb-cccc-0123456789ab?token=secret#state=x",
      "https://claude.ai/login?code=secret",
      `${CHAT}?utm=secret`,
    ]) {
      const json = JSON.stringify(detect(href, "Title - Claude", { showChatTitle: true }));
      expect(json).not.toContain("secret");
      expect(json).not.toContain("3f2a9c10");
      expect(json).not.toContain("0d5c7e7a");
    }
  });

  test("titles are cleaned and bounded", () => {
    expect(chatTitle("Hello - Claude")).toBe("Hello");
    expect(chatTitle("Claude")).toBeNull();
    expect(chatTitle("New chat - Claude")).toBeNull();
    expect(chatTitle(`${"a".repeat(200)} - Claude`)).toHaveLength(64);
    expect(chatTitle("a‮b\u0000c - Claude")).toBe("abc");
  });

  test("nothing it returns would be refused or cut by Discord", () => {
    for (const href of [CHAT, "https://claude.ai/", "https://claude.ai/code"]) {
      const activity = detect(href, "Planning a trip - Claude", { showChatTitle: true });
      expect(activity && checkActivity(activity)).toEqual([]);
    }
  });
});

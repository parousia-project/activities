import type { Activity, NativeActivity, Page } from "parousia";
import metadata from "./metadata.json";

/**
 * The client never sets the tab's title and its addresses carry only ids, so
 * unlike Fluxer's it can say only what kind of page someone is on. It has no
 * settings because nothing it shows is private. Another instance's host
 * (`/i/<host>`) is never shown.
 */

const ORIGIN = "https://stoat.chat";
const NAME = "Stoat";

const ASSETS = "https://raw.githubusercontent.com/parousia-project/activities/main/assets";

const STATUS = {
  chat: { smallImage: `${ASSETS}/status/comments.png`, smallText: "Chatting" },
  conversation: { smallImage: `${ASSETS}/status/user.png`, smallText: "Conversation" },
  people: { smallImage: `${ASSETS}/status/users.png`, smallText: "Friends" },
} as const;

const ID = /^[A-Z\d]{26}$/;

const WEBSITE = new Set(["about", "brand", "download", "legal", "updates", "privacy", "terms"]);

const QUIET = new Set(["login", "invite", "bot", "pwa", "dev", "settings"]);

function detect({ url }: Page): Activity | null {
  const base: Activity = {
    id: "stoat",
    name: NAME,
    url: `${ORIGIN}/`,
    assets: { largeImage: metadata.icon, largeText: NAME },
  };
  const say = (details: string, status?: keyof typeof STATUS): Activity => ({
    ...base,
    details,
    ...(status && { assets: { ...base.assets, ...STATUS[status] } }),
  });
  const segments = url.pathname.split("/").filter(Boolean);

  const instance = segments[0] === "i";
  const [section = "", id, next, channel] = instance ? segments.slice(2) : segments;

  if (!instance && (section === "" || WEBSITE.has(section))) {
    return {
      ...base,
      details: section === "download" ? "Looking at Stoat downloads" : "Browsing the Stoat website",
    };
  }
  if (QUIET.has(section)) return null;

  if (section === "friends") return say("Browsing friends", "people");
  if (section === "discover") return say("Browsing server discovery");
  if (section === "channel" && id !== undefined && ID.test(id)) {
    return say("Chatting in a conversation", "conversation");
  }
  if (section === "server" && id !== undefined && ID.test(id)) {
    return next === "channel" && channel !== undefined && ID.test(channel)
      ? say("Chatting in a server", "chat")
      : say("Browsing a server");
  }

  return say("Browsing Stoat");
}

const activity: NativeActivity = { detect };

export default activity;

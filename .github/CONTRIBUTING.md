# Writing an Activity

This is the reference for native Parousia Activities: the format, the API, the rules, and how to test one. The README has the short version.

## How Parousia runs an Activity

The Parousia browser extension includes every Activity in this repository when it's built, at a commit the extension pins (`browser/activity-sources.json` in [Parousia's repository](https://github.com/Abadima/RPC)). Nothing is downloaded at runtime.

For the page in the active tab, Parousia picks the first Activity whose `matches` cover the page's URL and calls its `detect(page, settings)`. It calls again when the URL changes, and when the title changes on a page the Activity matches (single-page sites often set the title a moment after the URL). What `detect` returns becomes the user's presence: Parousia applies their Privacy settings, then Parousia Desktop shows it on Discord. Returning `null` means there's nothing to show on this page.

## Files

Each website's Activity is a folder, `websites/<letter>/<Name>/`:

- `<Name>` is the site's name as people know it: letters, digits, spaces, and `. ' & + _ -`, at most 64 characters (`Jena`, `YouTube Music`).
- `<letter>` is its first letter in upper case, `0-9` when it starts with a digit, or `#` for anything else. That's the same rule PreMiD's Activities follow, so the tree stays easy to browse as it grows.

In the folder:

- `metadata.json`: what the Activity is (below).
- `activity.ts`: its default export is `{ detect }`.
- `activity.test.ts`: its tests.

## metadata.json

| Key               | Required | What it is                                                                               |
| ----------------- | -------- | ---------------------------------------------------------------------------------------- |
| `apiVersion`      | yes      | `1`, the Activity API in `types/parousia.d.ts`                                           |
| `id`              | yes      | The folder's name in lowercase, words joined by `-` (`YouTube Music` is `youtube-music`) |
| `name`            | yes      | The site or service, as people know it (at most 64 characters)                           |
| `description`     | yes      | One sentence for the extension's Activities page (at most 256)                           |
| `version`         | yes      | `MAJOR.MINOR.PATCH`; raise it with every change                                          |
| `authors`         | yes      | `[{ "name": "…", "github": "…" }]`                                                       |
| `matches`         | yes      | The pages it's for, as match patterns                                                    |
| `discordClientId` | no       | Its own Discord Application; without one it shows as Parousia                            |
| `icon`            | no       | An `https` image URL for the extension's Activities page                                 |
| `data`            | no       | Page data it takes beyond the URL and title: `media`, `thumbnails` (below)               |
| `settings`        | no       | Options people can change (below)                                                        |

`schemas/metadata.json` describes the same thing for editors: keep the `"$schema"` line at the top and most editors will check the file as you type.

### matches

[Match patterns](https://developer.mozilla.org/docs/Mozilla/Add-ons/WebExtensions/Match_patterns), the same syntax browser extensions use: `https://example.com/*`, `https://*.example.com/*` (the domain and every subdomain), `https://example.com/watch*`. The scheme is `https`, `http`, or `*` for both; the host is always a particular site. Prefer `https`, and list `www.` separately when the site answers on both.

### settings

```json
{
  "id": "showButtons",
  "title": "Show buttons",
  "description": "Links to the page for people looking at your profile.",
  "type": "boolean",
  "default": true
}
```

| `type`    | `default`                       | Extra keys                |
| --------- | ------------------------------- | ------------------------- |
| `boolean` | `true` or `false`               |                           |
| `choice`  | the index of the default choice | `choices`: 2 to 32 labels |
| `text`    | text, possibly empty            | `placeholder`             |
| `number`  | a number                        | `placeholder`             |

`when` shows a setting only while other settings have given values: `"when": { "showButtons": true }`. `detect` receives every setting's current value in `settings`, keyed by `id`, with a choice as its index.

### data

Most Activities need nothing but the URL and title. One that shows what's playing can declare the page data it takes, and gets only that:

| Kind         | What Parousia reads                                                                                                  | `page` field     |
| ------------ | -------------------------------------------------------------------------------------------------------------------- | ---------------- |
| `media`      | The page's Media Session (title, artist, album) and its playing `<video>` or `<audio>` (playing, position, duration) | `page.media`     |
| `thumbnails` | The Media Session's largest `https` artwork, or the page's `og:image`                                                | `page.thumbnail` |

Parousia's own collector reads these; no Activity code runs in the page. An Activity that declares `data` is off until the person turns it on, which asks their browser for the sites `matches` names, and it runs only on sites they granted. It reads only the kinds the person allows for every Activity (Settings > Privacy in the extension). `page.granted` lists what the Activity has on this page. That can be nothing, so it must still work from the URL and title: declaring data never makes an Activity depend on it.

## activity.ts

```ts
import type { Activity, NativeActivity, Page } from "parousia";

function detect({ url, title }: Page): Activity | null {
  // …
}

const activity: NativeActivity = { detect };
export default activity;
```

`page.url` is a `URL`; `page.title` is the tab's title. That, and the page data it declares (above), is all an Activity sees: it doesn't run in the page and can't read it. `detect` runs often, so it must be quick and must not keep state between calls.

The Activity it returns:

| Field                                    | What Discord shows                                                     |
| ---------------------------------------- | ---------------------------------------------------------------------- |
| `id`                                     | Nothing; the Activity's id                                             |
| `name`                                   | The Activity's name ("Playing Jena Hub")                               |
| `details`, `state`                       | The two lines of text                                                  |
| `detailsUrl`, `stateUrl`                 | Links on those lines                                                   |
| `url`                                    | Nothing; the page it came from                                         |
| `assets.largeImage`, `assets.smallImage` | Images, as `https` URLs                                                |
| `assets.largeText`, `assets.smallText`   | Their captions                                                         |
| `timestamps.start`, `timestamps.end`     | Time elapsed or left, in Unix milliseconds                             |
| `buttons`                                | Up to two `{ label, url }` links, shown to people viewing your profile |

Discord refuses a whole activity over one bad field, so Parousia leaves out what it can't take: text under 2 or over 128 characters is left out or cut, links that aren't `http(s)`, more than two buttons, and so on. `checkActivity` in `tools/testing.ts` lists anything that would be lost.

## Rules

Every Activity follows these; reviews check them.

- **Only what the page says.** Build presence from the URL, the title, and the page data you declared, and nothing else: no network requests, storage, timers, or globals. Declare the least page data you need, and work without it.
- **No secrets.** Rebuild links from the parts you need. Never copy a query string or fragment unless it names what's shown (a video's `?v=`): sign-in codes and tokens live there.
- **Clean text.** Titles are written by whoever runs the site. Remove control and direction-override characters and cap the length before a title becomes a name (see `gameName` in `websites/J/Jena`).
- **Plain code.** No `eval`, `new Function`, or dynamic `import()`. Type-only imports from `"parousia"`; anything else the Activity needs lives in its folder.
- **The site's own images, or yours.** Image URLs are `https`, and Discord fetches them when it shows your presence.

## Testing

`tools/testing.ts` has helpers:

- `page(href, title, data?)`: a page as `detect` receives it; pass `{ granted, media, thumbnail }` to test with page data.
- `matches(metadata, href)`: whether Parousia would run the Activity there.
- `defaults(metadata)`: every setting at its default.
- `checkActivity(activity)`: what Discord would refuse or cut.

Test at least: the pages it matches and ones it must not (lookalike hosts like `example.com.evil.test`, other schemes); every kind of page it describes; that query strings and fragments don't leak into what it returns; and `checkActivity` on a few real pages. `websites/J/Jena/activity.test.ts` is an example.

`bun run check` runs the type checker, lint, format check, `tools/validate.ts` (every folder's place and name, metadata.json, and activity.ts), and the tests. CI runs the same.

## Trying it in the extension

In a checkout of [Parousia](https://github.com/Abadima/RPC), point the extension's build at this folder:

```sh
cd browser
PAROUSIA_ACTIVITIES_DIR=/path/to/activities bun run build
```

Then load `dist/chromium` (or `dist/firefox`) as an unpacked extension. The build checks every Activity again, including its types against Parousia's own copy of the API, and stops on a problem.

## API versions

This is Activity API version 1. A change that would break existing Activities gets a new `apiVersion`; Activities keep working on the version they were written for until they move.

Page data (`data`, `page.media`, `page.thumbnail`, `page.granted`) was added to version 1 without breaking anything: an Activity that doesn't declare it sees `granted: []` and nothing else changes. Reading anything else from the page isn't part of version 1. PreMiD's Activities read pages with their own code, and Parousia runs those on the sites someone allows when they turn one on.

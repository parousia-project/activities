# Writing an Activity

Reference guide for native Parousia Activities—format, API, rules, and testing. Check the README for the TL;DR.

## How Parousia Runs an Activity

Parousia bundles every Activity in this repo at build time (configured in `browser/activity-sources.json`). **Nothing is downloaded at runtime.**

When a tab loads or updates (URL/title change):

1. Parousia picks the first Activity with matching URL patterns.
2. It runs `detect(page, settings)`.
3. Returning `null` hides presence. Returning an Activity object updates Discord presence (respecting user privacy settings).

## File Structure

Activities live in `websites/<letter>/<Name>/`:

- `<Name>`: Site name (max 64 chars; letters, digits, spaces, `. ' & + _ -`).
- `<letter>`: Capital first letter, `0-9` for digits, or `#` for special characters (PreMiD-style).

```text
websites/Y/YouTube Music/
├── metadata.json   # Required: Activity manifest
├── activity.ts     # Required: Exports { detect }
└── fixtures.json   # Optional: Test cases
```

No test files required as `bun test` runs all Activities automatically. Use `fixtures.json` for complex logic, or your own debugging.

---

## metadata.json

```json
{
  "$schema": "../../../schemas/metadata.json",
  "apiVersion": 1,
  "id": "youtube-music",
  "name": "YouTube Music",
  "description": "Shows what you're listening to on YouTube Music.",
  "version": "1.0.0",
  "authors": [{ "name": "Dev", "github": "username" }],
  "matches": ["https://music.youtube.com/*"]
}
```

### Core Schema

| Key               | Req? | Description                                                                                                                       |
| ----------------- | ---- | --------------------------------------------------------------------------------------------------------------------------------- |
| `apiVersion`      | Yes  | Must be `1`                                                                                                                       |
| `id`              | Yes  | Lowercase folder name, hyphenated                                                                                                 |
| `name`            | Yes  | Display name (max 64 chars)                                                                                                       |
| `description`     | Yes  | One sentence (max 256 chars)                                                                                                      |
| `version`         | Yes  | `MAJOR.MINOR.PATCH`                                                                                                               |
| `authors`         | Yes  | Array of `[{ "name": "…", "github": "…" }]`                                                                                       |
| `matches`         | Yes  | [Match patterns](https://developer.mozilla.org/docs/Mozilla/Add-ons/WebExtensions/Match_patterns) (`https://`, `http://`, or `*`) |
| `discordClientId` | No   | Custom Discord App ID (defaults to Parousia)                                                                                      |
| `icon`            | No   | `https` image URL for options page                                                                                                |
| `data`            | No   | Request extra page features: `media`, `thumbnails`                                                                                |
| `settings`        | No   | User-configurable options                                                                                                         |

### Settings & Data

- **`settings`**: Define user inputs (`boolean`, `choice`, `text`, `number`). Values pass to `detect(page, settings)`.
- **`data`**: Declare `media` (Media Session / HTML5 players) or `thumbnails` (artwork / `og:image`).
- Activities don't run code in the page—Parousia collects this data natively.
- Users must explicitly grant permission for `data`-enabled Activities.
- **Always handle missing data gracefully**—fall back to URL and title.

---

## activity.ts

```ts
import type { Activity, NativeActivity, Page } from "parousia";

function detect({ url, title }: Page): Activity | null {
  return {
    type: "listening", // "playing" (default), "listening", "watching", "competing"
    details: title,
    state: url.hostname,
  };
}

const activity: NativeActivity = { detect };
export default activity;
```

### Constraints & Discord Limits

- `detect` runs often: **keep it synchronous, fast, and stateless.**
- Discord discards invalid fields. Parousia sanitizes outputs (truncates text over 128 chars, strips invalid URLs, limits buttons to 2).

---

## Rules

1. **Pure Inputs**: Use _only_ URL, title, and declared `data`. No fetch calls, DOM access, storage, timers, or global state.
2. **Sanitize Data**: Strip session tokens/secrets from URLs. Clean control characters and trim long titles.
3. **Plain Code**: No `eval`, dynamic imports, or runtime external modules.
4. **Clean Comments**: Explain _why_, not _what_. Code should self-document.
5. **Assets**: Store static icons in root `assets/`. Reference via GitHub raw URLs (PNG/JPEG, min 128x128, square).

---

## Testing & Tooling

Run standard tests across all Activities:

```bash
bun test             # Run test suite across all activities
bun run check        # Run typechecks, linter, file structure checks, and tests
bun run test:report  # Generate summary table of test results
bun run api-check    # Verify local types against Parousia RPC repo
```

### Fixtures (`fixtures.json`)

Optional snapshot testing for complex logic. Generate automatically with:

```bash
bun run fixture "<Folder>" <url> [title] [setting=value ...]
```

---

## Local Extension Testing

Test your changes inside the local extension build:

```bash
cd /path/to/parousia/browser
PAROUSIA_ACTIVITIES_DIR=/path/to/activities bun run build
```

Load `dist/chromium` or `dist/firefox` as an unpacked extension.

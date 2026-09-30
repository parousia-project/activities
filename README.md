# Parousia Activities

Native Activities for Parousia. An Activity teaches Parousia to recognize a site and describe what you're doing there, like "Playing Chess" on Jena Hub. The Parousia browser extension builds every Activity in this repository into itself.

Parousia also runs [PreMiD's Activities](https://github.com/PreMiD/Activities) unchanged, so a site PreMiD already covers doesn't need a copy here. Write a native Activity when a site isn't covered there, or when the page's URL and title say enough: a native Activity reads nothing else, so it needs no extra browser permission.

## Layout

Every website's Activity has its own folder, `websites/<letter>/<Name>/`, filed under its name's first letter (`0-9` for a digit, `#` for anything else), the same way PreMiD organizes theirs: Jena Hub is `websites/J/Jena/`.

| Path                                        | What it is                                                        |
| ------------------------------------------- | ----------------------------------------------------------------- |
| `websites/<letter>/<Name>/metadata.json`    | Name, description, the pages it's for, settings                   |
| `websites/<letter>/<Name>/activity.ts`      | `detect(page, settings)`: a page's URL and title in, presence out |
| `websites/<letter>/<Name>/activity.test.ts` | Its tests                                                         |
| `types/parousia.d.ts`                       | The Activity API                                                  |
| `schemas/metadata.json`                     | The schema for metadata.json                                      |
| `tools/`                                    | Validation and test helpers                                       |

## Contributing

1. Install [Bun](https://bun.sh), then run `bun install`.
2. Copy `websites/J/Jena` to `websites/<letter>/<Name>` and make it yours.
3. Run `bun run check`.
4. Open a pull request.

[CONTRIBUTING.md](.github/CONTRIBUTING.md) covers the format, the API, testing, and the rules every Activity follows. [PULL_REQUESTS.md](.github/PULL_REQUESTS.md) covers opening and reviewing a pull request.

## License

[Apache-2.0](LICENSE)

# Pull requests

Every Activity is added or changed through a pull request. This covers how to open one and what happens to it. [CONTRIBUTING.md](CONTRIBUTING.md) covers what an Activity is made of.

## Before you open one

1. Fork the repository and create a branch from `main`, named for the site (`add-jena`, `fix-youtube-music-title`).
2. Check that [PreMiD's Activities](https://github.com/PreMiD/Activities) doesn't already cover the site. Parousia runs those unchanged, so a copy here isn't needed.
3. Copy `websites/J/Jena` to `websites/<letter>/<Name>/` and edit it.
4. Run `bun run check`. CI runs the same command, and a pull request can't merge until it passes.

## One site per pull request

A pull request adds or changes one website's folder. Changes to `types/`, `schemas/`, or `tools/` go in their own pull request, since they affect every Activity.

## Title

Start with what changed and name the site:

- `Add Jena`
- `Jena: show the game's rank`
- `Fix YouTube Music title cleanup`

## Description

The template asks for:

- The site and the pages the Activity covers.
- What the presence looks like on each kind of page. A screenshot of the Discord profile helps.
- Whether it declares `data` (`media` or `thumbnails`), and why the URL and title aren't enough.
- Anything reviewers should look at closely.

## Changing an existing Activity

- Raise `version` in `metadata.json` in the same pull request.
- Add `authors` for yourself if you aren't listed.
- Add or update tests for the behavior you changed.

## What reviewers check

- `bun run check` passes.
- The folder is in the right place and named correctly.
- `matches` is as narrow as the Activity needs, and lookalike hosts are tested.
- Nothing beyond the URL, title, and declared page data is read, and no query string or fragment leaks into the presence.
- Titles are cleaned and length-capped before they become text.
- Every returned field passes `checkActivity`.

The full rules are under [Rules](CONTRIBUTING.md#rules).

## After review

Reviewers may ask for changes. Push them to the same branch and the pull request updates. Once approved, a maintainer squash-merges it. The Parousia extension picks up merged Activities the next time it updates its pinned commit, so a merge doesn't appear in the extension immediately.

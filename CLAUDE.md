# Lagotto App

Staff-facing tools for Lagotto restaurant (Fitzroy North), deployed as a Cloudflare
Workers Static Assets project at `staff.lagotto-fitzroynorth.com.au`.

Two kinds of page here:
- **Reference pages** staff use during service: `wine.html`, `cocktails.html`, `menu.html`,
  `dietary.html`, `wine-quiz.html`, `menu-quiz.html`.
- **BOH editing tools**: `wine-cellar.html`, `cocktail-library.html`, `dish-library.html`
  (edit + publish flows for wine, cocktails, and food respectively).

## Data model — read this before touching any JSON in this repo

Wine and food data is **not** stored in this repo. `wine.json` and `food.json` here are
static leftover reference copies from the original PDF transcription — nothing reads them
at runtime, and editing them has zero effect on any live page. The actual source of truth
for wine and food is two **GitHub Gists**, fetched live by every relevant page:

- Wine + cocktails (combined): `wine-cellar.html` / `wine.html` / `wine-quiz.html` fetch
  `https://gist.githubusercontent.com/davidyuncken-tech/cd3af55a9e99108f8a606a09fa0e8025/raw/wine_quiz_data.json`
- Food: `dish-library.html` / `menu.html` / `dietary.html` / `menu-quiz.html` fetch
  `https://gist.githubusercontent.com/davidyuncken-tech/961008059dd9725f75c8fff63fd8c64d/raw/menu_data.json`

Publishing (from the BOH tool's Publish button, or `scripts/publish.mjs`) POSTs the full
updated dataset to a Google Apps Script web app, which writes it back to the Gist. The
Apps Script URL + shared secret for each are embedded client-side in the relevant page's
`<head>` (`LAGOTTO_PUBLISH_URL`/`SECRET`, `LAGOTTO_WINE_PUBLISH_URL`/`SECRET`) — not
hidden, already in the repo.

**Cocktails are the exception**: `cocktails.json` in this repo *is* the live source of
truth. `cocktail-library.html` publishes straight to this file via GitHub's Contents API
(see `apps-script/cocktail-publisher.gs`), no Gist involved. Cocktail sections are sorted
alphabetically at render time in both `cocktails.html` and `cocktail-library.html` — new
entries slot in automatically, no manual sorting needed.

`raw.githubusercontent.com` caches aggressively. If you publish something and the raw
Gist/repo URL still shows the old value, don't panic — check the GitHub API
(`api.github.com/repos/.../contents/...` or `api.github.com/gists/...`) for the real,
uncached state before assuming a publish failed.

## Streamlined menu-update workflow

For routine menu/wine PDF updates (the common case — a few times a week), use
`scripts/publish.mjs` instead of clicking through the BOH UI:

```
node scripts/publish.mjs food ./patch.json           # dry run, shows the diff
node scripts/publish.mjs food ./patch.json --publish  # actually publishes
node scripts/publish.mjs wine ./patch.json --publish
```

See the comment header in `scripts/publish.mjs` for the patch file format. The normal
flow: parse the PDF, diff it against the live Gist, confirm the change list with the
user, then publish. `apps-script/` and `scripts/` are both excluded from the deployed
site via `.assetsignore`.

## Local dev

`node server.js` (port 8084) mimics Cloudflare's clean-URL/extensionless routing so local
testing matches production. `_redirects` handles 301s from old Webflow slugs.

## Other things worth knowing

- Apple-touch-icon color convention per tool group: wine = ink bg, food = rust bg,
  cocktail = sage bg, staff home hub = gold bg with an "S" monogram. Icons live in
  `assets/img/icons/`.
- BOH nav pills are split into two rows: "Staff pages" (reference, opens in a new tab)
  and "Editing" (the BOH tools themselves).

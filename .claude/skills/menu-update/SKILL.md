---
name: menu-update
description: Process a new kitchen menu, wine-list, or cocktail-spec PDF — diff it against the live App data (Gists + cocktails.json) and the Website's separate hardcoded copy, research any new wine against real sources before writing its tasting notes, confirm the change list with the user, publish to both (using the full required schema so new items stay editable), then refresh the kitchen gap report (missing photos, missing tasting notes, dietary-matrix mismatches, under-specified cocktails). Use whenever a menu/wine/beverage PDF is dropped into chat with a request to update the site.
---

# Menu / wine-list update workflow

Routine flow, expected a couple of times a week: someone drops a PDF straight into
chat and asks to update the site with it. This skill spans two sibling repos —
`App/` and `Website/`, checked out next to each other per the root `CLAUDE.md`.

## 0. Orient first

Read `App/CLAUDE.md` and `Website/CLAUDE.md` if you haven't this session. Load-bearing
facts from them, restated here so this skill is self-contained:

- Food and wine data live in two GitHub Gists, fetched **live** by the App's pages —
  `App/food.json` and `App/wine.json` in the repo are stale leftovers, not read by
  anything.
- `App/cocktails.json` is the one exception: it *is* the live source of truth for
  cocktails, published straight to the repo via GitHub's Contents API.
- `Website/more.html` holds a **completely separate, hand-authored, static** copy of
  the same menu/wine content, in two places in the one file (the regular accordion,
  and further down the Chef's Menu "Add to Your Menu" section). Nothing keeps it in
  sync with the App automatically — it has drifted out of sync before. Treat it as a
  required target every time, not an afterthought.
- `raw.githubusercontent.com` caches aggressively. If a just-published change doesn't
  show up on a refetch, check `api.github.com/gists/...` (or the repo contents API for
  cocktails.json) for the real state before assuming the publish failed.

## 1. Identify what came in

- **Food menu PDF** → dishes, categories (Snacks/Entrees/Pasta/Proteins/Sides/Dessert),
  prices, descriptions.
- **Wine/beverage list PDF** → wines by section (style/colour/region), BTG vs bottle
  pricing.
- **Cocktail spec sheet** → full bar recipes: ingredients *with oz measurements*,
  method, garnish — this is different from and more detailed than the short
  ingredient summary guests see.

## 2. Fetch current live state — always live, never trust stale local JSON

- Food: `https://gist.githubusercontent.com/lagottofitzroynorth/269584319e28a9726c00649104e0f273/raw/menu_data.json`
  (append `?t=<timestamp>` to bust cache)
- Wine: `https://gist.githubusercontent.com/lagottofitzroynorth/50df275f829876f48a4e4016ec27ec87/raw/wine_quiz_data.json`
- Cocktails: `App/cocktails.json` — `git pull` first, or fetch fresh via the GitHub
  contents API if you need certainty it's current.
- Website: read `Website/more.html` directly — both the accordion section and the
  Chef's Menu section.

## 3. Research any new wine before writing its tasting notes

For every wine that's new (not just a price/vintage bump on an existing one),
`tastingNotes`, `winemaking`, `producer` and `convNote` must be grounded in real
sources — WebSearch/WebFetch the producer's own page plus a couple of independent
listings (retailer tech sheets, Wine-Searcher, Vivino, Wine Enthusiast, etc.) and base
the write-up on what they actually say, not on general knowledge of the grape/region.
Don't publish a wine's tasting notes from inference alone.

This isn't a hypothetical risk — check it every time regardless of who entered the
PDF data. Verified against source on 2026-08-21, the three wines added in the
2026-08-20 update (Palmento Costanzo Mofete, Crotin 1897 San Patelu, Saison Aperitifs
Brae Farm Radicchio Amaro) turned out to be accurate — but that was confirmed by
research, not assumed. If a claim can't be corroborated (an unusual ABV, a specific
technique, a producer detail), say so in the diff shown to the user rather than
quietly publishing it as fact.

## 4. Diff, don't touch anything yet

Build a plain-language change list — new items, price moves, dropped items, wording
changes — cross-referenced against **all relevant targets** (Gist/cocktails.json, and
Website). Explicitly call out if Website is already behind the App from a prior
update. For new wines, include a one-line note on what was verified and against
which sources.

### Before treating any item as brand new, check it against the archive

A "new" item in the PDF is sometimes actually an archived (`active: false`) dish or
wine coming back with a minor tweak — a garnish or side swapped, format resized —
not a genuinely new item. Confusing the two in either direction is a real cost:
treating a revival as new creates a duplicate id and throws away the existing
photo, tasting notes and dietary history, generating make-work that already existed;
treating a genuine revival as identical risks silently carrying over dietary/allergen
data that no longer matches the changed recipe (this is exactly the recurring
"recipe changed, matrix hasn't caught up" pattern the kitchen-needs report tracks).

So: for every item that doesn't match an existing *active* item, compare it against
the archive in the same category — same core protein/component, overlapping
secondary ingredients, roughly the same format. If something plausible turns up,
**ask the user directly, one concrete question per candidate** — don't decide either
way yourself. Frame it concretely, e.g.: "The PDF has 'Queensland coral trout,
saffron bearnaise, goolwa pippies, silverbeet' ($65) — the archive has 'Whole side of
Coral Trout 650g, beurre blanc, pippies, silverbeet' ($200). Same protein and two of
the same sides, but a different format and price. Is this that dish coming back
reformatted, or a separate new one?" (This exact pair exists in the live data as of
2026-08-21 and was never asked about — worth resolving next time either is touched.)

- **If it's a revival**: `"update"` the *existing* id (never mint a new one) — flip
  `active` back to `true`, update the changed fields, and explicitly re-verify (not
  copy forward) the dietary matrix and tasting notes against the new description,
  even though the id and history carry over.
- **If it's genuinely new**: proceed as a normal `"add"` with a fresh id, full schema,
  per the rule below.

Show the diff and **wait for explicit confirmation** before publishing anything.

## 5. Publish once confirmed

- **Food / wine**: write a patch file in the format documented in the header comment
  of `App/scripts/publish.mjs`, dry-run it (`node scripts/publish.mjs food ./patch.json`),
  confirm the script's own diff matches expectations, then re-run with `--publish`.
- **Cocktails**: `scripts/publish.mjs`'s `kind:"cocktail"` option is a trap — it
  writes into the wine Gist's legacy `cocktails` array, which nothing reads anymore
  (see the header comment in `apps-script/cocktail-publisher.gs`). Instead, edit
  `App/cocktails.json` directly, then POST `{secret, data}` to
  `window.LAGOTTO_COCKTAIL_PUBLISH_URL` / `_SECRET` (read live from
  `cocktail-library.html`'s `<head>`), same pattern `publish.mjs` uses for food/wine.
- **New items**: kebab-case `id`, leave `image`/`img` empty until a real photo exists,
  mark tasting-note and dietary fields `"pending"` rather than guessing — this matches
  existing venue convention (see the food Gist's `data_completeness_note` and the
  per-dish `chef_note` fields already in the data).
- **New dishes must carry the FULL schema, always** — `id`, `category`, `name`,
  `price`, `image`, `active`, `draft`, `last_confirmed`, `confirmed_by`,
  `on_chefs_menu`, `tasting_notes_status`, `tasting_notes`, `tasting_notes_source`,
  `dietary` (one `{status:"pending", note:null}` entry per `dietary_categories` key),
  `chef_note`, `short_name`. **Why this is non-negotiable**: `dish-library.html`'s
  `dietaryHTML()` reads `dish.dietary[key]` unconditionally — a dish pushed without a
  `dietary` object renders fine in the read-only list but throws the moment someone
  clicks it open, so it becomes silently un-editable in the BOH tool. This exact bug
  shipped live on 2026-08-20: two dishes Liam added directly to the Gist (Aurum
  dry-aged duck breast, Queensland coral trout) landed with only 7 of the 15 required
  fields and can't be opened in the Dish Library as a result. `scripts/publish.mjs`'s
  food `"add"` op now auto-fills every missing field the same way the Dish Library's
  own "+ Add a dish" button does (see `fillDishDefaults()`), so publishing through the
  script is safe by default — but if a dish ever gets added by any other route (hand-
  editing the Gist, a different script), verify its key-set matches an existing
  complete dish before considering the update done. If you find a dish already broken
  this way, repair it by filling the missing fields with the same "pending"/"not yet
  reviewed" defaults, show the fix as a diff, and get confirmation before publishing —
  same as any other live-data change.
- **Website**: hand-edit `more.html` in both spots, matching the existing wording and
  HTML style. Commit with a clear message.

## 6. Kitchen gap report — regenerate every time, after publishing

Produce a report in the same style as a doc like `kitchen_needs_2026-08-20.md`
(ask the user where it should go / who it's for if unclear — likely a file to hand to
Liam/the kitchen). Sourced from **live data, post-publish**, covering every active
item across food, wine and cocktails:

- **Missing photo** — empty `image`/`img`.
- **Missing/pending tasting notes** — `tasting_notes_status` not `"complete"` (food);
  no `tastingNotes` (wine/cocktails).
- **Dietary matrix gaps** — for any dish this update touched (new, or
  description/ingredients changed), sanity-check the `dietary` object against the new
  text. Flag **high priority** only when confident it's wrong (an allergen explicitly
  named in the dish but marked `"safe"`); flag **medium / confirm with kitchen**
  otherwise. Never silently correct a dietary field — allergen data always needs
  kitchen sign-off (this is existing venue policy, stated in the food Gist's
  `data_completeness_note`).
- **Cocktails without a full bar spec** — present in the customer-facing list but
  missing or thin in `cocktails.json` (no oz measurements/method/garnish).

Only report items still open after this update's publish step. Match the existing
doc's format: grouped by priority, item name in bold, one line explaining the flag.

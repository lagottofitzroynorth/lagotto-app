# Kitchen / bar needs — Sept 2026 wine, beverage & food menu update

Generated after publishing the 2026-09-22 wine/beverage list PDF and the 2026-09-22 food
menu PDF to the live Gists, `cocktails.json`, the new `beer.json`, and the website.
Everything below is still open — nothing here has been guessed or silently filled in.

## For Liam — allergen/dietary confirmation needed (David: Liam will handle this)

Three dishes had specific dietary fields reset to "pending" because the recipe/garnish
changed enough that the previous answer could no longer be trusted — not because the
data was simply missing. These need the dietary matrix updated, not just filled in:

- **Black Opal wagyu 6+ 180g rump, broccoli leaf, miso mustard, jus** (revived, à la
  carte Proteins *and* the Chef's Menu protein course) — garnish changed from
  erbette/black garlic ketchup to broccoli leaf/miso mustard. Reset: **dairy, coeliac,
  gluten_free, fructose, onion_garlic**. Note on file: David confirmed 2026-09-22 there's
  no more split plating between à la carte and the Chef's Menu for this dish, but also
  flagged that the kitchen mixes up sauces and green garnishes between proteins often —
  worth double-checking what's actually going out before signing off the matrix.
- **Tiramisu, chocolate sponge, coffee gelato, caramel, mascarpone** — the printed name
  dropped "hazelnut crunch" entirely and added chocolate sponge + mascarpone. The old
  coeliac/gluten_free "modifiable — hazelnut cream on side" answer and the tree_nuts
  "contains" answer were both keyed specifically to that hazelnut layer, which may no
  longer be part of the dish at all. Reset: **coeliac, gluten_free, tree_nuts**.
- **NZ Yellowbelly flounder, lemon beurre blanc, asparagus, dill** (revived fish-of-the-day
  slot) — sauce and garnish fully changed (beurre noisette/pippies/silverbeet/capers →
  lemon beurre blanc/asparagus/dill), pippies dropped entirely. Reset: **dairy, molluscs,
  coeliac, gluten_free**.

Every other dietary field on these three dishes was left untouched because the specific
ingredient it depends on didn't change.

## Medium priority — confirm with kitchen/bar

- **Bera Barbera d'Asti** — the PDF itself is inconsistent: the Wine by the Glass page
  lists 2023 ($19 glass), the Wine by the Bottle page lists 2022 ($86 bottle). The Gist
  now carries 2022 (following the bottle page), but the website's glass-list copy still
  says 2023 and was left alone, since this same split already existed in the website's
  own content before today. Worth the bar confirming which vintage is actually being
  poured by the glass right now.
- **Villa Migliarina Chianti Superiore** (new wine, Red — Medium Weight, $110) — replaces
  Tenimenti Mancini 'Podere della Filandra' Chianti in this list slot. Tasting notes,
  winemaking and producer copy were researched from Falstaff, Vivino, a retailer tech
  sheet and the producer's own history — not yet tasted/confirmed in-house.
- **Saison Rhubarb Vermouth** (new, Vermouth & Friends, $17) — the rhubarb-flavoured
  sibling to the existing Saison White Flowers Vermouth, same Melbourne producer (Dave
  Verheul / Saison Aperitifs). Both are now active on the list. Tasting notes researched
  from the producer's own product copy and retailer listings — not yet confirmed
  in-house.
- **Beer — brand new category** (Peroni Red, Stingray Draught, Balter XPA, Bodriggy
  Speccy Juice, Yulli's Brews Amanda Mandarin IPA, Heaps Normal Quiet XPA) — first time
  beer has been tracked in the App at all (new `beer.json` + `/beer` staff reference
  page). All six ABVs matched the printed list exactly, but tasting notes are pulled
  from brewery/retailer sources, not house-tasted. Flagged `tasting_notes_status:
  "researched, pending venue review"` on every entry.
- **Cardamaro Spritz** and **Tommy Verde** (new cocktails, both printed and orderable
  now) — full bar spec (oz measurements, method, garnish) still pending from Liam.
  Currently hold only the short guest-facing description from the printed list, marked
  pending in `cocktails.json`.
- **Squid ink conchiglie, tiger prawn, vodka sauce, wood sorrel** — the printed name
  drops "prawn powder", which the existing tasting notes describe as an integral part of
  the dish (roasted, blitzed prawn shell). Worth confirming whether it's actually gone
  or just trimmed from the printed wording — doesn't change the crustacean flag either
  way since tiger prawn alone already covers that.
- **Potato rosti, blue fin tuna, bottarga, lemon** — printed name now says "blue fin
  tuna" instead of "tuna belly crudo"; the tasting notes still specifically describe
  "the fatty tuna belly". Might just be the same cut described more generically —
  worth a quick confirm rather than assuming.

## New dishes added, full dietary + tasting notes still pending

- **Add on Tasmanian sea urchin** ($8/$20, Snacks) — new add-on, same slot as the
  existing truffle add-on. Printed menu recommends it with the potato rosti and the
  Moreton Bay bug pasta.
- **Spinach lasagne, wagyu ragu, parmesan foam** ($48, Pasta) — replaces the celeriac/
  raclette/porcini lasagne (now archived). No tasting notes or dietary matrix yet — this
  is an in-house dish, not something to research externally.
- **Tortellini, potato & morels, smoked raclette, hazelnut foam** ($43, Pasta) —
  replaces the Tortelloni/confit duck leg ragu (now archived). David confirmed
  2026-09-22 this one is **vegetarian**; every other dietary field is still pending.

## Archived this update (dropped from the printed menu)

- Tortelloni, confit duck leg ragu, parmesan bechamel, hazelnut
- Celeriac, raclette & porcini lasagne, pecorino foam, black truffle
- Coral trout, goolwa pippies, preserved lemon, silverbeet (replaced by the flounder above)
- Matriarch wagyu 6+ 200g striploin, broccoli leaf, miso mustard, jus (replaced by the
  Black Opal wagyu rump above, on both the à la carte menu and the Chef's Menu)

## Chef's Menu bookkeeping fixed this update

- `course_order` was missing the Bavette Tartare and Conchiglie courses that the website
  (and presumably actual service) already included — added, matching the website.
- `add_ons` referenced two archived/retired dish ids (an old spanner-crab rosti and a
  retired spring roll) instead of the current potato rosti and wagyu intercostal skewer
  — fixed to match what's actually offered.
- `chefs_menu.notes` rewritten to drop now-contradictory history (previous notes
  described a "two different platings" story for the Black Opal wagyu rump across two
  separate prior revisions that no longer matches David's 2026-09-22 confirmation).

## Missing photos (active items)

- **Add on Tasmanian sea urchin**, **Spinach lasagne**, **Tortellini, potato & morels**
  — all three brand new, no photo yet.
- **Black Opal wagyu rump** and **NZ Yellowbelly flounder** still show their old photos
  (from the erbette/black-garlic-ketchup plating and the beurre-noisette plating
  respectively) — worth a reshoot since the garnish changed on both.

All six beer photos (Peroni Red, Stingray Draught, Balter XPA, Bodriggy Speccy Juice,
Yulli's Brews Amanda Mandarin IPA, Heaps Normal Quiet XPA) and the Villa Migliarina
Chianti Superiore photo were supplied 2026-09-22 and are now live.

No other active wine or existing food dish lacks a photo.

## Cocktails still needing a full bar spec

- **Cardamaro Spritz** (Cardamaro amaro, prosecco, soda, orange)
- **Tommy Verde** (Tequila blanco, tommy's kiwi, green tabasco, lime, agave)

## Retired this update (kept under "Retired" in the Cocktail Reference, not deleted)

- Fig Spritz, Los Amargos, Martini, Luca's Espresso Martini (House) — dropped from the
  printed Lagotto Cocktails section, replaced by Cardamaro Spritz and Tommy Verde.
  Original recipes preserved in the Retired section in case a regular asks for one.

## Resolved 2026-09-22 (research follow-up)

- **Amaro tasting notes** — 36 of the ~38 amaro/spirit entries that had an empty
  `tastingNotes[]` array (the long-standing gap noted in the 2026-08-29 report) now have
  real tasting notes, researched per-product from producer sites, retailer tech sheets
  and spirits-review sources (Distiller, Diffords Guide, Vinepair, Punch, etc). Not
  house-tasted/confirmed — worth a spot-check next time bar staff pour a few, but grounded
  in real sources rather than inferred from the grape/region alone.
- **Two could not be corroborated and were deliberately left alone:**
  - **Saison Blackcurrant Leaf Vin Amaro** — Saison Aperitifs' actual current range
    (Artichoke, Marigold, Radicchio, Rhubarb, White Flowers) turned up nowhere with a
    "Blackcurrant Leaf" release. Worth checking whether this is a discontinued/one-off
    batch, a mislabel of another flavour, or a custom order — as-is I don't have a real
    source to write tasting notes from.
  - **Tilus Amaro al Tartufo 1978** — only generic "truffle amaro" category information
    turned up, nothing specific to this bottle/vintage. Its `convNote` already on file
    may be accurate but wasn't independently verified.
- **Villa Migliarina Chianti Superiore's photo** — supplied by David and uploaded via the
  Wine Cellar photo pipeline; no longer missing.
- **Six beer photos** — supplied by David, downloaded and self-hosted under
  `assets/img/beer/`; `beer.html` now shows a thumbnail per entry.
- **Food schema bug found and fixed**: `scripts/publish.mjs`'s `fillDishDefaults()` was
  missing an `image` default, so the three new dishes added this update (sea urchin
  add-on, Spinach lasagne, Tortellini) briefly published with only 14 of the 15 required
  fields — the same class of bug that broke the Aurum duck breast/Coral trout dishes on
  2026-08-20. Caught and fixed immediately (all three patched to `image: null`, matching
  `createDish()`'s own default), and the script itself now defaults `image` for every
  future "add", so this shouldn't recur.

## Not flagged (checked, no issue)

- The 108-wine reactivation (nearly the entire wine list had been sitting
  `active: false` in the Gist since the 2026-08-31 update, apparently unintentionally)
  was verified item-by-item against the printed PDF before publishing — every
  vintage/price match was checked by script, not by eye.
- The staff Wine Cellar page may still show a stale, cached "11 archived" count for a
  while after this publish — that was a caching artifact from before this update, not a
  sign anything here is wrong. A hard refresh should clear it.

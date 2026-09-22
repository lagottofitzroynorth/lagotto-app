# Kitchen / bar needs — Sept 2026 wine & beverage list update

Generated after publishing the 2026-09-22 wine/beverage list PDF to the live wine Gist,
`cocktails.json`, the new `beer.json`, and the website. Everything below is still open —
nothing here has been guessed or silently filled in.

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

## Missing photos (active items)

- Villa Migliarina Chianti Superiore *(new)*
- Peroni Red, Stingray Draught, Balter XPA, Bodriggy Speccy Juice, Yulli's Brews Amanda
  Mandarin IPA, Heaps Normal Quiet XPA *(new — first six beers ever tracked, so this is
  six-for-six; worth asking whether photos are wanted for these at all before chasing
  them down)*

No other active wine lost or lacks a photo — the 108 wines reactivated this update all
already carried their existing photos from before they were archived.

## Cocktails still needing a full bar spec

- **Cardamaro Spritz** (Cardamaro amaro, prosecco, soda, orange)
- **Tommy Verde** (Tequila blanco, tommy's kiwi, green tabasco, lime, agave)

## Retired this update (kept under "Retired" in the Cocktail Reference, not deleted)

- Fig Spritz, Los Amargos, Martini, Luca's Espresso Martini (House) — dropped from the
  printed Lagotto Cocktails section, replaced by Cardamaro Spritz and Tommy Verde.
  Original recipes preserved in the Retired section in case a regular asks for one.

## Not flagged (checked, no issue)

- Amaro list (~36 items) still has no structured tasting-notes array — this is the same
  long-standing, pre-existing gap noted in the 2026-08-29 report, not something new from
  this update.
- The 108-wine reactivation (nearly the entire wine list had been sitting
  `active: false` in the Gist since the 2026-08-31 update, apparently unintentionally)
  was verified item-by-item against the printed PDF before publishing — every
  vintage/price match was checked by script, not by eye.
- The staff Wine Cellar page may still show a stale, cached "11 archived" count for a
  while after this publish — that was a caching artifact from before this update, not a
  sign anything here is wrong. A hard refresh should clear it.

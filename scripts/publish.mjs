#!/usr/bin/env node
/**
 * Publish menu/wine changes straight to the live Gists, bypassing the
 * Dish Library / Wine Cellar browser UI.
 *
 * Reuses the exact publish protocol those pages already use (same Apps
 * Script endpoints, same secrets — read live from the HTML so this never
 * drifts out of sync if a secret is rotated). This exists so Claude can
 * apply a menu-PDF diff in one reliable pass instead of clicking through
 * the BOH tool by hand.
 *
 * Usage:
 *   node scripts/publish.mjs food ./patch.json           # dry run — shows the diff, does not publish
 *   node scripts/publish.mjs food ./patch.json --publish  # actually publishes
 *   node scripts/publish.mjs wine ./patch.json --publish
 *
 * Patch file format — a JSON array of ops:
 *   food, matched by dish id:
 *     {"op":"update","id":"tiramisu","fields":{"price":"$24"}}
 *     {"op":"add","item":{"id":"...", "category":"Entrees", "name":"...", "price":"$36", "image":"", "active":true}}
 *   wine, matched by wine/cocktail name:
 *     {"op":"update","kind":"wine","name":"2024 Carousal","fields":{"bottlePrice":72}}
 *     {"op":"add","kind":"wine","section":"red-medium","item":{"name":"...", ...}}
 *     {"op":"update","kind":"cocktail","name":"Bello Cello","fields":{"price":27}}
 *
 * "add" for wine does a best-effort section placement (pushes the name into
 * that section's top-level wines list). It does not handle by-the-glass
 * subgroup placement or map pins — finish those in Wine Cellar by hand.
 *
 * Food "add" only needs the fields shown above — every other field the Dish
 * Library expects (tasting_notes_status, dietary, chef_note, short_name, etc.,
 * see createDish() in dish-library.html) is defaulted the same way the "+ Add
 * a dish" button in the Dish Library does. This matters: a dish pushed to the
 * Gist without a `dietary` object crashes dish-library.html's edit panel
 * (dietaryHTML() reads dish.dietary[key] unconditionally) — the dish shows up
 * in the list but silently can't be opened or edited. Two dishes shipped that
 * way in the 2026-08-20 update before this defaulting existed; don't
 * reintroduce it by constructing `item` by hand elsewhere.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const TARGETS = {
  food: {
    gistUrl: 'https://gist.githubusercontent.com/lagottofitzroynorth/269584319e28a9726c00649104e0f273/raw/menu_data.json',
    pageFile: 'dish-library.html',
    urlVar: 'LAGOTTO_PUBLISH_URL',
    secretVar: 'LAGOTTO_PUBLISH_SECRET',
  },
  wine: {
    gistUrl: 'https://gist.githubusercontent.com/lagottofitzroynorth/50df275f829876f48a4e4016ec27ec87/raw/wine_quiz_data.json',
    pageFile: 'wine-cellar.html',
    urlVar: 'LAGOTTO_WINE_PUBLISH_URL',
    secretVar: 'LAGOTTO_WINE_PUBLISH_SECRET',
  },
};

function readPagePublishConfig(pageFile, urlVar, secretVar) {
  const html = readFileSync(path.join(ROOT, pageFile), 'utf8');
  const urlMatch = html.match(new RegExp(`window\\.${urlVar}\\s*=\\s*'([^']+)'`));
  const secretMatch = html.match(new RegExp(`window\\.${secretVar}\\s*=\\s*'([^']+)'`));
  if (!urlMatch || !secretMatch) {
    throw new Error(`Could not find ${urlVar}/${secretVar} in ${pageFile}`);
  }
  return { url: urlMatch[1], secret: secretMatch[1] };
}

async function fetchJson(url) {
  const res = await fetch(url + (url.includes('?') ? '&' : '?') + 't=' + Date.now());
  if (!res.ok) throw new Error(`GET ${url} -> HTTP ${res.status}`);
  return res.json();
}

function blankDietary(data) {
  const out = {};
  for (const c of data.dietary_categories || []) out[c.key] = { status: 'pending', note: null };
  return out;
}

// Mirrors createDish() in dish-library.html so a dish added via this script
// is exactly as complete as one added through the "+ Add a dish" button.
// Fields the caller supplies win; everything else gets the same "not yet
// reviewed" defaults the Dish Library itself would use.
function fillDishDefaults(item, data) {
  const today = new Date().toISOString().slice(0, 10);
  return {
    active: false,
    draft: true,
    last_confirmed: today,
    confirmed_by: 'added via publish.mjs',
    on_chefs_menu: false,
    tasting_notes_status: 'pending',
    tasting_notes: null,
    tasting_notes_source: null,
    dietary: blankDietary(data),
    chef_note: 'Added by hand and not yet reviewed. Set the price, tasting notes '
      + 'and dietary before switching it on.',
    short_name: (item.name || '').split(',')[0].trim(),
    ...item,
  };
}

function applyFoodPatch(data, ops) {
  const diff = [];
  for (const op of ops) {
    if (op.op === 'update') {
      const dish = data.dishes.find(d => d.id === op.id);
      if (!dish) throw new Error(`food update: no dish with id "${op.id}"`);
      const before = {};
      for (const k of Object.keys(op.fields)) before[k] = dish[k];
      Object.assign(dish, op.fields);
      diff.push({ id: op.id, name: dish.name, before, after: op.fields });
    } else if (op.op === 'add') {
      if (data.dishes.some(d => d.id === op.item.id)) {
        throw new Error(`food add: dish id "${op.item.id}" already exists`);
      }
      const dish = fillDishDefaults(op.item, data);
      data.dishes.push(dish);
      diff.push({ id: dish.id, name: dish.name, before: null, after: 'ADDED' });
    } else {
      throw new Error(`unknown food op: ${op.op}`);
    }
  }
  return diff;
}

function applyWinePatch(data, ops) {
  const diff = [];
  for (const op of ops) {
    const list = op.kind === 'cocktail' ? data.cocktails : data.wines;
    if (op.op === 'update') {
      const rec = list.find(w => w.name === op.name);
      if (!rec) throw new Error(`wine update: no ${op.kind || 'wine'} named "${op.name}"`);
      const before = {};
      for (const k of Object.keys(op.fields)) before[k] = rec[k];
      Object.assign(rec, op.fields);
      diff.push({ name: op.name, kind: op.kind || 'wine', before, after: op.fields });
    } else if (op.op === 'add') {
      if (list.some(w => w.name === op.item.name)) {
        throw new Error(`wine add: "${op.item.name}" already exists`);
      }
      list.push(op.item);
      if (op.kind !== 'cocktail' && op.section) {
        const section = data.sections.find(s => s.id === op.section);
        if (!section) throw new Error(`wine add: no section "${op.section}"`);
        section.wines.push(op.item.name);
      }
      diff.push({ name: op.item.name, kind: op.kind || 'wine', before: null, after: 'ADDED — check section/subgroup placement and map pin in Wine Cellar' });
    } else {
      throw new Error(`unknown wine op: ${op.op}`);
    }
  }
  return diff;
}

async function publish(target, url, secret, payloadExtra) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ secret, ...payloadExtra }),
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    if (/accounts\.google\.com|signin|Sign in/i.test(text)) {
      throw new Error('the web app is asking for a Google sign-in — deployment access must be "Anyone".');
    }
    if (res.status === 404) throw new Error('404 — that deployment no longer exists.');
    throw new Error(`HTTP ${res.status}, non-JSON reply: ${text.replace(/\s+/g, ' ').slice(0, 200)}`);
  }
  return json;
}

async function main() {
  const [, , targetName, patchPath, ...rest] = process.argv;
  const doPublish = rest.includes('--publish');

  if (!targetName || !TARGETS[targetName] || !patchPath) {
    console.error('Usage: node scripts/publish.mjs <food|wine> <patch.json> [--publish]');
    process.exit(1);
  }

  const target = TARGETS[targetName];
  const ops = JSON.parse(readFileSync(patchPath, 'utf8'));
  const { url, secret } = readPagePublishConfig(target.pageFile, target.urlVar, target.secretVar);

  console.log(`Fetching live ${targetName} data...`);
  const data = await fetchJson(target.gistUrl);

  const knownIds = targetName === 'food' ? data.dishes.map(d => d.id) : undefined;
  const knownNames = targetName === 'wine' ? data.wines.map(w => w.name) : undefined;

  const diff = targetName === 'food' ? applyFoodPatch(data, ops) : applyWinePatch(data, ops);

  console.log(`\n${diff.length} change(s):`);
  for (const d of diff) {
    console.log(`  - ${d.name}`);
    if (d.after === 'ADDED' || typeof d.after === 'string') {
      console.log(`      ${d.after}`);
    } else {
      for (const k of Object.keys(d.after)) {
        console.log(`      ${k}: ${JSON.stringify(d.before[k])} -> ${JSON.stringify(d.after[k])}`);
      }
    }
  }

  if (!doPublish) {
    console.log('\nDry run only — nothing published. Re-run with --publish to push live.');
    return;
  }

  console.log('\nPublishing...');
  const payloadExtra = targetName === 'food'
    ? { data, knownIds }
    : { target: 'wine', data, knownNames };
  const result = await publish(targetName, url, secret, payloadExtra);

  if (result.ok) {
    console.log('Published — live on the staff pages.');
  } else {
    console.error('Publish failed:', result.message || JSON.stringify(result));
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});

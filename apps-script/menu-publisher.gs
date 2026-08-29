/**
 * Lagotto — form and Dish Library → Gist, without the CSV.
 *
 * Lives in the Google Sheet that collects the chef form responses:
 *   Extensions → Apps Script, paste this in.
 *
 * It does two jobs:
 *   1. onFormSubmit — a chef submits a dish, this writes it straight to the Gist.
 *   2. doPost       — the Dish Library page publishes on/off changes to the Gist.
 *
 * SAFETY RULE THAT SHAPES EVERYTHING BELOW:
 * a new dish arrives as active:false, so it appears in the Dish Library but on
 * none of the staff pages until you toggle it on. Chefs can submit freely; the
 * floor only ever sees what you've approved. For a dish that already exists,
 * only its dietary, photo, method notes and confirmation date are updated —
 * never its name, price, category or active state, because those are yours.
 *
 * SETUP
 *   Project Settings → Script Properties, add:
 *     GITHUB_TOKEN   a fine-grained PAT with Gist read+write, AND Contents:
 *                    read and write on the lagottofitzroynorth/lagotto-app
 *                    repo (needed for photo uploads — see the GitHub photo
 *                    upload section below). One token, two permissions.
 *     GIST_ID        269584319e28a9726c00649104e0f273
 *     REPO           lagottofitzroynorth/lagotto-app
 *     BRANCH         main (optional — defaults to main if unset)
 *     SHARED_SECRET  any long random string; also paste it into lagotto-boh.html
 *   Triggers → Add trigger → onFormSubmit → From spreadsheet → On form submit
 *   Deploy → New deployment → Web app → Execute as me → Anyone
 *
 * The token never leaves Google. The Dish Library page only ever sees the
 * shared secret, which can do nothing except call this endpoint.
 */

var FILENAME = 'menu_data.json';

/* Bumped whenever doPost gains a capability. The Dish Library checks this on
 * load and warns if the deployed version is behind, because a web app keeps
 * serving the version it was deployed at - editing the script is not enough,
 * you have to Deploy > Manage deployments > New version. That trap costs an
 * afternoon the first time it bites. */
var SCRIPT_VERSION = 9;

var CATEGORIES = {
  dairy: ['dairy', 'milk'],
  coeliac: ['coeliac', 'celiac'],
  gluten_free: ['gluten'],
  crustacean: ['crustacean', 'prawn', 'crab'],
  molluscs: ['mollusc', 'mollusk', 'shellfish'],
  sesame: ['sesame'],
  peanuts: ['peanut'],
  tree_nuts: ['tree nut', 'treenut', 'nuts'],
  fructose: ['fructose', 'fodmap'],
  vegetarian: ['vegetarian'],
  vegan: ['vegan'],
  pregnant: ['pregnan'],
  onion_garlic: ['onion', 'garlic', 'allium'],
  egg: ['egg']
};

var LABELS = {
  dairy: 'Dairy', coeliac: 'Coeliac', gluten_free: 'Gluten Free',
  crustacean: 'Crustacean', molluscs: 'Molluscs', sesame: 'Sesame',
  peanuts: 'Peanuts', tree_nuts: 'Tree Nuts', fructose: 'Fructose / FODMAP',
  vegetarian: 'Vegetarian', vegan: 'Vegan', pregnant: 'Pregnancy-safe',
  onion_garlic: 'Onion & Garlic', egg: 'Egg'
};

var REQUIREMENT = {
  coeliac: { yes: 'Contains gluten — not coeliac-safe as served.',
             no: 'Coeliac-safe as made — no gluten-containing ingredient.' },
  gluten_free: { yes: 'Contains gluten — not gluten free as served.',
                 no: 'Gluten free as made.' },
  vegetarian: { yes: 'Contains meat, poultry or seafood — not vegetarian as served.',
                no: 'Vegetarian as made.' },
  vegan: { yes: 'Contains animal products — not vegan as served.',
           no: 'Vegan as made.' },
  pregnant: { yes: 'Contains an ingredient not recommended during pregnancy — not suitable as served.',
              no: 'Suitable during pregnancy as made.' }
};

function norm(s) {
  return String(s == null ? '' : s).replace(/\s+/g, ' ').trim().toLowerCase();
}

function checkProps() {
  var p = PropertiesService.getScriptProperties().getProperties();
  Object.keys(p).forEach(function (k) {
    Logger.log('[' + k + '] length=' + p[k].length);
  });
}


function matchCategory(header) {
  var inner = String(header).match(/\[(.+?)\]/);
  var text = norm(inner ? inner[1] : header);
  var best = null, bestLen = 0;
  for (var key in CATEGORIES) {
    CATEGORIES[key].forEach(function (w) {
      if (text.indexOf(w) !== -1 && w.length > bestLen) { best = key; bestLen = w.length; }
    });
  }
  return best;
}

function findColumn(headers) {
  var words = Array.prototype.slice.call(arguments, 1);
  for (var i = 0; i < headers.length; i++) {
    var n = norm(headers[i]);
    if (words.every(function (w) { return n.indexOf(w) !== -1; })) return i;
  }
  return -1;
}

/** Sheets stores a typed price as a number, so "$14" arrives as 14. Every other
 *  price in the data carries a dollar sign; without this the card renders "14". */
function formatPrice(raw) {
  var s = String(raw == null ? '' : raw).trim();
  if (!s) return 'TBC';
  if (s.charAt(0) === '$') return s;
  var n = Number(s);
  if (!isNaN(n) && s !== '') {
    // 18ea and similar stay as typed; plain numbers lose a trailing .0
    return '$' + (n % 1 === 0 ? String(n) : String(n));
  }
  return s;
}


function slugify(title) {
  return String(title).split(/[,(]/)[0]
    .toLowerCase().replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '').slice(0, 40) || 'untitled';
}

/**
 * Turn a form upload into a URL an <img> tag can actually load.
 *
 * The old drive.google.com/uc?export=view path now returns 403 — it broke as a
 * side effect of Drive dropping third-party cookies. The /thumbnail endpoint is
 * the current working route.
 *
 * Treat this as good enough to REVIEW a dish, not to serve it. The thumbnail
 * endpoint rate-limits when a page loads many images at once, and Drive is not
 * a CDN. Every established dish photo lives in the lagotto-app repo on GitHub;
 * a new dish should be moved there before it goes on the menu. Because
 * submissions arrive switched off, the staff pages never serve a Drive URL
 * unless a dish is switched on before its photo is moved — which is what the
 * chef_note warns about.
 */
function publicDriveUrl(raw) {
  var m = String(raw || '').match(/(?:\/d\/|id=)([A-Za-z0-9_-]{20,})/);
  if (!m) return String(raw || '').trim() || null;
  try {
    DriveApp.getFileById(m[1])
      .setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (err) {
    Logger.log('could not open sharing on ' + m[1] + ': ' + err);
  }
  return 'https://drive.google.com/thumbnail?id=' + m[1] + '&sz=w1000';
}


function parseModifications(text) {
  var out = {};
  String(text || '').split('\n').forEach(function (line) {
    line = line.replace(/^[\s\-•\t]+/, '').trim();
    if (!line || line.indexOf(':') === -1) return;
    var i = line.indexOf(':');
    var key = matchCategory(line.slice(0, i));
    var note = line.slice(i + 1).trim();
    if (key && note) out[key] = note.charAt(0).toUpperCase() + note.slice(1);
  });
  return out;
}

function containsNote(key, src) {
  if (REQUIREMENT[key]) return REQUIREMENT[key].yes + src;
  return LABELS[key] + ' is integral to this dish as served.' + src;
}

function safeNote(key, src) {
  if (REQUIREMENT[key]) return REQUIREMENT[key].no + src;
  return 'No ' + LABELS[key].toLowerCase() + ' in this dish as made.' + src;
}

/** One sheet row → the dietary block the pages render. */
function buildDietary(headers, row, src) {
  var mods = parseModifications(row[findColumn(headers, 'modif')]);
  var reserved = {};
  ['timestamp', 'name', 'dish', 'title', 'photo', 'image', 'method',
   'provenance', 'modif', 'category', 'price'].forEach(function (w) {
    var i = findColumn(headers, w);
    if (i >= 0) reserved[i] = true;
  });

  var out = {};
  for (var key in CATEGORIES) out[key] = { status: 'pending', note: null };

  for (var i = 0; i < headers.length; i++) {
    if (reserved[i]) continue;
    var key = matchCategory(headers[i]);
    if (!key) continue;
    var answer = norm(row[i]);
    if (answer.indexOf('contain') === 0) {
      out[key] = { status: 'contains', note: containsNote(key, src) };
    } else if (answer.indexOf('not present') === 0 || answer === 'none') {
      out[key] = { status: 'safe', note: safeNote(key, src) };
    } else if (answer.indexOf('modif') !== -1 || answer.indexOf('can be') === 0) {
      out[key] = {
        status: 'modifiable',
        note: (mods[key] || 'Can be modified — ask the kitchen how.') + src
      };
    }
    // anything else, including "not sure" and blank, stays pending
  }
  return out;
}

function readGist() {
  var props = PropertiesService.getScriptProperties();
  var res = UrlFetchApp.fetch(
    'https://api.github.com/gists/' + props.getProperty('GIST_ID'),
    { headers: {
        Authorization: 'Bearer ' + props.getProperty('GITHUB_TOKEN'),
        Accept: 'application/vnd.github+json'
      }, muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) {
    throw new Error('gist read failed: ' + res.getResponseCode() + ' ' + res.getContentText());
  }
  var files = JSON.parse(res.getContentText()).files;
  if (!files[FILENAME]) throw new Error('gist has no ' + FILENAME);
  return JSON.parse(files[FILENAME].content);
}

function writeGist(data) {
  var props = PropertiesService.getScriptProperties();
  var body = { files: {} };
  body.files[FILENAME] = { content: JSON.stringify(data, null, 2) + '\n' };
  var res = UrlFetchApp.fetch(
    'https://api.github.com/gists/' + props.getProperty('GIST_ID'),
    { method: 'patch',
      contentType: 'application/json',
      payload: JSON.stringify(body),
      headers: {
        Authorization: 'Bearer ' + props.getProperty('GITHUB_TOKEN'),
        Accept: 'application/vnd.github+json'
      }, muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) {
    throw new Error('gist write failed: ' + res.getResponseCode() + ' ' + res.getContentText());
  }
}

/**
 * Find the dish a submission refers to.
 *
 * Dish ids were chosen by hand ("focaccia"), not derived from titles
 * ("sourdough_focaccia"), so matching on the slug alone silently creates a
 * duplicate for nearly every existing dish. Exact name is the reliable key.
 *
 * If nothing matches we return the closest candidate too, so the email can say
 * "this looks like it might be an update to X" rather than leaving a quiet
 * duplicate in the library. A wrong guess costs a draft you delete; a wrong
 * overwrite costs live dietary data, so this only ever suggests.
 */
function findExisting(data, title, id) {
  var target = norm(title);
  var i, d;
  for (i = 0; i < data.dishes.length; i++) {
    if (norm(data.dishes[i].name) === target) return { dish: data.dishes[i], how: 'name' };
  }
  for (i = 0; i < data.dishes.length; i++) {
    if (data.dishes[i].id === id) return { dish: data.dishes[i], how: 'slug' };
  }
  // no match — is anything close enough to be worth mentioning?
  var head = target.split(',')[0].trim();
  var near = null;
  for (i = 0; i < data.dishes.length; i++) {
    d = data.dishes[i];
    var dHead = norm(d.name).split(',')[0].trim();
    if (!head || !dHead) continue;
    if (dHead === head || dHead.indexOf(head) !== -1 || head.indexOf(dHead) !== -1) {
      near = d;
      break;
    }
  }
  return { dish: null, how: null, near: near };
}


/**
 * Fold one submission into the live data.
 * Returns a short human sentence describing what changed, for the email.
 */
function mergeSubmission(data, headers, row) {
  var title = String(row[findColumn(headers, 'dish')] || row[findColumn(headers, 'title')] || '').trim();
  if (!title) return null;

  var id = slugify(title);
  var who = String(row[findColumn(headers, 'name')] || '').trim() || 'unattributed';
  var stamp = row[0] instanceof Date ? row[0] : new Date();
  var when = Utilities.formatDate(stamp, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  var src = ' [source: kitchen form, ' + who + ', ' + when + ']';

  var photoCol = findColumn(headers, 'photo');
  if (photoCol < 0) photoCol = findColumn(headers, 'image');
  var image = photoCol >= 0 ? publicDriveUrl(row[photoCol]) : null;

  var methodCol = findColumn(headers, 'method');
  if (methodCol < 0) methodCol = findColumn(headers, 'provenance');
  var method = methodCol >= 0 ? String(row[methodCol] || '').trim() : '';

  var catCol = findColumn(headers, 'category');
  var category = catCol >= 0 ? String(row[catCol] || '').trim() : '';

  var dietary = buildDietary(headers, row, src);
  var found = findExisting(data, title, id);
  var existing = found.dish;

  if (existing) {
    // Update only what the kitchen owns. Name, price, category and active
    // state are David's, set against the printed menu.
    existing.dietary = dietary;
    existing.last_confirmed = when;
    existing.confirmed_by = who;
    if (image) existing.image = image;
    if (method) {
      existing.tasting_notes = method;
      existing.tasting_notes_status = 'complete';
      existing.tasting_notes_source = 'Kitchen form, ' + who + ', ' + when + '.';
    }
    return 'Updated "' + existing.name + '" — dietary and notes refreshed. '
      + 'It is ' + (existing.active === false ? 'still archived' : 'live on the menu') + '.'
      + (found.how === 'slug'
          ? '\n\nNote: matched on a shortened name rather than an exact title. '
            + 'The submitted title was "' + title + '". Worth a check.'
          : '');
  }

  var dish = {
    id: id,
    category: category || 'Snacks',
    name: title,
    price: formatPrice(row[findColumn(headers, 'price')]),
    image: image,
    active: false,
    draft: true,
    last_confirmed: when,
    confirmed_by: who,
    on_chefs_menu: false,
    tasting_notes_status: method ? 'complete' : 'pending',
    tasting_notes: method || null,
    tasting_notes_source: method ? ('Kitchen form, ' + who + ', ' + when + '.') : null,
    dietary: dietary,
    chef_note: 'Submitted through the kitchen form and not yet reviewed. Confirm '
      + 'the name, price and category against the printed menu before switching on.'
      + (image ? ' The photo is still hosted on Google Drive, which is not a '
          + 'reliable image host — upload a proper photo through the Dish '
          + 'Library\'s photo picker and swap the URL before this dish goes on '
          + 'the menu.' : ' No photo was supplied.'),
    short_name: title.split(',')[0].trim()
  };
  insertInCategoryOrder(data, dish);
  var msg = 'New dish "' + title + '" added to the Dish Library, switched OFF. '
    + 'Review it and toggle on when it goes to print.';
  if (found.near) {
    msg += '\n\nHeads up: this looks close to the existing dish "' + found.near.name
      + '". If it was meant as an update to that one rather than a new dish, '
      + 'delete the draft and have it resubmitted with the exact printed title.';
  }
  return msg;
}

/**
 * Put a new dish with its own kind rather than on the end of the list.
 *
 * The pages start a new category heading whenever the category changes, so a
 * Snacks dish appended after the desserts produces a second SNACKS heading at
 * the very bottom - which reads as "nothing happened" to whoever is looking.
 */
function insertInCategoryOrder(data, dish) {
  var order = data.menu_categories || [];
  var rank = order.indexOf(dish.category);
  if (rank === -1) { data.dishes.push(dish); return; }
  var at = -1;
  for (var i = 0; i < data.dishes.length; i++) {
    var r = order.indexOf(data.dishes[i].category);
    if (r !== -1 && r > rank) { at = i; break; }
  }
  if (at === -1) data.dishes.push(dish);
  else data.dishes.splice(at, 0, dish);
}



/* ===========================================================================
 * GitHub photo upload.
 *
 * Photos used to go to Webflow's CDN via a site token with assets:write --
 * that broke when the Webflow subscription was cancelled (2026-08-29).
 * Photos now commit straight into assets/img/dishes/ in the lagotto-app
 * GitHub repo instead, served from staff.lagotto-fitzroynorth.com.au. This
 * is the same approach the Cocktail Library's publisher already used
 * successfully (apps-script/cocktail-publisher.gs in that repo) -- there's
 * no Webflow dependency left to replace on that side.
 *
 * Extra script properties needed (see SETUP at the top of this file):
 *   REPO    lagottofitzroynorth/lagotto-app
 *   BRANCH  main (optional -- defaults to main if unset)
 *
 * GITHUB_TOKEN is the same token readGist/writeGist already use -- it just
 * needs Contents: read and write added on the lagotto-app repo, alongside
 * its existing Gist read+write permission.
 * =========================================================================== */

/** GitHub commits get upset about unusual file names; keep it plain. */
function safeFileName(dishId, mime) {
  var ext = mime && mime.indexOf('png') !== -1 ? 'png'
          : mime && mime.indexOf('webp') !== -1 ? 'webp' : 'jpg';
  return (String(dishId).replace(/[^a-z0-9_-]/gi, '').slice(0, 60) || 'dish')
    + '-' + Date.now() + '.' + ext;
}

function uploadToGithub(base64, mime, dishId) {
  var props = PropertiesService.getScriptProperties();
  var token = props.getProperty('GITHUB_TOKEN');
  var repo = props.getProperty('REPO');
  var branch = props.getProperty('BRANCH') || 'main';
  if (!token || !repo) {
    var missing = [];
    if (!token) missing.push('GITHUB_TOKEN');
    if (!repo) missing.push('REPO');
    throw new Error(missing.join(' and ') + ' not set.');
  }

  var path = 'assets/img/dishes/' + safeFileName(dishId, mime);
  var res = UrlFetchApp.fetch(
    'https://api.github.com/repos/' + repo + '/contents/' + path,
    { method: 'put',
      contentType: 'application/json',
      payload: JSON.stringify({
        message: 'Upload dish photo for ' + dishId,
        content: base64,
        branch: branch
      }),
      headers: {
        Authorization: 'Bearer ' + token,
        Accept: 'application/vnd.github+json'
      }, muteHttpExceptions: true });
  if (res.getResponseCode() >= 300) {
    throw new Error('GitHub rejected the upload: ' + res.getResponseCode()
      + ' ' + res.getContentText().slice(0, 300));
  }
  return 'https://staff.lagotto-fitzroynorth.com.au/' + path;
}



/* ===========================================================================
 * diagnose() — run this from the editor when a submission doesn't arrive.
 *
 * Checks every link in the chain in order and stops at the first break, so the
 * answer is one line rather than a guess. Writes nothing.
 * =========================================================================== */
function diagnose() {
  var out = [];
  function say(ok, label, detail) {
    out.push((ok ? 'OK    ' : 'BROKEN') + '  ' + label + (detail ? '  -> ' + detail : ''));
    return ok;
  }

  // 1. properties
  var props = PropertiesService.getScriptProperties();
  var need = ['GITHUB_TOKEN', 'GIST_ID', 'SHARED_SECRET'];
  var missing = need.filter(function (k) { return !props.getProperty(k); });
  if (!say(missing.length === 0, 'script properties',
      missing.length ? 'missing: ' + missing.join(', ') : 'all present')) {
    return finish(out);
  }
  var upl = ['GITHUB_TOKEN', 'REPO'].filter(function (k) { return !props.getProperty(k); });
  if (!say(upl.length === 0, 'photo upload properties',
      upl.length ? 'not set (photo upload unavailable): ' + upl.join(', ')
                 : 'both set')) {
    var keys = Object.keys(props.getProperties());
    out.push('        Keys currently stored: '
      + (keys.length ? keys.map(function (k) { return JSON.stringify(k); }).join(', ')
                     : 'none'));
    out.push('        Names are case-sensitive and must match exactly.');
  } else {
    // Present but wrong is worse than absent - it fails at the moment someone
    // is trying to upload a photo. Check the token can actually see the repo.
    var probe = UrlFetchApp.fetch(
      'https://api.github.com/repos/' + props.getProperty('REPO'),
      { headers: { Authorization: 'Bearer ' + props.getProperty('GITHUB_TOKEN'),
                   Accept: 'application/vnd.github+json' }, muteHttpExceptions: true });
    var code = probe.getResponseCode();
    say(code === 200, 'github repo access',
        code === 200 ? 'token can see ' + props.getProperty('REPO')
                        + ' (this only confirms read -- a write can still fail '
                        + 'if Contents permission was not granted)'
        : code === 401 ? 'token rejected - wrong token, or missing scopes'
        : code === 404 ? 'repo not found - check REPO is exactly owner/name, '
                          + 'and the token has access to it'
        : 'GitHub said ' + code + ': ' + probe.getContentText().slice(0, 120));
  }

  // 2. trigger installed?
  var trigs = ScriptApp.getProjectTriggers().filter(function (tr) {
    return tr.getHandlerFunction() === 'onFormSubmit';
  });
  var kinds = trigs.map(function (tr) { return String(tr.getEventType()); }).join(', ');
  if (!say(trigs.length > 0, 'onFormSubmit trigger',
      trigs.length ? trigs.length + ' installed (' + kinds + ')'
                   : 'none - Triggers > Add trigger > onFormSubmit, From spreadsheet, On form submit')) {
    return finish(out);
  }
  var onSubmit = trigs.some(function (tr) {
    return String(tr.getEventType()) === 'ON_FORM_SUBMIT';
  });
  say(onSubmit, 'trigger event type',
      onSubmit ? 'on form submit' : 'wrong type - delete it and recreate as On form submit');

  // 3. sheet and columns
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  say(true, 'sheet', '"' + sheet.getName() + '", ' + (sheet.getLastRow() - 1)
      + ' response(s), ' + headers.length + ' columns');

  var titleCol = findColumn(headers, 'dish');
  if (titleCol < 0) titleCol = findColumn(headers, 'title');
  if (!say(titleCol >= 0, 'dish title column',
      titleCol >= 0 ? 'col ' + (titleCol + 1) + ' "' + String(headers[titleCol]).trim() + '"'
                    : 'NOT FOUND - a submission with no title is skipped silently')) {
    return finish(out);
  }
  var gridCount = 0;
  for (var i = 0; i < headers.length; i++) if (matchCategory(headers[i])) gridCount++;
  say(gridCount >= 14, 'dietary grid columns', gridCount + ' of 14 matched');

  // 4. gist reachable and writable
  var data;
  try {
    data = readGist();
    say(true, 'gist read', data.dishes.length + ' dishes');
  } catch (err) {
    say(false, 'gist read', String(err));
    return finish(out);
  }
  try {
    writeGist(data);  // same content back; proves the token can write
    say(true, 'gist write', 'token has write access');
  } catch (err) {
    say(false, 'gist write', String(err));
    return finish(out);
  }

  // 5. what the newest row would actually do
  if (sheet.getLastRow() > 1) {
    var row = sheet.getRange(sheet.getLastRow(), 1, 1, sheet.getLastColumn()).getValues()[0];
    var copy = JSON.parse(JSON.stringify(data));
    var before = copy.dishes.length;
    var summary;
    try {
      summary = mergeSubmission(copy, headers, row);
    } catch (err) {
      say(false, 'parsing the newest row', String(err));
      return finish(out);
    }
    say(!!summary, 'newest row (' + String(row[titleCol]).trim() + ')',
        summary ? summary.split('\n')[0] : 'produced nothing - check the title column is filled');
    say(true, 'result', 'dishes would go ' + before + ' -> ' + copy.dishes.length);
  }

  // 6. can it email?
  try {
    var addr = Session.getEffectiveUser().getEmail();
    say(!!addr, 'email address', addr || 'empty - notifications will fail');
    say(true, 'email quota left today', String(MailApp.getRemainingDailyQuota()));
  } catch (err) {
    say(false, 'email', String(err));
  }

  return finish(out);
}

function finish(lines) {
  // Log only. An earlier version also popped a SpreadsheetApp UI alert, which
  // hangs when run from the script editor: the dialog goes to a spreadsheet tab
  // that isn't in front, and the execution sits waiting for a click that never
  // comes. The log is where you're already looking.
  var text = lines.join('\n');
  Logger.log(text);
  return text;
}


/** Trigger: a chef submits the form. */
function onFormSubmit(e) {
  var sheet = e && e.range ? e.range.getSheet()
    : SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var row;
  if (e && e.range) {
    row = e.range.getValues()[0];
  } else {
    // No event object. Either a manual run, or - the trap - a trigger wired to
    // the wrong event type. An ON_OPEN trigger lands here and quietly
    // republishes the last row every time the sheet is opened, which looks
    // exactly like the form working. Say so plainly.
    row = sheet.getRange(sheet.getLastRow(), 1, 1, sheet.getLastColumn()).getValues()[0];
    Logger.log('Running without a form-submit event - processing the LAST ROW '
      + 'only. If this came from a trigger, that trigger is the wrong type: it '
      + 'should be "On form submit" from the spreadsheet. Run diagnose() to check.');
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var data = readGist();
    var summary = mergeSubmission(data, headers, row);
    if (!summary) {
      // "Completed" with no email looks identical to success from the outside.
      Logger.log('No dish title found in the submitted row - nothing written. '
        + 'Row was: ' + JSON.stringify(row));
      MailApp.sendEmail({
        to: Session.getEffectiveUser().getEmail(),
        subject: 'Lagotto — form submission skipped',
        body: 'A submission arrived with no dish title, so nothing was published.\n'
          + 'Check the Sheet for a row with an empty title column.'
      });
      return;
    }
    writeGist(data);
    MailApp.sendEmail({
      to: Session.getEffectiveUser().getEmail(),
      subject: 'Lagotto — dish submitted',
      body: summary + '\n\nDish Library: '
        + 'https://lagotto-fitzroynorth.com.au/lagotto-boh\n'
    });
  } catch (err) {
    MailApp.sendEmail({
      to: Session.getEffectiveUser().getEmail(),
      subject: 'Lagotto — form submission FAILED to publish',
      body: 'The submission is safe in the Sheet but did not reach the Gist.\n\n'
        + err + '\n\nRe-run manually with republishAll() once fixed.'
    });
    throw err;
  } finally {
    lock.releaseLock();
  }
}

/**
 * Open the web app URL in a browser tab to check it is alive.
 *
 * A browser POST that fails with "Failed to fetch" tells you nothing about
 * why - an Apps Script error page has no CORS headers, so the browser blocks
 * it and the real message never arrives. Loading this in a tab is a plain
 * request with no CORS involved, so whatever comes back is the truth.
 *
 * JSON here  -> the deployment is healthy; the problem is browser-side.
 * Error page -> the script or the deployment is the problem, and it will say so.
 */
function doGet() {
  var p = PropertiesService.getScriptProperties();
  var status = {
    ok: true,
    version: SCRIPT_VERSION,
    time: new Date().toISOString(),
    hasGithubToken: !!p.getProperty('GITHUB_TOKEN'),
    hasGistId: !!p.getProperty('GIST_ID'),
    hasSecret: !!p.getProperty('SHARED_SECRET'),
    canUpload: !!(p.getProperty('GITHUB_TOKEN') && p.getProperty('REPO'))
  };
  try {
    status.dishesInGist = readGist().dishes.length;
  } catch (err) {
    status.ok = false;
    status.gistError = String(err);
  }
  return ContentService
    .createTextOutput(JSON.stringify(status, null, 2))
    .setMimeType(ContentService.MimeType.JSON);
}


/** Endpoint: the Dish Library page publishes on/off changes. */
function doPost(e) {
  var out = function (ok, msg) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: ok, message: msg, version: SCRIPT_VERSION }))
      .setMimeType(ContentService.MimeType.JSON);
  };
  try {
    var body = JSON.parse(e.postData.contents);
    if (body.secret !== PropertiesService.getScriptProperties().getProperty('SHARED_SECRET')) {
      return out(false, 'bad secret');
    }

    if (body.action === 'ping') {
      var p = PropertiesService.getScriptProperties();
      return ContentService
        .createTextOutput(JSON.stringify({
          ok: true, version: SCRIPT_VERSION,
          canUpload: !!(p.getProperty('GITHUB_TOKEN') && p.getProperty('REPO'))
        }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    if (body.action === 'upload') {
      if (!body.image) return out(false, 'no image data');
      var url = uploadToGithub(body.image, body.mime, body.dishId);
      return ContentService
        .createTextOutput(JSON.stringify({ ok: true, url: url }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    if (!body.data || !Array.isArray(body.data.dishes) || !body.data.dishes.length) {
      return out(false, 'payload has no dishes — refusing to overwrite');
    }
    var live = readGist();

    // Guard against a stale tab clobbering dishes that arrived after it loaded,
    // WITHOUT blocking deliberate deletions. Counting dishes can't tell those
    // apart - deleting two while the kitchen submits one nets out to a smaller
    // payload either way. So the page sends the ids it loaded with, and the
    // only thing rejected is a dish that is live, absent from the payload, and
    // was never on the page's radar.
    var known = Array.isArray(body.knownIds) ? body.knownIds : null;
    if (known) {
      var inPayload = {}, wasKnown = {};
      body.data.dishes.forEach(function (d) { inPayload[d.id] = true; });
      known.forEach(function (id) { wasKnown[id] = true; });
      var unseen = live.dishes.filter(function (d) {
        return !inPayload[d.id] && !wasKnown[d.id];
      });
      if (unseen.length) {
        return out(false, unseen.length + ' dish(es) were added since this page '
          + 'loaded and would be lost: '
          + unseen.map(function (d) { return d.name; }).join(', ')
          + '. Reload the Dish Library and redo your changes.');
      }
    } else if (body.data.dishes.length < live.dishes.length) {
      // Older page with no knownIds - fall back to the blunt check.
      return out(false, 'this page is out of date; reload the Dish Library');
    }
    var lock = LockService.getScriptLock();
    lock.waitLock(30000);
    try {
      writeGist(body.data);
    } finally {
      lock.releaseLock();
    }
    return out(true, 'published');
  } catch (err) {
    return out(false, String(err));
  }
}


/** Manual repair: rebuild the Gist from every row in the Sheet. */
function republishAll() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  var values = sheet.getDataRange().getValues();
  var headers = values[0];
  var data = readGist();
  var n = 0;
  for (var i = 1; i < values.length; i++) {
    if (mergeSubmission(data, headers, values[i])) n++;
  }
  writeGist(data);
  Logger.log('replayed ' + n + ' submission(s)');
}

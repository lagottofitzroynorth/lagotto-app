/**
 * Lagotto - wine data publisher.
 *
 * Deploy this as its own web app, separate from the dish-library publisher. Two
 * scripts writing two different Gists is safer than one script branching on a
 * flag: a bug in the branch would write wine data over the food menu.
 *
 * SETUP
 * 1. script.google.com > New project > paste this in.
 * 2. Project Settings > Script properties, add:
 *      SHARED_SECRET   any long random string
 *      GITHUB_TOKEN    a GitHub token with the "gist" scope AND Contents:
 *                      read and write on lagottofitzroynorth/lagotto-app
 *                      (needed for photo uploads - see the GitHub photo
 *                      upload section below). One token, two permissions.
 *      GIST_ID         50df275f829876f48a4e4016ec27ec87
 *      FILE_NAME       wine_quiz_data.json
 *      REPO            lagottofitzroynorth/lagotto-app
 *      BRANCH          main (optional - defaults to main if unset)
 * 3. Deploy > New deployment > Web app.
 *      Execute as: Me.  Who has access: Anyone.
 *    This version no longer touches Google Drive, so unlike earlier versions
 *    it does not need the Drive re-authorisation / "this app isn't verified"
 *    consent screen.
 * 4. window.LAGOTTO_WINE_PUBLISH_URL / LAGOTTO_WINE_PUBLISH_SECRET are set
 *    directly in wine-cellar.html's own <head> - update them there if this
 *    deployment's /exec URL or the shared secret ever change.
 *
 * Editing this script does NOT update the live web app. After any change:
 * Deploy > Manage deployments > edit > Version: New version > Deploy.
 *
 * IMAGE HOSTING NOTE
 * Uploaded photos used to be stored in a Google Drive folder ("Lagotto Wine
 * Bottle Shots") and served via Drive's /thumbnail endpoint - reliable
 * enough for a BOH tool, but Drive is not a dedicated image CDN (the food
 * publisher's equivalent Drive path has broken before, e.g. when Drive
 * dropped third-party cookies and /uc?export=view started 403ing). Photos
 * now commit straight into assets/img/wine/ in the lagotto-app GitHub repo
 * instead, served from staff.lagotto-fitzroynorth.com.au - the same
 * approach cocktail-publisher.gs and menu-publisher.gs already use.
 */

var VERSION = 3;

function prop(name) {
  return PropertiesService.getScriptProperties().getProperty(name);
}

function reply(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function slugify(s) {
  return String(s || 'wine')
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() || 'wine';
}

/* ===========================================================================
 * GitHub photo upload.
 *
 * See the IMAGE HOSTING NOTE above for why this replaced the Drive-based
 * uploadImage(). GITHUB_TOKEN is the same token used to write the Gist below
 * - it just needs Contents: read and write added on lagotto-app, alongside
 * its existing "gist" scope.
 * =========================================================================== */
function uploadToGithub(base64, mime, nameHint) {
  if (!base64) {
    return {ok: false, message: 'no image data received'};
  }
  var token = prop('GITHUB_TOKEN');
  var repo = prop('REPO');
  var branch = prop('BRANCH') || 'main';
  if (!token || !repo) {
    var missing = [];
    if (!token) missing.push('GITHUB_TOKEN');
    if (!repo) missing.push('REPO');
    return {ok: false, message: missing.join(' and ') + ' not set.'};
  }

  var contentType = mime || 'image/jpeg';
  var ext = contentType.indexOf('png') > -1 ? 'png' : 'jpg';
  var filename = slugify(nameHint) + '-' + Date.now() + '.' + ext;
  var path = 'assets/img/wine/' + filename;

  var res = UrlFetchApp.fetch(
    'https://api.github.com/repos/' + repo + '/contents/' + path,
    { method: 'put',
      contentType: 'application/json',
      payload: JSON.stringify({
        message: 'Upload wine photo for ' + nameHint,
        content: base64,
        branch: branch
      }),
      headers: {
        Authorization: 'Bearer ' + token,
        Accept: 'application/vnd.github+json'
      }, muteHttpExceptions: true });

  if (res.getResponseCode() >= 300) {
    return {ok: false, message: 'GitHub rejected the upload: ' + res.getResponseCode()
      + ' ' + res.getContentText().slice(0, 300)};
  }
  return {ok: true, url: 'https://staff.lagotto-fitzroynorth.com.au/' + path};
}

function doPost(e) {
  var body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return reply({ok: false, message: 'the request was not JSON'});
  }

  if (!prop('SHARED_SECRET') || body.secret !== prop('SHARED_SECRET')) {
    return reply({ok: false, message: 'wrong or missing secret'});
  }

  if (body.action === 'ping') {
    return reply({ok: true, version: VERSION, canUpload: !!(prop('GITHUB_TOKEN') && prop('REPO'))});
  }

  if (body.action === 'upload') {
    return reply(uploadToGithub(body.image, body.mime, body.dishId));
  }

  var data = body.data;
  if (!data || !data.wines || !data.wines.length || !data.sections || !data.sections.length) {
    return reply({ok: false, message: 'that payload is not wine data'});
  }

  // Delete guard. A publish that drops a big slice of the list is far more
  // likely to be a half-loaded page or a bad merge than a real decision, and
  // the Gist has no undo worth relying on mid-service.
  var known = body.knownNames || [];
  if (known.length) {
    var present = {};
    data.wines.forEach(function (w) { present[w.name] = true; });
    var missing = known.filter(function (n) { return !present[n]; });
    if (missing.length > 10) {
      return reply({
        ok: false,
        message: missing.length + ' wines would disappear in one publish. '
          + 'Refusing in case the page loaded badly - reload and try again.'
      });
    }
  }

  var gistId = prop('GIST_ID');
  var fileName = prop('FILE_NAME') || 'wine_quiz_data.json';
  var files = {};
  files[fileName] = {content: JSON.stringify(data, null, 2)};

  var res = UrlFetchApp.fetch('https://api.github.com/gists/' + gistId, {
    method: 'patch',
    contentType: 'application/json',
    headers: {
      'Authorization': 'Bearer ' + prop('GITHUB_TOKEN'),
      'Accept': 'application/vnd.github+json',
      'User-Agent': 'lagotto-wine-publisher'
    },
    payload: JSON.stringify({files: files}),
    muteHttpExceptions: true
  });

  var code = res.getResponseCode();
  if (code < 200 || code >= 300) {
    return reply({
      ok: false,
      message: 'GitHub said ' + code + ' - '
        + String(res.getContentText()).slice(0, 160)
    });
  }

  return reply({ok: true, version: VERSION});
}

function doGet() {
  return reply({ok: true, version: VERSION, note: 'post to this endpoint'});
}

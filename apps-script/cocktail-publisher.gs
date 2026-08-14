/**
 * Lagotto Cocktail Library publisher.
 *
 * Unlike the wine/food publishers (which write to a Gist because the old
 * Webflow pages still read from there, and upload photos to Webflow's
 * asset API), this one writes straight to cocktails.json in the
 * lagotto-app GitHub repo and commits uploaded photos into
 * assets/img/cocktails/ -- there's no legacy Webflow page reading
 * cocktail data, so there's no reason to go through a Gist.
 *
 * Deploy as a Web App (Execute as: Me, Who has access: Anyone), then set
 * these Script Properties (Project Settings -> Script Properties):
 *
 *   SECRET        a shared secret -- must match window.LAGOTTO_COCKTAIL_PUBLISH_SECRET
 *                 in cocktail-library.html
 *   GITHUB_TOKEN  a fine-grained GitHub PAT scoped to ONLY the lagotto-app
 *                 repo, with Contents: Read and write permission
 *   REPO          lagottofitzroynorth/lagotto-app
 *   BRANCH        main
 */

function doPost(e) {
  const props = PropertiesService.getScriptProperties();
  const SECRET = props.getProperty('SECRET');
  const GITHUB_TOKEN = props.getProperty('GITHUB_TOKEN');
  const REPO = props.getProperty('REPO');
  const BRANCH = props.getProperty('BRANCH') || 'main';

  let body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return jsonResponse({ ok: false, message: 'Invalid JSON body' });
  }

  if (!SECRET || body.secret !== SECRET) {
    return jsonResponse({ ok: false, message: 'Invalid secret' });
  }
  if (!GITHUB_TOKEN || !REPO) {
    return jsonResponse({ ok: false, message: 'Script not configured -- missing GITHUB_TOKEN or REPO property' });
  }

  if (body.action === 'ping') {
    return jsonResponse({ ok: true, version: 1, canUpload: true });
  }
  if (body.action === 'upload') {
    return handleUpload(body, GITHUB_TOKEN, REPO, BRANCH);
  }
  return handlePublish(body, GITHUB_TOKEN, REPO, BRANCH);
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function githubGetFile(path, token, repo, branch) {
  const url = 'https://api.github.com/repos/' + repo + '/contents/' + path + '?ref=' + branch;
  const res = UrlFetchApp.fetch(url, {
    headers: { Authorization: 'token ' + token, 'User-Agent': 'lagotto-cocktail-publisher' },
    muteHttpExceptions: true
  });
  if (res.getResponseCode() === 200) return JSON.parse(res.getContentText());
  return null;
}

function githubPutFile(path, base64Content, message, token, repo, branch, sha) {
  const url = 'https://api.github.com/repos/' + repo + '/contents/' + path;
  const payload = { message: message, content: base64Content, branch: branch };
  if (sha) payload.sha = sha;
  const res = UrlFetchApp.fetch(url, {
    method: 'put',
    contentType: 'application/json',
    headers: { Authorization: 'token ' + token, 'User-Agent': 'lagotto-cocktail-publisher' },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });
  return { code: res.getResponseCode(), body: res.getContentText() };
}

function handlePublish(body, token, repo, branch) {
  if (!body.data) return jsonResponse({ ok: false, message: 'Missing data' });
  const existing = githubGetFile('cocktails.json', token, repo, branch);
  const sha = existing ? existing.sha : null;
  const content = JSON.stringify(body.data, null, 2);
  const base64Content = Utilities.base64Encode(content, Utilities.Charset.UTF_8);
  const result = githubPutFile('cocktails.json', base64Content, 'Publish cocktail changes from Cocktail Library', token, repo, branch, sha);
  if (result.code === 200 || result.code === 201) return jsonResponse({ ok: true });
  return jsonResponse({ ok: false, message: 'GitHub write failed: ' + result.code + ' ' + result.body.slice(0, 200) });
}

function handleUpload(body, token, repo, branch) {
  if (!body.image || !body.cocktailId) return jsonResponse({ ok: false, message: 'Missing image or cocktailId' });
  const ext = body.mime === 'image/png' ? 'png' : 'jpg';
  const safeId = String(body.cocktailId).replace(/[^a-z0-9-]/gi, '');
  const filename = 'assets/img/cocktails/' + safeId + '-' + Date.now() + '.' + ext;
  const result = githubPutFile(filename, body.image, 'Upload cocktail photo for ' + safeId, token, repo, branch, null);
  if (result.code === 200 || result.code === 201) {
    return jsonResponse({ ok: true, url: 'https://staff.lagotto-fitzroynorth.com.au/' + filename });
  }
  return jsonResponse({ ok: false, message: 'Upload failed: ' + result.code + ' ' + result.body.slice(0, 200) });
}

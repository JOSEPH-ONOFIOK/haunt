/**
 * HAUNT — Google Apps Script web app.
 *
 * The database behind GOOGLE_SHEETS_WEBAPP_URL, built the same way as the militia
 * site's sheet. Each tab holds one kind of record: readable columns for people,
 * plus a "Data" column with the full record the site reads back.
 *
 * Contract with src/lib/store.ts (the "sheets" store):
 *
 *   GET  ?version                -> { version, secured }
 *   GET  ?account=xid            -> { account | null }
 *   GET  ?scores=1               -> { scores: [...] }
 *   GET  ?score=runId            -> { score | null }
 *   GET  ?run=runId              -> { hints, wrong }
 *   GET  ?bans=1                 -> { bans: [xid, ...] }
 *   GET  ?apps=1                 -> { apps: [...] }
 *   GET  ?app=xid                -> { app | null }
 *   GET  ?meta=airdrop|rewards   -> { meta | null }
 *   GET  ?claims_airdrop=1       -> { claims: [...] }      (and ?claims_rewards=1)
 *
 *   POST {action:"putAccount", account}
 *   POST {action:"ban", xid}
 *   POST {action:"postScore", score, display}  -> { ok } | { error:"duplicate" }
 *   POST {action:"hideScore", id}
 *   POST {action:"markRun", id, field}         -> { hints, wrong }
 *   POST {action:"saveApp", app}               -> { ok } | { error:"wallet_taken" }
 *   POST {action:"decide", xids, status, cap, now} -> { changed, capped }
 *   POST {action:"putSnapshot", list, meta, claims}
 *
 *   Every call except ?version must carry `secret` once SHARED_SECRET is set in
 *   Script Properties. Writes run one at a time under the script lock.
 *
 * Setup is in README.md next to this file.
 */

/** Bumped whenever this file changes, so `?version` shows which copy is deployed. */
var SCRIPT_VERSION = 2;

/**
 * Tabs and their columns. Rows are read and written by header name, so columns
 * can be reordered, and new ones are added to existing sheets on the next write.
 */
var TABS = {
  Scores: ['Run ID', 'Room', 'Nickname', 'Handle', 'Time', 'Ms', 'Hints', 'Round', 'Day', 'Posted At', 'Wallet', 'Verified', 'Hidden', 'X User ID', 'Data'],
  Accounts: ['X User ID', 'Handle', 'Verified', 'Eligible', 'Followers', 'X Account Created', 'Reward Wallet', 'First Seen', 'Data'],
  Applications: ['X User ID', 'Handle', 'Wallet', 'Status', 'Applied At', 'Decided At', 'Verified', 'Eligible', 'Followers', 'X Account Created', 'Data',
    // Added in version 2: the permit card and the five tasks
    'Permit ID', 'Tasks Done'],
  Bans: ['X User ID', 'Banned At'],
  Runs: ['Run ID', 'Hints', 'Wrong Codes', 'Updated At'],
  Claims: ['List', 'Index', 'Account', 'Amount', 'X User ID', 'Proof'],
  Meta: ['Key', 'Value'],
};

/**
 * Shared secret, read from Script Properties so it never sits in this file
 * (the repo is public). Set the same value as SHEETS_WEBHOOK_SECRET on the site.
 */
var SHARED_SECRET = PropertiesService.getScriptProperties().getProperty('SHARED_SECRET') || '';

// --- entry points -----------------------------------------------------

function doGet(e) {
  try {
    var p = (e && e.parameter) || {};
    if (p.version !== undefined) return json({ version: SCRIPT_VERSION, secured: !!SHARED_SECRET });
    // Reads expose wallets, so they need the secret too once one is set.
    if (SHARED_SECRET && p.secret !== SHARED_SECRET) return json({ error: 'unauthorised' });

    if (p.account) return json({ account: dataOf(find('Accounts', 'X User ID', p.account)) });
    if (p.scores !== undefined) return json({ scores: all('Scores').map(scoreOf).filter(Boolean) });
    if (p.score) return json({ score: scoreOf(find('Scores', 'Run ID', p.score)) });
    if (p.run) {
      var r = find('Runs', 'Run ID', p.run);
      return json({ hints: r ? Number(r['Hints']) || 0 : 0, wrong: r ? Number(r['Wrong Codes']) || 0 : 0 });
    }
    if (p.bans !== undefined) return json({ bans: all('Bans').map(function (r) { return String(r['X User ID']); }) });
    if (p.apps !== undefined) return json({ apps: all('Applications').map(dataOf).filter(Boolean) });
    if (p.app) return json({ app: dataOf(find('Applications', 'X User ID', p.app)) });
    if (p.meta) {
      var m = find('Meta', 'Key', p.meta);
      return json({ meta: m && m['Value'] ? JSON.parse(m['Value']) : null });
    }
    if (p.claims_airdrop !== undefined) return json({ claims: claimsOf('airdrop') });
    if (p.claims_rewards !== undefined) return json({ claims: claimsOf('rewards') });
    return json({ ok: true });
  } catch (err) {
    return json({ error: String(err) });
  }
}

function doPost(e) {
  // One writer at a time, so two saves can't read the same row and both write it.
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
  } catch (err) {
    return json({ error: 'busy' });
  }
  try {
    var b = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (SHARED_SECRET && b.secret !== SHARED_SECRET) return json({ error: 'unauthorised' });
    var actions = { putAccount: putAccount, ban: ban, postScore: postScore, hideScore: hideScore, markRun: markRun, saveApp: saveApp, decide: decide, putSnapshot: putSnapshot };
    if (!actions[b.action]) return json({ error: 'unknown action' });
    return json(actions[b.action](b));
  } catch (err) {
    return json({ error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

// --- writes -------------------------------------------------------------

function putAccount(b) {
  var a = b.account;
  if (!a || !a.xid) return { error: 'missing account' };
  upsert('Accounts', 'X User ID', a.xid, {
    'X User ID': a.xid,
    'Handle': '@' + a.handle,
    'Verified': !!a.verified,
    'Eligible': !!a.eligible,
    'Followers': a.followers == null ? '' : a.followers,
    'X Account Created': a.xCreatedAt || '',
    'Reward Wallet': a.wallet || '',
    'First Seen': iso(a.firstSeen),
    'Data': JSON.stringify(a),
  });
  return { ok: true };
}

function ban(b) {
  if (!b.xid) return { error: 'missing xid' };
  if (!find('Bans', 'X User ID', b.xid)) append('Bans', { 'X User ID': b.xid, 'Banned At': iso(Date.now()) });
  return { ok: true };
}

function postScore(b) {
  var s = b.score;
  var d = b.display || {};
  if (!s || !s.id) return { error: 'missing score' };
  if (find('Scores', 'Run ID', s.id)) return { error: 'duplicate' };
  append('Scores', scoreRow(s, d));
  return { ok: true };
}

function hideScore(b) {
  var t = table('Scores');
  var i = indexOf(t, 'Run ID', b.id);
  if (i < 0) return { error: 'unknown score' };
  var row = t.rows[i];
  var s = JSON.parse(row['Data']);
  s.hidden = true;
  row['Hidden'] = true;
  row['Data'] = JSON.stringify(s);
  writeRow(t, i, row);
  return { ok: true };
}

function markRun(b) {
  if (b.field !== 'hints' && b.field !== 'wrong') return { error: 'bad field' };
  var t = table('Runs');
  var i = indexOf(t, 'Run ID', b.id);
  var row = i >= 0 ? t.rows[i] : { 'Run ID': b.id, 'Hints': 0, 'Wrong Codes': 0 };
  var col = b.field === 'hints' ? 'Hints' : 'Wrong Codes';
  row[col] = (Number(row[col]) || 0) + 1;
  row['Updated At'] = iso(Date.now());
  if (i >= 0) writeRow(t, i, row);
  else append('Runs', row);
  return { hints: Number(row['Hints']) || 0, wrong: Number(row['Wrong Codes']) || 0 };
}

function saveApp(b) {
  var a = b.app;
  if (!a || !a.xid || !a.wallet) return { error: 'missing application' };
  var t = table('Applications');
  var wallet = String(a.wallet).toLowerCase();
  for (var i = 0; i < t.rows.length; i++) {
    if (String(t.rows[i]['Wallet']).toLowerCase() === wallet && String(t.rows[i]['X User ID']) !== String(a.xid)) return { error: 'wallet_taken' };
  }
  upsert('Applications', 'X User ID', a.xid, appRow(a));
  return { ok: true };
}

/** Moves applications to a status. Approvals stop at the cap, checked here inside the lock. */
function decide(b) {
  var t = table('Applications');
  var approved = 0;
  for (var i = 0; i < t.rows.length; i++) {
    var d = parse(t.rows[i]['Data']);
    if (d && d.status === 'approved') approved++;
  }
  var changed = 0;
  var capped = 0;
  var wanted = {};
  (b.xids || []).forEach(function (x) { wanted[String(x)] = true; });
  for (var j = 0; j < t.rows.length; j++) {
    var row = t.rows[j];
    if (!wanted[String(row['X User ID'])]) continue;
    var a = parse(row['Data']);
    if (!a || a.status === b.status) continue;
    if (b.status === 'approved' && approved >= Number(b.cap)) { capped++; continue; }
    if (a.status === 'approved') approved--;
    if (b.status === 'approved') approved++;
    a.status = b.status;
    a.decidedAt = Number(b.now) || Date.now();
    t.rows[j] = appRow(a);
    changed++;
  }
  if (changed) writeAll(t);
  return { changed: changed, capped: capped };
}

/** Replaces one frozen claim list (airdrop or rewards). A null meta unfreezes it. */
function putSnapshot(b) {
  if (b.list !== 'airdrop' && b.list !== 'rewards') return { error: 'bad list' };
  var t = table('Claims');
  t.rows = t.rows.filter(function (r) { return r['List'] !== b.list; });
  (b.claims || []).forEach(function (c) {
    t.rows.push({ 'List': b.list, 'Index': c.index, 'Account': c.account, 'Amount': String(c.amount), 'X User ID': c.xid || '', 'Proof': JSON.stringify(c.proof) });
  });
  writeAll(t);
  var m = table('Meta');
  var i = indexOf(m, 'Key', b.list);
  if (b.meta) {
    var row = { 'Key': b.list, 'Value': JSON.stringify(b.meta) };
    if (i >= 0) writeRow(m, i, row);
    else append('Meta', row);
  } else if (i >= 0) {
    m.rows.splice(i, 1);
    writeAll(m);
  }
  return { ok: true };
}

// --- records <-> rows ---------------------------------------------------

function scoreRow(s, d) {
  return {
    'Run ID': s.id,
    'Room': s.room,
    'Nickname': s.name,
    'Handle': '@' + s.handle,
    'Time': d.time || '',
    'Ms': s.ms,
    'Hints': s.hints,
    'Round': d.round || '',
    'Day': s.day,
    'Posted At': iso(s.at),
    'Wallet': s.wallet,
    'Verified': !!s.verified,
    'Hidden': !!s.hidden,
    'X User ID': s.xid,
    'Data': JSON.stringify(s),
  };
}

/** A score as the site sees it. Typing TRUE in the Hidden column hides it too. */
function scoreOf(row) {
  var s = dataOf(row);
  if (s && (row['Hidden'] === true || String(row['Hidden']).toUpperCase() === 'TRUE')) s.hidden = true;
  return s;
}

function appRow(a) {
  return {
    'X User ID': a.xid,
    'Handle': '@' + a.handle,
    'Wallet': a.wallet,
    'Status': a.status,
    'Applied At': iso(a.appliedAt),
    'Decided At': a.decidedAt ? iso(a.decidedAt) : '',
    'Verified': !!a.verified,
    'Eligible': !!a.eligible,
    'Followers': a.followers == null ? '' : a.followers,
    'X Account Created': a.xCreatedAt || '',
    'Data': JSON.stringify(a),
    'Permit ID': a.permit || '',
    'Tasks Done': a.tasks ? Object.keys(a.tasks).length + ' / 5' : '',
  };
}

function claimsOf(list) {
  return all('Claims')
    .filter(function (r) { return r['List'] === list; })
    .map(function (r) {
      var c = { index: Number(r['Index']), account: String(r['Account']), amount: String(r['Amount']), proof: JSON.parse(r['Proof']) };
      if (r['X User ID']) c.xid = String(r['X User ID']);
      return c;
    });
}

// --- sheet helpers --------------------------------------------------------

function sheetFor(name) {
  var ss = SpreadsheetApp.getActive();
  var sheet = ss.getSheetByName(name);
  var want = TABS[name];
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.getRange(1, 1, 1, want.length).setValues([want]);
    sheet.setFrozenRows(1);
    return sheet;
  }
  // Add any columns a newer script version introduced, at the end, so nothing else moves.
  var have = sheet.getLastColumn() ? sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0] : [];
  var missing = want.filter(function (h) { return have.indexOf(h) < 0; });
  if (missing.length) sheet.getRange(1, have.length + 1, 1, missing.length).setValues([missing]);
  return sheet;
}

/** The whole tab as objects keyed by header. */
function table(name) {
  var sheet = sheetFor(name);
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  var values = lastRow ? sheet.getRange(1, 1, lastRow, lastCol).getValues() : [TABS[name]];
  var head = values[0];
  var rows = values.slice(1).map(function (v) {
    var o = {};
    head.forEach(function (h, i) { o[h] = v[i]; });
    return o;
  });
  return { name: name, sheet: sheet, head: head, rows: rows };
}

function all(name) {
  return table(name).rows;
}

function indexOf(t, col, value) {
  for (var i = 0; i < t.rows.length; i++) if (String(t.rows[i][col]) === String(value)) return i;
  return -1;
}

function find(name, col, value) {
  var t = table(name);
  var i = indexOf(t, col, value);
  return i >= 0 ? t.rows[i] : null;
}

/**
 * A row ready for setValues. Text goes in with a leading apostrophe, which Sheets keeps as plain text
 * and doesn't show. Without it Sheets "helpfully" converts: a 19 digit X user id or a token amount
 * loses precision, and a day like 2026-10-30 turns into a date.
 */
function toArray(head, o) {
  return head.map(function (h) {
    var v = o[h];
    if (v === undefined || v === null) return '';
    return typeof v === 'string' && v !== '' ? "'" + v : v;
  });
}

function writeRow(t, i, o) {
  t.sheet.getRange(i + 2, 1, 1, t.head.length).setValues([toArray(t.head, o)]);
}

function append(name, o) {
  var t = table(name);
  t.sheet.getRange(t.rows.length + 2, 1, 1, t.head.length).setValues([toArray(t.head, o)]);
}

function upsert(name, col, value, o) {
  var t = table(name);
  var i = indexOf(t, col, value);
  if (i >= 0) writeRow(t, i, o);
  else t.sheet.getRange(t.rows.length + 2, 1, 1, t.head.length).setValues([toArray(t.head, o)]);
}

/** Rewrites every data row of a tab, clearing any rows left over below. */
function writeAll(t) {
  var old = t.sheet.getLastRow() - 1;
  if (t.rows.length) t.sheet.getRange(2, 1, t.rows.length, t.head.length).setValues(t.rows.map(function (o) { return toArray(t.head, o); }));
  if (old > t.rows.length) t.sheet.getRange(t.rows.length + 2, 1, old - t.rows.length, t.head.length).clearContent();
}

function dataOf(row) {
  return row ? parse(row['Data']) : null;
}

function parse(s) {
  try {
    return s ? JSON.parse(s) : null;
  } catch (err) {
    return null;
  }
}

function iso(t) {
  return t ? new Date(Number(t)).toISOString() : '';
}

function json(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

// --- setup check ---------------------------------------------------------

/** Run from the editor after pasting: writes and reads a test record on every tab. */
function selfTest() {
  var acct = { xid: 'selftest', handle: 'selftest', verified: true, eligible: true, firstSeen: Date.now() };
  putAccount({ account: acct });
  var back = dataOf(find('Accounts', 'X User ID', 'selftest'));
  var run = markRun({ id: 'selftest', field: 'hints' });
  var dup = postScore({ score: { id: 'selftest', room: 'study', xid: 'selftest', handle: 'selftest', name: 'selftest', wallet: '', ms: 1, hints: 0, at: Date.now(), day: '' } });
  var dup2 = postScore({ score: { id: 'selftest' } });
  var ok = back && back.handle === 'selftest' && run.hints >= 1 && dup.ok && dup2.error === 'duplicate';
  Logger.log('shared secret : ' + (SHARED_SECRET ? 'on' : 'OFF (set SHARED_SECRET in Script Properties)'));
  Logger.log(ok ? 'PASS. Delete the "selftest" rows on the Accounts, Runs and Scores tabs before going live.' : 'FAIL. Check the tabs and try again.');
}

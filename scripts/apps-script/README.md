# HAUNT database sheet: deploy guide

`Code.gs` is a Google Apps Script web app that stores HAUNT's data in a Google
Sheet, the same way the militia site does. Set it up once, paste its URL into
the site's environment, and the site saves everything to the sheet.

## 1. Make the spreadsheet

1. Go to <https://sheets.new> and name it something like `HAUNT Database`.
2. Leave it empty. The script creates its tabs on the first save.

Keep this spreadsheet private. It holds wallet addresses. Share it only with
the people who review winners and applications.

## 2. Add the script

1. In the spreadsheet: **Extensions → Apps Script**.
2. Delete the placeholder `myFunction` code.
3. Paste the whole contents of [Code.gs](Code.gs).
4. Save (⌘S / Ctrl+S).

## 3. Set the shared secret

The sheet holds wallets and the script can read them back, so lock it with a
secret as well as the URL. The secret lives in Script Properties, never in
`Code.gs`, because the repo is public.

1. Generate one: `openssl rand -base64 32`.
2. In the Apps Script editor: **Project Settings** (gear icon) → **Script
   Properties** → **Add script property**. Property `SHARED_SECRET`, value the
   string from step 1. **Save script properties**.
3. In Vercel, add `SHEETS_WEBHOOK_SECRET` with the **same** value.

## 4. Check it works

Pick `selfTest` in the function dropdown, press **Run**, allow the permissions
Google asks for, then open **Execution log**. It should end with:

```
shared secret : on
PASS. Delete the "selftest" rows on the Accounts, Runs and Scores tabs before going live.
```

Delete those `selftest` rows.

## 5. Deploy it

1. **Deploy → New deployment**.
2. Click the gear next to "Select type" and choose **Web app**.
3. Set **Execute as: Me** and **Who has access: Anyone**.
4. **Deploy**, then **Authorize access**. Google warns the app is unverified;
   that is expected for your own script. Choose **Advanced → Go to (project name)**.
5. Copy the **Web app URL**, which looks like
   `https://script.google.com/macros/s/AKfy.../exec`.

"Anyone" is required because the site calls the URL from its server without
Google credentials. The URL is unguessable and the shared secret is a second lock.
Open the URL with `?version` on the end: it should show `"secured":true`.

## 6. Point the site at it

In Vercel (**Project → Settings → Environment Variables**), then redeploy:

```
GOOGLE_SHEETS_WEBAPP_URL=https://script.google.com/macros/s/AKfy.../exec
SHEETS_WEBHOOK_SECRET=<the same value as SHARED_SECRET>
SESSION_SECRET=<a long random string>
```

Leave the Upstash variables empty: when they are set, the site uses Upstash
instead of the sheet.

## What lands in the sheet

Every tab has readable columns for people and a hidden-in-spirit **Data**
column with the full record the site reads back. **Do not edit Data.** Sorting
and filtering any tab is safe: the script finds rows by id, never by position.

| Tab | One row per | Columns |
| --- | --- | --- |
| **Scores** | posted escape | Run ID, Room, Nickname, Handle, Time, Ms, Hints, Round (`Round 1` if posted before the round ended), Day, Posted At, Wallet, Verified, Hidden, X User ID |
| **Accounts** | signed in X account | X User ID, Handle, Verified, Eligible (30+ day old account with 10+ followers), Followers, X Account Created, Reward Wallet, First Seen |
| **Applications** | airdrop claim | X User ID, Handle, Wallet, Status (pending, approved, rejected), Applied At, Decided At, Verified, Eligible, Followers, X Account Created, Permit ID (printed on their card), Tasks Done |
| **Bans** | banned account | X User ID, Banned At |
| **Runs** | run that used a hint or sent a wrong code | Run ID, Hints, Wrong Codes |
| **Claims** | wallet in a frozen claim list | List (`airdrop` or `rewards`), Index, Account, Amount (base units), X User ID, Proof |
| **Meta** | frozen claim list | Key (`airdrop` or `rewards`), Value (Merkle root, total to fund) |

Runs in progress are not saved: the game keeps them in a signed ticket in the
player's browser, so playing never waits on the sheet.

## What you can and can't change by hand

- **Hide a score:** type `TRUE` in its **Hidden** cell. It leaves the boards
  within about 15 seconds. The admin page's Hide button does the same.
- **Approve or reject applications:** use the admin page (`/admin/airdrop`),
  not the Status column. The admin page enforces the 2,000 cap; editing the
  sheet doesn't.
- **Claims and Meta:** never edit them. They must match the claim contracts
  exactly. Freeze and unfreeze from the admin page.

## Re-deploying after an edit

A new deployment gets a new URL. To keep the existing one:

**Deploy → Manage deployments → pencil icon → Version: New version → Deploy**

## Limits

Apps Script answers in roughly half a second to two seconds and handles one
write at a time. The game writes only when someone posts a score, takes a hint
or signs in, so that's fine for a launch. The site caches lists for 15 seconds
per server, so the public board can lag by up to that much; the admin pages
always read fresh. If traffic outgrows the sheet, set the Upstash variables in
`.env.example` instead: it's a drop-in replacement.

## Troubleshooting

| Symptom | Cause |
| --- | --- |
| Board says it's hiding / nothing saves | `GOOGLE_SHEETS_WEBAPP_URL` not set, or set without a redeploy |
| `Sheets web app returned 401/403` | Access isn't "Anyone", or the deployment was never authorised |
| `Sheets web app: unauthorised` | `SHARED_SECRET` (Script Properties) and `SHEETS_WEBHOOK_SECRET` (Vercel) don't match, or Vercel wasn't redeployed |
| Edits to `Code.gs` have no effect | Saved but not deployed as a new version |
| `?version` shows an old number | Same as above |

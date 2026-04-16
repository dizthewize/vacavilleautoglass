# Web Audit Bug Fixes — Design Spec

**Date:** 2026-04-15
**Status:** Approved
**Scope:** Six targeted fixes to `web-audit` plugin — no new features, no unrelated refactoring

---

## Overview

Six issues were discovered during the first live test run of the `web-audit` skill on `flooringdixon.com`. This spec covers the root cause and fix design for each.

---

## Issue 1 — GitHub Pages 404 (Publisher)

**File:** `web-audit/skills/site-audit/agents/publisher.md`

### Root Cause

The publisher creates a new Git branch (`audit/<domain>-<date>`), commits `index.html` into it, and pushes. GitHub Pages is configured to serve only from `main`. The file is unreachable at the expected URL — Pages simply doesn't see content on other branches.

### Fix

Push the report as a subdirectory directly into `main`, not to a separate branch.

**Before:**
```
git checkout -b audit/flooringdixon-com-2026-04-15   ← separate branch, Pages ignores it
index.html committed here
```

**After:**
```
main branch
└── audit/flooringdixon-com-2026-04-15/
    └── index.html                                    ← Pages serves this
```

The live URL stays identical: `https://<user>.github.io/web-audits/audit/<domain>-<date>/index.html`

**Deploy steps (updated):**
1. Clone `main` to a temp directory
2. `mkdir -p audit/<domain>-<date>/`
3. Copy report to `audit/<domain>-<date>/index.html`
4. `git add`, `git commit -m "audit: <domain> <date>"`, `git push origin main`
5. Return live URL

**No `git checkout -b` step.** The branch concept is dropped entirely for the deploy — only the subdirectory naming convention is kept.

---

## Issue 2 — TTL Cleanup Workflow

**File:** `web-audit/skills/site-audit/github-actions/ttl-cleanup.yml`

### Root Cause

The workflow lists `audit/*` Git branches and deletes them. After the Issue 1 fix there are no `audit/*` branches — reports live in folders on `main`. The cleanup job would find nothing to delete, so reports would never expire.

### Fix

Update the workflow to operate on the filesystem instead of branches:

```yaml
steps:
  - uses: actions/checkout@v4
    with:
      ref: main
      fetch-depth: 0

  - name: Delete expired audit folders
    run: |
      CUTOFF=$(date -d '14 days ago' +%Y-%m-%d 2>/dev/null || date -v-14d +%Y-%m-%d)
      CHANGED=false

      for dir in audit/*/; do
        [ -d "$dir" ] || continue
        DATE_STR=$(basename "$dir" | grep -oE '[0-9]{4}-[0-9]{2}-[0-9]{2}')
        [ -z "$DATE_STR" ] && continue
        if [[ "$DATE_STR" < "$CUTOFF" ]] || [[ "$DATE_STR" == "$CUTOFF" ]]; then
          echo "Deleting expired: $dir (date: $DATE_STR)"
          rm -rf "$dir"
          CHANGED=true
        fi
      done

      if [ "$CHANGED" = true ]; then
        git config user.email "github-actions[bot]@users.noreply.github.com"
        git config user.name "github-actions[bot]"
        git add -A
        git commit -m "chore: remove expired audit reports"
        git push
      else
        echo "No expired audits to remove."
      fi
```

When a folder is deleted from `main` and pushed, GitHub Pages stops serving that URL automatically.

---

## Issue 3 — Gmail Auth Pre-check

**File:** `web-audit/skills/site-audit/SKILL.md`

### Root Cause

The `--email` flag is only acted on at Stage 5 (Publish), after the full crawl + parallel analysis has run (potentially 5+ minutes). If Gmail MCP is not authenticated, the user learns this after all the work is done — the email is silently skipped.

### Fix

Add a Stage 0 auth check immediately after parameter parsing, before any crawl work begins.

**In `SKILL.md`, after "Parse Parameters" and before "Stage 1: Crawl":**

```markdown
## Stage 0: Pre-flight Checks

**If `--email` was provided:**

Check Gmail MCP authentication with a lightweight read:
- Call `mcp__claude_ai_Gmail__gmail_get_profile`
- If it succeeds: print `"Gmail: authenticated ✓ (report will be emailed to <EMAIL>)"` and continue
- If it fails or tool is unavailable: print the following and stop:

  ```
  ✗ Gmail MCP not authenticated.
    Run /mcp → select "claude.ai Gmail" → complete OAuth flow.
    Then re-run: /site-audit <url> --email <address>
  ```
```

This fails fast with a clear, actionable message before any network calls to the target site are made.

---

## Issue 4 — Playwright Launch Detection

**File:** `web-audit/skills/site-audit/agents/design-analyzer.md`

### Root Cause

The availability check runs `npx playwright --version`. This command succeeds (the CLI package is installed) even when the Chromium binary cannot launch due to missing system libraries (e.g. `libnspr4.so` in WSL environments). The agent incorrectly concludes Playwright is working and attempts screenshot capture, which silently fails.

### Fix

Replace the version check with an actual browser launch test:

```bash
PLAYWRIGHT_STATUS=$(node -e "
const { chromium } = require('playwright');
chromium.launch().then(b => { b.close(); process.stdout.write('PLAYWRIGHT_OK'); })
  .catch(() => process.stdout.write('PLAYWRIGHT_MISSING'));
" 2>/dev/null || echo "PLAYWRIGHT_MISSING")
```

- If `PLAYWRIGHT_OK`: proceed with screenshot capture as before
- If `PLAYWRIGHT_MISSING`: skip all screenshot steps, score Design & UX from DOM only

**Finding note when missing:**
```
"Visual analysis unavailable — Playwright browser failed to launch.
To enable screenshots: sudo npx playwright install-deps chromium"
```

This is a behaviour change only in the check mechanism. The fallback path (DOM-only analysis) is unchanged.

---

## Issue 5 — Puppeteer PDF Graceful Fallback

**File:** `web-audit/scripts/generate-report.js`

### Root Cause

`generatePdf()` calls `require('puppeteer')` and `puppeteer.launch()` without error handling. In environments where Chrome cannot launch (same missing system libs as Playwright), the process crashes with an unhelpful error and no report is produced.

### Fix

Wrap PDF generation in try/catch at two levels:

```js
async function generatePdf(auditResult, outputPath) {
  let puppeteer;
  try {
    puppeteer = require('puppeteer');
  } catch {
    console.warn('Warning: Puppeteer not installed. Falling back to HTML report.');
    const htmlPath = outputPath.replace(/\.pdf$/, '.html');
    return generateHtml(auditResult, htmlPath);
  }

  let browser;
  try {
    browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  } catch (e) {
    console.warn(`Warning: PDF generation unavailable — Chrome failed to launch (${e.message.split('\n')[0]}). Generating HTML report instead.`);
    const htmlPath = outputPath.replace(/\.pdf$/, '.html');
    return generateHtml(auditResult, htmlPath);
  }

  try {
    const page = await browser.newPage();
    await page.goto(`file://${path.resolve(outputPath.replace(/\.pdf$/, '-tmp.html'))}`, { waitUntil: 'networkidle0' });
    // write tmp HTML first, then PDF
    const data = buildReportData(auditResult);
    const tmpHtml = outputPath.replace(/\.pdf$/, '-tmp.html');
    fs.writeFileSync(tmpHtml, renderTemplate('report-pdf.html', data));
    await page.goto(`file://${path.resolve(tmpHtml)}`, { waitUntil: 'networkidle0' });
    await page.pdf({ path: outputPath, format: 'A4', printBackground: true,
      margin: { top: '0', bottom: '0', left: '0', right: '0' } });
  } finally {
    await browser.close();
    const tmpHtml = outputPath.replace(/\.pdf$/, '-tmp.html');
    if (fs.existsSync(tmpHtml)) fs.unlinkSync(tmpHtml);
  }
  return outputPath;
}
```

**Behaviour:** `--format pdf` requested → Chrome fails → HTML report produced at `audit-<domain>-<date>.html` → warning printed to terminal. The caller always gets a report file.

---

## Issue 6 — setup-pages.sh HTTPS Git URLs

**File:** `web-audit/scripts/setup-pages.sh`

### Root Cause

The script uses `https://github.com/...` for `git remote add origin` and `git clone`. In SSH-configured environments (like this one, where `gh auth login` uses SSH), these HTTPS URLs fail because there are no stored HTTPS credentials and no `gh` credential helper configured.

### Fix

Replace all `https://github.com/<repo>.git` git URLs with `git@github.com:<repo>.git` (SSH format). Additionally replace the manual `git init + git remote add + git push` pattern in the initial repo setup with `gh repo clone` which respects whatever protocol the user configured at `gh auth login` time.

**Specific changes:**

```bash
# Initial push after repo creation — replace:
git remote add origin "https://github.com/$FULL_REPO.git"
# With:
git remote add origin "git@github.com:$FULL_REPO.git"

# TTL workflow install clone — replace:
git clone --depth 1 "https://github.com/$FULL_REPO.git" .
# With:
gh repo clone "$FULL_REPO" . -- --depth 1
```

---

## Files Changed

| File | Change |
|---|---|
| `skills/site-audit/agents/publisher.md` | Deploy to `main` subfolder instead of separate branch |
| `skills/site-audit/github-actions/ttl-cleanup.yml` | Delete subdirs from `main` instead of deleting branches |
| `skills/site-audit/SKILL.md` | Add Stage 0 Gmail auth pre-check before crawl |
| `skills/site-audit/agents/design-analyzer.md` | Replace version check with actual browser launch test |
| `scripts/generate-report.js` | Catch Puppeteer require + launch failures, fall back to HTML |
| `scripts/setup-pages.sh` | Replace HTTPS git URLs with SSH (`git@github.com:`) |

## Out of Scope

- Fixing the missing WSL system libraries (requires `sudo`, out of scope for the plugin)
- Changing report content or scoring logic
- Adding new features

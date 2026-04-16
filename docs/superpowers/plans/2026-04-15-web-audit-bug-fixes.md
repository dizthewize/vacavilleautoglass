# Web Audit Bug Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix six bugs discovered during the first live test run: Puppeteer crash on PDF, Playwright false-positive availability check, GitHub Pages 404 on deployed reports, TTL cleanup targeting wrong objects, missing Gmail auth pre-check, and HTTPS git URLs failing in SSH environments.

**Architecture:** All fixes are isolated to existing files — no new modules, no API changes. Task 1 is the only JavaScript code change (has unit tests). Tasks 2–6 are markdown agent files, a GitHub Actions workflow, and a bash script — each verified manually by reading the updated file and confirming the change is present and correct.

**Tech Stack:** Node.js 18+, Jest 29, Bash, GitHub Actions, GitHub Pages, Gmail MCP

---

## Task 1: Puppeteer PDF Graceful Fallback

**Files:**
- Modify: `web-audit/scripts/generate-report.js` (lines 83–102, `generatePdf` function)
- Create: `web-audit/tests/generate-report-pdf.test.js`

### Context

`generatePdf` calls `require('puppeteer')` then `puppeteer.launch()` with no error handling. In WSL and other environments missing Chrome system libraries, `launch()` rejects and the whole process crashes — no report is produced. The fix wraps both in try/catch and falls back to `generateHtml` with a console warning.

---

- [ ] **Step 1: Write the failing test**

Create `web-audit/tests/generate-report-pdf.test.js`:

```js
'use strict';

// Mock puppeteer so launch() rejects — simulates Chrome failing to start
jest.mock('puppeteer', () => ({
  launch: jest.fn().mockRejectedValue(new Error('Failed to launch the browser process'))
}));

const os = require('os');
const path = require('path');
const fs = require('fs');
const { generatePdf } = require('../scripts/generate-report');

const mockAudit = {
  crawl: {
    startUrl: 'https://example.com',
    crawledAt: '2026-04-15T10:00:00.000Z',
    pages: [{}]
  },
  seoFindings: {
    working: ['HTTPS configured'],
    issues: ['Missing sitemap'],
    actions: [{ priority: 'CRITICAL', text: 'Add sitemap' }]
  },
  designFindings: {
    working: [],
    issues: [],
    actions: []
  },
  score: {
    composite: 60,
    liteMode: false,
    band: { label: 'Fair', description: 'Noticeable gaps, actionable items' },
    categories: {
      technicalSeo: { score: 60 }, onPageSeo: { score: 60 },
      performance: { score: 60 }, keywordHealth: { score: 60 },
      designUx: { score: 60 }, cro: { score: 60 }
    }
  }
};

describe('generatePdf fallback', () => {
  const tmpDir = os.tmpdir();

  test('returns an .html path when puppeteer.launch() rejects', async () => {
    const pdfPath = path.join(tmpDir, 'test-fallback.pdf');
    const result = await generatePdf(mockAudit, pdfPath);
    expect(result).toMatch(/\.html$/);
  });

  test('writes the HTML file to disk when falling back', async () => {
    const pdfPath = path.join(tmpDir, 'test-fallback-written.pdf');
    const htmlPath = pdfPath.replace(/\.pdf$/, '.html');
    if (fs.existsSync(htmlPath)) fs.unlinkSync(htmlPath);

    await generatePdf(mockAudit, pdfPath);

    expect(fs.existsSync(htmlPath)).toBe(true);
    fs.unlinkSync(htmlPath);
  });

  test('prints a warning when falling back', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const pdfPath = path.join(tmpDir, 'test-fallback-warn.pdf');

    await generatePdf(mockAudit, pdfPath);

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('PDF generation unavailable'));
    const htmlPath = pdfPath.replace(/\.pdf$/, '.html');
    if (fs.existsSync(htmlPath)) fs.unlinkSync(htmlPath);
    warnSpy.mockRestore();
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
cd /mnt/c/Users/tez/projects/web-audit && npx jest tests/generate-report-pdf.test.js --no-coverage
```

Expected: 3 tests FAIL — `generatePdf` crashes with Puppeteer error rather than returning HTML path.

- [ ] **Step 3: Update `generatePdf` in `web-audit/scripts/generate-report.js`**

Replace the entire `generatePdf` function (lines 83–102) with:

```js
async function generatePdf(auditResult, outputPath) {
  let puppeteer;
  try {
    puppeteer = require('puppeteer');
  } catch {
    console.warn('Warning: Puppeteer not installed. Generating HTML report instead.');
    return generateHtml(auditResult, outputPath.replace(/\.pdf$/, '.html'));
  }

  let browser;
  try {
    browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  } catch (e) {
    console.warn(`Warning: PDF generation unavailable — Chrome failed to launch (${e.message.split('\n')[0]}). Generating HTML report instead.`);
    return generateHtml(auditResult, outputPath.replace(/\.pdf$/, '.html'));
  }

  const data = buildReportData(auditResult);
  const tmpHtml = outputPath.replace(/\.pdf$/, '-tmp.html');
  fs.writeFileSync(tmpHtml, renderTemplate('report-pdf.html', data));

  try {
    const page = await browser.newPage();
    await page.goto(`file://${path.resolve(tmpHtml)}`, { waitUntil: 'networkidle0' });
    await page.pdf({
      path: outputPath, format: 'A4', printBackground: true,
      margin: { top: '0', bottom: '0', left: '0', right: '0' }
    });
  } finally {
    await browser.close();
    if (fs.existsSync(tmpHtml)) fs.unlinkSync(tmpHtml);
  }
  return outputPath;
}
```

Note: `buildReportData` and `renderTemplate` calls are now after the `browser.launch()` check — no tmp file is written if launch fails.

- [ ] **Step 4: Run the new tests to confirm they pass**

```bash
cd /mnt/c/Users/tez/projects/web-audit && npx jest tests/generate-report-pdf.test.js --no-coverage
```

Expected: 3 tests PASS.

- [ ] **Step 5: Run the full test suite to confirm no regressions**

```bash
cd /mnt/c/Users/tez/projects/web-audit && npm test
```

Expected: All tests pass (3 suites, 38 tests total).

- [ ] **Step 6: Commit**

```bash
cd /mnt/c/Users/tez/projects/web-audit
git add scripts/generate-report.js tests/generate-report-pdf.test.js
git commit -m "fix: graceful PDF fallback when Puppeteer/Chrome fails to launch"
```

---

## Task 2: Playwright Launch Detection Fix

**Files:**
- Modify: `web-audit/skills/site-audit/agents/design-analyzer.md` (Step 1, availability check)

### Context

The current check is `npx playwright --version` — this prints the version even when the Chromium binary can't run (missing system libs in WSL). The agent incorrectly concludes Playwright is working. Replace with a Node.js launch test that actually tries to start the browser.

---

- [ ] **Step 1: Replace the availability check in `design-analyzer.md`**

Find this block in `web-audit/skills/site-audit/agents/design-analyzer.md`:

```markdown
## Step 1: Check Playwright Availability

```bash
npx playwright --version 2>/dev/null || echo "PLAYWRIGHT_MISSING"
```

If `PLAYWRIGHT_MISSING`: skip all screenshot analysis. Score design/UX and CRO from DOM data only. Note in findings: "Visual analysis unavailable — install Playwright for screenshot-based scoring."
```

Replace the entire Step 1 block with:

```markdown
## Step 1: Check Playwright Availability

```bash
PLAYWRIGHT_STATUS=$(node -e "
const { chromium } = require('playwright');
chromium.launch()
  .then(b => { b.close(); process.stdout.write('PLAYWRIGHT_OK'); })
  .catch(() => process.stdout.write('PLAYWRIGHT_MISSING'));
" 2>/dev/null || echo "PLAYWRIGHT_MISSING")
echo "Playwright status: $PLAYWRIGHT_STATUS"
```

If `PLAYWRIGHT_MISSING`: skip all screenshot analysis. Score Design & UX and CRO from DOM data only. Add this note to `designUx.issues` in the findings:
```
"Visual analysis unavailable — Playwright browser failed to launch. To enable screenshots: sudo npx playwright install-deps chromium"
```
```

- [ ] **Step 2: Verify the edit is correct**

```bash
grep -A 12 "Step 1: Check Playwright" /mnt/c/Users/tez/projects/web-audit/skills/site-audit/agents/design-analyzer.md
```

Expected output: Shows the `chromium.launch()` node script, not `npx playwright --version`.

- [ ] **Step 3: Commit**

```bash
cd /mnt/c/Users/tez/projects/web-audit
git add skills/site-audit/agents/design-analyzer.md
git commit -m "fix: replace playwright --version check with actual browser launch test"
```

---

## Task 3: Gmail Auth Pre-check in SKILL.md

**Files:**
- Modify: `web-audit/skills/site-audit/SKILL.md` (add Stage 0 section after "Parse Parameters")

### Context

When `--email` is provided, the skill currently discovers a Gmail auth failure at Stage 5 (after the full crawl + analysis). The fix adds a Stage 0 pre-flight check that calls `mcp__claude_ai_Gmail__gmail_get_profile` immediately after parameter parsing. If Gmail isn't authenticated, it prints a clear message and stops before any crawl work begins.

---

- [ ] **Step 1: Add Stage 0 section to `SKILL.md`**

In `web-audit/skills/site-audit/SKILL.md`, find this line:

```markdown
## Stage 1: Crawl
```

Insert the following block immediately before it (after the "Parse Parameters" section):

```markdown
## Stage 0: Pre-flight Checks

**If `--email` was provided:**

Check Gmail MCP authentication before starting any crawl work:

- Call `mcp__claude_ai_Gmail__gmail_get_profile`
- If the call **succeeds**: print `"Gmail: authenticated ✓ (report will be emailed to <EMAIL>)"` and continue to Stage 1
- If the call **fails** or the tool is unavailable: print the following message and **stop**:

```
✗ Gmail MCP not authenticated.
  Run /mcp → select "claude.ai Gmail" → complete the OAuth flow.
  Then re-run: /site-audit <URL> --email <EMAIL>
```

**If `--email` was not provided:** skip this stage entirely.

```

- [ ] **Step 2: Verify the edit is correct**

```bash
grep -A 20 "Stage 0:" /mnt/c/Users/tez/projects/web-audit/skills/site-audit/SKILL.md
```

Expected output: Shows the full Stage 0 block with `mcp__claude_ai_Gmail__gmail_get_profile` call and stop condition.

- [ ] **Step 3: Confirm Stage 1 still follows immediately after Stage 0**

```bash
grep -n "## Stage" /mnt/c/Users/tez/projects/web-audit/skills/site-audit/SKILL.md
```

Expected output:
```
XX:## Stage 0: Pre-flight Checks
XX:## Stage 1: Crawl
XX:## Stage 2: Parallel Analysis
XX:## Stage 3: Score
XX:## Stage 4: Generate Report
XX:## Stage 5: Publish
```

- [ ] **Step 4: Commit**

```bash
cd /mnt/c/Users/tez/projects/web-audit
git add skills/site-audit/SKILL.md
git commit -m "fix: check Gmail MCP auth before crawl when --email is passed"
```

---

## Task 4: Publisher — Deploy to main Branch Subdirectory

**Files:**
- Modify: `web-audit/skills/site-audit/agents/publisher.md` (Steps 1 and 2)

### Context

GitHub Pages only serves from the configured branch (`main`). The current publisher creates a new Git branch (`audit/<domain>-<date>`) and commits there — Pages ignores it entirely. Fix: commit the report to a subdirectory in `main` instead. The URL stays identical; only the Git mechanics change.

---

- [ ] **Step 1: Replace the publisher's deploy steps**

In `web-audit/skills/site-audit/agents/publisher.md`, find the entire **Step 2: Deploy to GitHub Pages** block and replace it with:

```markdown
## Step 2: Deploy to GitHub Pages (full mode only)

```bash
CONFIG=$(cat ~/.web-audit/config.json)
GH_USER=$(echo $CONFIG | node -e "process.stdin.resume();let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).githubUser))")
PAGES_BASE=$(echo $CONFIG | node -e "process.stdin.resume();let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).pagesBase))")
REPO=$(echo $CONFIG | node -e "process.stdin.resume();let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).fullRepo))")

DOMAIN=$(node -e "const d=require('/tmp/web-audit-crawl.json'); console.log(new URL(d.startUrl).hostname.replace(/\./g,'-'))")
DATE=$(date +%Y-%m-%d)
REPORT_DIR="audit/${DOMAIN}-${DATE}"
REPORT_FILE=<REPORT_FILE_PATH>
LIVE_URL="${PAGES_BASE}/${REPORT_DIR}/index.html"

# Clone main, add report as subdirectory, push back to main
TMPDIR_DEPLOY=$(mktemp -d)
gh repo clone "$REPO" "$TMPDIR_DEPLOY" -- --depth 1
cd "$TMPDIR_DEPLOY"
mkdir -p "${REPORT_DIR}"
cp "$REPORT_FILE" "${REPORT_DIR}/index.html"
git add "${REPORT_DIR}/index.html"
git commit -m "audit: ${DOMAIN} ${DATE}"
git push origin main
cd -
rm -rf "$TMPDIR_DEPLOY"

echo "Deployed to: $LIVE_URL"
echo "Live in ~60 seconds (GitHub Pages build time)"
echo "Expires: $(date -d '14 days' '+%B %d, %Y' 2>/dev/null || date -v+14d '+%B %d, %Y')"
```

If push fails: save report locally, print path, tell user GitHub Pages deploy failed and suggest running `bash $PLUGIN_ROOT/scripts/setup-pages.sh` to re-run setup.
```

Key changes from the old version:
1. No `git checkout -b` — commits directly to `main`
2. `gh repo clone` instead of `git clone https://...` — respects configured SSH/HTTPS protocol
3. `git push origin main` instead of `git push origin "$BRANCH"`

- [ ] **Step 2: Verify no branch creation commands remain**

```bash
grep -n "checkout -b\|git branch\|push origin audit" /mnt/c/Users/tez/projects/web-audit/skills/site-audit/agents/publisher.md
```

Expected output: No matches (empty).

- [ ] **Step 3: Verify `gh repo clone` is present**

```bash
grep "gh repo clone" /mnt/c/Users/tez/projects/web-audit/skills/site-audit/agents/publisher.md
```

Expected output: One match showing `gh repo clone "$REPO" "$TMPDIR_DEPLOY" -- --depth 1`

- [ ] **Step 4: Commit**

```bash
cd /mnt/c/Users/tez/projects/web-audit
git add skills/site-audit/agents/publisher.md
git commit -m "fix: deploy reports to main branch subdirectory so GitHub Pages serves them"
```

---

## Task 5: TTL Cleanup — Delete Subdirectories from main

**Files:**
- Modify: `web-audit/skills/site-audit/github-actions/ttl-cleanup.yml` (the cleanup step)

### Context

The workflow currently lists `audit/*` Git branches and deletes them. After the Task 4 fix, there are no `audit/*` branches — reports live in `audit/*/` subdirectories on `main`. The cleanup must now checkout `main`, find expired audit folders by date, delete them, and push the deletion back to `main`.

---

- [ ] **Step 1: Replace `ttl-cleanup.yml` entirely**

Write `web-audit/skills/site-audit/github-actions/ttl-cleanup.yml` with:

```yaml
name: Cleanup Expired Audit Reports

on:
  schedule:
    - cron: '0 2 * * *'   # daily at 2am UTC
  workflow_dispatch:        # allow manual trigger

jobs:
  cleanup:
    runs-on: ubuntu-latest
    permissions:
      contents: write

    steps:
      - uses: actions/checkout@v4
        with:
          ref: main
          fetch-depth: 0

      - name: Delete audit folders older than 14 days
        run: |
          # YYYY-MM-DD string comparison works correctly for ISO dates
          CUTOFF=$(date -d '14 days ago' +%Y-%m-%d)
          CHANGED=false

          for dir in audit/*/; do
            [ -d "$dir" ] || continue
            # Extract trailing YYYY-MM-DD from folder name (ignores -lite suffix)
            DATE_STR=$(basename "$dir" | grep -oE '[0-9]{4}-[0-9]{2}-[0-9]{2}' | head -1)
            [ -z "$DATE_STR" ] && continue

            if [[ "$DATE_STR" < "$CUTOFF" ]] || [[ "$DATE_STR" == "$CUTOFF" ]]; then
              echo "Deleting expired: $dir (date: $DATE_STR, cutoff: $CUTOFF)"
              rm -rf "$dir"
              CHANGED=true
            else
              echo "Keeping: $dir (date: $DATE_STR)"
            fi
          done

          if [ "$CHANGED" = true ]; then
            git config user.email "github-actions[bot]@users.noreply.github.com"
            git config user.name "github-actions[bot]"
            git add -A
            git commit -m "chore: remove expired audit reports older than 14 days"
            git push
          else
            echo "No expired audit folders found."
          fi
```

- [ ] **Step 2: Verify no branch-deletion logic remains**

```bash
grep -n "git/refs/heads\|delete.*branch\|branches.*audit" /mnt/c/Users/tez/projects/web-audit/skills/site-audit/github-actions/ttl-cleanup.yml
```

Expected output: No matches (empty).

- [ ] **Step 3: Verify folder deletion logic is present**

```bash
grep -n "rm -rf\|DATE_STR\|CUTOFF\|git push" /mnt/c/Users/tez/projects/web-audit/skills/site-audit/github-actions/ttl-cleanup.yml
```

Expected output: All four patterns match — confirms delete, date check, cutoff, and push are all there.

- [ ] **Step 4: Commit**

```bash
cd /mnt/c/Users/tez/projects/web-audit
git add skills/site-audit/github-actions/ttl-cleanup.yml
git commit -m "fix: TTL cleanup deletes subdirs from main instead of branches"
```

---

## Task 6: setup-pages.sh — Use SSH Git URLs

**Files:**
- Modify: `web-audit/scripts/setup-pages.sh` (two `git remote add origin https://...` lines and one `git clone https://...` line)

### Context

The script hardcodes `https://github.com/...` for git operations. In environments where `gh auth login` used SSH (the default for this project), HTTPS operations fail because there are no stored credentials. Replace with `git@github.com:` SSH URLs for the initial push, and `gh repo clone` for the workflow install clone — both respect the user's configured auth method.

---

- [ ] **Step 1: Fix the initial repo push (SSH URL)**

In `web-audit/scripts/setup-pages.sh`, find:

```bash
  git remote add origin "https://github.com/$FULL_REPO.git"
```

Replace with:

```bash
  git remote add origin "git@github.com:$FULL_REPO.git"
```

- [ ] **Step 2: Fix the TTL workflow install clone**

In the same file, find:

```bash
git clone --depth 1 "https://github.com/$FULL_REPO.git" .
```

Replace with:

```bash
gh repo clone "$FULL_REPO" . -- --depth 1
```

- [ ] **Step 3: Verify no HTTPS git remote URLs remain**

```bash
grep "https://github.com" /mnt/c/Users/tez/projects/web-audit/scripts/setup-pages.sh
```

Expected output: No matches (empty). The only remaining `github.com` references should be in `echo` statements (display only, not git operations).

- [ ] **Step 4: Verify SSH URL and gh clone are present**

```bash
grep -n "git@github.com\|gh repo clone" /mnt/c/Users/tez/projects/web-audit/scripts/setup-pages.sh
```

Expected output: Two matches — one `git@github.com:$FULL_REPO.git` and one `gh repo clone`.

- [ ] **Step 5: Commit**

```bash
cd /mnt/c/Users/tez/projects/web-audit
git add scripts/setup-pages.sh
git commit -m "fix: use SSH git URLs and gh repo clone in setup-pages.sh"
```

---

## Final Verification

- [ ] **Run full test suite one last time**

```bash
cd /mnt/c/Users/tez/projects/web-audit && npm test
```

Expected: All tests pass (4 suites including the new PDF fallback suite).

- [ ] **Confirm all 6 fixes are committed**

```bash
cd /mnt/c/Users/tez/projects/web-audit && git log --oneline -8
```

Expected: 6 fix commits visible, all with `fix:` prefix.

- [ ] **Push web-audit changes to remote (if applicable)**

```bash
cd /mnt/c/Users/tez/projects && git add web-audit/ && git status
```

Confirm only the expected files changed, then commit and push from the projects repo if desired.

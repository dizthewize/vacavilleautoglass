# Web Audit Skill Suite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone `web-audit` Claude Code plugin that crawls a URL, runs parallel SEO + design analysis, scores 0–100, and publishes a styled PDF/HTML/dashboard report to GitHub Pages with a 14-day TTL.

**Architecture:** SKILL.md orchestrator → crawler script (Node.js) → parallel SEO + Design agents → scorer script → report generator (Puppeteer) → publisher agent (gh CLI + Gmail MCP). Lite mode skips design/keywords/publishing and caps at 10 pages.

**Tech Stack:** Node.js 18+, jsdom, Puppeteer, Playwright, Jest, `gh` CLI, Gmail MCP

---

## File Map

```
web-audit/
├── package.json
├── jest.config.js
├── .gitignore
├── scripts/
│   ├── crawl.js                 ← breadth-first crawler, outputs URL map JSON
│   ├── score.js                 ← weighted composite scorer
│   ├── generate-report.js       ← HTML/PDF/dashboard generator via Puppeteer
│   └── setup-pages.sh           ← one-time GitHub Pages repo setup
├── tests/
│   ├── crawl.test.js
│   ├── score.test.js
│   └── generate-report.test.js
└── skills/
    └── site-audit/
        ├── SKILL.md                    ← orchestrator entry point
        ├── agents/
        │   ├── crawler.md              ← instructs Claude to run crawl.js
        │   ├── seo-analyzer.md         ← SEO analysis instructions
        │   ├── design-analyzer.md      ← Playwright + UX/CRO instructions
        │   ├── scorer.md               ← instructs Claude to run score.js
        │   └── publisher.md            ← gh CLI deploy + email instructions
        ├── templates/
        │   ├── report.html             ← full report template ({{variable}} slots)
        │   ├── report-pdf.html         ← PDF-optimized (print CSS)
        │   └── dashboard.html          ← live dashboard
        ├── github-actions/
        │   └── ttl-cleanup.yml         ← deletes audit/* branches after 14 days
        └── references/
            ├── scoring-weights.md
            └── checklist.md
```

---

## Task 1: Plugin Scaffold

**Files:**
- Create: `web-audit/package.json`
- Create: `web-audit/jest.config.js`
- Create: `web-audit/.gitignore`

- [ ] **Step 1: Create the plugin directory**

```bash
mkdir -p /mnt/c/Users/tez/projects/web-audit
cd /mnt/c/Users/tez/projects/web-audit
```

- [ ] **Step 2: Write package.json**

```json
{
  "name": "web-audit",
  "version": "1.0.0",
  "description": "Automated site audit skill suite for Claude Code",
  "main": "scripts/crawl.js",
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "crawl": "node scripts/crawl.js",
    "score": "node scripts/score.js",
    "report": "node scripts/generate-report.js"
  },
  "dependencies": {
    "jsdom": "^24.0.0",
    "puppeteer": "^22.0.0"
  },
  "devDependencies": {
    "jest": "^29.0.0"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
```

- [ ] **Step 3: Write jest.config.js**

```js
/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  collectCoverageFrom: ['scripts/**/*.js']
};
```

- [ ] **Step 4: Write .gitignore**

```
node_modules/
*.pdf
*.tmp.html
.web-audit/
audit-output/
coverage/
```

- [ ] **Step 5: Install dependencies**

```bash
cd /mnt/c/Users/tez/projects/web-audit && npm install
```

Expected: `node_modules/` created, `package-lock.json` written. No errors.

- [ ] **Step 6: Create directory structure**

```bash
mkdir -p scripts tests skills/site-audit/agents skills/site-audit/templates skills/site-audit/github-actions skills/site-audit/references
```

- [ ] **Step 7: Commit**

```bash
git -C /mnt/c/Users/tez/projects/web-audit init
git -C /mnt/c/Users/tez/projects/web-audit add package.json jest.config.js .gitignore
git -C /mnt/c/Users/tez/projects/web-audit commit -m "feat: init web-audit plugin scaffold"
```

---

## Task 2: Crawler Module

**Files:**
- Create: `web-audit/scripts/crawl.js`
- Create: `web-audit/tests/crawl.test.js`

- [ ] **Step 1: Write the failing tests**

Create `web-audit/tests/crawl.test.js`:

```js
'use strict';
const { parseArgs, extractPageData, checkRobots } = require('../scripts/crawl');

describe('parseArgs', () => {
  test('defaults: maxPages=50, maxDepth=Infinity, lite=false', () => {
    const opts = parseArgs(['https://example.com']);
    expect(opts.maxPages).toBe(50);
    expect(opts.maxDepth).toBe(Infinity);
    expect(opts.lite).toBe(false);
  });

  test('--pages flag sets maxPages', () => {
    expect(parseArgs(['https://example.com', '--pages', '20']).maxPages).toBe(20);
  });

  test('--pages= syntax', () => {
    expect(parseArgs(['https://example.com', '--pages=20']).maxPages).toBe(20);
  });

  test('--depth= syntax sets maxDepth', () => {
    expect(parseArgs(['https://example.com', '--depth=2']).maxDepth).toBe(2);
  });

  test('--depth flag sets maxDepth', () => {
    expect(parseArgs(['https://example.com', '--depth', '3']).maxDepth).toBe(3);
  });

  test('--lite caps maxPages at 10', () => {
    const opts = parseArgs(['https://example.com', '--lite', '--pages', '50']);
    expect(opts.maxPages).toBe(10);
    expect(opts.lite).toBe(true);
  });

  test('--lite with pages < 10 keeps lower value', () => {
    expect(parseArgs(['https://example.com', '--lite', '--pages', '5']).maxPages).toBe(5);
  });
});

describe('extractPageData', () => {
  test('extracts title and meta description', () => {
    const html = `<html><head><title>Test Page</title><meta name="description" content="A test page"></head><body></body></html>`;
    const data = extractPageData('https://example.com/', html);
    expect(data.title).toBe('Test Page');
    expect(data.metaDesc).toBe('A test page');
  });

  test('extracts all H1s', () => {
    const html = `<html><body><h1>First</h1><h1>Second</h1></body></html>`;
    const data = extractPageData('https://example.com/', html);
    expect(data.h1s).toEqual(['First', 'Second']);
  });

  test('only returns internal links', () => {
    const html = `<html><body>
      <a href="/about">About</a>
      <a href="https://example.com/contact">Contact</a>
      <a href="https://external.com/page">External</a>
    </body></html>`;
    const data = extractPageData('https://example.com/', html);
    expect(data.links).toContain('https://example.com/about');
    expect(data.links).toContain('https://example.com/contact');
    expect(data.links).not.toContain('https://external.com/page');
  });

  test('deduplicates links', () => {
    const html = `<html><body>
      <a href="/page">One</a><a href="/page">Two</a>
    </body></html>`;
    const data = extractPageData('https://example.com/', html);
    expect(data.links.filter(l => l.endsWith('/page')).length).toBe(1);
  });

  test('strips fragments and query strings from links', () => {
    const html = `<html><body>
      <a href="/page?ref=nav#section">Link</a>
    </body></html>`;
    const data = extractPageData('https://example.com/', html);
    expect(data.links).toContain('https://example.com/page');
  });

  test('returns canonical tag value', () => {
    const html = `<html><head><link rel="canonical" href="https://example.com/page"></head><body></body></html>`;
    const data = extractPageData('https://example.com/page?q=1', html);
    expect(data.canonical).toBe('https://example.com/page');
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd /mnt/c/Users/tez/projects/web-audit && npm test -- tests/crawl.test.js
```

Expected: `Cannot find module '../scripts/crawl'`

- [ ] **Step 3: Write crawl.js**

Create `web-audit/scripts/crawl.js`:

```js
'use strict';

const { JSDOM } = require('jsdom');

function parseArgs(args) {
  const opts = { maxPages: 50, maxDepth: Infinity, lite: false };
  const url = args[0]; // positional — not stored in opts
  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--lite') { opts.lite = true; continue; }
    if (args[i] === '--pages') { opts.maxPages = parseInt(args[++i]); continue; }
    if (args[i].startsWith('--pages=')) { opts.maxPages = parseInt(args[i].split('=')[1]); continue; }
    if (args[i] === '--depth') { opts.maxDepth = parseInt(args[++i]); continue; }
    if (args[i].startsWith('--depth=')) { opts.maxDepth = parseInt(args[i].split('=')[1]); continue; }
  }
  if (opts.lite) opts.maxPages = Math.min(10, opts.maxPages);
  return opts;
}

function extractPageData(url, html) {
  const dom = new JSDOM(html, { url });
  const doc = dom.window.document;

  const title = doc.querySelector('title')?.textContent?.trim() ?? '';
  const metaDesc = doc.querySelector('meta[name="description"]')?.getAttribute('content') ?? '';
  const canonical = doc.querySelector('link[rel="canonical"]')?.getAttribute('href') ?? '';
  const robotsMeta = doc.querySelector('meta[name="robots"]')?.getAttribute('content') ?? '';
  const h1s = Array.from(doc.querySelectorAll('h1')).map(el => el.textContent.trim());
  const h2s = Array.from(doc.querySelectorAll('h2')).map(el => el.textContent.trim());
  const imgsMissingAlt = Array.from(doc.querySelectorAll('img:not([alt])')).length;
  const imgsTotal = doc.querySelectorAll('img').length;

  const base = new URL(url);
  const links = Array.from(doc.querySelectorAll('a[href]'))
    .map(a => {
      try { return new URL(a.getAttribute('href'), url).href; } catch { return null; }
    })
    .filter(href => href && new URL(href).hostname === base.hostname)
    .map(href => href.split('#')[0].split('?')[0])
    .filter((v, i, a) => v && a.indexOf(v) === i);

  return { title, metaDesc, canonical, robotsMeta, h1s, h2s, imgsMissingAlt, imgsTotal, links };
}

async function fetchPage(url) {
  const start = Date.now();
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'web-audit/1.0' },
      signal: AbortSignal.timeout(10000)
    });
    const html = await res.text();
    return { url, statusCode: res.status, responseTime: Date.now() - start, html, error: null };
  } catch (err) {
    return { url, statusCode: 0, responseTime: Date.now() - start, html: '', error: err.message };
  }
}

async function checkRobots(baseUrl) {
  const robotsUrl = new URL('/robots.txt', baseUrl).href;
  const result = await fetchPage(robotsUrl);
  if (result.statusCode !== 200) return { exists: false, content: null, sitemapRefs: [], disallowed: [] };
  const sitemapRefs = (result.html.match(/^Sitemap:\s*(.+)$/gim) || [])
    .map(l => l.replace(/^Sitemap:\s*/i, '').trim());
  const disallowed = (result.html.match(/^Disallow:\s*(.+)$/gim) || [])
    .map(l => l.replace(/^Disallow:\s*/i, '').trim())
    .filter(Boolean);
  return { exists: true, content: result.html, sitemapRefs, disallowed };
}

async function checkSitemap(baseUrl, robotsData) {
  const candidates = [
    ...robotsData.sitemapRefs,
    new URL('/sitemap.xml', baseUrl).href,
    new URL('/sitemap_index.xml', baseUrl).href
  ];
  for (const url of candidates) {
    const result = await fetchPage(url);
    if (result.statusCode === 200) {
      return { exists: true, url, urlCount: (result.html.match(/<loc>/g) || []).length };
    }
  }
  return { exists: false, url: null, urlCount: 0 };
}

async function crawl(startUrl, options = {}) {
  const { maxPages = 50, maxDepth = Infinity, lite = false } = options;
  const effectiveMax = lite ? Math.min(10, maxPages) : maxPages;

  const robots = await checkRobots(startUrl);
  const sitemap = await checkSitemap(startUrl, robots);

  const visited = new Set();
  const queue = [{ url: startUrl, depth: 0 }];
  const pages = [];

  while (queue.length > 0 && pages.length < effectiveMax) {
    const { url, depth } = queue.shift();
    if (visited.has(url)) continue;
    visited.add(url);

    const fetched = await fetchPage(url);
    if (fetched.error || !fetched.html) continue;

    const data = extractPageData(url, fetched.html);
    pages.push({ url, depth, statusCode: fetched.statusCode, responseTime: fetched.responseTime, ...data });

    if (depth < maxDepth) {
      data.links
        .filter(link => !visited.has(link))
        .forEach(link => queue.push({ url: link, depth: depth + 1 }));
    }
  }

  return { pages, robots, sitemap, crawledAt: new Date().toISOString(), startUrl };
}

// CLI entry point
if (require.main === module) {
  const args = process.argv.slice(2);
  const startUrl = args[0];
  if (!startUrl) {
    console.error('Usage: node crawl.js <url> [--pages N] [--depth N] [--lite]');
    process.exit(1);
  }
  const opts = parseArgs(args);
  crawl(startUrl, opts)
    .then(result => console.log(JSON.stringify(result, null, 2)))
    .catch(err => { console.error(err.message); process.exit(1); });
}

module.exports = { crawl, extractPageData, checkRobots, checkSitemap, parseArgs };
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
cd /mnt/c/Users/tez/projects/web-audit && npm test -- tests/crawl.test.js
```

Expected: All 11 tests PASS.

- [ ] **Step 5: Commit**

```bash
cd /mnt/c/Users/tez/projects/web-audit && git add scripts/crawl.js tests/crawl.test.js && git commit -m "feat: add breadth-first crawler module with --lite and --depth support"
```

---

## Task 3: Scoring Module

**Files:**
- Create: `web-audit/scripts/score.js`
- Create: `web-audit/tests/score.test.js`

- [ ] **Step 1: Write failing tests**

Create `web-audit/tests/score.test.js`:

```js
'use strict';
const { computeScore, getBand, WEIGHTS } = require('../scripts/score');

describe('WEIGHTS', () => {
  test('sum to exactly 1.0', () => {
    const total = Object.values(WEIGHTS).reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(1.0, 10);
  });
});

describe('getBand', () => {
  test('90 → Excellent', () => expect(getBand(90).label).toBe('Excellent'));
  test('89 → Good', () => expect(getBand(89).label).toBe('Good'));
  test('75 → Good', () => expect(getBand(75).label).toBe('Good'));
  test('74 → Fair', () => expect(getBand(74).label).toBe('Fair'));
  test('50 → Fair', () => expect(getBand(50).label).toBe('Fair'));
  test('49 → Poor', () => expect(getBand(49).label).toBe('Poor'));
  test('0 → Poor', () => expect(getBand(0).label).toBe('Poor'));
});

describe('computeScore', () => {
  const allEighty = {
    technicalSeo: { score: 80 }, onPageSeo: { score: 80 },
    performance: { score: 80 }, keywordHealth: { score: 80 },
    designUx: { score: 80 }, cro: { score: 80 }
  };

  test('uniform scores produce that score as composite', () => {
    expect(computeScore(allEighty).composite).toBe(80);
  });

  test('returns band for composite', () => {
    expect(computeScore(allEighty).band.label).toBe('Good');
  });

  test('missing category defaults to 0', () => {
    const findings = { technicalSeo: { score: 100 } };
    const result = computeScore(findings);
    expect(result.composite).toBe(Math.round(100 * 0.25));
  });

  test('all zeros → 0', () => {
    const findings = {};
    expect(computeScore(findings).composite).toBe(0);
  });

  test('all 100 → 100', () => {
    const findings = Object.fromEntries(
      Object.keys(WEIGHTS).map(k => [k, { score: 100 }])
    );
    expect(computeScore(findings).composite).toBe(100);
  });

  test('categories object includes weight and contribution', () => {
    const result = computeScore(allEighty);
    expect(result.categories.technicalSeo.weight).toBe(0.25);
    expect(result.categories.technicalSeo.contribution).toBe(20);
  });

  test('lite mode skips designUx and cro, reweights remaining', () => {
    const findings = {
      technicalSeo: { score: 80 }, onPageSeo: { score: 80 },
      performance: { score: 80 }, keywordHealth: { score: 80 }
    };
    const result = computeScore(findings, { lite: true });
    // lite weights: techSEO=0.3125, onPage=0.25, perf=0.25, keywords=0.1875
    expect(result.composite).toBe(80);
    expect(result.liteMode).toBe(true);
  });
});
```

- [ ] **Step 2: Run — verify failure**

```bash
cd /mnt/c/Users/tez/projects/web-audit && npm test -- tests/score.test.js
```

Expected: `Cannot find module '../scripts/score'`

- [ ] **Step 3: Write score.js**

Create `web-audit/scripts/score.js`:

```js
'use strict';

const WEIGHTS = {
  technicalSeo: 0.25,
  onPageSeo: 0.20,
  performance: 0.20,
  keywordHealth: 0.15,
  designUx: 0.10,
  cro: 0.10
};

const LITE_KEYS = ['technicalSeo', 'onPageSeo', 'performance', 'keywordHealth'];

const BANDS = [
  { min: 90, label: 'Excellent', description: 'Minimal issues' },
  { min: 75, label: 'Good', description: 'Some improvements available' },
  { min: 50, label: 'Fair', description: 'Noticeable gaps, actionable items' },
  { min: 0,  label: 'Poor', description: 'Critical issues blocking performance' }
];

function getBand(score) {
  return BANDS.find(b => score >= b.min);
}

function computeScore(findings, options = {}) {
  const { lite = false } = options;

  // In lite mode, only use the 4 lite categories and reweight them proportionally
  const activeKeys = lite ? LITE_KEYS : Object.keys(WEIGHTS);
  const activeWeightSum = activeKeys.reduce((sum, k) => sum + WEIGHTS[k], 0);

  const composite = activeKeys.reduce((sum, key) => {
    const categoryScore = findings[key]?.score ?? 0;
    const normalizedWeight = WEIGHTS[key] / activeWeightSum;
    return sum + categoryScore * normalizedWeight;
  }, 0);

  const rounded = Math.round(composite);

  const categories = Object.fromEntries(
    Object.keys(WEIGHTS).map(key => [key, {
      score: findings[key]?.score ?? 0,
      weight: WEIGHTS[key],
      contribution: Math.round((findings[key]?.score ?? 0) * WEIGHTS[key] * 10) / 10,
      included: activeKeys.includes(key)
    }])
  );

  return { composite: rounded, band: getBand(rounded), categories, liteMode: lite };
}

// CLI entry point
if (require.main === module) {
  const findingsPath = process.argv[2];
  const lite = process.argv.includes('--lite');
  if (!findingsPath) {
    console.error('Usage: node score.js <findings.json> [--lite]');
    process.exit(1);
  }
  const findings = JSON.parse(require('fs').readFileSync(findingsPath, 'utf8'));
  console.log(JSON.stringify(computeScore(findings, { lite }), null, 2));
}

module.exports = { computeScore, getBand, WEIGHTS, BANDS, LITE_KEYS };
```

- [ ] **Step 4: Run tests — verify pass**

```bash
cd /mnt/c/Users/tez/projects/web-audit && npm test -- tests/score.test.js
```

Expected: All 10 tests PASS.

- [ ] **Step 5: Commit**

```bash
cd /mnt/c/Users/tez/projects/web-audit && git add scripts/score.js tests/score.test.js && git commit -m "feat: add weighted scoring module with lite mode reweighting"
```

---

## Task 4: Report Templates

**Files:**
- Create: `web-audit/skills/site-audit/templates/report.html`
- Create: `web-audit/skills/site-audit/templates/report-pdf.html`
- Create: `web-audit/skills/site-audit/templates/dashboard.html`

- [ ] **Step 1: Write report.html (full interactive HTML)**

Create `web-audit/skills/site-audit/templates/report.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Site Audit — {{domain}}</title>
<style>
  :root { --indigo:#4f46e5; --green:#22c55e; --amber:#f59e0b; --red:#ef4444; --gray:#64748b; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: system-ui, -apple-system, sans-serif; background: #f8fafc; color: #1e293b; }
  .header { background: linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4f46e5 100%); color: #fff; padding: 32px 40px; }
  .header-top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; }
  .header-meta { font-size: 11px; text-transform: uppercase; letter-spacing: 3px; color: #a5b4fc; margin-bottom: 6px; }
  .header-domain { font-size: 24px; font-weight: 700; }
  .header-sub { font-size: 13px; color: #c7d2fe; margin-top: 4px; }
  .score-badge { background: rgba(255,255,255,0.12); border-radius: 12px; padding: 16px 24px; text-align: center; }
  .score-number { font-size: 56px; font-weight: 800; line-height: 1; }
  .score-label { font-size: 10px; color: #c7d2fe; text-transform: uppercase; letter-spacing: 1px; margin-top: 4px; }
  .category-row { display: grid; grid-template-columns: repeat(6,1fr); gap: 8px; }
  .cat-box { background: rgba(255,255,255,0.1); border-radius: 8px; padding: 10px 8px; text-align: center; }
  .cat-score { font-size: 20px; font-weight: 700; }
  .cat-label { font-size: 9px; color: #a5b4fc; margin-top: 3px; }
  .body { padding: 32px 40px; max-width: 900px; margin: 0 auto; }
  .section { margin-bottom: 32px; }
  .section-title { font-size: 11px; text-transform: uppercase; letter-spacing: 2px; color: var(--indigo); font-weight: 700; margin-bottom: 12px; }
  .summary-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .summary-box { border-radius: 0 8px 8px 0; padding: 14px 16px; }
  .summary-box.good { background: #f0fdf4; border-left: 3px solid var(--green); }
  .summary-box.bad { background: #fff7ed; border-left: 3px solid var(--amber); }
  .summary-box-title { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; font-weight: 700; margin-bottom: 8px; }
  .summary-box.good .summary-box-title { color: #16a34a; }
  .summary-box.bad .summary-box-title { color: #d97706; }
  .summary-box ul { padding-left: 16px; font-size: 13px; line-height: 1.8; }
  .action-item { display: flex; align-items: center; gap: 10px; padding: 10px 14px; border-radius: 6px; margin-bottom: 6px; font-size: 13px; }
  .action-item.critical { background: #fef2f2; border: 1px solid #fecaca; }
  .action-item.high { background: #fff7ed; border: 1px solid #fed7aa; }
  .action-item.quickwin { background: #f0fdf4; border: 1px solid #bbf7d0; }
  .badge { font-size: 9px; font-weight: 700; padding: 3px 8px; border-radius: 999px; white-space: nowrap; color: #fff; }
  .badge.critical { background: var(--red); }
  .badge.high { background: var(--amber); }
  .badge.quickwin { background: var(--green); }
  .score-color-excellent { color: var(--green); }
  .score-color-good { color: #84cc16; }
  .score-color-fair { color: var(--amber); }
  .score-color-poor { color: var(--red); }
  .footer { border-top: 1px solid #e5e7eb; padding: 16px 40px; display: flex; justify-content: space-between; font-size: 12px; color: var(--gray); }
  .upgrade-banner { background: linear-gradient(135deg, #f0f9ff, #e0f2fe); border: 1px solid #bae6fd; border-radius: 8px; padding: 16px 20px; text-align: center; font-size: 13px; color: #0369a1; margin-top: 24px; }
  .upgrade-banner strong { display: block; font-size: 15px; margin-bottom: 4px; }
</style>
</head>
<body>
<div class="header">
  <div class="header-top">
    <div>
      <div class="header-meta">Site Audit Report</div>
      <div class="header-domain">{{domain}}</div>
      <div class="header-sub">{{pagesCrawled}} pages crawled · {{crawledAt}}{{#liteMode}} · Lite Mode{{/liteMode}}</div>
    </div>
    <div class="score-badge">
      <div class="score-number">{{overallScore}}</div>
      <div class="score-label">{{band}} · Overall Score</div>
    </div>
  </div>
  <div class="category-row">
    <div class="cat-box"><div class="cat-score">{{technicalSeoScore}}</div><div class="cat-label">Tech SEO</div></div>
    <div class="cat-box"><div class="cat-score">{{onPageSeoScore}}</div><div class="cat-label">On-Page</div></div>
    <div class="cat-box"><div class="cat-score">{{performanceScore}}</div><div class="cat-label">Performance</div></div>
    <div class="cat-box"><div class="cat-score">{{keywordHealthScore}}</div><div class="cat-label">Keywords</div></div>
    <div class="cat-box"><div class="cat-score">{{designUxScore}}</div><div class="cat-label">Design</div></div>
    <div class="cat-box"><div class="cat-score">{{croScore}}</div><div class="cat-label">CRO</div></div>
  </div>
</div>
<div class="body">
  <div class="section">
    <div class="section-title">Executive Summary</div>
    <div class="summary-grid">
      <div class="summary-box good">
        <div class="summary-box-title">✓ What's Working</div>
        <ul>{{#working}}<li>{{.}}</li>{{/working}}</ul>
      </div>
      <div class="summary-box bad">
        <div class="summary-box-title">⚠ Needs Attention</div>
        <ul>{{#issues}}<li>{{.}}</li>{{/issues}}</ul>
      </div>
    </div>
  </div>
  <div class="section">
    <div class="section-title">Priority Action Plan</div>
    {{#actions}}
    <div class="action-item {{cssClass}}">
      <span class="badge {{cssClass}}">{{priority}}</span>
      <span>{{text}}</span>
    </div>
    {{/actions}}
  </div>
  {{#liteMode}}
  <div class="upgrade-banner">
    <strong>This is a Lite Audit ({{pagesCrawled}} pages)</strong>
    A Full Audit covers up to 50 pages, visual design scoring, keyword analysis, backlink data, and a live shareable report link.
  </div>
  {{/liteMode}}
</div>
<div class="footer">
  <span>Report {{#liteMode}}(Lite){{/liteMode}} · Generated {{crawledAt}} · Expires {{expiryDate}}</span>
  <span>{{#liveUrl}}<a href="{{liveUrl}}">View live report →</a>{{/liveUrl}}</span>
</div>
</body>
</html>
```

- [ ] **Step 2: Write report-pdf.html (print-optimized)**

Create `web-audit/skills/site-audit/templates/report-pdf.html`:

Same as `report.html` but with the following additional CSS inside `<style>`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Site Audit — {{domain}}</title>
<style>
  /* Same CSS as report.html, plus: */
  @page { size: A4; margin: 0; }
  body { font-family: system-ui, -apple-system, sans-serif; background: #fff; color: #1e293b; }
  :root { --indigo:#4f46e5; --green:#22c55e; --amber:#f59e0b; --red:#ef4444; --gray:#64748b; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  .header { background: linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4f46e5 100%); color: #fff; padding: 28px 36px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .header-top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; }
  .header-meta { font-size: 10px; text-transform: uppercase; letter-spacing: 3px; color: #a5b4fc; margin-bottom: 4px; }
  .header-domain { font-size: 22px; font-weight: 700; }
  .header-sub { font-size: 12px; color: #c7d2fe; margin-top: 4px; }
  .score-badge { background: rgba(255,255,255,0.12); border-radius: 10px; padding: 12px 20px; text-align: center; }
  .score-number { font-size: 48px; font-weight: 800; line-height: 1; }
  .score-label { font-size: 9px; color: #c7d2fe; text-transform: uppercase; letter-spacing: 1px; margin-top: 4px; }
  .category-row { display: grid; grid-template-columns: repeat(6,1fr); gap: 6px; }
  .cat-box { background: rgba(255,255,255,0.1); border-radius: 6px; padding: 8px; text-align: center; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .cat-score { font-size: 18px; font-weight: 700; }
  .cat-label { font-size: 8px; color: #a5b4fc; margin-top: 2px; }
  .body { padding: 24px 36px; }
  .section { margin-bottom: 24px; page-break-inside: avoid; }
  .section-title { font-size: 10px; text-transform: uppercase; letter-spacing: 2px; color: var(--indigo); font-weight: 700; margin-bottom: 10px; }
  .summary-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .summary-box { border-radius: 0 6px 6px 0; padding: 12px 14px; }
  .summary-box.good { background: #f0fdf4; border-left: 3px solid var(--green); -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .summary-box.bad { background: #fff7ed; border-left: 3px solid var(--amber); -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .summary-box-title { font-size: 9px; text-transform: uppercase; letter-spacing: 1px; font-weight: 700; margin-bottom: 6px; }
  .summary-box.good .summary-box-title { color: #16a34a; }
  .summary-box.bad .summary-box-title { color: #d97706; }
  .summary-box ul { padding-left: 14px; font-size: 11px; line-height: 1.7; }
  .action-item { display: flex; align-items: center; gap: 8px; padding: 8px 12px; border-radius: 4px; margin-bottom: 5px; font-size: 11px; }
  .action-item.critical { background: #fef2f2; border: 1px solid #fecaca; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .action-item.high { background: #fff7ed; border: 1px solid #fed7aa; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .action-item.quickwin { background: #f0fdf4; border: 1px solid #bbf7d0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .badge { font-size: 8px; font-weight: 700; padding: 2px 6px; border-radius: 999px; white-space: nowrap; color: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .badge.critical { background: var(--red); }
  .badge.high { background: var(--amber); }
  .badge.quickwin { background: var(--green); }
  .footer { border-top: 1px solid #e5e7eb; padding: 12px 36px; display: flex; justify-content: space-between; font-size: 10px; color: var(--gray); }
  .upgrade-banner { background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 6px; padding: 12px 16px; text-align: center; font-size: 11px; color: #0369a1; margin-top: 16px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .upgrade-banner strong { display: block; font-size: 13px; margin-bottom: 3px; }
</style>
</head>
<body>
<div class="header">
  <div class="header-top">
    <div>
      <div class="header-meta">Site Audit Report</div>
      <div class="header-domain">{{domain}}</div>
      <div class="header-sub">{{pagesCrawled}} pages crawled · {{crawledAt}}{{#liteMode}} · Lite Mode{{/liteMode}}</div>
    </div>
    <div class="score-badge">
      <div class="score-number">{{overallScore}}</div>
      <div class="score-label">{{band}} · Overall Score</div>
    </div>
  </div>
  <div class="category-row">
    <div class="cat-box"><div class="cat-score">{{technicalSeoScore}}</div><div class="cat-label">Tech SEO</div></div>
    <div class="cat-box"><div class="cat-score">{{onPageSeoScore}}</div><div class="cat-label">On-Page</div></div>
    <div class="cat-box"><div class="cat-score">{{performanceScore}}</div><div class="cat-label">Performance</div></div>
    <div class="cat-box"><div class="cat-score">{{keywordHealthScore}}</div><div class="cat-label">Keywords</div></div>
    <div class="cat-box"><div class="cat-score">{{designUxScore}}</div><div class="cat-label">Design</div></div>
    <div class="cat-box"><div class="cat-score">{{croScore}}</div><div class="cat-label">CRO</div></div>
  </div>
</div>
<div class="body">
  <div class="section">
    <div class="section-title">Executive Summary</div>
    <div class="summary-grid">
      <div class="summary-box good">
        <div class="summary-box-title">✓ What's Working</div>
        <ul>{{#working}}<li>{{.}}</li>{{/working}}</ul>
      </div>
      <div class="summary-box bad">
        <div class="summary-box-title">⚠ Needs Attention</div>
        <ul>{{#issues}}<li>{{.}}</li>{{/issues}}</ul>
      </div>
    </div>
  </div>
  <div class="section">
    <div class="section-title">Priority Action Plan</div>
    {{#actions}}
    <div class="action-item {{cssClass}}">
      <span class="badge {{cssClass}}">{{priority}}</span>
      <span>{{text}}</span>
    </div>
    {{/actions}}
  </div>
  {{#liteMode}}
  <div class="upgrade-banner">
    <strong>This is a Lite Audit ({{pagesCrawled}} pages)</strong>
    A Full Audit covers up to 50 pages, visual design scoring, keyword analysis, backlink data, and a live shareable report.
  </div>
  {{/liteMode}}
</div>
<div class="footer">
  <span>Site Audit Report · {{domain}} · {{crawledAt}}</span>
  <span>Expires {{expiryDate}} · Generated by web-audit</span>
</div>
</body>
</html>
```

- [ ] **Step 3: Write dashboard.html**

Create `web-audit/skills/site-audit/templates/dashboard.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Audit Dashboard — {{domain}}</title>
<style>
  :root { --indigo:#4f46e5; --green:#22c55e; --amber:#f59e0b; --red:#ef4444; }
  * { box-sizing:border-box; margin:0; padding:0; }
  body { font-family: system-ui, sans-serif; background:#0f1117; color:#e2e8f0; min-height:100vh; padding:32px; }
  h1 { font-size:14px; color:#a5b4fc; text-transform:uppercase; letter-spacing:3px; margin-bottom:4px; }
  .domain { font-size:28px; font-weight:800; margin-bottom:4px; }
  .sub { font-size:13px; color:#64748b; margin-bottom:32px; }
  .score-hero { font-size:96px; font-weight:900; color:var(--indigo); line-height:1; margin-bottom:8px; }
  .band { font-size:18px; color:#a5b4fc; margin-bottom:32px; }
  .cats { display:grid; grid-template-columns:repeat(3,1fr); gap:12px; margin-bottom:32px; }
  .cat { background:#1e2433; border-radius:10px; padding:16px; }
  .cat-name { font-size:11px; color:#64748b; text-transform:uppercase; letter-spacing:1px; margin-bottom:8px; }
  .cat-score { font-size:32px; font-weight:700; }
  .bar { height:4px; background:#334155; border-radius:999px; margin-top:8px; }
  .bar-fill { height:4px; border-radius:999px; }
  .actions { display:flex; flex-direction:column; gap:8px; }
  .act { display:flex; align-items:center; gap:10px; padding:12px 16px; border-radius:8px; font-size:13px; }
  .act.critical { background:#450a0a; border:1px solid #7f1d1d; }
  .act.high { background:#431407; border:1px solid #7c2d12; }
  .act.quickwin { background:#052e16; border:1px solid #14532d; }
  .badge { font-size:9px; font-weight:700; padding:3px 8px; border-radius:999px; color:#fff; white-space:nowrap; }
  .badge.critical { background:var(--red); }
  .badge.high { background:var(--amber); }
  .badge.quickwin { background:var(--green); }
  .footer { margin-top:32px; font-size:12px; color:#334155; }
</style>
</head>
<body>
<h1>Site Audit Dashboard</h1>
<div class="domain">{{domain}}</div>
<div class="sub">{{pagesCrawled}} pages · {{crawledAt}}</div>
<div class="score-hero">{{overallScore}}</div>
<div class="band">{{band}} — {{bandDesc}}</div>
<div class="cats">
  <div class="cat">
    <div class="cat-name">Technical SEO</div>
    <div class="cat-score" style="color:#38bdf8">{{technicalSeoScore}}</div>
    <div class="bar"><div class="bar-fill" style="width:{{technicalSeoScore}}%;background:#38bdf8"></div></div>
  </div>
  <div class="cat">
    <div class="cat-name">On-Page SEO</div>
    <div class="cat-score" style="color:#22c55e">{{onPageSeoScore}}</div>
    <div class="bar"><div class="bar-fill" style="width:{{onPageSeoScore}}%;background:#22c55e"></div></div>
  </div>
  <div class="cat">
    <div class="cat-name">Performance</div>
    <div class="cat-score" style="color:#fb923c">{{performanceScore}}</div>
    <div class="bar"><div class="bar-fill" style="width:{{performanceScore}}%;background:#fb923c"></div></div>
  </div>
  <div class="cat">
    <div class="cat-name">Keywords</div>
    <div class="cat-score" style="color:#a78bfa">{{keywordHealthScore}}</div>
    <div class="bar"><div class="bar-fill" style="width:{{keywordHealthScore}}%;background:#a78bfa"></div></div>
  </div>
  <div class="cat">
    <div class="cat-name">Design & UX</div>
    <div class="cat-score" style="color:#f472b6">{{designUxScore}}</div>
    <div class="bar"><div class="bar-fill" style="width:{{designUxScore}}%;background:#f472b6"></div></div>
  </div>
  <div class="cat">
    <div class="cat-name">CRO</div>
    <div class="cat-score" style="color:#34d399">{{croScore}}</div>
    <div class="bar"><div class="bar-fill" style="width:{{croScore}}%;background:#34d399"></div></div>
  </div>
</div>
<div class="actions">
  {{#actions}}
  <div class="act {{cssClass}}">
    <span class="badge {{cssClass}}">{{priority}}</span>
    <span>{{text}}</span>
  </div>
  {{/actions}}
</div>
<div class="footer">Expires {{expiryDate}} · web-audit</div>
</body>
</html>
```

- [ ] **Step 4: Commit**

```bash
cd /mnt/c/Users/tez/projects/web-audit && git add skills/site-audit/templates/ && git commit -m "feat: add HTML, PDF, and dashboard report templates"
```

---

## Task 5: Report Generator

**Files:**
- Create: `web-audit/scripts/generate-report.js`
- Create: `web-audit/tests/generate-report.test.js`

- [ ] **Step 1: Write failing tests**

Create `web-audit/tests/generate-report.test.js`:

```js
'use strict';
const { buildReportData } = require('../scripts/generate-report');

const mockAudit = {
  crawl: {
    startUrl: 'https://example.com',
    crawledAt: '2026-04-15T10:00:00.000Z',
    pages: Array(12).fill(null)
  },
  seoFindings: {
    working: ['Strong HTTPS', 'Good meta descriptions'],
    issues: ['Missing sitemap', 'Robots blocks /pricing'],
    actions: [
      { priority: 'CRITICAL', text: 'Generate XML sitemap' },
      { priority: 'QUICK WIN', text: 'Add alt text to 4 images' }
    ]
  },
  designFindings: {
    working: ['Clean typography'],
    issues: ['No CTA above fold'],
    actions: [{ priority: 'HIGH', text: 'Add hero CTA button' }]
  },
  score: {
    composite: 74,
    band: { label: 'Fair', description: 'Noticeable gaps, actionable items' },
    liteMode: false,
    categories: {
      technicalSeo: { score: 68 }, onPageSeo: { score: 82 },
      performance: { score: 71 }, keywordHealth: { score: 61 },
      designUx: { score: 85 }, cro: { score: 48 }
    }
  }
};

describe('buildReportData', () => {
  test('extracts domain from startUrl', () => {
    expect(buildReportData(mockAudit).domain).toBe('example.com');
  });

  test('counts pages crawled', () => {
    expect(buildReportData(mockAudit).pagesCrawled).toBe(12);
  });

  test('expiry is 14 days from now', () => {
    const data = buildReportData(mockAudit);
    const expiry = new Date(data.expiryDate);
    const expected = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    expect(Math.abs(expiry - expected)).toBeLessThan(86400000);
  });

  test('CRITICAL actions sort before HIGH before QUICK WIN', () => {
    const data = buildReportData(mockAudit);
    const priorities = data.actions.map(a => a.priority);
    const critIdx = priorities.indexOf('CRITICAL');
    const highIdx = priorities.indexOf('HIGH');
    const qwIdx = priorities.indexOf('QUICK WIN');
    expect(critIdx).toBeLessThan(highIdx);
    expect(highIdx).toBeLessThan(qwIdx);
  });

  test('actions have cssClass derived from priority', () => {
    const data = buildReportData(mockAudit);
    const critical = data.actions.find(a => a.priority === 'CRITICAL');
    const high = data.actions.find(a => a.priority === 'HIGH');
    const qw = data.actions.find(a => a.priority === 'QUICK WIN');
    expect(critical.cssClass).toBe('critical');
    expect(high.cssClass).toBe('high');
    expect(qw.cssClass).toBe('quickwin');
  });

  test('lite mode caps actions at 3', () => {
    const liteAudit = {
      ...mockAudit,
      score: { ...mockAudit.score, liteMode: true },
      seoFindings: {
        ...mockAudit.seoFindings,
        actions: [
          { priority: 'CRITICAL', text: 'A' },
          { priority: 'CRITICAL', text: 'B' },
          { priority: 'HIGH', text: 'C' },
          { priority: 'HIGH', text: 'D' }
        ]
      }
    };
    const data = buildReportData(liteAudit);
    expect(data.actions.length).toBeLessThanOrEqual(3);
  });

  test('passes composite score through', () => {
    expect(buildReportData(mockAudit).overallScore).toBe(74);
  });
});
```

- [ ] **Step 2: Run — verify failure**

```bash
cd /mnt/c/Users/tez/projects/web-audit && npm test -- tests/generate-report.test.js
```

Expected: `Cannot find module '../scripts/generate-report'`

- [ ] **Step 3: Write generate-report.js**

Create `web-audit/scripts/generate-report.js`:

```js
'use strict';

const fs = require('fs');
const path = require('path');

const TEMPLATES_DIR = path.join(__dirname, '../skills/site-audit/templates');
const PRIORITY_ORDER = { CRITICAL: 0, HIGH: 1, 'QUICK WIN': 2 };
const CSS_CLASS = { CRITICAL: 'critical', HIGH: 'high', 'QUICK WIN': 'quickwin' };

function buildReportData(auditResult) {
  const { crawl, seoFindings, designFindings, score } = auditResult;
  const { liteMode = false } = score;

  const allActions = [
    ...(seoFindings.actions || []),
    ...(designFindings.actions || [])
  ]
    .sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 3) - (PRIORITY_ORDER[b.priority] ?? 3))
    .map(a => ({ ...a, cssClass: CSS_CLASS[a.priority] ?? 'high' }));

  const actions = liteMode ? allActions.slice(0, 3) : allActions;

  const expiryDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
    .toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  return {
    domain: new URL(crawl.startUrl).hostname,
    crawledAt: new Date(crawl.crawledAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
    pagesCrawled: crawl.pages.length,
    overallScore: score.composite,
    band: score.band.label,
    bandDesc: score.band.description,
    liteMode,
    technicalSeoScore: score.categories.technicalSeo?.score ?? 0,
    onPageSeoScore: score.categories.onPageSeo?.score ?? 0,
    performanceScore: score.categories.performance?.score ?? 0,
    keywordHealthScore: score.categories.keywordHealth?.score ?? 0,
    designUxScore: score.categories.designUx?.score ?? 0,
    croScore: score.categories.cro?.score ?? 0,
    working: [...(seoFindings.working || []), ...(designFindings.working || [])].slice(0, 6),
    issues: [...(seoFindings.issues || []), ...(designFindings.issues || [])].slice(0, 6),
    actions,
    expiryDate,
    liveUrl: auditResult.liveUrl ?? null
  };
}

function renderTemplate(templateName, data) {
  let html = fs.readFileSync(path.join(TEMPLATES_DIR, templateName), 'utf8');

  // Handle {{#flag}}...{{/flag}} blocks
  html = html.replace(/\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (_, key, content) => {
    const val = data[key];
    if (!val || (Array.isArray(val) && val.length === 0)) return '';
    if (Array.isArray(val)) {
      return val.map(item => {
        if (typeof item === 'object') {
          return content.replace(/\{\{(\w+)\}\}/g, (m, k) => item[k] ?? '');
        }
        return content.replace(/\{\{\.?\}\}/g, item);
      }).join('');
    }
    return content;
  });

  // Replace remaining {{variable}} slots
  html = html.replace(/\{\{(\w+)\}\}/g, (_, key) => data[key] ?? '');
  return html;
}

async function generateHtml(auditResult, outputPath) {
  const data = buildReportData(auditResult);
  fs.writeFileSync(outputPath, renderTemplate('report.html', data));
  return outputPath;
}

async function generatePdf(auditResult, outputPath) {
  const puppeteer = require('puppeteer');
  const data = buildReportData(auditResult);
  const tmpHtml = outputPath.replace(/\.pdf$/, '-tmp.html');
  fs.writeFileSync(tmpHtml, renderTemplate('report-pdf.html', data));

  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
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

async function generateDashboard(auditResult, outputPath) {
  const data = buildReportData(auditResult);
  fs.writeFileSync(outputPath, renderTemplate('dashboard.html', data));
  return outputPath;
}

async function generateReport(auditResult, format, outputDir) {
  const domain = new URL(auditResult.crawl.startUrl).hostname.replace(/\./g, '-');
  const date = new Date().toISOString().split('T')[0];
  const base = path.join(outputDir, `audit-${domain}-${date}`);

  // --lite + dashboard falls back to html
  const effectiveFormat = (auditResult.score.liteMode && format === 'dashboard') ? 'html' : format;
  if (effectiveFormat !== format) {
    console.warn('Note: --lite mode does not support dashboard format. Generating HTML instead.');
  }

  switch (effectiveFormat) {
    case 'html': return generateHtml(auditResult, `${base}.html`);
    case 'dashboard': return generateDashboard(auditResult, `${base}-dashboard.html`);
    case 'pdf':
    default: return generatePdf(auditResult, `${base}.pdf`);
  }
}

module.exports = { generateReport, generateHtml, generatePdf, generateDashboard, buildReportData, renderTemplate };
```

- [ ] **Step 4: Run tests — verify pass**

```bash
cd /mnt/c/Users/tez/projects/web-audit && npm test -- tests/generate-report.test.js
```

Expected: All 6 tests PASS.

- [ ] **Step 5: Run full test suite**

```bash
cd /mnt/c/Users/tez/projects/web-audit && npm test
```

Expected: All tests across crawl, score, generate-report pass.

- [ ] **Step 6: Commit**

```bash
cd /mnt/c/Users/tez/projects/web-audit && git add scripts/generate-report.js tests/generate-report.test.js && git commit -m "feat: add report generator with PDF/HTML/dashboard output and lite mode fallback"
```

---

## Task 6: GitHub Actions TTL + Setup Script

**Files:**
- Create: `web-audit/skills/site-audit/github-actions/ttl-cleanup.yml`
- Create: `web-audit/scripts/setup-pages.sh`

- [ ] **Step 1: Write ttl-cleanup.yml**

Create `web-audit/skills/site-audit/github-actions/ttl-cleanup.yml`:

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
      - name: Delete audit branches older than 14 days
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          REPO="${{ github.repository }}"
          CUTOFF=$(date -d '14 days ago' +%s 2>/dev/null || date -v-14d +%s)
          
          echo "Scanning audit/* branches older than 14 days..."
          
          gh api "repos/$REPO/branches" --paginate --jq '.[].name' | grep '^audit/' | while read branch; do
            # Extract date from branch name: audit/<domain>-YYYY-MM-DD
            DATE_STR=$(echo "$branch" | grep -oE '[0-9]{4}-[0-9]{2}-[0-9]{2}$')
            
            if [ -z "$DATE_STR" ]; then
              echo "Skipping $branch — no date suffix found"
              continue
            fi
            
            BRANCH_TS=$(date -d "$DATE_STR" +%s 2>/dev/null || date -j -f "%Y-%m-%d" "$DATE_STR" +%s)
            
            if [ "$BRANCH_TS" -lt "$CUTOFF" ]; then
              echo "Deleting expired branch: $branch (created $DATE_STR)"
              gh api -X DELETE "repos/$REPO/git/refs/heads/$branch"
            else
              echo "Keeping $branch (not yet expired)"
            fi
          done
          
          echo "Cleanup complete."
```

- [ ] **Step 2: Write setup-pages.sh**

Create `web-audit/scripts/setup-pages.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

CONFIG_DIR="$HOME/.web-audit"
CONFIG_FILE="$CONFIG_DIR/config.json"
ACTIONS_SRC="$(dirname "$0")/../skills/site-audit/github-actions/ttl-cleanup.yml"

# Check gh CLI is authenticated
if ! gh auth status &>/dev/null; then
  echo "ERROR: gh CLI not authenticated. Run: gh auth login"
  exit 1
fi

GH_USER=$(gh api user --jq '.login')
REPO_NAME="web-audits"
FULL_REPO="$GH_USER/$REPO_NAME"

echo "Setting up GitHub Pages repo: $FULL_REPO"

# Create repo if it doesn't exist
if ! gh repo view "$FULL_REPO" &>/dev/null; then
  echo "Creating repo $FULL_REPO..."
  gh repo create "$REPO_NAME" --public --description "Web audit reports (auto-expiring)" --confirm 2>/dev/null \
    || gh repo create "$REPO_NAME" --public --description "Web audit reports (auto-expiring)"
  
  # Create an initial commit so Pages can be enabled
  TMPDIR_SETUP=$(mktemp -d)
  cd "$TMPDIR_SETUP"
  git init
  git remote add origin "https://github.com/$FULL_REPO.git"
  echo "# Web Audit Reports" > README.md
  git add README.md
  git commit -m "chore: init web-audits repo"
  git branch -M main
  git push -u origin main
  cd - > /dev/null
  rm -rf "$TMPDIR_SETUP"
else
  echo "Repo $FULL_REPO already exists — skipping creation."
fi

# Enable GitHub Pages on main branch / root
echo "Enabling GitHub Pages..."
gh api -X PUT "repos/$FULL_REPO/pages" \
  --field source[branch]=main \
  --field source[path]=/ 2>/dev/null || echo "Pages may already be enabled — continuing."

# Install TTL cleanup workflow
echo "Installing TTL cleanup workflow..."
TMPDIR_WF=$(mktemp -d)
cd "$TMPDIR_WF"
git clone --depth 1 "https://github.com/$FULL_REPO.git" .
mkdir -p .github/workflows
cp "$ACTIONS_SRC" .github/workflows/ttl-cleanup.yml
git add .github/workflows/ttl-cleanup.yml
git diff --staged --quiet || git commit -m "chore: install 14-day audit TTL cleanup workflow"
git push origin main
cd - > /dev/null
rm -rf "$TMPDIR_WF"

# Write config
mkdir -p "$CONFIG_DIR"
cat > "$CONFIG_FILE" <<EOF
{
  "githubUser": "$GH_USER",
  "repo": "$REPO_NAME",
  "fullRepo": "$FULL_REPO",
  "pagesBase": "https://$GH_USER.github.io/$REPO_NAME",
  "setupAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF

echo ""
echo "✓ Setup complete!"
echo "  Repo:  https://github.com/$FULL_REPO"
echo "  Pages: https://$GH_USER.github.io/$REPO_NAME"
echo "  Config saved to: $CONFIG_FILE"
```

- [ ] **Step 3: Make setup-pages.sh executable**

```bash
chmod +x /mnt/c/Users/tez/projects/web-audit/scripts/setup-pages.sh
```

- [ ] **Step 4: Commit**

```bash
cd /mnt/c/Users/tez/projects/web-audit && git add skills/site-audit/github-actions/ttl-cleanup.yml scripts/setup-pages.sh && git commit -m "feat: add GitHub Actions 14-day TTL cleanup and Pages setup script"
```

---

## Task 7: References — Scoring Weights + Checklist

**Files:**
- Create: `web-audit/skills/site-audit/references/scoring-weights.md`
- Create: `web-audit/skills/site-audit/references/checklist.md`

- [ ] **Step 1: Write scoring-weights.md**

Create `web-audit/skills/site-audit/references/scoring-weights.md`:

```markdown
# Scoring Weights & Rubrics

## Category Weights

| Category | Weight | Agent Source |
|---|---|---|
| Technical SEO | 25% | seo-analyzer |
| On-Page SEO | 20% | seo-analyzer |
| Performance | 20% | design-analyzer |
| Keyword Health | 15% | seo-analyzer |
| Design & UX | 10% | design-analyzer |
| Conversion (CRO) | 10% | design-analyzer |

**Lite mode** (--lite): Only Technical SEO, On-Page SEO, Performance, and Keyword Health are scored. Weights are renormalized proportionally across those four categories.

## Composite Formula

```
Score = (TechSEO × 0.25) + (OnPage × 0.20) + (Performance × 0.20)
      + (Keywords × 0.15) + (Design × 0.10) + (CRO × 0.10)
```

## Score Bands

| Range | Label | Report Color |
|---|---|---|
| 90–100 | Excellent | Green (#22c55e) |
| 75–89 | Good | Light green (#84cc16) |
| 50–74 | Fair | Amber (#f59e0b) |
| 0–49 | Poor | Red (#ef4444) |

## Per-Category Rubrics

### Technical SEO (0–100)
- Sitemap exists and is valid: +20
- robots.txt present and no important pages blocked: +20
- HTTPS throughout: +15
- No noindex on important pages: +15
- Canonical tags present and self-referencing: +10
- No broken internal links (4xx): +10
- Response times < 2s average: +10

### On-Page SEO (0–100)
- Unique title tag on every page: +20
- All titles 50–60 chars with keyword: +15
- Unique meta description on every page: +15
- Single H1 per page containing keyword: +20
- Logical heading hierarchy (H1→H2→H3): +15
- Alt text on all images: +15

### Performance (0–100)
Score is derived directly from Google PageSpeed Insights mobile score for the homepage (0–100). If PageSpeed API is unavailable, estimate from response times: < 1s avg = 80, 1–2s = 60, 2–3s = 40, > 3s = 20.

### Keyword Health (0–100)
- Primary keyword in title, H1, and URL: +30
- No keyword cannibalization across pages: +25
- Target keywords in first 100 words: +20
- Related/semantic keywords used naturally: +15
- No keyword stuffing detected: +10
*(Requires DataForSEO for volume data. Without it, score structural keyword usage only.)*

### Design & UX (0–100)
- Clear visual hierarchy on homepage screenshot: +20
- Readable typography (font size ≥ 16px body): +15
- Sufficient whitespace and layout balance: +15
- Trust signals visible (testimonials/logos/certs): +20
- Accessible color contrast (≥ 4.5:1 main text): +15
- No horizontal scroll on mobile viewport: +15

### Conversion / CRO (0–100)
- Primary CTA visible above the fold: +25
- CTA has clear, specific copy (not just "Click here"): +20
- Social proof present on homepage: +20
- Value proposition clear within 5 seconds: +20
- Contact info visible in header or footer: +15
```

- [ ] **Step 2: Write checklist.md (fallback for when marketing-skills not installed)**

Create `web-audit/skills/site-audit/references/checklist.md`:

```markdown
# Site Audit Checklist

Fallback checklist used when marketing-skills plugin is not installed.
When marketing-skills IS installed, seo-analyzer reads those skill files directly.

## Technical SEO

### Crawlability
- [ ] robots.txt exists at /robots.txt
- [ ] robots.txt does not block important pages (/pricing, /features, /blog, /)
- [ ] XML sitemap exists (check /sitemap.xml and /sitemap_index.xml)
- [ ] Sitemap referenced in robots.txt
- [ ] Site is accessible (no 5xx errors on homepage)

### Indexation
- [ ] Homepage returns 200 status
- [ ] No <meta name="robots" content="noindex"> on important pages
- [ ] Canonical tags present on all pages
- [ ] Self-referencing canonicals on unique pages
- [ ] HTTP → HTTPS redirect in place

### Security
- [ ] HTTPS valid SSL certificate
- [ ] No mixed content warnings
- [ ] HTTP redirects to HTTPS (301)

### Site Architecture
- [ ] Important pages reachable within 3 clicks of homepage
- [ ] No orphan pages (pages with zero internal links pointing to them)
- [ ] URL structure: lowercase, hyphen-separated, no parameters
- [ ] Consistent trailing slash usage

## On-Page SEO

### Per Page
- [ ] Unique title tag (not duplicated across pages)
- [ ] Title is 50–60 characters
- [ ] Primary keyword appears near start of title
- [ ] Unique meta description (not duplicated)
- [ ] Meta description is 150–160 characters
- [ ] One H1 per page
- [ ] H1 contains primary keyword
- [ ] Logical heading hierarchy (H1 → H2 → H3, no skipping)
- [ ] Primary keyword in first 100 words of body content
- [ ] All images have alt text

### Internal Linking
- [ ] Important pages have inbound internal links
- [ ] Anchor text is descriptive (not "click here")
- [ ] No broken internal links

## Performance

### Core Web Vitals (via PageSpeed Insights)
- [ ] LCP (Largest Contentful Paint) < 2.5s
- [ ] INP (Interaction to Next Paint) < 200ms
- [ ] CLS (Cumulative Layout Shift) < 0.1

### Speed
- [ ] Average page response time < 2s
- [ ] Images compressed and in modern formats (WebP preferred)
- [ ] Homepage loads without render-blocking resources

### Mobile
- [ ] Viewport meta tag present
- [ ] No horizontal scroll on 375px viewport
- [ ] Tap targets ≥ 44px

## Keyword Health

- [ ] Each page has a clear primary keyword target
- [ ] No two pages target the same primary keyword (cannibalization)
- [ ] Keywords appear in: title, H1, URL, first 100 words
- [ ] Related/LSI keywords used naturally in content
- [ ] No keyword stuffing (keyword density < 3%)

## Design & UX

### Visual
- [ ] Clear visual hierarchy — eye moves naturally to primary message
- [ ] Font size ≥ 16px for body text
- [ ] Adequate line-height (≥ 1.5)
- [ ] Sufficient whitespace — not cramped
- [ ] Consistent color palette

### Accessibility
- [ ] Main text color contrast ratio ≥ 4.5:1
- [ ] All images have descriptive alt text
- [ ] Links distinguishable from body text

### Trust
- [ ] Testimonials or social proof visible on homepage
- [ ] Logo/brand marks of clients or partners visible
- [ ] Contact information accessible in header or footer
- [ ] Privacy policy and terms links present

## Conversion / CRO

- [ ] Primary CTA visible above the fold (no scroll required)
- [ ] CTA copy is specific and benefit-driven
- [ ] Social proof (review count, testimonials) near CTA
- [ ] Value proposition clear within 5 seconds of landing
- [ ] Hero section explains what the site/product does
- [ ] Forms are minimal (only necessary fields)
- [ ] Contact info visible without searching
```

- [ ] **Step 3: Commit**

```bash
cd /mnt/c/Users/tez/projects/web-audit && git add skills/site-audit/references/ && git commit -m "feat: add scoring rubrics and audit checklist references"
```

---

## Task 8: Agent Skill Files

**Files:**
- Create: `web-audit/skills/site-audit/agents/crawler.md`
- Create: `web-audit/skills/site-audit/agents/seo-analyzer.md`
- Create: `web-audit/skills/site-audit/agents/design-analyzer.md`
- Create: `web-audit/skills/site-audit/agents/scorer.md`
- Create: `web-audit/skills/site-audit/agents/publisher.md`

- [ ] **Step 1: Write crawler.md**

Create `web-audit/skills/site-audit/agents/crawler.md`:

```markdown
# Crawler Agent

Runs the Node.js crawler and returns the URL map JSON to the orchestrator.

## Steps

1. Verify Node.js ≥ 18 is available: `node --version`
   - If missing: tell the user to install Node.js 18+ and stop.

2. Verify dependencies installed in plugin root:
   ```bash
   ls <PLUGIN_ROOT>/node_modules/jsdom 2>/dev/null || (cd <PLUGIN_ROOT> && npm install)
   ```

3. Run the crawler:
   ```bash
   node <PLUGIN_ROOT>/scripts/crawl.js <URL> --pages <MAX_PAGES> --depth <MAX_DEPTH> [--lite] > /tmp/web-audit-crawl.json
   ```
   - Replace `<URL>`, `<MAX_PAGES>`, `<MAX_DEPTH>` with values from the orchestrator.
   - Omit `--depth` flag if no depth limit was specified.
   - Include `--lite` if `--lite` mode is active.

4. Verify the output:
   ```bash
   node -e "const r = require('/tmp/web-audit-crawl.json'); console.log('Pages crawled:', r.pages.length, '| Sitemap:', r.sitemap.exists, '| Robots:', r.robots.exists)"
   ```

5. Report back to orchestrator:
   - Page count
   - Whether sitemap was found
   - Whether robots.txt was found
   - Any disallowed paths in robots.txt
   - Output file path: `/tmp/web-audit-crawl.json`

## Error Handling

- If crawl returns 0 pages: report "URL unreachable or returned no content" and stop.
- If node crashes with ENOTFOUND: DNS resolution failed — check URL spelling.
- If output file is empty: re-run once. If still empty, report failure.
```

- [ ] **Step 2: Write seo-analyzer.md**

Create `web-audit/skills/site-audit/agents/seo-analyzer.md`:

```markdown
# SEO Analyzer Agent

Analyzes the crawl output for SEO issues. Runs in parallel with design-analyzer.

## Input
- Crawl JSON at `/tmp/web-audit-crawl.json`
- Flags: `--lite` (skip keyword health), DataForSEO env vars (optional)

## Skill Frameworks to Apply

Check if marketing-skills is installed:
```bash
ls ~/.claude/plugins/cache/marketingskills/marketing-skills/*/skills/seo-audit/SKILL.md 2>/dev/null | head -1
```

**If found:** Read that SKILL.md and site-architecture/SKILL.md and ai-seo/SKILL.md.
Apply their full checklists against the crawl data.

**If not found:** Use `references/checklist.md` in this plugin as the evaluation framework.

## Analysis Steps

### 1. Technical SEO (weight: 25%)

Read `/tmp/web-audit-crawl.json` and evaluate:

```js
// Run this in Node.js to extract technical signals:
const data = require('/tmp/web-audit-crawl.json');

const signals = {
  sitemapExists: data.sitemap.exists,
  robotsExists: data.robots.exists,
  disallowedPaths: data.robots.disallowed,
  httpsPages: data.pages.filter(p => p.url.startsWith('https://')).length,
  totalPages: data.pages.length,
  noindexPages: data.pages.filter(p => p.robotsMeta?.includes('noindex')).length,
  missingCanonicals: data.pages.filter(p => !p.canonical).length,
  brokenLinks: data.pages.filter(p => p.statusCode >= 400).length,
  avgResponseTime: data.pages.reduce((s,p) => s + p.responseTime, 0) / data.pages.length
};
console.log(JSON.stringify(signals, null, 2));
```

Score 0–100 using the rubric in `references/scoring-weights.md` → Technical SEO section.

### 2. On-Page SEO (weight: 20%)

Evaluate per-page signals from crawl data:

```js
const data = require('/tmp/web-audit-crawl.json');
const onPage = data.pages.map(p => ({
  url: p.url,
  hasTitle: !!p.title,
  titleLength: p.title?.length ?? 0,
  hasMetaDesc: !!p.metaDesc,
  metaDescLength: p.metaDesc?.length ?? 0,
  h1Count: p.h1s?.length ?? 0,
  missingAltCount: p.imgsMissingAlt ?? 0
}));

const issues = {
  missingTitles: onPage.filter(p => !p.hasTitle).length,
  longTitles: onPage.filter(p => p.titleLength > 60).length,
  shortTitles: onPage.filter(p => p.hasTitle && p.titleLength < 30).length,
  missingMeta: onPage.filter(p => !p.hasMetaDesc).length,
  multipleH1: onPage.filter(p => p.h1Count > 1).length,
  noH1: onPage.filter(p => p.h1Count === 0).length,
  missingAltTotal: onPage.reduce((s,p) => s + p.missingAltCount, 0)
};
console.log(JSON.stringify(issues, null, 2));
```

Score 0–100 using the On-Page SEO rubric.

### 3. Keyword Health (weight: 15%) — Skip in --lite mode

**With DataForSEO** (`DATAFORSEO_LOGIN` + `DATAFORSEO_PASSWORD` env vars set):
```bash
node <PLUGIN_ROOT>/scripts/../tools/dataforseo-keywords.js <DOMAIN> 2>/dev/null || echo "DataForSEO unavailable"
```

**Without DataForSEO:** Score keyword structural usage only (keyword in title/H1/URL) — do not call external APIs. Note in findings: "Full keyword volume data requires DataForSEO credentials."

### 4. Build Findings JSON

Output findings to `/tmp/web-audit-seo-findings.json`:

```json
{
  "technicalSeo": {
    "score": <0-100>,
    "working": ["<positive finding>", ...],
    "issues": ["<issue description>", ...],
    "actions": [
      { "priority": "CRITICAL|HIGH|QUICK WIN", "text": "<specific actionable fix>" }
    ]
  },
  "onPageSeo": { "score": <0-100>, "working": [...], "issues": [...], "actions": [...] },
  "keywordHealth": { "score": <0-100>, "working": [...], "issues": [...], "actions": [...] }
}
```

Write this file and report "SEO analysis complete" to orchestrator with scores summary.

## Scoring Guidance

- Be specific in findings: "3 pages have duplicate title tags" not "title tags need work"
- Actions must be actionable: "Add meta description to /pricing, /features, /about" not "add meta descriptions"
- Priority CRITICAL = blocking indexation or causing ranking loss
- Priority HIGH = significant impact on rankings or user experience
- Priority QUICK WIN = easy fix, immediate benefit, < 1 hour to implement
```

- [ ] **Step 3: Write design-analyzer.md**

Create `web-audit/skills/site-audit/agents/design-analyzer.md`:

```markdown
# Design Analyzer Agent

Analyzes visual design, UX, and conversion signals. Runs in parallel with seo-analyzer.
Skipped entirely in --lite mode.

## Input
- Crawl JSON at `/tmp/web-audit-crawl.json`
- Target URL (homepage)

## Step 1: Check Playwright Availability

```bash
npx playwright --version 2>/dev/null || echo "PLAYWRIGHT_MISSING"
```

If `PLAYWRIGHT_MISSING`: skip all screenshot analysis. Score design/UX and CRO from DOM data only. Note in findings: "Visual analysis unavailable — install Playwright for screenshot-based scoring."

## Step 2: Core Web Vitals (PageSpeed Insights)

```bash
DOMAIN=$(node -e "const d=require('/tmp/web-audit-crawl.json'); console.log(d.startUrl)")
curl -s "https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${DOMAIN}&strategy=mobile${PAGESPEED_API_KEY:+&key=$PAGESPEED_API_KEY}" \
  | node -e "
    const data = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
    const cat = data.lighthouseResult?.categories?.performance;
    const audits = data.lighthouseResult?.audits;
    console.log(JSON.stringify({
      performanceScore: Math.round((cat?.score ?? 0) * 100),
      lcp: audits?.['largest-contentful-paint']?.displayValue,
      cls: audits?.['cumulative-layout-shift']?.displayValue,
      inp: audits?.['interaction-to-next-paint']?.displayValue,
      fcp: audits?.['first-contentful-paint']?.displayValue
    }));
  " > /tmp/web-audit-pagespeed.json 2>/dev/null || echo '{"performanceScore":0,"error":"PageSpeed API unavailable"}' > /tmp/web-audit-pagespeed.json
```

If `performanceScore` is 0 and error is set: estimate from crawl response times using scoring-weights.md guidance.

## Step 3: Screenshot Analysis (if Playwright available)

Take desktop and mobile screenshots of the homepage:

```bash
HOMEPAGE=$(node -e "const d=require('/tmp/web-audit-crawl.json'); console.log(d.startUrl)")

npx playwright screenshot "$HOMEPAGE" /tmp/web-audit-screenshot-desktop.png --viewport-size="1280,800" 2>/dev/null
npx playwright screenshot "$HOMEPAGE" /tmp/web-audit-screenshot-mobile.png --viewport-size="375,812" 2>/dev/null
```

Analyze the screenshots for:

**Visual Hierarchy**
- Is there a clear focal point? (hero image, headline, CTA)
- Does the eye naturally move from headline → subhead → CTA?
- Is the most important content prominent vs buried?

**Typography**
- Is body text readable? (estimate font size from screenshot proportions — flag if appears < 14px)
- Is line height adequate? (text should not feel cramped)
- Is there good contrast between text and background?

**Layout**
- Is there adequate whitespace around elements?
- Does the layout feel balanced?
- Is anything visually broken or misaligned?

**Trust Signals**
- Are testimonials, client logos, or certifications visible above the fold?
- Is a phone number or contact info visible in the header?

## Step 4: DOM-Based CRO Analysis

```js
// Run against homepage HTML from crawl data
const data = require('/tmp/web-audit-crawl.json');
const homepage = data.pages.find(p => p.url === data.startUrl || p.depth === 0);

// Check for CTA signals in the HTML
const html = homepage?.html ?? '';
const hasCTA = /<button|<a[^>]+(?:btn|button|cta|get-started|sign-up|try|demo)/i.test(html);
const hasForm = /<form/i.test(html);
const hasSocialProof = /testimonial|review|rating|stars|customers|trusted|clients/i.test(html);
const hasPhone = /\+?[\d\s\-\(\)]{10,}/.test(html);
const hasValueProp = /<h1/i.test(html); // H1 presence as proxy for value prop

console.log(JSON.stringify({ hasCTA, hasForm, hasSocialProof, hasPhone, hasValueProp }));
```

## Step 5: Score Each Category

Using rubrics in `references/scoring-weights.md`:
- **Performance score**: use PageSpeed score directly (0–100)
- **Design & UX score**: score from screenshot analysis + DOM checks
- **CRO score**: score from DOM CTA/social proof/form analysis

## Step 6: Output Findings

Write `/tmp/web-audit-design-findings.json`:

```json
{
  "performance": {
    "score": <PageSpeed score or estimate>,
    "lcp": "<value>",
    "cls": "<value>",
    "inp": "<value>",
    "working": [...],
    "issues": [...],
    "actions": [{ "priority": "CRITICAL|HIGH|QUICK WIN", "text": "..." }]
  },
  "designUx": {
    "score": <0-100>,
    "screenshotsAvailable": true|false,
    "working": [...],
    "issues": [...],
    "actions": [...]
  },
  "cro": {
    "score": <0-100>,
    "working": [...],
    "issues": [...],
    "actions": [...]
  }
}
```

Report "Design analysis complete" to orchestrator with scores summary.
```

- [ ] **Step 4: Write scorer.md**

Create `web-audit/skills/site-audit/agents/scorer.md`:

```markdown
# Scorer Agent

Merges SEO and Design findings, runs score.js, outputs final score object.

## Steps

1. Verify both findings files exist:
   ```bash
   ls /tmp/web-audit-seo-findings.json /tmp/web-audit-design-findings.json
   ```
   If either is missing, report which agent failed and stop.

2. Merge findings into a single object:
   ```bash
   node -e "
     const seo = require('/tmp/web-audit-seo-findings.json');
     const design = require('/tmp/web-audit-design-findings.json');
     const merged = {
       technicalSeo: seo.technicalSeo,
       onPageSeo: seo.onPageSeo,
       keywordHealth: seo.keywordHealth,
       performance: design.performance,
       designUx: design.designUx,
       cro: design.cro
     };
     require('fs').writeFileSync('/tmp/web-audit-findings.json', JSON.stringify(merged, null, 2));
     console.log('Merged findings written.');
   "
   ```

3. Run the scorer:
   ```bash
   node <PLUGIN_ROOT>/scripts/score.js /tmp/web-audit-findings.json [--lite] > /tmp/web-audit-score.json
   ```
   Include `--lite` flag if lite mode is active.

4. Print score summary:
   ```bash
   node -e "
     const s = require('/tmp/web-audit-score.json');
     console.log('Overall:', s.composite, '(' + s.band.label + ')');
     Object.entries(s.categories).forEach(([k,v]) => console.log(' ', k + ':', v.score));
   "
   ```

5. Report back: composite score, band, all category scores.
```

- [ ] **Step 5: Write publisher.md**

Create `web-audit/skills/site-audit/agents/publisher.md`:

```markdown
# Publisher Agent

Deploys the report to GitHub Pages and optionally emails it.
Skipped in --lite mode (email still runs if --email was passed).

## Input
- Report file path (from orchestrator)
- `--email <address>` (optional)
- `--lite` flag (skips GitHub Pages deploy, email still works)
- Config at `~/.web-audit/config.json`

## Step 1: Check Setup (full mode only — skip if --lite)

```bash
cat ~/.web-audit/config.json 2>/dev/null || echo "NOT_CONFIGURED"
```

If `NOT_CONFIGURED`:
```bash
bash <PLUGIN_ROOT>/scripts/setup-pages.sh
```
Then re-read config.

## Step 2: Deploy to GitHub Pages (full mode only)

```bash
CONFIG=$(cat ~/.web-audit/config.json)
GH_USER=$(echo $CONFIG | node -e "process.stdin.resume();let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).githubUser))")
PAGES_BASE=$(echo $CONFIG | node -e "process.stdin.resume();let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).pagesBase))")
REPO=$(echo $CONFIG | node -e "process.stdin.resume();let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).fullRepo))")

DOMAIN=$(node -e "const d=require('/tmp/web-audit-crawl.json'); console.log(new URL(d.startUrl).hostname.replace(/\./g,'-'))")
DATE=$(date +%Y-%m-%d)
BRANCH="audit/${DOMAIN}-${DATE}"
REPORT_FILE=<REPORT_FILE_PATH>
LIVE_URL="${PAGES_BASE}/${BRANCH}/index.html"

# Clone repo, create branch, commit report, push
TMPDIR_DEPLOY=$(mktemp -d)
git clone --depth 1 "https://github.com/${REPO}.git" "$TMPDIR_DEPLOY"
cd "$TMPDIR_DEPLOY"
git checkout -b "$BRANCH"
mkdir -p "${BRANCH}"
cp "$REPORT_FILE" "${BRANCH}/index.html"
git add "${BRANCH}/index.html"
git commit -m "audit: ${DOMAIN} ${DATE}"
git push origin "$BRANCH"
cd -
rm -rf "$TMPDIR_DEPLOY"

echo "Deployed to: $LIVE_URL"
echo "Live in ~60 seconds (GitHub Pages build time)"
echo "Expires: $(date -d '14 days' '+%B %d, %Y' 2>/dev/null || date -v+14d '+%B %d, %Y')"
```

If push fails: save report locally, print path, tell user GitHub Pages deploy failed and suggest running `bash scripts/setup-pages.sh`.

## Step 3: Send Email (if --email provided)

Use Gmail MCP to send:
- **To**: `<email address>`
- **Subject**: `Site Audit — <domain> (Score: <composite>/100)`
- **Body**:
  ```
  Hi,

  Your site audit for <domain> is ready.

  Overall Score: <composite>/100 (<band>)

  Top Issues:
  <list top 3 CRITICAL/HIGH actions>

  <if full mode>
  View your full report here (live for 14 days):
  <LIVE_URL>
  <endif>

  <if lite mode>
  This is a Lite Audit (10 pages). A Full Audit covers up to 50 pages,
  visual design scoring, keyword analysis, backlink data, and a shareable
  live report link.
  Reply to this email to request a Full Audit.
  <endif>

  Report generated: <date>
  ```
- **Attachment**: attach `<REPORT_FILE>` if format is pdf

If Gmail MCP is not authenticated:
- Print the live URL to terminal
- Print: "Email not sent — Gmail MCP not authenticated. Run: /gmail authenticate"

## Step 4: Final Output

Print to terminal:
```
✓ Audit complete for <domain>
  Score: <composite>/100 (<band>)
  Report: <local file path>
  <if full mode>Live URL: <LIVE_URL> (expires <date>)<endif>
  <if email>Email sent to: <address><endif>
```
```

- [ ] **Step 6: Commit all agent files**

```bash
cd /mnt/c/Users/tez/projects/web-audit && git add skills/site-audit/agents/ && git commit -m "feat: add all five agent skill files (crawler, seo-analyzer, design-analyzer, scorer, publisher)"
```

---

## Task 9: SKILL.md Orchestrator

**Files:**
- Create: `web-audit/skills/site-audit/SKILL.md`

- [ ] **Step 1: Write SKILL.md**

Create `web-audit/skills/site-audit/SKILL.md`:

```markdown
---
name: site-audit
description: When the user wants to audit a website for SEO, design, performance, or conversion issues. Triggered by "/site-audit <url>" or any variation. Accepts --format, --pages, --depth, --lite, --email flags.
metadata:
  version: 1.0.0
---

# Site Audit

You are an expert site auditor. When invoked, run a full automated audit of the provided URL using the pipeline below.

## Setup

Locate the plugin root directory:
```bash
PLUGIN_ROOT=$(ls -d ~/.claude/plugins/cache/*/web-audit/*/skills/site-audit/../.. 2>/dev/null | head -1)
# Fallback if above fails:
[ -z "$PLUGIN_ROOT" ] && PLUGIN_ROOT="/mnt/c/Users/tez/projects/web-audit"
echo "Plugin root: $PLUGIN_ROOT"
```

## Parse Parameters

Extract from the invocation arguments:
- `URL` — required. First positional argument. If missing, ask: "Please provide a URL to audit."
- `FORMAT` — `--format pdf|html|dashboard`. Default: `pdf`
- `MAX_PAGES` — `--pages N`. Default: `50`
- `MAX_DEPTH` — `--depth N`. Default: none (unlimited)
- `LITE` — `--lite` flag. Default: false
- `EMAIL` — `--email address`. Default: none

**Validation:**
- URL must start with `http://` or `https://`. If not, prepend `https://`.
- If `--lite` + `--format dashboard`: set FORMAT to `html`, print: "Note: --lite mode does not support dashboard. Using HTML format."

Print parsed parameters:
```
Starting audit of: <URL>
Format: <FORMAT> | Pages: <MAX_PAGES> | Depth: <MAX_DEPTH or 'unlimited'> | Lite: <yes/no>
```

## Stage 1: Crawl

Read and follow: `agents/crawler.md`

Pass: URL, MAX_PAGES, MAX_DEPTH, LITE flag.

Output: `/tmp/web-audit-crawl.json`

If crawl returns 0 pages: stop with error "Could not reach <URL>. Check the URL and try again."

## Stage 2: Parallel Analysis

**If LITE mode:** Run SEO analyzer only (skip design analyzer entirely).

**If full mode:** Dispatch SEO and Design analyzers in parallel using the dispatching-parallel-agents skill pattern.

### SEO Analyzer
Read and follow: `agents/seo-analyzer.md`
Pass: crawl JSON path, LITE flag, DataForSEO env vars if set.
Output: `/tmp/web-audit-seo-findings.json`

### Design Analyzer (full mode only)
Read and follow: `agents/design-analyzer.md`
Pass: crawl JSON path, homepage URL.
Output: `/tmp/web-audit-design-findings.json`

**If LITE mode:** Write a stub design findings file with zeroed scores:
```bash
echo '{"performance":{"score":0,"working":[],"issues":["Performance analysis requires full mode"],"actions":[]},"designUx":{"score":0,"working":[],"issues":[],"actions":[]},"cro":{"score":0,"working":[],"issues":[],"actions":[]}}' > /tmp/web-audit-design-findings.json
```
Then fetch PageSpeed for performance score only (it's included in lite):
```bash
HOMEPAGE=$(node -e "const d=require('/tmp/web-audit-crawl.json'); console.log(d.startUrl)")
curl -s "https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${HOMEPAGE}&strategy=mobile" \
  | node -e "
    const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
    const score=Math.round((d.lighthouseResult?.categories?.performance?.score??0)*100);
    const existing=require('/tmp/web-audit-design-findings.json');
    existing.performance.score=score;
    require('fs').writeFileSync('/tmp/web-audit-design-findings.json',JSON.stringify(existing,null,2));
    console.log('Performance score:', score);
  " 2>/dev/null || echo "PageSpeed unavailable — performance score set to 0"
```

## Stage 3: Score

Read and follow: `agents/scorer.md`
Pass: LITE flag.
Output: `/tmp/web-audit-score.json`

## Stage 4: Generate Report

Set output directory:
```bash
mkdir -p ~/web-audit-reports
```

Run:
```bash
node $PLUGIN_ROOT/scripts/generate-report.js \
  --crawl /tmp/web-audit-crawl.json \
  --seo /tmp/web-audit-seo-findings.json \
  --design /tmp/web-audit-design-findings.json \
  --score /tmp/web-audit-score.json \
  --format <FORMAT> \
  --output ~/web-audit-reports
```

Note the output file path.

## Stage 5: Publish

Read and follow: `agents/publisher.md`
Pass: report file path, EMAIL (if set), LITE flag.

## Cleanup

```bash
rm -f /tmp/web-audit-crawl.json /tmp/web-audit-seo-findings.json /tmp/web-audit-design-findings.json /tmp/web-audit-findings.json /tmp/web-audit-score.json /tmp/web-audit-pagespeed.json
```

## Error Summary

If any stage fails, print:
```
✗ Audit failed at stage: <stage name>
  Error: <specific error message>
  Report saved locally (if generation completed): <path or 'not generated'>
```
```

- [ ] **Step 2: Update generate-report.js CLI interface to match SKILL.md invocation**

The SKILL.md calls `generate-report.js` with named flags. Update the CLI section at the bottom of `scripts/generate-report.js`:

Open `web-audit/scripts/generate-report.js` and replace the module.exports line at the bottom with:

```js
// CLI entry point
if (require.main === module) {
  const args = process.argv.slice(2);
  const get = (flag) => { const i = args.indexOf(flag); return i >= 0 ? args[i+1] : null; };

  const crawlPath = get('--crawl');
  const seoPath = get('--seo');
  const designPath = get('--design');
  const scorePath = get('--score');
  const format = get('--format') ?? 'pdf';
  const outputDir = get('--output') ?? process.cwd();

  if (!crawlPath || !seoPath || !designPath || !scorePath) {
    console.error('Usage: generate-report.js --crawl <path> --seo <path> --design <path> --score <path> [--format pdf|html|dashboard] [--output <dir>]');
    process.exit(1);
  }

  const auditResult = {
    crawl: JSON.parse(require('fs').readFileSync(crawlPath, 'utf8')),
    seoFindings: (() => {
      const seo = JSON.parse(require('fs').readFileSync(seoPath, 'utf8'));
      return {
        working: [...(seo.technicalSeo?.working??[]), ...(seo.onPageSeo?.working??[])],
        issues: [...(seo.technicalSeo?.issues??[]), ...(seo.onPageSeo?.issues??[])],
        actions: [...(seo.technicalSeo?.actions??[]), ...(seo.onPageSeo?.actions??[]), ...(seo.keywordHealth?.actions??[])]
      };
    })(),
    designFindings: (() => {
      const d = JSON.parse(require('fs').readFileSync(designPath, 'utf8'));
      return {
        working: [...(d.performance?.working??[]), ...(d.designUx?.working??[]), ...(d.cro?.working??[])],
        issues: [...(d.performance?.issues??[]), ...(d.designUx?.issues??[]), ...(d.cro?.issues??[])],
        actions: [...(d.performance?.actions??[]), ...(d.designUx?.actions??[]), ...(d.cro?.actions??[])]
      };
    })(),
    score: JSON.parse(require('fs').readFileSync(scorePath, 'utf8'))
  };

  generateReport(auditResult, format, outputDir)
    .then(outPath => console.log('Report written to:', outPath))
    .catch(err => { console.error(err.message); process.exit(1); });
}

module.exports = { generateReport, generateHtml, generatePdf, generateDashboard, buildReportData, renderTemplate };
```

- [ ] **Step 3: Run full test suite to confirm nothing broke**

```bash
cd /mnt/c/Users/tez/projects/web-audit && npm test
```

Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
cd /mnt/c/Users/tez/projects/web-audit && git add skills/site-audit/SKILL.md scripts/generate-report.js && git commit -m "feat: add SKILL.md orchestrator and update generate-report.js CLI interface"
```

---

## Task 10: Integration Smoke Test

**Goal:** Verify the full pipeline runs end-to-end against a real URL.

- [ ] **Step 1: Test the crawler against a live site**

```bash
cd /mnt/c/Users/tez/projects/web-audit && node scripts/crawl.js https://example.com --pages 5 | node -e "
  const r = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
  console.log('Pages:', r.pages.length);
  console.log('Sitemap:', r.sitemap.exists);
  console.log('Robots:', r.robots.exists);
  console.log('First page title:', r.pages[0]?.title);
"
```

Expected: `Pages: 1` (example.com has few internal links), no errors.

- [ ] **Step 2: Test the scorer with mock findings**

```bash
cat > /tmp/test-findings.json << 'EOF'
{
  "technicalSeo": { "score": 70 },
  "onPageSeo": { "score": 80 },
  "performance": { "score": 65 },
  "keywordHealth": { "score": 55 },
  "designUx": { "score": 75 },
  "cro": { "score": 50 }
}
EOF
node /mnt/c/Users/tez/projects/web-audit/scripts/score.js /tmp/test-findings.json
```

Expected: composite score ~67, band "Fair", no errors.

- [ ] **Step 3: Test lite mode scoring**

```bash
node /mnt/c/Users/tez/projects/web-audit/scripts/score.js /tmp/test-findings.json --lite
```

Expected: `liteMode: true`, composite based only on technicalSeo/onPageSeo/performance/keywordHealth, no errors.

- [ ] **Step 4: Test HTML report generation with mock data**

```bash
cat > /tmp/test-seo.json << 'EOF'
{
  "technicalSeo": { "score": 70, "working": ["HTTPS configured"], "issues": ["Missing sitemap"], "actions": [{ "priority": "CRITICAL", "text": "Generate sitemap.xml" }] },
  "onPageSeo": { "score": 80, "working": ["Good meta descriptions"], "issues": [], "actions": [] },
  "keywordHealth": { "score": 55, "working": [], "issues": ["No keyword targeting"], "actions": [{ "priority": "HIGH", "text": "Define target keywords per page" }] }
}
EOF

cat > /tmp/test-design.json << 'EOF'
{
  "performance": { "score": 65, "working": [], "issues": ["Slow LCP 3.8s"], "actions": [{ "priority": "HIGH", "text": "Optimize hero image" }] },
  "designUx": { "score": 75, "working": ["Clean layout"], "issues": [], "actions": [] },
  "cro": { "score": 50, "working": [], "issues": ["No CTA above fold"], "actions": [{ "priority": "QUICK WIN", "text": "Add CTA button to hero" }] }
}
EOF

node /mnt/c/Users/tez/projects/web-audit/scripts/score.js /tmp/test-findings.json > /tmp/test-score.json

mkdir -p /tmp/web-audit-output

node /mnt/c/Users/tez/projects/web-audit/scripts/generate-report.js \
  --crawl <(node -e "const d=require('/tmp/web-audit-crawl.json') 2>/dev/null; console.log(JSON.stringify({startUrl:'https://example.com',crawledAt:new Date().toISOString(),pages:[{url:'https://example.com',depth:0}]}))") \
  --seo /tmp/test-seo.json \
  --design /tmp/test-design.json \
  --score /tmp/test-score.json \
  --format html \
  --output /tmp/web-audit-output
```

Expected: `Report written to: /tmp/web-audit-output/audit-example-com-<date>.html`

Open the file to verify it renders correctly:
```bash
echo "Open this in a browser: /tmp/web-audit-output/audit-example-com-$(date +%Y-%m-%d).html"
```

- [ ] **Step 5: Commit final state**

```bash
cd /mnt/c/Users/tez/projects/web-audit && git add -A && git commit -m "test: add integration smoke test notes and verify full pipeline"
```

---

## Self-Review Checklist

After writing this plan, checked against spec:

| Spec Requirement | Covered In |
|---|---|
| URL-first crawl up to N pages | Task 2 (crawl.js), Task 9 (SKILL.md) |
| --pages parameter | Task 2 (parseArgs), Task 9 |
| --depth parameter | Task 2 (parseArgs), Task 9 |
| --lite mode (10 page cap, skip design/keywords/publish) | Task 3 (score.js), Task 5 (generate-report.js), Task 9 (SKILL.md) |
| --email compatible with --lite | Task 8 (publisher.md) |
| --format pdf/html/dashboard | Task 4 (templates), Task 5 (generate-report.js) |
| --lite + dashboard → html fallback | Task 5 (generate-report.js), Task 9 (SKILL.md) |
| Parallel SEO + Design agents | Task 9 (SKILL.md Stage 2) |
| Reuse seo-audit/site-architecture/ai-seo | Task 8 (seo-analyzer.md) |
| DataForSEO optional enhancement | Task 8 (seo-analyzer.md) |
| Playwright optional (graceful fallback) | Task 8 (design-analyzer.md) |
| PageSpeed Insights integration | Task 8 (design-analyzer.md), Task 9 (lite PageSpeed fetch) |
| Weighted 0–100 composite score | Task 3 (score.js) |
| 6 categories with correct weights | Task 3 (score.js WEIGHTS) |
| Score bands (Excellent/Good/Fair/Poor) | Task 3 (getBand) |
| Report: header + exec summary + action plan + per-category | Task 4 (templates) |
| PDF default output | Task 5 (generatePdf), Task 9 |
| HTML interactive report | Task 4 (report.html), Task 5 |
| Dashboard dark mode | Task 4 (dashboard.html), Task 5 |
| Upgrade banner in lite mode | Task 4 (templates) |
| GitHub Pages one-time setup | Task 6 (setup-pages.sh) |
| Per-audit branch deploy (audit/<domain>-<date>) | Task 8 (publisher.md) |
| 14-day TTL via GitHub Actions | Task 6 (ttl-cleanup.yml) |
| Config saved to ~/.web-audit/config.json | Task 6 (setup-pages.sh) |
| Gmail MCP email with fallback | Task 8 (publisher.md) |
| Email attachment for PDF format | Task 8 (publisher.md) |
| Lite mode email still works | Task 8 (publisher.md) |
| URL unreachable → fail fast | Task 9 (SKILL.md 0 pages check) |
| Playwright not installed → DOM fallback | Task 8 (design-analyzer.md) |

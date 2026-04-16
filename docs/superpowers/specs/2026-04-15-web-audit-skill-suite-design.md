# Web Audit Skill Suite — Design Spec

**Date:** 2026-04-15
**Status:** Approved
**Scope:** Standalone `web-audit` plugin — URL-first, automated site audit with scored reporting and publishing

---

## Overview

The `web-audit` skill suite accepts a URL, crawls up to N pages, runs parallel SEO and design analysis, produces a weighted 0–100 score, and delivers a styled PDF/HTML/dashboard report published to GitHub Pages with a 14-day TTL. Reports can be emailed directly via Gmail MCP.

Intended for use on own sites and client sites across all industries (SaaS, e-commerce, service-based, local business, content/blog).

---

## Invocation

```bash
/site-audit <url>                                        # PDF report, 50 pages, no email
/site-audit <url> --format html                          # HTML report
/site-audit <url> --format dashboard                     # Live browser dashboard
/site-audit <url> --pages 30                             # Limit crawl to 30 pages
/site-audit <url> --format pdf --email client@agency.com # PDF + email on completion
```

**Parameters:**

| Parameter | Default | Description |
|---|---|---|
| `url` | required | Target site to audit |
| `--format` | `pdf` | Output format: `pdf`, `html`, `dashboard` |
| `--pages` | `50` | Max pages to crawl |
| `--email` | none | Send report to this address via Gmail MCP |

---

## Architecture

Orchestrator + Parallel Agent design. Six sequential stages; stages 2 and 3 run in parallel.

```
/site-audit <url>
      ↓
① CRAWLER — spider up to N pages, build URL map, fetch robots.txt + sitemap
      ↓ URL map + page HTML
  ┌──────────────────────────────────────┐
  │ ② SEO AGENT     │ ③ DESIGN AGENT    │  ← parallel
  │                  │                   │
  │ Technical SEO    │ Playwright shots   │
  │ On-page checks   │ Visual / UX review │
  │ Keyword analysis │ CRO assessment     │
  │ Backlink summary │ Core Web Vitals    │
  │                  │                   │
  │ ↳ wraps:         │ ↳ uses:           │
  │   seo-audit      │   Playwright CLI   │
  │   site-arch      │   PageSpeed API    │
  │   ai-seo         │                   │
  └──────────────────────────────────────┘
      ↓ findings JSON (merged)
④ SCORER — compute weighted 0–100 composite + per-category scores
      ↓ score + findings
⑤ REPORT GENERATOR — produce PDF / HTML / dashboard from template
      ↓ report file
⑥ PUBLISHER — deploy to GitHub Pages, send email, provision TTL workflow
      ↓
🔗 Live URL printed to terminal · email sent (if --email) · report saved locally
```

---

## Skill Suite Structure

Standalone `web-audit` plugin, separate from `marketing-skills`. The SEO agent internally reads and applies the `seo-audit`, `site-architecture`, and `ai-seo` skill frameworks as its evaluation logic — no duplication, reference only.

```
web-audit/
├── skills/
│   └── site-audit/
│       ├── SKILL.md                    ← entry point, orchestrator logic
│       ├── agents/
│       │   ├── crawler.md              ← spiders pages, builds URL map
│       │   ├── seo-analyzer.md         ← SEO agent (wraps existing skill frameworks)
│       │   ├── design-analyzer.md      ← Design agent (Playwright + UX/CRO)
│       │   ├── scorer.md               ← merges findings, computes weighted scores
│       │   └── publisher.md            ← GitHub Pages deploy + Gmail + TTL setup
│       ├── templates/
│       │   ├── report.html             ← styled HTML report template
│       │   ├── report-pdf.html         ← PDF-optimized version (print CSS)
│       │   └── dashboard.html          ← live browser dashboard
│       ├── github-actions/
│       │   └── ttl-cleanup.yml         ← deletes audit branches after 14 days
│       └── references/
│           ├── scoring-weights.md      ← category weights + rubrics
│           └── checklist.md            ← full audit checklist per category
```

---

## Crawler

- Starts at provided URL, follows internal links up to `--pages` limit (default 50)
- Collects: page HTML, status codes, response times, canonical tags, meta robots
- Checks: `robots.txt` (allowed/disallowed paths), XML sitemap existence and validity
- Outputs: structured URL map JSON consumed by SEO and Design agents
- Uses `web_fetch` for page fetching; no external crawler dependency

---

## SEO Agent

Runs in parallel with Design Agent. Applies the checklist logic from three existing skills:

- **`seo-audit`** — technical SEO (crawlability, indexation, canonicals, HTTPS, sitemaps), on-page (titles, meta, headings, content depth, internal linking)
- **`site-architecture`** — page hierarchy, URL structure, navigation depth, orphan pages
- **`ai-seo`** — AI search readiness, E-E-A-T signals, structured data presence

**Optional DataForSEO enhancement** (when `DATAFORSEO_LOGIN` + `DATAFORSEO_PASSWORD` env vars are set):
- Keyword search volume for targeted terms
- Backlink summary (domain rank, referring domains, spam score)
- On-page API for deeper per-page analysis

Without credentials, keyword and backlink sections show "requires DataForSEO" with setup instructions.

---

## Design Agent

Runs in parallel with SEO Agent. Uses Playwright for screenshot capture.

**Technical Design:**
- Mobile responsiveness (viewport, tap targets, no horizontal scroll)
- Core Web Vitals via Google PageSpeed Insights API (LCP, INP, CLS)
- Accessibility basics (color contrast, alt text, heading structure)

**Visual / UX:**
- Visual hierarchy (is there a clear focal point?)
- Typography (readable font sizes, line height, contrast)
- Whitespace and layout balance
- Trust signals (testimonials, logos, certifications visible)

**Conversion (CRO):**
- Primary CTA above the fold
- CTA clarity and prominence
- Social proof placement
- Form design and friction
- Value proposition clarity

Assessment is based on screenshot analysis + DOM inspection. Playwright renders pages with JavaScript enabled to capture actual visual state.

---

## Scoring System

### Categories and Weights

| Category | Weight | Source |
|---|---|---|
| Technical SEO | 25% | SEO Agent |
| On-Page SEO | 20% | SEO Agent |
| Performance | 20% | Design Agent (PageSpeed) |
| Keyword Health | 15% | SEO Agent |
| Design & UX | 10% | Design Agent |
| Conversion (CRO) | 10% | Design Agent |

### Composite Formula

```
Score = (TechSEO × 0.25) + (OnPage × 0.20) + (Performance × 0.20)
      + (Keywords × 0.15) + (Design × 0.10) + (CRO × 0.10)
```

### Score Bands

| Range | Label | Meaning |
|---|---|---|
| 90–100 | Excellent | Minimal issues |
| 75–89 | Good | Some improvements available |
| 50–74 | Fair | Noticeable gaps, actionable items |
| 0–49 | Poor | Critical issues blocking performance |

---

## Report Format

### Structure (all formats)

1. **Header** — site URL, crawl date, page count, overall score (large), 6 category scores
2. **Executive Summary** — What's Working (green) vs Needs Attention (amber), 4–6 bullets each
3. **Priority Action Plan** — color-coded items: CRITICAL → HIGH → QUICK WIN
4. **Per-Category Detail** — one section per category with issue/impact/fix breakdowns
5. **Footer** — report expiry date, live link, generated-by attribution

### Format Differences

- **PDF** (default): Print-optimized CSS, paginated, embeds screenshots, suitable for email attachment
- **HTML**: Same layout, interactive — expandable sections, live score bars
- **Dashboard**: Simplified single-page view, auto-refreshes if re-run, suitable for browser bookmarking

---

## Publishing Pipeline

### One-Time Setup (automated on first run)

1. Create `web-audits` GitHub repo with Pages enabled
2. Install `ttl-cleanup.yml` GitHub Actions workflow
3. Store repo details in `~/.web-audit/config.json` for future runs

### Per-Audit Deploy

1. Generate report file(s)
2. Create branch: `audit/<domain>-<YYYY-MM-DD>` (e.g. `audit/acmecorp-2026-04-15`)
3. Commit report to branch
4. GitHub Pages builds automatically (~60s)
5. Return live URL: `<username>.github.io/web-audits/audit/<domain>-<YYYY-MM-DD>`

### 14-Day TTL Cleanup

GitHub Actions workflow (`ttl-cleanup.yml`) runs daily at 2am UTC:
- Lists all `audit/*` branches
- Calculates branch age from timestamp in branch name
- Deletes branches older than 14 days
- GitHub Pages for those branches disappears automatically

### Email Sharing

When `--email` is provided:
- Uses Gmail MCP (`mcp__claude_ai_Gmail__*`) to send report
- Subject: `Site Audit — <domain> (Score: <n>/100)`
- Body: executive summary + live link + expiry notice
- Attachment: PDF file if `--format pdf`
- Graceful fallback: if Gmail MCP not authenticated, prints URL to terminal with instructions

---

## Error Handling

| Scenario | Behavior |
|---|---|
| URL unreachable | Fail fast with clear error, no partial report |
| Crawl hits page limit | Audit proceeds with pages collected, notes limit reached |
| PageSpeed API unavailable | Performance section skipped, score weighted across remaining categories |
| DataForSEO creds missing | Keyword/backlink sections show setup prompt, not an error |
| GitHub Pages setup fails | Report saved locally, URL not generated, user notified |
| Gmail MCP not authenticated | URL printed to terminal, email skipped with instructions |
| Playwright not installed | Design agent falls back to DOM-only analysis, screenshots skipped |

---

## Dependencies

**Required:**
- `web_fetch` / HTTP access to target URL
- GitHub account + `gh` CLI authenticated
- Node.js + Puppeteer (headless Chrome for PDF generation via `puppeteer` npm package)

**Optional (graceful degradation if absent):**
- Playwright — enables screenshots and visual analysis
- Google PageSpeed Insights API key — enables Core Web Vitals data
- DataForSEO credentials — enables keyword volume + backlink data
- Gmail MCP authentication — enables email delivery

---

## Reuse of Existing Skills

The `seo-analyzer` agent reads these skill files directly as its evaluation framework. It does not copy their content — it references them at runtime:

- `/marketing-skills/skills/seo-audit/SKILL.md` — technical + on-page SEO checklist
- `/marketing-skills/skills/site-architecture/SKILL.md` — IA and URL structure checks
- `/marketing-skills/skills/ai-seo/SKILL.md` — AI search readiness signals

If `marketing-skills` is not installed, the SEO agent falls back to its own embedded checklist in `references/checklist.md`.

---

## Out of Scope

- Competitor analysis (separate audit run per competitor)
- Ongoing monitoring / scheduled re-audits (could be added in v2)
- Full accessibility audit (WCAG compliance) — basics only in v1
- Backlink acquisition recommendations — data shown, strategy out of scope

# Urge Quiz → Shopify Waitlist Pipeline

**Status:** Live (2026-07-21)  
**Owner context:** Booth / iPad quiz lead gen for Urge Candies (`tasteurge.com`)

Quiz finishers land in the **same Shopify Customers list** as the website waitlist (homepage `/contact` form), with marketing consent + tags.

---

## Where to look (humans + AIs)

| What | Where |
|------|--------|
| **Live quiz** | https://tasteurge.com/pages/quiz |
| **Shopify customers** | Admin → Customers · filter tags: `waitlist`, `quiz`, or `source:quiz` |
| **Local kiosk / source** | `/Users/omar/Desktop/urge-quiz-kiosk` · GitHub `KINNECTCLUB/urge-quiz-kiosk` |
| **Live theme files** | `/Users/omar/tasteurge-theme` · Ritual theme id `135106986055` · store `1rfgq1-eb.myshopify.com` |
| **Theme template** | `templates/page.quiz.liquid` + `layout/quiz.liquid` + `assets/urge-quiz-*` |
| **Sheet backup webhook** | Apps Script: `https://script.google.com/macros/s/AKfycbzV4qIM3AZq8_PUuDCycAfh-2WLYhHGua7YFaxk_lzdcykLOz09UocUlML_0MML5dQUkw/exec` · source `sheet-webhook.gs` |
| **Admin upsert (server)** | GCP Cloud Function `urge-quiz-sync` · `https://us-central1-kinnect-dev-461723.cloudfunctions.net/urge-quiz-sync` · secret `URGE_QUIZ_SHOPIFY_TOKEN` (project `kinnect-dev-461723`) |
| **Growth agent waitlist jobs** | `~/urge-growth-agent` · Slack notify polls tag `waitlist` |
| **Hosting notes** | `SHOPIFY-HOSTING.txt` (this repo) |

---

## Dual-write on quiz finish (`trySyncLead`)

Every completed quiz (with email + consent) does **three** best-effort writes:

1. **Storefront waitlist (primary, same as website)**  
   - Hidden form + `fetch` POST to `/contact` (or `https://tasteurge.com/contact`)  
   - `form_type=customer`, `contact[accepts_marketing]=true`  
   - Tags: `waitlist`, `free samples`, `early access`, `quiz`, `source:quiz`  
   - Plus `quiz-winner` if 10/10; optional `event:<name>`  

2. **Admin API upsert (Cloud Function)**  
   - `POST` JSON lead → `urge-quiz-sync`  
   - `customerCreate` / `customerUpdate` + email marketing `SUBSCRIBED`  
   - Same tags + note `Source: Urge Quiz Kiosk`  

3. **Google Sheet row (backup)**  
   - Apps Script webhook appends to tab **Leads**  
   - Offline: `localStorage` queue; staff can Export CSV  

Code: `index.html` (repo) and live `page.quiz.liquid` (theme).

---

## Tags convention (Shopify)

| Tag | Meaning |
|-----|---------|
| `waitlist` | Same pool as homepage waitlist |
| `free samples` / `early access` | Launch incentives (match site) |
| `quiz` / `source:quiz` | Came from booth/iPad quiz |
| `quiz-winner` | Perfect 10/10 (free year prize) |
| `event:…` | Optional booth/event label |
| `homepage` / `pdp` | Website sources (not quiz) |

**Slack / growth:** customers with tag `waitlist` are the unified list (quiz + site).

---

## Deploy cheatsheet

```bash
# Theme (Ritual live #135106986055) — use Admin token with write_themes if CLI session expired
cd /Users/omar/tasteurge-theme
shopify theme push --store 1rfgq1-eb.myshopify.com --theme 135106986055 \
  --allow-live --nodelete \
  --only templates/page.quiz.liquid \
  --only layout/quiz.liquid \
  --only "assets/urge-quiz-*"

# Or REST asset PUT with shpat_ (URGE_SHOPIFY_ACCESS_TOKEN in GCP has write_themes)
```

Growth Shopify secret `URGE_SHOPIFY_ACCESS_TOKEN` is **content/themes-oriented** (often `read_customers` only) — not always enough for customer write. Quiz Admin writes use `urge-quiz-sync` + `URGE_QUIZ_SHOPIFY_TOKEN`.

---

## Related systems

- **Homepage waitlist form:** `form_type=customer` → `/contact` · tags include `waitlist, free samples, early access, …`  
- **Axel / growth agent:** `~/urge-growth-agent` · waitlist CTA + optional Slack on new `waitlist` customers  
- **GitHub backup host:** https://kinnectclub.github.io/urge-quiz-kiosk/  

Do **not** reintroduce FormSubmit; dual-write above is the source of truth for quiz → Shopify.

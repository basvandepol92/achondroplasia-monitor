# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Behavioral Guidelines

Reduce common LLM coding mistakes. **Tradeoff:** these guidelines bias toward caution over speed — for trivial tasks, use judgment.

### 1. Think Before Coding
**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing: state assumptions explicitly (if uncertain, ask), present multiple interpretations rather than picking silently, suggest simpler approaches when they exist, and stop to name what's confusing if something is unclear.

### 2. Simplicity First
**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

### 3. Surgical Changes
**Touch only what you must. Clean up only your own mess.**

When editing existing code: don't "improve" adjacent code or formatting, don't refactor things that aren't broken, match existing style even if you'd do it differently, and if you notice unrelated dead code — mention it, don't delete it.

When your changes create orphans: remove imports/variables/functions that *your* changes made unused. Don't remove pre-existing dead code unless asked.

The test: every changed line should trace directly to the user's request.

### 4. Goal-Driven Execution
**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

---

## Commands

```bash
# Installeren
npm install

# Eénmalig draaien (alle fetchers + e-mail indien nieuwe items)
node index.js

# Scheduler starten (houdt zichzelf draaiend via node-cron)
node index.js --daemon

# Database initialiseren / migreren
node src/db/migrations.js

# Één fetcher handmatig testen
node -e "require('./src/fetchers/clinicaltrials').fetch().then(console.log)"
```

Kopieer `.env.example` naar `.env` en vul de variabelen in voor je de eerste run doet.

---

# Achondroplasia Monitor — Project Context

## Doel
Dit project monitort automatisch nieuws over medicijnen en behandelingen
voor kinderen met achondroplasie. De informatie wordt elk uur opgehaald
uit klinische trial registers, wetenschappelijke literatuur, bedrijfsnieuws
en beursberichten. Nieuwe bevindingen worden dagelijks per e-mail gestuurd
naar de ouders van een kind met achondroplasie.

De ouders zijn goed thuis in het vakgebied. E-mails zijn feitelijk en
inhoudelijk — geen vereenvoudiging nodig, geen onnodige toelichting.
De scope is internationaal: trials en goedkeuringen wereldwijd zijn relevant.

---

## Doelgroep van het nieuws
- Kinderen met achondroplasie (primair focus leeftijd 0–12 jaar)
- Medicamenteuze behandelingen (geen chirurgische ingrepen)
- Internationale trials en goedkeuringen (FDA, EMA, PMDA en overig)

---

## Keywords
Gebruik deze lijst voor filtering in alle fetchers. Een item is relevant
als minstens één keyword voorkomt in titel, samenvatting of body.

### Aandoeningen
- achondroplasia
- achondroplasie
- hypochondroplasia
- hypochondroplasie
- FGFR3
- fibroblast growth factor receptor 3

### Medicijnen & behandelingen in ontwikkeling
- vosoritide
- BMN 111
- TransCon CNP
- navepegritide
- infigratinib
- BGJ398
- Tyra-300
- TYRA-300
- recifercept
- RGX-111
- gene therapy achondroplasia
- meclozine
- C-type natriuretic peptide
- CNP analogue
- soluble decoy receptor
- FGFR3 inhibitor

### Bedrijven actief in dit veld
- BioMarin
- Ascendis Pharma
- Ascendis
- QED Therapeutics
- BridgeBio
- Tyra Biosciences
- REGENXBIO
- Pfizer achondroplasia
- Sanofi achondroplasia

### Regulatoire termen (altijd relevant in combinatie met bovenstaande)
- FDA approval
- EMA approval
- breakthrough designation
- orphan drug
- pediatric trial
- phase 2
- phase 3
- marketing authorization

---

## Bronnen

### API — meest betrouwbaar
| Bron | Endpoint | Unieke sleutel |
|---|---|---|
| ClinicalTrials.gov | https://clinicaltrials.gov/api/v2/studies | NCTId |
| PubMed (NCBI) | https://eutils.ncbi.nlm.nih.gov/entrez/eutils/ | PMID |
| SEC EDGAR | https://efts.sec.gov/LATEST/search-index | filing accession number |

**ClinicalTrials.gov query parameters:**
```
query.cond = "achondroplasia OR hypochondroplasia"
filter.overallStatus = RECRUITING,NOT_YET_RECRUITING,ACTIVE_NOT_RECRUITING
pageSize = 50
fields = NCTId,BriefTitle,OverallStatus,StartDate,LastUpdatePostDate,
         BriefSummary,InterventionName,Condition,Phase,
         LocationCity,LocationCountry,MinimumAge,MaximumAge
```
Let op: filter ook op leeftijd — alleen trials die kinderen includeren
(MinimumAge < 18 jaar of niet gespecificeerd).

**PubMed query:**
```
(achondroplasia[MeSH] OR hypochondroplasia[MeSH] OR FGFR3[tiab])
AND (drug therapy[MeSH] OR clinical trial[pt] OR treatment[tiab])
AND (child[MeSH] OR pediatric[tiab] OR paediatric[tiab])
```
Sort op datum, retmax=20 per run.

**SEC EDGAR:**
Zoek op "achondroplasia" in 8-K, 20-F en 6-K filings.
Filter op bedrijven: BioMarin, Ascendis, BridgeBio, QED, Tyra, REGENXBIO.

---

### RSS — betrouwbaar, filter op keywords
| Bron | Feed URL |
|---|---|
| GlobeNewswire | https://www.globenewswire.com/RssFeed/industry/Biotechnology |
| BusinessWire | https://feed.businesswire.com/rss/home/?rss=G1&rId=20_ |

Filter elk RSS-item op de keywords lijst. Sla op als: source + link als unieke sleutel.

---

### Scrape — minder betrouwbaar, controleer structuur bij breuk
| Bron | URL | Wat te scrapen |
|---|---|---|
| Ascendis Pharma | https://ascendispharma.com/media/press-releases/ | Titel + datum + link per persbericht |
| Tyra Biosciences | https://tyra.bio/news/ | Titel + datum + link |
| BridgeBio | https://bridgebio.com/news/ | Titel + datum + link |
| BioMarin | https://www.biomarin.com/media/press-releases/ | Titel + datum + link |
| Novartis | https://www.novartis.com/news/media-releases | Titel + datum + link |
| The Chandler Project | https://thechandlerproject.org/qed/ | Paginawijzigingen |
| EUROSPE | https://www.eurospe.org/news/ | Nieuws + events |
| Endocrine Society | https://www.endocrine.org/meetings-and-events/endo-annual-meetings | Meetings agenda |
| ASHG | https://www.ashg.org/meetings-and-events/ | Meetings agenda |
| EU Clinical Trials | https://euclinicaltrials.eu/search-for-clinical-trials/?lang=en | Zoekresultaten op "achondroplasia" |
| WHO ICTRP | https://trialsearch.who.int/Default.aspx | XML export indien beschikbaar, anders scrape |

**Scraper aanpak:**
- Gebruik axios + cheerio voor statische pagina's
- Gebruik Playwright (via MCP) voor pagina's die JavaScript nodig hebben
- Unieke sleutel: de volledige URL van het item
- Sla ruwe HTML niet op, alleen: title, url, datum, source
- Als een scraper breekt: log een waarschuwing maar crash de hele run niet

---

## Database schema (SQLite)

```sql
CREATE TABLE items (
  id            INTEGER PRIMARY KEY,
  source        TEXT NOT NULL,
  external_id   TEXT NOT NULL,
  title         TEXT,
  summary       TEXT,
  url           TEXT,
  published_at  TEXT,
  status        TEXT,        -- voor trials: RECRUITING etc.
  age_min       TEXT,        -- voor trials: minimumleeftijd
  age_max       TEXT,        -- voor trials: maximumleeftijd
  phase         TEXT,        -- voor trials: fase 1/2/3
  locations     TEXT,        -- voor trials: landen (JSON array)
  raw_json      TEXT,        -- volledige API response
  created_at    TEXT DEFAULT (datetime('now')),
  emailed       INTEGER DEFAULT 0,
  UNIQUE(source, external_id)
);

CREATE TABLE status_changes (
  id            INTEGER PRIMARY KEY,
  item_id       INTEGER REFERENCES items(id),
  field         TEXT,        -- bijv. "status", "phase"
  old_value     TEXT,
  new_value     TEXT,
  changed_at    TEXT DEFAULT (datetime('now'))
);
```

Statuswijzigingen bij trials (bijv. van NOT_YET_RECRUITING naar RECRUITING)
zijn altijd relevant en moeten apart in de digest gemeld worden.

---

## Projectstructuur

```
/src
  /fetchers
    clinicaltrials.js   ← ClinicalTrials.gov API v2
    pubmed.js           ← NCBI E-utilities
    edgar.js            ← SEC EDGAR full-text search
    rss.js              ← GlobeNewswire + BusinessWire
    scraper.js          ← Generieke scraper (axios + cheerio)
    playwright.js       ← Scraper voor JS-zware sites
  /db
    database.js         ← SQLite setup, queries, deduplicatie
    migrations.js       ← Schema aanmaken/updaten
  /email
    mailer.js           ← Nodemailer
    template.js         ← HTML e-mail opbouwen
  scheduler.js          ← node-cron orchestratie
  config.js             ← Keywords, URLs, bronnen, e-mailadressen
index.js
CLAUDE.md
.env                    ← nooit committen
.env.example
```

---

## E-mail digest

**Frequentie:** Dagelijks om 07:00 (zodat ouders het 's ochtends lezen)
**Alleen versturen als:** er nieuwe items zijn (emailed = 0)
**Taal:** Engels (de bronnen zijn Engels, geen vertaling nodig)
**Toon:** Feitelijk en inhoudelijk

**Structuur van de e-mail:**
1. Onderwerpregel: `Achondroplasia update — [datum] — [X nieuwe items]`
2. Sectie per bron, gesorteerd op prioriteit:
   - 🔴 Statuswijzigingen bij bestaande trials (hoogste prioriteit)
   - 🟡 Nieuwe clinical trials
   - 🟡 Nieuwe publicaties (PubMed)
   - ⚪ Bedrijfsnieuws (press releases, SEC filings)
   - ⚪ Conferenties en events
3. Per item: titel, bron, datum, directe link, korte samenvatting (max 2 zinnen)

---

## Scheduler (node-cron)

```
Elk uur (0 * * * *):     Draai alle fetchers, sla nieuwe items op
Dagelijks 07:00 (0 7 * * *): Stuur e-mail digest
```

Bij elke run: log timestamp + aantal nieuwe items per bron.
Fetchers draaien parallel (Promise.allSettled — één falende fetcher
stopt de rest niet).

---

## Environment variabelen (.env)

```
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
EMAIL_FROM=
EMAIL_TO=                  # e-mailadres ouders
NCBI_API_KEY=              # optioneel, verhoogt rate limit
GOOGLE_API_KEY=            # Gemini Flash, voor AI-extractie als cheerio-scraper breekt
DB_PATH=./data/monitor.db
LOG_LEVEL=info
```

---

## Nieuwe bron toevoegen

Gebruik `/project:add-source` of volg dit patroon handmatig:
1. Bepaal type: API / RSS / scrape / playwright-scrape
2. Maak fetcher aan in `/src/fetchers/` — volg bestaand patroon:
   - exporteer één async `fetch()` functie
   - return array van objecten met: `{ external_id, title, summary, url, published_at, status?, ... }`
   - filter op keywords uit `config.js`
3. Registreer in `scheduler.js`
4. Voeg toe aan de bronnenlijst in dit bestand

---

## Bekende valkuilen

- **euclinicaltrials.eu** laadt zoekresultaten deels via JavaScript → gebruik Playwright
- **WHO ICTRP** heeft een XML exportfunctie (probeer dit eerst vóór scrapen)
- **GlobeNewswire RSS** is breed — keyword filtering is essentieel, anders te veel ruis
- **SEC EDGAR** geeft soms PDFs terug — parse alleen de metadata, niet de volledige filing
- **Scraper breuk:** als een bedrijfswebsite z'n HTML aanpast, log dan een waarschuwing
  en stuur een aparte notificatie zodat de scraper gerepareerd kan worden

---

## Monitoring & uptime

### Vereiste: de eigenaar moet weten als de software stopt met draaien

Gebruik **Healthchecks.io** (gratis tier volstaat) als heartbeat monitor.
Na elke succesvolle scheduler-run pingt de applicatie een unieke URL.
Als Healthchecks.io binnen de verwachte tijd geen ping ontvangt,
stuurt het automatisch een e-mailalert.

**Implementatie in scheduler.js:**
```javascript
// Aan het einde van elke succesvolle run:
const HEALTHCHECK_URL = process.env.HEALTHCHECK_URL;
if (HEALTHCHECK_URL) {
  await fetch(HEALTHCHECK_URL).catch(err =>
    logger.warn('Healthcheck ping mislukt', { err })
  );
}
```

**Toevoegen aan .env.example:**
```
HEALTHCHECK_URL=   # Ping URL van healthchecks.io, aanmaken op https://healthchecks.io
```

**Instelling op healthchecks.io:**
- Period: 1 hour (de scheduler draait elk uur)
- Grace time: 10 minutes (enige uitloop toegestaan)
- Alert via: e-mail naar hetzelfde adres als de digest

### Wat er gemonitord wordt

| Wat | Hoe | Alert bij |
|---|---|---|
| Scheduler draait | Healthchecks.io heartbeat | Geen ping binnen 70 minuten |
| Individuele fetcher faalt | Logging + waarschuwing in digest | Fetcher faalt 3x op rij |
| Scraper breekt (HTML gewijzigd) | Log + aparte e-mail notificatie | Geen items gevonden waar er eerder wel waren |

### Scraper breuk detectie

Als een scraper 0 items teruggeeft terwijl hij de vorige 5 runs
wel items teruggaf, stuur dan een aparte waarschuwingsmail:

```
Onderwerp: ⚠️ Achondroplasia monitor — scraper mogelijk stuk

De scraper voor [bron] heeft de afgelopen [N] runs geen items gevonden.
Dit kan betekenen dat de website z'n structuur heeft gewijzigd.
Controleer: [URL]
```

Implementeer dit als aparte check in scheduler.js na elke run.

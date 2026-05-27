# Achondroplasia Monitor

Automatische monitor voor nieuws over medicijnen en behandelingen bij achondroplasie. Haalt elk uur data op uit klinische trial registers, wetenschappelijke literatuur, bedrijfsnieuws en beursberichten. Nieuwe bevindingen worden dagelijks per e-mail verstuurd.

---

## Wat het doet

- **Elk uur** draaien alle fetchers parallel en worden nieuwe items opgeslagen in een lokale SQLite-database
- **Dagelijks om 08:00** (Europe/Amsterdam) wordt een digest gemaild met alle nieuwe items gesorteerd op prioriteit
- **Statuswijzigingen** bij bestaande trials (bijv. van `NOT_YET_RECRUITING` naar `RECRUITING`) worden apart gemeld
- Als een fetcher 5 opeenvolgende runs niets teruggeeft, wordt er een waarschuwingsmail gestuurd
- Een eenvoudig **dashboard** toont de database-inhoud live

---

## Bronnen

| Type | Bron |
|---|---|
| API | ClinicalTrials.gov |
| API | PubMed (NCBI) |
| API | SEC EDGAR (BioMarin, Ascendis, BridgeBio, QED, Tyra, REGENXBIO) |
| API | WHO ICTRP |
| RSS | GlobeNewswire, BusinessWire |
| Scraper | Ascendis Pharma, Tyra Biosciences, BridgeBio, BioMarin, Novartis |
| Scraper | The Chandler Project, EUROSPE, Endocrine Society, ASHG |
| API | EU Clinical Trials (CTIS) |

Scraping gebruikt Gemini AI voor extractie, zodat de monitor robuust blijft als een website z'n HTML-structuur wijzigt.

---

## Vereisten

- Node.js ≥ 20
- Een [Resend](https://resend.com) account (e-mail)
- Een [Google AI Studio](https://aistudio.google.com) API key met billing ingeschakeld (scraper)
- Optioneel: een [Healthchecks.io](https://healthchecks.io) ping-URL voor uptime monitoring

---

## Installatie

```bash
git clone <repo-url>
cd achondroplasia-monitor
npm install
cp .env.example .env
# Vul .env in (zie hieronder)
node src/db/migrations.js   # Database aanmaken
```

---

## Environment variabelen

```env
# E-mail (Resend)
RESEND_API_KEY=        # Aanmaken op resend.com
EMAIL_FROM=            # Geverifieerd afzenderadres in Resend
EMAIL_TO=              # Ontvanger van de dagelijkse digest

# AI-extractie voor scraper
GOOGLE_API_KEY=        # Google AI Studio — billing moet ingeschakeld zijn

# Database
DB_PATH=./data/monitor.db

# Optioneel
NCBI_API_KEY=          # Verhoogt PubMed rate limit
HEALTHCHECK_URL=       # Ping-URL van healthchecks.io
LOG_LEVEL=info
NODE_ENV=production    # Zet op 'production' voor PROD-label in e-mail
```

---

## Draaien

```bash
# Eénmalige run (alle fetchers + e-mail als er nieuwe items zijn)
node index.js

# Daemon starten (scheduler + dashboard)
node index.js --daemon

# Database opnieuw aanmaken
node src/db/migrations.js

# Dashboard los draaien
npm run dashboard

# Testen
npm test

# Één fetcher handmatig testen
node -e "import('./src/fetchers/clinicaltrials.js').then(m => m.fetch().then(console.log))"
```

---

## Projectstructuur

```
index.js                    Entrypoint
src/
  scheduler.js              Orchestratie, cron-jobs, health checks
  config.js                 Keywords, bronnen, query-parameters
  dashboard.js              HTTP-dashboard (poort via PORT of 3000)
  fetchers/
    clinicaltrials.js       ClinicalTrials.gov API v2
    pubmed.js               NCBI E-utilities
    edgar.js                SEC EDGAR full-text search
    rss.js                  GlobeNewswire + BusinessWire
    scraper.js              Scraper met Gemini AI-extractie
    ctis.js                 EU Clinical Trials (CTIS)
    whoictrp.js             WHO ICTRP trial register
  db/
    database.js             SQLite queries, upsert, deduplicatie
    migrations.js           Schema aanmaken
  email/
    mailer.js               Resend integratie
    template.js             HTML e-mail opbouwen
data/
  monitor.db                SQLite database (gitignored)
  zero_streaks.json         Persistente teller voor fetcher health checks
```

---

## E-mail digest

Verstuurd dagelijks om **08:00 Amsterdam** als er nieuwe items zijn.

**Onderwerp:** `Achondroplasia update — YYYY-MM-DD — N new items`

Secties op prioriteit:
1. 🔴 Statuswijzigingen bij bestaande trials (hoogste prioriteit)
2. 🟡 Nieuwe clinical trials
3. 🟡 Nieuwe publicaties (PubMed)
4. ⚪ Bedrijfsnieuws (press releases, SEC filings, RSS)
5. ⚪ EU trial registry

---

## Dashboard

Beschikbaar op `http://localhost:3000` (of via `PORT` environment variabele).  
Toont: totaal items, nog niet gemailde items, statuswijzigingen, en een overzicht per bron.

---

## Deployment op Railway

Het project draait op [Railway](https://railway.app).

1. Verbind de GitHub repository met Railway
2. Stel alle environment variabelen in via het Railway dashboard
3. Railway detecteert automatisch Node.js via `nixpacks.toml`
4. Start command: `node index.js --daemon`

Het dashboard is bereikbaar via de Railway-URL op de poort die Railway via `PORT` injecteert.

---

## Uptime monitoring

Gebruik [Healthchecks.io](https://healthchecks.io) om te detecteren als de scheduler stopt.

1. Maak een nieuwe check aan op healthchecks.io
2. Stel in: **Period** 1 hour, **Grace** 10 minutes
3. Kopieer de ping-URL naar `HEALTHCHECK_URL` in `.env`

Na elke succesvolle scheduler-run pingt de applicatie deze URL automatisch. Als healthchecks.io binnen 70 minuten geen ping ontvangt, stuurt het een alert.

---

## Bekende beperkingen

- Volledig JavaScript-gerenderde pagina's (sommige company sites) kunnen leeg zijn na axios-fetch — Gemini ziet dan ook niets
- WHO ICTRP toont momenteel weinig resultaten (hun zoekindex is beperkt)
- SEC EDGAR filings zijn engelstalige bedrijfsdocumenten — veel ruis, keyword-filter is essentieel

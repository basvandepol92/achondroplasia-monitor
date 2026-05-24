// Primary: aandoeningen en specifieke medicijnen — één hiervan is voldoende om relevant te zijn
export const PRIMARY_KEYWORDS = [
  'achondroplasia',
  'achondroplasie',
  'hypochondroplasia',
  'hypochondroplasie',
  'FGFR3',
  'fibroblast growth factor receptor 3',
  'vosoritide',
  'BMN 111',
  'TransCon CNP',
  'navepegritide',
  'infigratinib',
  'BGJ398',
  'Tyra-300',
  'TYRA-300',
  'recifercept',
  'RGX-111',
  'gene therapy achondroplasia',
  'meclozine',
  'C-type natriuretic peptide',
  'CNP analogue',
  'soluble decoy receptor',
  'FGFR3 inhibitor',
];

// Secondary: alleen relevant in combinatie met een primary keyword
export const SECONDARY_KEYWORDS = [
  'BioMarin',
  'Ascendis Pharma',
  'Ascendis',
  'QED Therapeutics',
  'BridgeBio',
  'Tyra Biosciences',
  'REGENXBIO',
  'Pfizer achondroplasia',
  'Sanofi achondroplasia',
  'FDA approval',
  'EMA approval',
  'breakthrough designation',
  'orphan drug',
  'pediatric trial',
  'phase 2',
  'phase 3',
  'marketing authorization',
];

// Gecombineerde lijst (voor backward-compatibiliteit)
export const KEYWORDS = [...PRIMARY_KEYWORDS, ...SECONDARY_KEYWORDS];

export const SCRAPER_SOURCES = [
  {
    name: 'Ascendis Pharma',
    url: 'https://ascendispharma.com/pipeline/',
    selectors: { items: 'article, .pipeline-item, section', title: 'h2, h3', link: 'a', date: 'time, .date' },
  },
  {
    name: 'Tyra Biosciences',
    url: 'https://tyra.bio/news/',
    selectors: { items: 'article, .news-item', title: 'h2, h3', link: 'a', date: 'time, .date' },
  },
  {
    name: 'BridgeBio',
    url: 'https://bridgebio.com/news/',
    selectors: { items: 'article, .news-item', title: 'h2, h3', link: 'a', date: 'time, .date' },
  },
  {
    name: 'BioMarin',
    url: 'https://investors.biomarin.com/news/default.aspx',
    selectors: { items: 'article, .news-item, tr', title: 'h2, h3, a', link: 'a', date: 'time, .date, td' },
  },
  {
    name: 'Novartis',
    url: 'https://www.novartis.com/news/newsroom?search_api_fulltext=Achondroplasia&type=All&news_filters=&language=All&start_date=&end_date=',
    selectors: { items: 'article, .news-item, .views-row', title: 'h2, h3, .teaser__title', link: 'a', date: 'time, .date-display-single, .field--name-field-date' },
  },
  {
    name: 'The Chandler Project',
    url: 'https://thechandlerproject.org/qed/',
    selectors: { items: 'article, p', title: 'h2, h3', link: 'a', date: 'time, .date' },
  },
  {
    name: 'EUROSPE',
    url: 'https://www.eurospe.org/news/',
    selectors: { items: 'article, .news-item', title: 'h2, h3', link: 'a', date: 'time, .date' },
  },
  {
    name: 'Endocrine Society',
    url: 'https://www.endocrine.org/meetings-and-events/endo-annual-meetings',
    selectors: { items: 'article, .event', title: 'h2, h3', link: 'a', date: 'time, .date' },
  },
  {
    name: 'ASHG',
    url: 'https://www.ashg.org/category/publications-news/press-releases/',
    selectors: { items: 'article, .post', title: 'h2, h3, .entry-title', link: 'a', date: 'time, .entry-date' },
  },
];

export const RSS_FEEDS = [
  { name: 'GlobeNewswire', url: 'https://www.globenewswire.com/RssFeed/keyword/achondroplasia' },
  { name: 'BusinessWire', url: 'https://feed.businesswire.com/rss/home/?rss=G1&rId=20_' },
];

export const CLINICALTRIALS_QUERY = {
  'query.cond': 'achondroplasia OR hypochondroplasia',
  'filter.overallStatus': 'RECRUITING,NOT_YET_RECRUITING,ACTIVE_NOT_RECRUITING',
  pageSize: 50,
  fields: [
    'NCTId', 'BriefTitle', 'OverallStatus', 'StartDate', 'LastUpdatePostDate',
    'BriefSummary', 'InterventionName', 'Condition', 'Phase',
    'LocationCity', 'LocationCountry', 'MinimumAge', 'MaximumAge',
  ].join(','),
};

export const PUBMED_QUERY =
  '(achondroplasia[MeSH] OR hypochondroplasia[MeSH] OR FGFR3[tiab]) AND (drug therapy[MeSH] OR clinical trial[pt] OR treatment[tiab]) AND (child[MeSH] OR pediatric[tiab] OR paediatric[tiab])';

export const EDGAR_COMPANIES = ['BioMarin', 'Ascendis', 'BridgeBio', 'QED', 'Tyra', 'REGENXBIO'];

/**
 * Returns true if the text contains at least one primary keyword (disease or drug).
 * Company names and regulatory terms alone are not sufficient.
 */
export function matchesKeyword(text = '') {
  const lower = (text ?? '').toLowerCase();
  return PRIMARY_KEYWORDS.some(kw => lower.includes(kw.toLowerCase()));
}

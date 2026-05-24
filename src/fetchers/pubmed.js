import axios from 'axios';
import { PUBMED_QUERY, matchesKeyword } from '../config.js';

const BASE_URL = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';
const API_KEY = process.env.NCBI_API_KEY;

async function searchPmids() {
  const params = {
    db: 'pubmed',
    term: PUBMED_QUERY,
    retmax: 20,
    sort: 'date',
    retmode: 'json',
    ...(API_KEY && { api_key: API_KEY }),
  };
  const res = await axios.get(`${BASE_URL}/esearch.fcgi`, { params });
  return res.data?.esearchresult?.idlist ?? [];
}

async function fetchSummaries(pmids) {
  if (pmids.length === 0) return [];
  const params = {
    db: 'pubmed',
    id: pmids.join(','),
    retmode: 'json',
    ...(API_KEY && { api_key: API_KEY }),
  };
  const res = await axios.get(`${BASE_URL}/esummary.fcgi`, { params });
  return Object.values(res.data?.result ?? {}).filter(v => v.uid);
}

export async function fetch() {
  const pmids = await searchPmids();
  const summaries = await fetchSummaries(pmids);

  return summaries
    .filter(s => matchesKeyword(s.title) || matchesKeyword(s.source))
    .map(s => ({
      source:       'pubmed',
      external_id:  s.uid,
      title:        s.title,
      summary:      s.source,
      url:          `https://pubmed.ncbi.nlm.nih.gov/${s.uid}/`,
      published_at: s.pubdate ?? null,
      raw_json:     s,
    }));
}

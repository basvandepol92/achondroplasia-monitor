import axios from 'axios';

const BASE_URL = 'https://euclinicaltrials.eu/ctis-public-api/search';

const PAYLOAD = {
  pagination:     { page: 1, size: 50 },
  sort:           { property: 'decisionDate', direction: 'DESC' },
  searchCriteria: { containAll: 'achondroplasia' },
};

const STATUS_MAP = {
  1: 'Authorised',
  2: 'Ongoing',
  3: 'Completed',
  4: 'Withdrawn',
  5: 'Suspended',
  6: 'Prohibited by CA',
  7: 'Temporarily Halted',
  8: 'Under evaluation',
};

export async function fetch() {
  const res = await axios.post(BASE_URL, PAYLOAD, {
    headers: { 'Content-Type': 'application/json' },
    timeout: 20000,
  });

  const trials = res.data?.data ?? [];

  return trials.map(trial => ({
    source:       'ctis',
    external_id:  trial.ctNumber,
    title:        trial.ctTitle ?? trial.shortTitle ?? null,
    summary:      trial.primaryEndPoint ?? trial.endPoint ?? null,
    url:          `https://euclinicaltrials.eu/search-for-clinical-trials/?lang=en#${trial.ctNumber}`,
    published_at: trial.decisionDateOverall ?? null,
    status:       STATUS_MAP[trial.ctStatus] ?? String(trial.ctStatus ?? ''),
    phase:        trial.trialPhase ?? null,
    raw_json:     trial,
  }));
}

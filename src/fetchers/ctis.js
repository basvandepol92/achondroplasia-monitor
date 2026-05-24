import axios from 'axios';

// EU Clinical Trials Information System (CTIS) public API
const BASE_URL = 'https://euclinicaltrials.eu/ctis-public/search';

export async function fetch() {
  const res = await axios.get(BASE_URL, {
    params: {
      query: 'achondroplasia',
      page: 0,
      size: 50,
    },
  });

  const trials = res.data?.content ?? res.data?.data ?? [];

  return trials.map(trial => ({
    source:       'ctis',
    external_id:  trial.ctNumber ?? trial.id,
    title:        trial.fullTitle ?? trial.title ?? null,
    summary:      trial.primaryObjective ?? null,
    url:          `https://euclinicaltrials.eu/search-for-clinical-trials/?lang=en#${trial.ctNumber ?? trial.id}`,
    published_at: trial.startDateEU ?? trial.decisionDate ?? null,
    status:       trial.trialStatus ?? null,
    raw_json:     trial,
  }));
}

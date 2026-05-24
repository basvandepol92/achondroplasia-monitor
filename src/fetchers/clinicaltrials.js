import axios from 'axios';
import { CLINICALTRIALS_QUERY } from '../config.js';

const BASE_URL = 'https://clinicaltrials.gov/api/v2/studies';

function parseAge(ageStr) {
  if (!ageStr) return null;
  const match = ageStr.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

function isChildTrial(study) {
  const minAge = parseAge(study.MinimumAge);
  // Include if no min age specified, or min age is under 18
  return minAge === null || minAge < 18;
}

export async function fetch() {
  const response = await axios.get(BASE_URL, { params: CLINICALTRIALS_QUERY });
  const studies = response.data?.studies ?? [];

  return studies
    .filter(s => isChildTrial(s.protocolSection?.eligibilityModule ?? {}))
    .map(s => {
      const proto = s.protocolSection ?? {};
      const id = proto.identificationModule ?? {};
      const status = proto.statusModule ?? {};
      const desc = proto.descriptionModule ?? {};
      const eligibility = proto.eligibilityModule ?? {};
      const interventions = proto.armsInterventionsModule?.interventions ?? [];
      const contacts = proto.contactsLocationsModule ?? {};
      const countries = (contacts.locations ?? [])
        .map(l => l.country)
        .filter(Boolean)
        .filter((v, i, a) => a.indexOf(v) === i);

      return {
        source:       'clinicaltrials',
        external_id:  id.nctId,
        title:        id.briefTitle,
        summary:      desc.briefSummary,
        url:          `https://clinicaltrials.gov/study/${id.nctId}`,
        published_at: status.lastUpdatePostDateStruct?.date ?? status.startDateStruct?.date,
        status:       status.overallStatus,
        age_min:      eligibility.minimumAge ?? null,
        age_max:      eligibility.maximumAge ?? null,
        phase:        proto.designModule?.phases?.join(', ') ?? null,
        locations:    countries,
        raw_json:     s,
      };
    });
}

import { matchesKeyword } from './config.js';

describe('matchesKeyword', () => {
  it('matches on disease keywords', () => {
    expect(matchesKeyword('New results for ACHONDROPLASIA patients')).toBe(true);
    expect(matchesKeyword('FGFR3 mutation study')).toBe(true);
  });

  it('matches on drug keywords', () => {
    expect(matchesKeyword('Vosoritide approved by FDA')).toBe(true);
    expect(matchesKeyword('TransCon CNP phase 3 trial')).toBe(true);
  });

  it('does NOT match on company name alone', () => {
    expect(matchesKeyword('BioMarin announces new oncology drug')).toBe(false);
    expect(matchesKeyword('Ascendis Pharma Q3 earnings report')).toBe(false);
  });

  it('does NOT match on regulatory terms alone', () => {
    expect(matchesKeyword('FDA approval for new diabetes drug')).toBe(false);
    expect(matchesKeyword('phase 3 results for cancer treatment')).toBe(false);
  });

  it('returns false for unrelated text and empty input', () => {
    expect(matchesKeyword('General cancer drug trial results')).toBe(false);
    expect(matchesKeyword('')).toBe(false);
    expect(matchesKeyword(undefined)).toBe(false);
  });
});

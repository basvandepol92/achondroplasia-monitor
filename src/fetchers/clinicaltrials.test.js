import { jest } from '@jest/globals';

// Mock axios before importing the fetcher
const mockGet = jest.fn();
jest.unstable_mockModule('axios', () => ({ default: { get: mockGet } }));

const { fetch } = await import('./clinicaltrials.js');

describe('clinicaltrials fetcher', () => {
  beforeEach(() => mockGet.mockReset());

  it('returns mapped items from a valid response', async () => {
    mockGet.mockResolvedValue({
      data: {
        studies: [
          {
            protocolSection: {
              identificationModule: { nctId: 'NCT001', briefTitle: 'Test Trial' },
              statusModule: { overallStatus: 'RECRUITING', lastUpdatePostDateStruct: { date: '2024-01-01' } },
              descriptionModule: { briefSummary: 'A summary' },
              eligibilityModule: { minimumAge: '2 Years', maximumAge: '17 Years' },
              designModule: { phases: ['PHASE3'] },
              armsInterventionsModule: { interventions: [] },
              contactsLocationsModule: { locations: [{ country: 'Netherlands' }] },
            },
          },
        ],
      },
    });

    const items = await fetch();
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      source:      'clinicaltrials',
      external_id: 'NCT001',
      title:       'Test Trial',
      status:      'RECRUITING',
    });
  });

  it('excludes trials where minimum age is 18 or older', async () => {
    mockGet.mockResolvedValue({
      data: {
        studies: [
          {
            protocolSection: {
              identificationModule: { nctId: 'NCT002', briefTitle: 'Adult Trial' },
              statusModule: { overallStatus: 'RECRUITING' },
              descriptionModule: {},
              eligibilityModule: { minimumAge: '18 Years' },
              designModule: {},
              armsInterventionsModule: { interventions: [] },
              contactsLocationsModule: { locations: [] },
            },
          },
        ],
      },
    });

    const items = await fetch();
    expect(items).toHaveLength(0);
  });

  it('includes trials with no minimum age specified', async () => {
    mockGet.mockResolvedValue({
      data: {
        studies: [
          {
            protocolSection: {
              identificationModule: { nctId: 'NCT003', briefTitle: 'No Age Trial' },
              statusModule: { overallStatus: 'RECRUITING' },
              descriptionModule: {},
              eligibilityModule: {},
              designModule: {},
              armsInterventionsModule: { interventions: [] },
              contactsLocationsModule: { locations: [] },
            },
          },
        ],
      },
    });

    const items = await fetch();
    expect(items).toHaveLength(1);
  });

  it('returns empty array when API returns no studies', async () => {
    mockGet.mockResolvedValue({ data: {} });
    const items = await fetch();
    expect(items).toEqual([]);
  });
});

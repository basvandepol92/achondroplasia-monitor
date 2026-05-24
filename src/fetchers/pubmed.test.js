import { jest } from '@jest/globals';

const mockGet = jest.fn();
jest.unstable_mockModule('axios', () => ({ default: { get: mockGet } }));

const { fetch } = await import('./pubmed.js');

describe('pubmed fetcher', () => {
  beforeEach(() => mockGet.mockReset());

  it('returns mapped items for matching results', async () => {
    // First call: esearch
    mockGet.mockResolvedValueOnce({ data: { esearchresult: { idlist: ['12345'] } } });
    // Second call: esummary
    mockGet.mockResolvedValueOnce({
      data: {
        result: {
          '12345': { uid: '12345', title: 'Vosoritide for achondroplasia', source: 'NEJM', pubdate: '2024 Jan' },
        },
      },
    });

    const items = await fetch();
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ source: 'pubmed', external_id: '12345' });
  });

  it('returns empty array when no pmids found', async () => {
    mockGet.mockResolvedValueOnce({ data: { esearchresult: { idlist: [] } } });

    const items = await fetch();
    expect(items).toHaveLength(0);
    expect(mockGet).toHaveBeenCalledTimes(1); // no summary call needed
  });
});

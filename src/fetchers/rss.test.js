import { jest } from '@jest/globals';

const mockParseURL = jest.fn();
jest.unstable_mockModule('rss-parser', () => ({
  default: jest.fn().mockImplementation(() => ({ parseURL: mockParseURL })),
}));

const { fetch } = await import('./rss.js');

describe('rss fetcher', () => {
  beforeEach(() => mockParseURL.mockReset());

  it('returns items matching keywords', async () => {
    mockParseURL.mockResolvedValue({
      items: [
        { title: 'BioMarin announces vosoritide trial results', link: 'https://example.com/1', isoDate: '2024-01-01' },
        { title: 'Unrelated biotech news', link: 'https://example.com/2', isoDate: '2024-01-01' },
      ],
    });

    const items = await fetch();
    const feedCount = (await import('../config.js')).RSS_FEEDS.length;
    expect(items).toHaveLength(feedCount); // One matching item per feed
    items.forEach(item => {
      expect(item.source).toBe('rss');
      expect(item.url).toContain('example.com/1');
    });
  });

  it('filters out items with no keyword match', async () => {
    mockParseURL.mockResolvedValue({
      items: [
        { title: 'Company raises $100M for cancer drug', link: 'https://example.com/3', isoDate: '2024-01-01' },
      ],
    });

    const items = await fetch();
    expect(items).toHaveLength(0);
  });

  it('skips a feed that fails without crashing', async () => {
    mockParseURL
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({
        items: [{ title: 'achondroplasia news', link: 'https://example.com/4', isoDate: '2024-01-01' }],
      });

    const items = await fetch();
    expect(items).toHaveLength(1);
  });
});

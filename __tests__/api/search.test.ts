/**
 * Integration tests for /api/search endpoint
 */

describe('POST /api/search', () => {
  const API_URL = process.env.API_BASE_URL || 'http://localhost:3000';

  it('should return search results for valid query', async () => {
    const response = await fetch(`${API_URL}/api/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'building permits', limit: 5 }),
    });

    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data).toHaveProperty('results');
    expect(Array.isArray(data.results)).toBe(true);
    expect(data).toHaveProperty('timing_ms');
    expect(typeof data.timing_ms).toBe('number');
  });

  it('should return 400 for empty query', async () => {
    const response = await fetch(`${API_URL}/api/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: '' }),
    });

    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data).toHaveProperty('error');
  });

  it('should return 400 for query too long (>500 chars)', async () => {
    const longQuery = 'a'.repeat(501);

    const response = await fetch(`${API_URL}/api/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: longQuery }),
    });

    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data).toHaveProperty('error');
  });

  it('should return 400 for invalid JSON', async () => {
    const response = await fetch(`${API_URL}/api/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'invalid json',
    });

    expect(response.status).toBe(400);
  });

  it('should respect limit parameter', async () => {
    const response = await fetch(`${API_URL}/api/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'town', limit: 3 }),
    });

    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.results.length).toBeLessThanOrEqual(3);
  });

  it('should include cached answer if available', async () => {
    const response = await fetch(`${API_URL}/api/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'building permits' }),
    });

    expect(response.status).toBe(200);

    const data = await response.json();
    // cached_answer is optional
    if (data.cached_answer) {
      expect(data.cached_answer).toHaveProperty('answer');
      expect(data.cached_answer).toHaveProperty('sources');
      expect(Array.isArray(data.cached_answer.sources)).toBe(true);
    }
  });
});

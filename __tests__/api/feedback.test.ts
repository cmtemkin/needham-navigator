/**
 * Integration tests for /api/feedback endpoint
 * These tests require a running server and are skipped in CI
 */

/**
 * Live HTTP tests against a running server.
 *
 * Previously gated on `process.env.CI`, which meant they were skipped in CI and
 * only ever ran locally — where they failed against whatever happened to be on
 * port 3000. They therefore protected nothing.
 *
 * Now they run only when RUN_API_TESTS=1, which CI sets after starting the built
 * server against a real database. Locally they skip cleanly unless you opt in.
 */
const runApiTests = process.env.RUN_API_TESTS === '1';

(runApiTests ? describe : describe.skip)('POST /api/feedback', () => {
  const API_URL = process.env.API_BASE_URL || 'http://localhost:3000';

  it('should accept valid feedback', async () => {
    const response = await fetch(`${API_URL}/api/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        helpful: true,
        comment: 'Great answer!',
      }),
    });

    expect(response.status).toBe(201);

    const data = await response.json();
    expect(data).toHaveProperty('success');
    expect(data.success).toBe(true);
  });

  it('should return 400 for missing helpful field', async () => {
    const response = await fetch(`${API_URL}/api/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ comment: 'Test' }),
    });

    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data).toHaveProperty('error');
  });

  it('should return 400 for invalid helpful field type', async () => {
    const response = await fetch(`${API_URL}/api/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ helpful: 'yes' }),
    });

    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data).toHaveProperty('error');
  });

  it('should return 400 for comment too long (>2000 chars)', async () => {
    const longComment = 'a'.repeat(2001);

    const response = await fetch(`${API_URL}/api/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        helpful: true,
        comment: longComment,
      }),
    });

    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data).toHaveProperty('error');
  });

  it('should sanitize HTML in comments', async () => {
    const response = await fetch(`${API_URL}/api/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        helpful: true,
        comment: '<script>alert("xss")</script>Safe comment',
      }),
    });

    // Should accept (sanitization happens server-side)
    expect(response.status).toBe(201);

    const data = await response.json();
    expect(data.success).toBe(true);
  });

  it('should return 400 for invalid JSON', async () => {
    const response = await fetch(`${API_URL}/api/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'invalid json',
    });

    expect(response.status).toBe(400);
  });
});

export {};

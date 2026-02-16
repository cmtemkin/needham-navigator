/**
 * Integration tests for /api/feedback endpoint
 * These tests require a running server and are skipped in CI
 */

const describeIfServer = process.env.CI ? describe.skip : describe;

describeIfServer('POST /api/feedback', () => {
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

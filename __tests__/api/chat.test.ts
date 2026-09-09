/**
 * Integration tests for /api/chat endpoint
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

(runApiTests ? describe : describe.skip)('POST /api/chat', () => {
  const API_URL = process.env.API_BASE_URL || 'http://localhost:3000';

  it('should return streaming response for valid message', async () => {
    const response = await fetch(`${API_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'What are the library hours?' }],
      }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/event-stream');

    // Read first few bytes of stream to verify SSE format
    const reader = response.body?.getReader();
    expect(reader).toBeDefined();
    if (reader) {
      const { done, value } = await reader.read();
      expect(done).toBe(false);
      expect(value).toBeDefined();

      const chunk = new TextDecoder().decode(value);
      // Should contain SSE data prefix
      expect(chunk).toContain('data:');

      reader.releaseLock();
    }
  }, 30000); // 30 second timeout for integration test with real API calls

  it('should return 400 for empty messages array', async () => {
    const response = await fetch(`${API_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [] }),
    });

    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data).toHaveProperty('error');
  });

  it('should return 400 for messages without user role', async () => {
    const response = await fetch(`${API_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'assistant', content: 'Hello' }],
      }),
    });

    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data).toHaveProperty('error');
  });

  it('should return 400 for invalid JSON', async () => {
    const response = await fetch(`${API_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'invalid json',
    });

    expect(response.status).toBe(400);
  });
});

export {};

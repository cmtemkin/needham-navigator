/**
 * Integration tests for /api/chat endpoint
 */

describe('POST /api/chat', () => {
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
  });

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

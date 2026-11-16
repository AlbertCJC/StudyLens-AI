import { mutateJSON, postJSON, setAuthToken } from '../client';

describe('mobile API error mapping', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    setAuthToken(null);
    jest.clearAllMocks();
  });

  it('surfaces the server error message from mutateJSON', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: 'Invalid credentials' }),
    });

    await expect(mutateJSON('/auth/login', 'POST', {})).rejects.toThrow('Invalid credentials');
  });

  it('maps network failures to an offline message', async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error('network down'));

    await expect(mutateJSON('/quizzes', 'DELETE')).rejects.toThrow("Couldn't reach the StudyLens server");
  });

  it('maps expired sessions to a sign-in message', async () => {
    jest.useFakeTimers();
    setAuthToken('expired-token');
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({}),
    });

    await expect(mutateJSON('/reports', 'POST', {})).rejects.toThrow('Your session has expired');
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('returns an empty object for a 204 response', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 204,
      json: async () => ({}),
    });

    await expect(mutateJSON('/notifications/1', 'DELETE')).resolves.toEqual({});
  });

  it('falls back to the provided value when postJSON cannot reach the server', async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error('offline'));

    await expect(postJSON('/quizzes', {}, () => [{ id: 'demo' }])).resolves.toEqual([{ id: 'demo' }]);
  });
});

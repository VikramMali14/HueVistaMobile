import { ApiError, errorFromThrown, userMessage } from './errors';

describe('ApiError', () => {
  it('carries status, code and field errors', () => {
    const err = new ApiError({
      message: 'Invalid',
      status: 422,
      code: 'VALIDATION',
      fieldErrors: { email: ['is required'] },
    });
    expect(err).toBeInstanceOf(Error);
    expect(err.status).toBe(422);
    expect(err.code).toBe('VALIDATION');
    expect(err.fieldErrors?.email).toEqual(['is required']);
    expect(err.isNetwork).toBe(false);
  });
});

describe('errorFromThrown', () => {
  it('passes ApiError through unchanged', () => {
    const original = new ApiError({ message: 'x', status: 500 });
    expect(errorFromThrown(original)).toBe(original);
  });

  it('wraps a plain Error as a network ApiError', () => {
    const err = errorFromThrown(new Error('socket hang up'));
    expect(err).toBeInstanceOf(ApiError);
    expect(err.isNetwork).toBe(true);
    expect(err.status).toBe(0);
    expect(err.message).toBe('socket hang up');
  });

  it('wraps a non-Error value', () => {
    const err = errorFromThrown('boom');
    expect(err.isNetwork).toBe(true);
    expect(err.message).toBe('Network request failed');
  });
});

describe('userMessage', () => {
  it('uses a friendly line for network failures', () => {
    const err = new ApiError({ message: 'raw', status: 0, isNetwork: true });
    expect(userMessage(err)).toMatch(/connection/i);
  });

  it('surfaces the backend message for HTTP errors', () => {
    const err = new ApiError({ message: 'Email already in use', status: 409 });
    expect(userMessage(err)).toBe('Email already in use');
  });

  it('falls back for unknown throwables', () => {
    expect(userMessage({})).toMatch(/something went wrong/i);
  });
});

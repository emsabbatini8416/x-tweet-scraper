import { describe, expect, it } from 'vitest';

import { validateInput } from '../src/input.js';

describe('validateInput', () => {
  it('defaults includeReplies and includeRetweets to false', () => {
    const input = validateInput({ fromUsers: ['apify'] });
    expect(input.includeReplies).toBe(false);
    expect(input.includeRetweets).toBe(false);
  });

  it('treats date-only since/until as an inclusive UTC day window', () => {
    const input = validateInput({
      fromUsers: ['apify'],
      since: '2026-01-15',
      until: '2026-01-15',
    });
    expect(input.since).toBe('2026-01-15T00:00:00.000Z');
    expect(input.until).toBe('2026-01-15T23:59:59.999Z');
  });
});

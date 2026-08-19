import { describe, expect, it } from 'vitest';

import { calculateRunLimits, resolveEntitlement } from '../src/entitlement.js';
import { validateInput } from '../src/input.js';
import type { ActorInput, Entitlement } from '../src/types.js';

const free: Entitlement = { paid: false, status: 'free', source: 'store' };
const paid: Entitlement = { paid: true, status: 'paid', source: 'store' };

describe('free-tier entitlement', () => {
  it('allows FREE maxResults 5', () => {
    expect(calculateRunLimits(5, free).effective).toBe(5);
  });

  it('caps FREE maxResults 1000 at 10', () => {
    expect(calculateRunLimits(1000, free)).toEqual({
      requested: 1000,
      effective: 10,
      limited: true,
      reason: 'free_tier',
      cap: 10,
    });
  });

  it('allows PAID maxResults 100', () => {
    expect(calculateRunLimits(100, paid).effective).toBe(100);
  });

  it('fails closed when entitlement lookup fails', async () => {
    const entitlement = await resolveEntitlement({
      userId: 'user-1',
      lookup: async () => {
        throw new Error('unavailable');
      },
    });
    expect(entitlement.paid).toBe(false);
    expect(entitlement.status).toBe('unknown');
    expect(calculateRunLimits(1000, entitlement).effective).toBe(10);
  });

  it('treats unknown or missing users as FREE', async () => {
    const unknown = await resolveEntitlement({
      userId: 'unknown',
      lookup: async () => null,
    });
    const missing = await resolveEntitlement({ userId: null });
    expect(unknown.paid).toBe(false);
    expect(missing.paid).toBe(false);
  });

  it('does not allow undocumented input fields to bypass the cap', () => {
    const raw = {
      fromUsers: ['apify'],
      maxResults: 1000,
      paid: true,
      entitlement: 'paid',
    } as ActorInput & { paid: boolean; entitlement: string };
    const input = validateInput(raw);
    expect(calculateRunLimits(input.maxResults, free).effective).toBe(10);
  });
});

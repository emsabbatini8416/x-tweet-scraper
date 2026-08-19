import { ApifyClient } from 'apify-client';

import type { Entitlement, RunLimits } from './types.js';
import { asRecord } from './utils.js';

export const FREE_TIER_CAP = 10;

export interface EntitlementOptions {
  userId: string | null | undefined;
  storeId?: string;
  storeToken?: string;
  lookup?: (userId: string) => Promise<unknown>;
}

export async function resolveEntitlement(options: EntitlementOptions): Promise<Entitlement> {
  if (!options.userId) return { paid: false, status: 'unknown', source: 'default' };

  try {
    let value: unknown;
    if (options.lookup !== undefined) {
      value = await options.lookup(options.userId);
    } else {
      if (!options.storeId || !options.storeToken) {
        return { paid: false, status: 'unknown', source: 'default' };
      }
      const client = new ApifyClient({ token: options.storeToken });
      const record = await client.keyValueStore(options.storeId).getRecord(options.userId);
      value = record?.value;
    }

    const record = asRecord(value);
    if (record?.paid === true) return { paid: true, status: 'paid', source: 'store' };
    return { paid: false, status: 'free', source: 'store' };
  } catch {
    return { paid: false, status: 'unknown', source: 'default' };
  }
}

export function calculateRunLimits(maxResults: number, entitlement: Entitlement): RunLimits {
  const effective = entitlement.paid ? maxResults : Math.min(maxResults, FREE_TIER_CAP);
  return {
    requested: maxResults,
    effective,
    limited: !entitlement.paid && maxResults > FREE_TIER_CAP,
    reason: !entitlement.paid && maxResults > FREE_TIER_CAP ? 'free_tier' : null,
    cap: entitlement.paid ? null : FREE_TIER_CAP,
  };
}

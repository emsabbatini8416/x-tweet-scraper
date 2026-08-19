import { gotScraping } from 'got-scraping';

import { asRecord, asString, delayWithJitter } from './utils.js';

const TOKEN_TTL_MS = 30 * 60 * 1_000;

class GuestTokenActivationError extends Error {
  public constructor(
    message: string,
    public readonly retryable: boolean,
  ) {
    super(message);
  }
}

export class GuestTokenManager {
  private token: string | null = null;
  private expiresAt = 0;
  private pending: Promise<string> | null = null;

  public constructor(
    private readonly bearerToken: string,
    private readonly getProxyUrl: () => Promise<string | undefined>,
    private readonly onStatus: (statusCode: number) => void = () => undefined,
  ) {}

  public async get(): Promise<string> {
    if (this.token !== null && Date.now() < this.expiresAt) return this.token;
    if (this.pending !== null) return this.pending;

    this.pending = this.activate().finally(() => {
      this.pending = null;
    });
    return this.pending;
  }

  public invalidate(token?: string): void {
    if (token === undefined || token === this.token) {
      this.token = null;
      this.expiresAt = 0;
    }
  }

  private async activate(): Promise<string> {
    let lastError: unknown;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const proxyUrl = await this.getProxyUrl();
        const response = await gotScraping.post('https://api.x.com/1.1/guest/activate.json', {
          headers: {
            authorization: `Bearer ${this.bearerToken}`,
          },
          ...(proxyUrl === undefined ? {} : { proxyUrl }),
          timeout: { request: 15_000 },
          retry: { limit: 0 },
          throwHttpErrors: false,
        });

        this.onStatus(response.statusCode);
        if (response.statusCode >= 500 || response.statusCode === 429) {
          throw new GuestTokenActivationError(
            `Guest token activation returned HTTP ${response.statusCode}`,
            true,
          );
        }
        if (response.statusCode !== 200) {
          throw new GuestTokenActivationError(
            `Guest token activation failed with HTTP ${response.statusCode}`,
            false,
          );
        }

        let parsed: unknown;
        try {
          parsed = JSON.parse(response.body);
        } catch {
          throw new GuestTokenActivationError(
            'Guest token activation returned invalid JSON',
            false,
          );
        }
        const body = asRecord(parsed);
        const token = asString(body?.guest_token);
        if (token === null) {
          throw new GuestTokenActivationError(
            'Guest token activation returned an invalid response',
            false,
          );
        }

        this.token = token;
        this.expiresAt = Date.now() + TOKEN_TTL_MS;
        return token;
      } catch (error) {
        lastError = error;
        if (error instanceof GuestTokenActivationError && !error.retryable) throw error;
        if (attempt < 2) await delayWithJitter(attempt);
      }
    }
    throw lastError instanceof Error ? lastError : new Error('Guest token activation failed');
  }
}

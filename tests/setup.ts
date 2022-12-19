import MockRedis from 'ioredis-mock';
import { beforeAll, vi } from 'vitest';

import { AppDataSource } from '../lib/orm';

vi.mock('../lib/redis', () => {
  return {
    default: new MockRedis(),
    Subscriber: new MockRedis(),
  };
});

vi.mock('../lib/externals/hcaptcha', () => {
  return {
    createHCaptchaDriver: () => {
      return { verify: (res: string) => Promise.resolve(res === 'fake-response') };
    },
    HCaptcha: class {
      verify(res: string): Promise<boolean> {
        return Promise.resolve(res === 'fake-response');
      }
    },
  };
});

vi.mock('../lib/externals/turnstile', () => {
  return {
    createTurnstileDriver: () => {
      return { verify: (res: string) => Promise.resolve(res === 'fake-response') };
    },
    Turnstile: class {
      verify(res: string): Promise<boolean> {
        return Promise.resolve(res === 'fake-response');
      }
    },
  };
});

beforeAll(async () => {
  await AppDataSource.initialize();
});

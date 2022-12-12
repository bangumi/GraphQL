import * as crypto from 'node:crypto';

import { createError } from '@fastify/error';
import { Type as t } from '@sinclair/typebox';
import * as bcrypt from 'bcrypt';
import httpCodes from 'http-status-codes';

import { NeedLoginError } from '../../../auth';
import * as session from '../../../auth/session';
import { hCaptchaConfigKey, redisPrefix, TURNSTILE_SECRET_KEY } from '../../../config';
import { createHCaptchaDriver } from '../../../externals/hcaptcha';
import { createTurnstileDriver } from '../../../externals/turnstile';
import { Tag } from '../../../openapi';
import prisma from '../../../prisma';
import redis from '../../../redis';
import { avatar } from '../../../response';
import type { IResUser } from '../../../types';
import { ErrorRes, formatError, formatErrors, ResUser } from '../../../types';
import Limiter from '../../../utils/rate-limit';
import type { App } from '../../type';

export const CookieKey = 'sessionID';

const TooManyRequestsError = createError(
  'TOO_MANY_REQUESTS',
  'too many failed login attempts',
  httpCodes.TOO_MANY_REQUESTS,
);

const CaptchaError = createError('CAPTCHA_ERROR', 'wrong captcha', httpCodes.UNAUTHORIZED);

const EmailOrPasswordError = createError(
  'EMAIL_PASSWORD_ERROR',
  'email does not exists or email and password not match',
  httpCodes.UNAUTHORIZED,
);

const LimitInTimeWindow = 10;

// eslint-disable-next-line @typescript-eslint/require-await
export async function setup(app: App) {
  // 10 calls per 600s
  const limiter = new Limiter({
    redisClient: redis,
    limit: LimitInTimeWindow,
    duration: 600,
  });

  const hCaptcha = createHCaptchaDriver(hCaptchaConfigKey);

  app.addSchema(ResUser);
  app.addSchema(ErrorRes);

  app.post(
    '/logout',
    {
      schema: {
        description: '登出',
        operationId: 'logout',
        tags: [Tag.Auth],
        response: {
          200: {},
          401: t.Ref(ErrorRes, {
            description: '未登录',
            'x-examples': {
              NeedLoginError: { value: formatError(NeedLoginError('logout')) },
            },
          }),
        },
      },
    },
    async (req, res) => {
      if (!req.auth.login) {
        throw new NeedLoginError('logout');
      }

      if (!req.cookies.sessionID) {
        throw new Error('missing cookies sessionID');
      }

      void res.clearCookie(CookieKey);
      await session.revoke(req.cookies.sessionID);
    },
  );

  app.post(
    '/login',
    {
      schema: {
        description: `需要 [hCaptcha的验证码](https://docs.hcaptcha.com/#add-the-hcaptcha-widget-to-your-webpage)

site-key 是 \`4874acee-9c6e-4e47-99ad-e2ea1606961f\``,
        operationId: 'login',
        tags: [Tag.Auth],
        response: {
          200: t.Ref(ResUser, {
            headers: {
              'Set-Cookie': t.String({ description: 'example: "sessionID=12345abc"' }),
            },
          }),
          400: t.Ref(ErrorRes, {
            description: '缺少字段等',
          }),
          401: t.Ref(ErrorRes, {
            description: '验证码错误/账号密码不匹配',
            headers: {
              'X-RateLimit-Remaining': t.Integer({ description: 'remaining rate limit' }),
              'X-RateLimit-Limit': t.Integer({ description: 'total limit per 10 minutes' }),
              'X-RateLimit-Reset': t.Integer({ description: 'seconds to reset rate limit' }),
            },
            'x-examples': formatErrors(new CaptchaError(), new EmailOrPasswordError()),
          }),
          429: t.Ref(ErrorRes, {
            description: '失败次数太多，需要过一段时间再重试',
            headers: {
              'X-RateLimit-Remaining': t.Integer({ description: 'remaining rate limit' }),
              'X-RateLimit-Limit': t.Integer({ description: 'limit per 10 minutes' }),
              'X-RateLimit-Reset': t.Integer({ description: 'seconds to reset rate limit' }),
            },
            examples: [formatError(TooManyRequestsError())],
          }),
        },
        body: t.Object(
          {
            email: t.String({ minLength: 1 }),
            password: t.String({ minLength: 1 }),
            'h-captcha-response': t.String({ minLength: 1 }),
          },
          {
            examples: [
              {
                email: 'treeholechan@gmail.com',
                password: 'lovemeplease',
                'h-captcha-response': '10000000-aaaa-bbbb-cccc-000000000001',
              },
            ],
          },
        ),
      },
    },
    async function handler(
      { body: { email, password, 'h-captcha-response': hCaptchaResponse }, clientIP },
      res,
    ): Promise<IResUser> {
      const { remain, reset } = await limiter.get(`${redisPrefix}-login-rate-limit-${clientIP}`);
      void res.headers({
        'X-RateLimit-Remaining': remain,
        'X-RateLimit-Limit': LimitInTimeWindow,
        'X-RateLimit-Reset': reset,
      });
      if (remain <= 0) {
        throw new TooManyRequestsError();
      }

      if (!(await hCaptcha.verify(hCaptchaResponse))) {
        throw new CaptchaError();
      }

      const user = await prisma.members.findFirst({ where: { email } });
      if (!user) {
        throw new EmailOrPasswordError();
      }
      if (!(await comparePassword(user.password_crypt, password))) {
        throw new EmailOrPasswordError();
      }

      const token = await session.create({
        id: user.id,
        regTime: user.regdate,
      });

      void res.cookie(CookieKey, token, { sameSite: 'strict' });

      return {
        ...user,
        user_group: user.groupid,
        avatar: avatar(user.avatar),
      };
    },
  );

  const turnstile = createTurnstileDriver(TURNSTILE_SECRET_KEY);

  app.post(
    '/login2',
    {
      schema: {
        description: `需要 [turnstile](https://developers.cloudflare.com/turnstile/get-started/client-side-rendering/)

site-key 是 \`0x4AAAAAAAAu7JMNAS8r2xDe\``,
        operationId: 'login',
        tags: [Tag.Auth],
        response: {
          200: t.Ref(ResUser, {
            headers: {
              'Set-Cookie': t.String({ description: 'example: "sessionID=12345abc"' }),
            },
          }),
          400: t.Ref(ErrorRes, {
            description: '缺少字段等',
          }),
          401: t.Ref(ErrorRes, {
            description: '验证码错误/账号密码不匹配',
            headers: {
              'X-RateLimit-Remaining': t.Integer({ description: 'remaining rate limit' }),
              'X-RateLimit-Limit': t.Integer({ description: 'total limit per 10 minutes' }),
              'X-RateLimit-Reset': t.Integer({ description: 'seconds to reset rate limit' }),
            },
            'x-examples': formatErrors(new CaptchaError(), new EmailOrPasswordError()),
          }),
          429: t.Ref(ErrorRes, {
            description: '失败次数太多，需要过一段时间再重试',
            headers: {
              'X-RateLimit-Remaining': t.Integer({ description: 'remaining rate limit' }),
              'X-RateLimit-Limit': t.Integer({ description: 'limit per 10 minutes' }),
              'X-RateLimit-Reset': t.Integer({ description: 'seconds to reset rate limit' }),
            },
            examples: [formatError(TooManyRequestsError())],
          }),
        },
        body: t.Object(
          {
            email: t.String({ minLength: 1 }),
            password: t.String({ minLength: 1 }),
            'cf-turnstile-response': t.String({ minLength: 1 }),
          },
          {
            examples: [
              {
                email: 'treeholechan@gmail.com',
                password: 'lovemeplease',
                'cf-turnstile-response': '10000000-aaaa-bbbb-cccc-000000000001',
              },
            ],
          },
        ),
      },
    },
    async function handler(
      { body: { email, password, 'cf-turnstile-response': cfCaptchaResponse }, clientIP },
      res,
    ): Promise<IResUser> {
      const { remain, reset } = await limiter.get(`${redisPrefix}-login-rate-limit-${clientIP}`);
      void res.headers({
        'X-RateLimit-Remaining': remain,
        'X-RateLimit-Limit': LimitInTimeWindow,
        'X-RateLimit-Reset': reset,
      });
      if (remain <= 0) {
        throw new TooManyRequestsError();
      }

      if (!(await turnstile.verify(cfCaptchaResponse))) {
        throw new CaptchaError();
      }

      const user = await prisma.members.findFirst({ where: { email } });
      if (!user) {
        throw new EmailOrPasswordError();
      }
      if (!(await comparePassword(user.password_crypt, password))) {
        throw new EmailOrPasswordError();
      }

      const token = await session.create({
        id: user.id,
        regTime: user.regdate,
      });

      void res.cookie(CookieKey, token, { sameSite: 'strict' });

      return {
        ...user,
        user_group: user.groupid,
        avatar: avatar(user.avatar),
      };
    },
  );
}

function processPassword(s: string): string {
  return crypto.createHash('md5').update(s).digest('hex');
}

export async function comparePassword(hashed: string, input: string): Promise<boolean> {
  return bcrypt.compare(processPassword(input), hashed);
}

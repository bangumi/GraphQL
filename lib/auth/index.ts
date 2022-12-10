import { createError } from '@fastify/error';
import NodeCache from 'node-cache';

import { redisPrefix } from '../config';
import type { IUser, Permission } from '../orm';
import { fetchPermission, fetchUser } from '../orm';
import prisma from '../prisma';
import redis from '../redis';

const tokenPrefix = 'Bearer ';
export const NeedLoginError = createError('NEED_LOGIN', 'you need to login before %s', 401);
const HeaderInvalidError = createError('AUTHORIZATION_INVALID', '%s', 401);
const TokenNotValidError = createError(
  'TOKEN_INVALID',
  "can't find access token or it has been expired",
  401,
);
const MissingUserError = createError('MISSING_USER', "can't find user", 500);

export interface IAuth {
  login: boolean;
  allowNsfw: boolean;
  permission: Readonly<Permission>;
  user: null | IUser;
}

export async function byHeader(key: string | string[] | undefined): Promise<IAuth> {
  if (!key) {
    return emptyAuth();
  }

  if (Array.isArray(key)) {
    throw new HeaderInvalidError("can't providing multiple access token");
  }

  if (!key.startsWith(tokenPrefix)) {
    throw new HeaderInvalidError('authorization header should have "Bearer ${TOKEN}" format');
  }

  const token = key.slice(tokenPrefix.length);
  if (!token) {
    throw new HeaderInvalidError('authorization header missing token');
  }

  return await byToken(token);
}

export async function byToken(access_token: string): Promise<IAuth> {
  const key = `${redisPrefix}-auth-access-token-${access_token}`;
  const cached = await redis.get(key);
  if (cached) {
    const user = JSON.parse(cached) as IUser;
    return await userToAuth(user);
  }

  const token = await prisma.chii_oauth_access_tokens.findFirst({
    where: { access_token, expires: { gte: new Date() } },
  });

  if (!token) {
    throw new TokenNotValidError();
  }

  const u = await fetchUser(Number.parseInt(token.user_id));
  if (!u) {
    throw new MissingUserError();
  }

  await redis.set(key, JSON.stringify(u), 'EX', 60 * 60 * 24);

  return await userToAuth(u);
}

export async function byUserID(userID: number): Promise<IAuth> {
  const key = `${redisPrefix}-auth-user-id-${userID}`;
  const cached = await redis.get(key);
  if (cached) {
    return await userToAuth(JSON.parse(cached) as IUser);
  }

  const u = await fetchUser(userID);
  if (!u) {
    throw new MissingUserError();
  }

  await redis.set(key, JSON.stringify(u), 'EX', 60 * 60 * 24);

  return await userToAuth(u);
}

const permissionCache = new NodeCache({ stdTTL: 60 * 10 });

async function getPermission(userGroup?: number): Promise<Readonly<Permission>> {
  if (!userGroup) {
    return {};
  }

  const cached = permissionCache.get(userGroup);
  if (cached) {
    return cached;
  }

  const p = await fetchPermission(userGroup);

  permissionCache.set(userGroup, p);

  return p;
}

export function emptyAuth(): IAuth {
  return {
    user: null,
    login: true,
    permission: {},
    allowNsfw: false,
  };
}

async function userToAuth(user: IUser): Promise<IAuth> {
  return {
    user: user,
    login: true,
    permission: await getPermission(user.groupID),
    allowNsfw: user.regTime - Date.now() / 1000 <= 60 * 60 * 24 * 90,
  };
}

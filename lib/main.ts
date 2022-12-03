import AltairFastify from 'altair-fastify-plugin';
import mercurius from 'mercurius';
import type { FastifyInstance, FastifyRequest, FastifyServerOptions } from 'fastify';
import { default as fastify } from 'fastify';

import { schema } from './graphql/schema';
import type { Context } from './graphql/context';
import prisma from './prisma';
import * as auth from './auth';

function createServer(opts: FastifyServerOptions = {}): FastifyInstance {
  const server = fastify(opts);

  server.register(mercurius, {
    schema,
    path: '/v0/graphql',
    graphiql: false,
    context: async (request: FastifyRequest): Promise<Context> => {
      const key = request.headers.authorization;
      if (Array.isArray(key)) {
        throw new Error("can't providing multiple access token");
      }
      if (!key) {
        return { prisma, user: { login: false, permission: {}, allowNsfw: false } };
      }
      if (!key.startsWith('Bearer ')) {
        throw new Error('authorization header should have "Bearer ${TOKEN}" format');
      }

      return {
        prisma,
        user: await auth.byToken(key.slice('Bearer '.length)),
      };
    },
  });
  // @ts-ignore
  server.register(AltairFastify, {
    path: '/v0/altair/',
    baseURL: '/v0/altair/',
    endpointURL: '/v0/graphql',
    initialSettings: {
      theme: 'dark',
      plugin: {
        list: ['altair-graphql-plugin-graphql-explorer'],
      },
    },
  });

  return server;
}

const server = createServer({
  logger: { level: 'info' },
  disableRequestLogging: process.env.ENABLE_REQUEST_LOGGING !== 'true',
});

const port = 4000;
await server.listen({ port, host: '0.0.0.0' });

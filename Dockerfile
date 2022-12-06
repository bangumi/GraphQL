FROM node:18-slim as builder

WORKDIR /usr/src/app

COPY . ./

# generate prisma client

RUN yarn \
  && rm node_modules -rf \
  && yarn --prod

##############

FROM node:18-slim

WORKDIR /usr/src/app
ENV NODE_ENV=production
ENTRYPOINT [ "node", "--no-warnings", "--loader=ts-node/esm/transpile-only", "--experimental-specifier-resolution=node", "--enable-source-maps", "lib/main.ts" ]

COPY --from=builder /usr/src/app/ ./

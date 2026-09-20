# syntax=docker/dockerfile:1

###############################################################################
# SplitMoney — single image containing the API and the built frontend.
#
# The frontend is built here and served by the Express server at runtime, so the
# whole app answers on one origin. That is what removes CORS, cross-site cookie
# and service-worker problems from the deployment entirely.
#
# Build from the repository root:
#   docker build -t splitmoney .
###############################################################################


###############################################################################
# 1. Build the frontend
#
# Vite inlines every VITE_* value at BUILD time, so these have to be present now
# rather than in the running container. They are all public by definition -- they
# end up in the JavaScript bundle either way -- so passing them as build args is
# safe. Never pass a secret this way.
###############################################################################
FROM node:24-alpine AS client-build

WORKDIR /build

# Dependencies first: this layer is cached until the lockfile actually changes,
# which is what keeps rebuilds fast.
COPY client/package*.json ./
RUN npm ci

COPY client/ ./

ARG VITE_API_BASE_URL=""
ARG VITE_SOCKET_URL=""
ARG VITE_APP_NAME="SplitMoney"
ARG VITE_CLOUDINARY_CLOUD_NAME=""
ARG VITE_CLOUDINARY_UPLOAD_PRESET=""
ARG VITE_CLOUDINARY_FOLDER="splitmoney"
ARG VITE_VAPID_PUBLIC_KEY=""
ARG VITE_MAX_UPLOAD_BYTES="5242880"

ENV VITE_API_BASE_URL=$VITE_API_BASE_URL \
    VITE_SOCKET_URL=$VITE_SOCKET_URL \
    VITE_APP_NAME=$VITE_APP_NAME \
    VITE_CLOUDINARY_CLOUD_NAME=$VITE_CLOUDINARY_CLOUD_NAME \
    VITE_CLOUDINARY_UPLOAD_PRESET=$VITE_CLOUDINARY_UPLOAD_PRESET \
    VITE_CLOUDINARY_FOLDER=$VITE_CLOUDINARY_FOLDER \
    VITE_VAPID_PUBLIC_KEY=$VITE_VAPID_PUBLIC_KEY \
    VITE_MAX_UPLOAD_BYTES=$VITE_MAX_UPLOAD_BYTES

RUN npm run build


###############################################################################
# 2. Server dependencies
#
# Installed in their own stage so the final image copies a finished node_modules
# rather than carrying npm's cache and build toolchain along with it.
###############################################################################
FROM node:24-alpine AS server-deps

WORKDIR /build

COPY server/package*.json ./
# `--omit=dev` is deliberately NOT used: the server runs TypeScript directly via
# tsx, and drizzle-kit is needed for migrations. Both live in dependencies, but
# pruning here has bitten this project before on Render, so it is called out.
RUN npm ci


###############################################################################
# 3. Runtime
###############################################################################
FROM node:24-alpine AS runtime

# tini reaps zombies and forwards signals, so `docker stop` actually stops Node
# instead of waiting out the timeout and killing it.
RUN apk add --no-cache tini

ENV NODE_ENV=production
WORKDIR /app

COPY --from=server-deps /build/node_modules ./node_modules
COPY server/package*.json ./
COPY server/ ./

# The built SPA, served by Express. Path matches CLIENT_DIST_PATH below.
COPY --from=client-build /build/dist ./client-dist
ENV CLIENT_DIST_PATH=/app/client-dist

# Run as a non-root user. The node image already provides one.
RUN chown -R node:node /app
USER node

EXPOSE 5000

# Compose has no way to know the app is ready otherwise, and it is what lets
# `depends_on: condition: service_healthy` mean something.
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||5000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/sbin/tini", "--"]

# `npm start` runs pending database migrations and then boots the server, so a
# deploy that adds a migration applies it on start with no extra step.
CMD ["npm", "start"]

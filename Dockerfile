# Build frontend Vite + storie Twine
FROM node:24-alpine AS app-build

WORKDIR /app

COPY package.json ./package.json
COPY package-lock.json ./package-lock.json
RUN npm ci

COPY app-env.js ./app-env.js
COPY audio.js ./audio.js
COPY cards.js ./cards.js
COPY family-voice.html ./family-voice.html
COPY family-voice.js ./family-voice.js
COPY fonts ./fonts
COPY game.js ./game.js
COPY index.html ./index.html
COPY print.html ./print.html
COPY print.js ./print.js
COPY sketch.js ./sketch.js
COPY scripts ./scripts
COPY stories ./stories
COPY style.css ./style.css
COPY tts.js ./tts.js
COPY vite.config.js ./vite.config.js
COPY assets ./assets

RUN node scripts/build-stories.js && npx vite build

# Runtime Node leggero: statici, auth, salvataggio registrazioni e proxy Piper
FROM node:24-alpine

WORKDIR /app

COPY . .
COPY --from=app-build /app/stories/generated ./stories/generated
COPY --from=app-build /app/dist ./dist

ENV APP_PORT=80
ENV APP_STATIC_ROOT=/app/dist

EXPOSE 80

CMD ["node", "server/app-server.js"]

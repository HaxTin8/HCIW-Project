# Build delle storie Twine in JSON runtime
FROM node:20-alpine AS stories-build

WORKDIR /app

COPY package.json ./package.json
COPY scripts ./scripts
COPY stories ./stories

RUN node scripts/build-stories.js

# Serve i file statici con nginx
FROM nginx:alpine

# Rimuove la pagina di default
RUN rm -rf /usr/share/nginx/html/*

# Copia tutta l'app nella cartella servita da nginx
COPY . /usr/share/nginx/html
COPY --from=stories-build /app/stories/generated /usr/share/nginx/html/stories/generated

# Espone la porta 80
EXPOSE 80

# nginx parte in foreground di default nell'immagine ufficiale

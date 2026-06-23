# Serve i file statici con nginx
FROM nginx:alpine

# Rimuove la pagina di default
RUN rm -rf /usr/share/nginx/html/*

# Copia tutta l'app nella cartella servita da nginx
COPY . /usr/share/nginx/html

# Espone la porta 80
EXPOSE 80

# nginx parte in foreground di default nell'immagine ufficiale

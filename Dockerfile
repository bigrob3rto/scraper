# Playwright ufficiale con Chromium già installato
FROM mcr.microsoft.com/playwright:v1.59.1-jammy

# directory di lavoro
WORKDIR /app

# copia solo package per cache install dipendenze
COPY package*.json ./

# install dipendenze Node (pulito e veloce)
RUN npm ci

# copia tutto il progetto
COPY . .

# esponi porta (Render la mapperà automaticamente)
EXPOSE 3000

# avvio app
CMD ["node", "app.js"]
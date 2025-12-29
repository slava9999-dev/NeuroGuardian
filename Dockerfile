FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3000
# Running local api server with tsx
CMD ["npx", "tsx", "scripts/local-api-server.mjs"]

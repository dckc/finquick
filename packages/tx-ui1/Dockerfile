FROM node:18-alpine
WORKDIR /usr/src/app
COPY package*.json ./
RUN yarn install --production --frozen-lockfile
COPY . .
EXPOSE 8080
ENV NODE_ENV=production
CMD ["node", "server/server.js"]
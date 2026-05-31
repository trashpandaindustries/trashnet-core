FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Build step might be needed if they compile fullstack, but for now we can just use tsx or compile standard express
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]

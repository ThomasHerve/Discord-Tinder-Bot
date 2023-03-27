FROM node:16.14.0
WORKDIR /app
COPY src .
COPY package* .
RUN npm install
CMD ["node", "index.js"]
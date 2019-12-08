FROM node:10-slim

RUN apt-get update -y

WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build
COPY build/app.js ./compiled.js

EXPOSE 9000

RUN apt-get install -y curl python
RUN curl -L https://yt-dl.org/latest/youtube-dl -o /usr/bin/youtube-dl
RUN chmod 755 /usr/bin/youtube-dl

CMD [ "node", "compiled.js" ]
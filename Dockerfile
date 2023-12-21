FROM node:18-alpine
WORKDIR /app

COPY package.json .
RUN npm install && npm build
COPY . .

EXPOSE 3000
CMD [ "npm", "run", "runserver"]
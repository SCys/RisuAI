FROM node:18-alpine
WORKDIR /app

COPY source/package.json .
RUN npm install && npm build
COPY source/ .

EXPOSE 3000
CMD [ "npm", "run", "runserver"]
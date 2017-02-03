FROM node:7.4-alpine

# Create an user app
RUN addgroup app-user && adduser -S -s /bin/bash -G app-user app-user
ENV HOME=/home/app-user

COPY package.json npm-shrinkwrap.json $HOME/app/
RUN chown -R app-user:app-user $HOME/*

USER app-user
WORKDIR $HOME/app
RUN npm install

# Bundle app source
USER root
COPY . $HOME/app
RUN chown -R app-user:app-user $HOME/*
USER app-user

CMD [ "npm", "start" ]
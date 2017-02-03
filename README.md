# Swagger Outlook API

## A Swagger API application using oauth2 client credentials to access office365 resources

## 1. Quick start
### 1-1. Set up credentials
Edit authHelper.js
```
const credentials = {
  client: {
    id: <your_app_id>,
    secret: '<secret>',
  },
  auth: {
    tokenHost: 'https://login.microsoftonline.com',
    authorizePath: '<your_tenant>/oauth2/v2.0/authorize',
    tokenPath: '<your_tenant>/oauth2/v2.0/token'
  }
}
```

### 1-2. Start the app
```
$ npm install
...
...
$ npm start
```

### 1-3. Test with curl
curl http://localhost:10010/mail?email=xu@cloudnativeltd.onmicrosoft.com
```
$ curl http://localhost:10010/mail?email=<your_account>@<your_tenant>
```

### 1-4. Test with Swagger UI
After 1-1. and 1-2.
```
$ swagger project edit
```


## 2. Dockerizing
### 2-1. Dockerfile
```
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
```

### 2-2. Build the image
docker build -t <your_username>/swagger-outlook-api .
```
$ docker build -t komushi/swagger-outlook-api .
...
...
Successfully built ba44e85bb92b
```

### 2-3. Login and push to docker hub
```
$ docker login
Login with your Docker ID to push and pull images from Docker Hub. If you don't have a Docker ID, head over to https://hub.docker.com to create one.
Username (komushi): komushi
Password: 
Login Succeeded
```

docker push <your_username>/swagger-outlook-api
```
$ docker push komushi/swagger-outlook-api
```

### 2-4. start a image by docker run command
docker run -p 10010:10010 --name outlook-api <your_username>/swagger-outlook-api
```
$ docker run -p 10010:10010 --name outlook-api komushi/swagger-outlook-api
```

### 2-5. docker-compse as optional approach
docker-compose.yml
```
version: '2'
services:
  swagger-outlook-api:
    image: komushi/swagger-outlook-api
    build: .
  environment:
    NODE_ENV: production
    ports:
      - 10010:10010
```

build image
```
$ docker-compose build
```

start up the service
```
$ docker-compose up
```

## 3. AWS ECS deployment option
[ECS deployment steps](/ecs)

## 4. shrinkwrap reference
[What is npm shrinkwrap and when is it needed](http://javascript.tutorialhorizon.com/2015/03/21/what-is-npm-shrinkwrap-and-when-is-it-needed/)

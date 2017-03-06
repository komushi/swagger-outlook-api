'use strict';
var Q = require("q");

const credentials = {
  client: {
    id: '<id>',
    secret: '<secret>',
  },
  auth: {
    tokenHost: 'https://login.microsoftonline.com',
    authorizePath: '<tenant>.onmicrosoft.com/oauth2/v2.0/authorize',
    tokenPath: '<tenant>.onmicrosoft.com/oauth2/v2.0/token'
  }
}

const tokenConfig = {
  scope: 'https://graph.microsoft.com/.default'
}

var oauth2 = require('simple-oauth2').create(credentials);

var token;

function getToken() {
  var d = Q.defer();

  if (!token || token.token.expires_at.getTime() <= Date.now()) {
    console.log("get new token");

    oauth2.clientCredentials
      .getToken(tokenConfig)
      .then((result) => {
        token = oauth2.accessToken.create(result);
        d.resolve(token);
      })
      .catch((error) => {
        console.log('Access Token error', error);
        d.reject(new Error(error)); 
      });
  }
  else {
    console.log("return existing token", token);

    d.resolve(token);
  }

  return d.promise;
}

exports.getToken = getToken; 


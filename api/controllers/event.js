'use strict';
var Q = require("q");
var authHelper = require('../helpers/authHelper');
var outlook = require('node-outlook');
var ip = require('ip');
var os = require('os');

var myuser = {};

//GET /event operationId
var getAll = function(req, res, next) {

	myuser.email = req.swagger.params.email.value;

	authHelper.getToken()
		.then((token) => {
			return getAllEvents(token);
  	})
		.then((events) => {
      res.setHeader("Container-Address", ip.address());
      res.setHeader("Host-Name", os.hostname());
			res.json({ events: events});
  	})
    .catch(function (error) {
      res.status(204).send();
    });
}

var getAllEvents = function(token) {

	var d = Q.defer();

  // Set up oData parameters
  var queryParams = {
    '$select': 'Subject,Start,End,Attendees',
    '$orderby': 'Start/DateTime desc',
    // '$top': 10
  };

  // Set the API endpoint to use the v2.0 endpoint
  outlook.base.setApiEndpoint('https://graph.microsoft.com/v1.0');
  // Set the anchor mailbox to the user's SMTP address
  outlook.base.setAnchorMailbox(myuser.email);

  outlook.calendar.getEvents({user: myuser, token: token.token.access_token, odataParams: queryParams},
    function(error, result){
      if (error) {
        console.log('getEvents returned an error: ' + error);
        d.reject(new Error(error));
      } else if (result) {
        console.log('getEvents returned ' + result.value.length + ' events.');
        
        var events = [];

        result.value.forEach(function(event) {
          // console.log('  Subject: ' + event.subject);
          // console.log('  Event dump: ' + JSON.stringify(event));
          // console.log(JSON.stringify(event));
          var attendees = [];
          event.attendees.forEach(function(attendee) { 
            attendees.push({name : attendee.emailAddress.name, email : attendee.emailAddress.address});
          });
          events.push({id: event.id, subject : event.subject, start : event.start.dateTime, end : event.end.dateTime, attendees : attendees});
        });

        // console.log(events);

        d.resolve(events);
      }
    });

  return d.promise;
}

//GET /event operationId
var getOne = function(req, res, next) {

  myuser.email = req.swagger.params.email.value;
  var id = req.swagger.params.id.value;

  authHelper.getToken()
    .then((token) => {
      return getOneEvent(token, id);
    })
    .then((event) => {
      res.json(event);
    })
    .catch(function (error) {
      res.status(204).send();
    });
}

var getOneEvent = function(token, id) {

  var d = Q.defer();

  // Set up oData parameters
  var queryParams = {
    '$select': 'Subject,Start,End,Attendees'
  };

  // Set the API endpoint to use the v2.0 endpoint
  outlook.base.setApiEndpoint('https://graph.microsoft.com/v1.0');
  // Set the anchor mailbox to the user's SMTP address
  outlook.base.setAnchorMailbox(myuser.email);

  outlook.calendar.getEvent({user: myuser, token: token.token.access_token, eventId: id, odataParams: queryParams},
    function(error, result){
      if (error) {
        console.log('getEvent returned an error: ' + error);
        d.reject(new Error(error));
      } else if (result) {

        var attendees = [];
        result.attendees.forEach(function(attendee) { 
          attendees.push({name : attendee.emailAddress.name, email : attendee.emailAddress.address});
        });
        
        d.resolve({id: result.id, subject : result.subject, start : result.start.dateTime, end : result.end.dateTime, attendees : attendees});
      }
    });

  return d.promise;
}

//GET /event operationId
var delOne = function(req, res, next) {

  myuser.email = req.swagger.params.email.value;
  var id = req.swagger.params.id.value;

  authHelper.getToken()
    .then((token) => {
      return delOneEvent(token, id);
    })
    .then(() => {
      res.json({success: 1, description: "Event deleted!"});
    })
    .catch(function (error) {
      res.status(204).send();
    });
}

var delOneEvent = function(token, id) {

  var d = Q.defer();

  // Set up oData parameters
  // var queryParams = {
  //   '$select': 'Subject,Start,End,Attendees'
  // };

  // Set the API endpoint to use the v2.0 endpoint
  outlook.base.setApiEndpoint('https://graph.microsoft.com/v1.0');
  // Set the anchor mailbox to the user's SMTP address
  outlook.base.setAnchorMailbox(myuser.email);

  outlook.calendar.deleteEvent({user: myuser, token: token.token.access_token, eventId: id},
    function(error){

      if (error) {
        console.log('getEvent returned an error: ' + error);
        d.reject(new Error(error));
      } else {        
        d.resolve();
      }
    });

  return d.promise;
}
module.exports = {getEvents : getAll, getEvent : getOne, delEvent : delOne};



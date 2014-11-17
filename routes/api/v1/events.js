var _ = require('underscore');
var Promise = require('bluebird/js/main/promise')();
var RejectionError = Promise.RejectionError;
var model = require('../../../model');
var moment = require('moment');
var Event = model.models.Event;
var EventItem = model.models.EventItem;


module.exports.get = function (req, res) {
    var eventId = req.params.id;

    new EventItem({ Event_id: eventId }).fetch().then(function (eventItem) {
        if (eventItem) {
            res.setHeader('X-CSRF-Token', req.csrfToken());
            res.json(
                {
                    id: eventItem.get('Event_id'),
                    title: eventItem.get('Title'),
                    location: eventItem.get('Location'),
                    description: eventItem.get('Description')
                }
            );
        } else {
            res.statusCode = 404;
            res.send('Error 404: Event with id ' + eventId + ' not found');
        }

    }).catch(function (error) {
        console.log("Error while reading events from database: " + error);
        res.statusCode = 500;
        return res.send('Error 500: reading of events from database failed');
    });
};
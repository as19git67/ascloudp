var _ = require('underscore');
var Promise = require('bluebird/js/main/promise')();
var model = require('../../../model');
var moment = require('moment');
var Event = model.models.Event;
var EventItem = model.models.EventItem;
var Audit = model.models.Audit;


module.exports.get = function (req, res) {
    var eventId = req.params.id;

    new EventItem({ Event_id: eventId, valid_end: null }).fetch().then(function (eventItem) {
        if (eventItem) {
            res.setHeader('X-CSRF-Token', req.csrfToken());
            res.json(
                {
                    id: eventItem.get('Event_id'),
                    title: eventItem.get('Title'),
                    location: eventItem.get('Location'),
                    description: eventItem.get('Description'),
                    event_start: eventItem.get('event_start'),
                    event_end: eventItem.get('event_end'),
                    publish_start: eventItem.get('publish_start'),
                    publish_end: eventItem.get('publish_end')
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


module.exports.put = function (req, res) {
    var eventId = req.params.id;

    model.bookshelf.transaction(function (t) {

        new EventItem({ Event_id: eventId, valid_end: null }).fetch().then(function (eventItem) {
            if (eventItem) {
                // invalidate current eventItem record
                var now = new Date();
                eventItem.set('valid_end', now);
                eventItem.save(null, { transacting: t }).then(function () {

                    // create new eventItem
                    new EventItem({
                        Event_id: eventId,
                        Title: req.body.title,
                        Location: req.body.location,
                        Description: req.body.description,
                        event_start: eventItem.get('event_start'),
                        event_end: eventItem.get('event_end'),
                        publish_start: eventItem.get('publish_start'),
                        publish_end: eventItem.get('publish_end'),
                        valid_start: now
                    }).save(null, { transacting: t }).then(function (savedEventItem) {
                            var userName = req.user.UserName ? req.user.UserName : req.user.id;
                            new Audit({
                                    ChangedAt: new Date(),
                                    Table: savedEventItem.tableName,
                                    ChangedBy: userName,
                                    Description: "EventItem changed by user " + userName + ". Id of new item in EventItems is " + savedEventItem.id
                                }
                            ).save().then(function () {
                                    t.commit(savedEventItem);
                                }).catch(function (error) {
                                    console.log("Error while saving Audit for new EventItem to database:", error);
                                    console.log("Roll back transaction");
                                    t.rollback({ statusCode: 500, message: 'Error 500: saving of events to database failed' });
                                });
                        }).catch(function (error) {
                            console.log("Error while saving new EventItem to database:", error);
                            console.log("Roll back transaction");
                            t.rollback({ statusCode: 500, message: 'Error 500: saving of events to database failed' });
                        });
                }).catch(function (error) {
                    console.log("Error while updating EventItem in database:", error);
                    console.log("Roll back transaction");
                    t.rollback({ statusCode: 500, message: 'Error 500: saving of events to database failed' });
                });
            } else {
                console.log("Event with id " + eventId + " not found. Rolling back transaction");
                t.rollback({ statusCode: 404, message: 'Error 404: Event with id ' + eventId + ' not found' });
            }

        }).catch(function (error) {
            console.log("Error while reading events from database:", error);
            console.log("Roll back transaction");
            t.rollback({ statusCode: 500, message: 'Error 500: reading of event from database failed' });
        });
    }).then(function (savedItem) {
        console.log("Transaction (saving eventItem) committed");
        if (savedItem) {
            // return put data again back to caller
            module.exports.get(req, res);
        } else {
            res.statusCode = 304;   // not changed
            res.send("304: Event information not changed");
        }
    }).catch(function (error) {
        console.log("Transaction (saving eventItem) rolled back");
        res.statusCode = error.statusCode;
        res.send(error.message);
    });
};

var _ = require('underscore');
var Promise = require('bluebird/js/release/promise')();
var model = require('../../../model');
var moment = require('moment');
var Event = model.models.Event;
var EventItem = model.models.EventItem;
var Audit = model.models.Audit;

var knex = model.bookshelf.knex;

function getEventItemSchema() {
    return new Promise(function (resolve, reject) {
        var tableName = new EventItem().tableName;
        knex(tableName).columnInfo()
            .then(function (eventItemSchema) {
                _.each(eventItemSchema, function (schemaItem) {
                    schemaItem.required = !schemaItem.nullable;
                });
                var event_schema = {
                    title: _.extend(eventItemSchema['Title'], {
                        name: "title",
                        label: "Titel",
                        description: "Titel der Veranstaltung"
                    }),
                    location: _.extend(eventItemSchema['Location'], {
                        label: "Veranstaltungsort",
                        description: "Ort der Veranstaltung"
                    }),
                    description: _.extend(eventItemSchema['Description'], {
                        label: "Beschreibung",
                        description: "Beschreibung der Veranstaltung"
                    }),
                    event_start: _.extend(eventItemSchema['event_start'], {
                        label: "Beginn",
                        description: "Veranstaltungsbeginn"
                    }),
                    event_end: _.extend(eventItemSchema['event_end'], {
                        label: "Ende",
                        description: "Veranstaltungsende"
                    }),
                    publish_start: _.extend(eventItemSchema['publish_start'], {
                        label: "Start Veröffentlichung",
                        description: "Beginn der Veröffentlichung der Veranstaltung"
                    }),
                    publish_end: _.extend(eventItemSchema['publish_end'], {
                        label: "Ende Veröffentlichung",
                        description: "Ende der Veröffentlichung der Veranstaltung"
                    }),
                    timezone: _.extend(eventItemSchema['Timezone'], {
                        label: "Zeitzone",
                        description: "Zeitzone"
                    })
                };
                resolve(event_schema);
            })
            .catch(function (error) {
                reject(error);
            });

    });
}

function respondWithEventItemData(req, res, eventItem) {
    getEventItemSchema().then(function (event_schema) {

        var deleted = eventItem.get('valid_end') != undefined;
        var csrfToken;
        if (req.csrfToken && req.session) {
            csrfToken = req.csrfToken();
            res.cookie('X-CSRF-Token', csrfToken); // for angularjs use a cookie instead a header parameter
        }
        res.json(
            {
                event: {
                    id: eventItem.get('Event_id'),
                    title: eventItem.get('Title'),
                    location: eventItem.get('Location'),
                    description: eventItem.get('Description'),
                    event_start: eventItem.get('event_start'),
                    event_end: eventItem.get('event_end'),
                    publish_start: eventItem.get('publish_start'),
                    publish_end: eventItem.get('publish_end'),
                    deleted: deleted
                },
                event_schema: event_schema
            }
        );
    }).catch(function (error) {
        console.log("Error while reading columnInfo for EventItem from database: " + error);
        res.statusCode = 500;
        return res.send('Error 500: reading schema info for events from database failed');
    });
}

module.exports.get = function (req, res) {
    if (req.query && req.query.type && req.query.type == "schema") {
        getEventItemSchema().then(function (event_schema) {
            var csrfToken;
            if (req.csrfToken && req.session) {
                csrfToken = req.csrfToken();
                res.cookie('X-CSRF-Token', csrfToken); // for angularjs use a cookie instead a header parameter
            }
            res.json(
                {
                    event_schema: event_schema
                }
            );
        }).catch(function (error) {
            console.log("Error while reading columnInfo for EventItem from database: " + error);
            res.statusCode = 500;
            return res.send('Error 500: reading schema info for events from database failed');
        });
    } else {
        var eventId = req.params.id;

        new EventItem()
            .query(function (qb) {
                qb.where({Event_id: eventId});
                qb.orderBy('valid_start', 'DESC');
            })
            .fetchAll()
            .then(function (eventItems) {
                if (eventItems && eventItems.length > 0) {
                    var eventItem = eventItems.at(0);
                    respondWithEventItemData(req, res, eventItem);
                } else {
                    res.statusCode = 404;
                    res.send('Error 404: Event with id ' + eventId + ' not found');
                }

            }).catch(function (error) {
            console.log("Error while reading events from database: " + error);
            res.statusCode = 500;
            return res.send('Error 500: reading of events from database failed');
        });
    }
};

// edit event
module.exports.put = function (req, res) {
    var eventId = req.params.id;

    model.bookshelf.transaction(function (t) {

        new EventItem()
            .query(function (qb) {
                qb.where({Event_id: eventId});
                qb.orderBy('valid_start', 'DESC');
            })
            .fetchAll()
            .then(function (eventItems) {
                if (eventItems && eventItems.length > 0) {
                    var eventItem = eventItems.first();
                    // invalidate current eventItem record
                    var now = new Date();
                    eventItem.set('valid_end', now);
                    eventItem.save(null, {transacting: t}).then(function () {

                        // create new eventItem
                        new EventItem({
                            Event_id: eventId,
                            Title: req.body.title,
                            Location: req.body.location,
                            Description: req.body.description,
                            event_start: req.body.event_start,
                            event_end: req.body.event_end,
                            publish_start: req.body.publish_start,
                            publish_end: req.body.publish_end,
                            Timezone: req.body.timezone,
                            valid_start: now
                        }).save(null, {transacting: t}).then(function (savedEventItem) {
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
                                t.rollback({statusCode: 500, message: 'Error 500: saving of events to database failed'});
                            });
                        }).catch(function (error) {
                            console.log("Error while saving new EventItem to database:", error);
                            console.log("Roll back transaction");
                            t.rollback({statusCode: 500, message: 'Error 500: saving of events to database failed'});
                        });
                    }).catch(function (error) {
                        console.log("Error while updating EventItem in database:", error);
                        console.log("Roll back transaction");
                        t.rollback({statusCode: 500, message: 'Error 500: saving of events to database failed'});
                    });
                } else {
                    console.log("Event with id " + eventId + " not found. Rolling back transaction");
                    t.rollback({statusCode: 404, message: 'Error 404: Event with id ' + eventId + ' not found'});
                }

            }).catch(function (error) {
            console.log("Error while reading events from database:", error);
            console.log("Roll back transaction");
            t.rollback({statusCode: 500, message: 'Error 500: reading of event from database failed'});
        });
    }).then(function (savedItem) {
        console.log("Transaction (saving eventItem) committed");
        if (savedItem) {
            // return put data again back to caller
            respondWithEventItemData(req, res, savedItem);
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

// create new event
module.exports.post = function (req, res) {
    model.bookshelf.transaction(function (t) {

        var now = new Date();

        new Event({
            Page_id: req.body.pageid
        })
            .save(null, {transacting: t})
            .then(function (newEvent) {
                // create new EventItem
                new EventItem({
                    Event_id: newEvent.get('id'),
                    Title: req.body.title,
                    Location: req.body.location,
                    Description: req.body.description,
                    event_start: req.body.event_start,
                    event_end: req.body.event_end,
                    publish_start: req.body.publish_start,
                    publish_end: req.body.publish_end,
                    Timezone: req.body.timezone,
                    valid_start: now
                })
                    .save(null, {transacting: t})
                    .then(function (savedEventItem) {
                        var userName = req.user.UserName ? req.user.UserName : req.user.id;
                        new Audit({
                            ChangedAt: new Date(),
                            Table: savedEventItem.tableName,
                            ChangedBy: userName,
                            Description: "New Event created for page " + req.body.pageid + " by user " + userName + ". Id of new item in EventItem is " + savedEventItem.id
                        })
                            .save()
                            .then(function () {
                                t.commit(savedEventItem);
                            })
                            .catch(function (error) {
                                console.log("Error while saving Audit for new EventItem to database:", error);
                                console.log("Roll back transaction");
                                t.rollback({
                                    statusCode: 500,
                                    message: 'Error 500: saving of event to database failed'
                                });
                            });
                    })
                    .catch(function (error) {
                        console.log("Error while saving new EventItem to database:", error);
                        console.log("Roll back transaction");
                        t.rollback({statusCode: 500, message: 'Error 500: saving of event to database failed'});
                    });
            })
            .catch(function (error) {
                console.log("Error while saving new Event to database:", error);
                console.log("Roll back transaction");
                t.rollback({statusCode: 500, message: 'Error 500: saving of event to database failed'});
            });

    }).then(function (savedItem) {
        console.log("Transaction (saving EventItem) committed");
        if (savedItem) {
            // return put data again back to caller
            respondWithEventItemData(req, res, savedItem);
        } else {
            res.statusCode = 304;   // not changed
            res.send("304: Event information not changed");
        }
    }).catch(function (error) {
        console.log("Transaction (saving EventItem) rolled back");
        res.statusCode = error.statusCode;
        res.send(error.message);
    });

};

// delete event -> set valid_end to now
module.exports.delete = function (req, res) {
    var eventId = req.params.id;

    new EventItem({Event_id: eventId, valid_end: null}).fetch().then(function (eventItem) {
        if (eventItem) {

            // start a transaction because EventItem and audit are updated
            model.bookshelf.transaction(function (t) {
                var now = new Date();

                // invalidate current EventItem record
                eventItem.set('valid_end', now);
                eventItem.save(null, {transacting: t}).then(function (savedEventItem) {

                    var userName = req.user.UserName ? req.user.UserName : req.user.id;
                    new Audit({
                        ChangedAt: new Date(),
                        Table: new EventItem().tableName,
                        ChangedBy: userName,
                        Description: "EventItem deleted by user " + userName + ". Id of deleted item in EventItem is " + savedEventItem.id
                    }).save(null, {transacting: t}).then(function () {
                        t.commit(savedEventItem);
                    }).catch(function (error) {
                        console.log("Error while updating EventItem in database:", error);
                        t.rollback({statusCode: 500, message: 'Error 500: deleting of event in database failed'});
                    });
                });
            }).then(function (savedItem) {
                console.log("Transaction (saving EventItem) committed");
                res.statusCode = 204;   // HTTP 204 No Content: The server successfully processed the request, but is not returning any content
                res.send("204: Event deleted");
            }).catch(function (error) {
                console.log("Transaction (deleting (update) EventItem) rolled back");
                res.status(error.statusCode).send(error.message);
            });
        }
        else {
            console.log("Event with id " + eventId + " not found. Rolling back transaction");
            res.status(404).send('EventItem with id ' + eventId + ' not found');
        }
    }).catch(function (error) {
        console.log("Error while reading event from database:", error);
        res.status(500).send('Reading of event from database failed');
    });
};

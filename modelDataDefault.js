var _ = require('underscore');
var moment = require('moment');
var Promise = require('bluebird/js/main/promise')();

var model = require('./model');
var knex = model.bookshelf.knex;

exports.importTestData = function () {

    var steps = exports.clearTablesFunctions;
    steps.push(function () {
        // TERMINE
        return new Promise(function (resolve, reject) {
            Promise.map(eventList, function (value) {
                return new Promise(function (resolveEvent, rejectEvent) {
                    new model.models.Event({Page_id: "termine"}).save().then(function (newEvent) {
                        var publishDateStart = value.publishDateStart == null ? new Date() : value.publishDateStart;
                        var publishDateEnd = value.publishDateEnd == null ? value.eventDateEnd : value.publishDateEnd;
                        var evObj = {
                            Event_id: newEvent.get('id'),
                            Title: value.title,
                            Location: value.locationdescription,
                            Description: value.description,
                            event_start: value.eventDateStart,
                            event_end: value.eventDateEnd,
                            publish_start: publishDateStart,
                            publish_end: publishDateEnd,
                            valid_start: new Date()
                        };
                        new model.models.EventItem(evObj).save().then(function (newEventItem) {
                            resolveEvent();
                        }).catch(function (error) {
                            console.log("Error while saving EventItem: " + error);
                            rejectEvent(error);
                        });
                    }).catch(function (error) {
                        console.log("Error while saving Event: " + error);
                        rejectEvent(error);
                    });
                });
            }).then(function (savedEvents) {
                console.log(savedEvents.length + " events added to database");
                resolve();
            }).catch(function (error) {
                console.log("Error while saving events: " + error);
            });
        });
    });

    return Promise.reduce(
        steps,
        function (total, current, index, arrayLength) {
            console.log("importTestData step " + (index + 1) + " von " + arrayLength);
            return current().then(function () {
            }).return(total + 1);
        }, 0);
};

exports.clearTablesFunctions = [
    function () {
        return knex('LinkItems').del();
    },
    function () {
        return knex('Links').del();
    },
    function () {
        return knex('ContactItems').del();
    },
    function () {
        return knex('Contacts').del();
    },
    function () {
        return knex('ArticleReferenceItems').del();
    },
    function () {
        return knex('ArticleReferences').del();
    },
    function () {
        return knex('ArticleSectionItems').del();
    },
    function () {
        return knex('ArticleSections').del();
    },
    function () {
        return knex('ArticleItems').del();
    },
    function () {
        return knex('Articles').del();
    },
    function () {
        return knex('EventItems').del();
    },
    function () {
        return knex('Events').del();
    },
    function () {
        return knex('MembershipItems').del();
    },
    function () {
        return knex('Memberships').del();
    },
    function () {
        return knex('PersonContactDataAddresses').del();
    },
    function () {
        return knex('PersonContactDataPhonenumbers').del();
    },
    function () {
        return knex('PersonContactDataAccounts').del();
    },
    function () {
        return knex('PersonContactDatas').del();
    },
    function () {
        return knex('PersonItems').del();
    },
    function () {
        return knex('Persons').del();
    },
    function () {
        return knex('PageCollectionColumns').del();
    },
    function () {
        return knex('PageContents').del();
    },
    function () {
        return knex('Pages').del();
    }
];

var gesternStart = moment().subtract(1, 'days').subtract(3, 'hours').utc().toDate();
var gesternEnd = moment().subtract(1, 'days').utc().toDate();

var eventList = [
    {
        title: "Kameradschaftsabend",
        description: "zum Aufbauen für den Kameradschaftsabend treffen wir uns um 17 Uhr im Feuerwehrhaus.",
        eventDateStart: new Date("2014-10-18 17:00:00"),
        eventDateEnd: new Date("2014-10-18 18:00:00"),
        street: "Schulweg",
        streetnumber: "8",
        postalcode: "86504",
        city: "Merching",
        locationdescription: "Feuerwehrhaus"
    }
];

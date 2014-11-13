var _ = require('underscore');
var moment = require('moment');
var Promise = require('bluebird/js/main/promise')();

var model = require('./model');
var knex = model.bookshelf.knex;

exports.importTestData = function () {

    var createSteps = [
        function () {
            // SEITEN
            return new Promise(function (resolve, reject) {
                var allPages = [
                    {Order: 1, Name: "overview", AnonymousAccess: true, EntityNameSingular: "Overview", EntityNamePlural: "Overview Infos", Model: "PageContent", View: "genericHTML"},
                    {Order: 2, Name: "events", AnonymousAccess: true, EntityNameSingular: "Event", EntityNamePlural: "Events", Collection: "Events", View: "Calendar"},
                    {Order: 4, Name: "kontakte", AnonymousAccess: true, EntityNameSingular: "Contact", EntityNamePlural: "Contacts", Collection: "Persons", View: "Contacts"},
                    {Order: 6, Name: "links", AnonymousAccess: true, EntityNameSingular: "Link", EntityNamePlural: "Links", Collection: "Links", View: "Links"},
                    {Order: 3, Name: "blog", AnonymousAccess: true, EntityNameSingular: "Article", EntityNamePlural: "Articles", Collection: "Articles", View: "Articles"},
                    {Order: 9, Name: "contacts", AnonymousAccess: true, EntityNameSingular: "Contact", EntityNamePlural: "Contacts", Collection: "Contacts", View: "Contacts"},
                    {Order: 10, Name: "members", AnonymousAccess: false, EntityNameSingular: "Member", EntityNamePlural: "Members", Collection: "Persons", View: "Members"}
                ];
                var pages = model.models.Pages.forge(allPages);
                console.log("Adding pages.");
                Promise.all(pages.invoke('save')).then(function () {
                    console.log("Pages added to database.");
                    resolve();
                }).catch(function (error) {
                    console.log("Error while saving pages: " + error);
                    reject(error);
                });
            });
        },
        function () {
            // SEITEN MIT GENERICHTML
            return new Promise(function (resolve, reject) {
                var allPageContents = [
                    {
                        Page_id: "overview",
                        Text: "### The Authentic Source for\r\n\r# NYC.com's Exclusive New York City Event Calendar\r\n\rWe proudly offer the most comprehensive event calendar of New York City events. Here you'll find hundreds of special events as well as everything from which DJ is spinning at the hottest club to which team the Knicks are playing. Search by event type, date and/or location below."
                    }
                ];
                var pageContents = model.models.PageContents.forge(allPageContents);
                console.log("Adding PageContents.");
                Promise.all(pageContents.invoke('save')).then(function () {
                    console.log("PageContents added to database.");
                    resolve();
                }).catch(function (error) {
                    console.log("Error while saving PageContents: " + error);
                    reject(error);
                });
            });
        },
        function () {
            // TERMINE
            return new Promise(function (resolve, reject) {
                Promise.map(eventList, function (value) {
                    return new Promise(function (resolveEvent, rejectEvent) {
                        new model.models.Event({Page_id: "events"}).save().then(function (newEvent) {
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
        },
    ];

    var steps = exports.clearTablesFunctions.concat(createSteps);

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
        title: "Christopher Williams: The Production Line of Hapiness",
        description: "The first retrospective ever mounted of Christopher Williams (American, b. 1956)—spans his 35-year career of one of the most influential cinephilic artists working in photography. Williams studied under West Coast Conceptual artists such as Michael Asher, John Baldessaria and Douglas Huebler, and become one of his generations leading Conceptualists. Williams’ body of work reflects his deep interest in the histories of film and photography and furthers the critique of late capitalisms use of images as agents of spectacle. The Production Line of Hapiness features rarely seen Super-8 shorts, major projects from the 80s and 90s, as well as photographs from his magnum series.",
        eventDateStart: new Date("2015-11-13 10:30:00"),
        eventDateEnd: new Date("2015-11-13 12:00:00"),
        street: "West 53rd Street",
        streetnumber: "11",
        postalcode: "10019",
        city: "New York",
        locationdescription: "Museum of Modern Art (MoMA)"
    },
    {
        title: "Siro's Restaurant Launches New Joy Bauer Healthy Menu",
        description: "Siro's Restaurant, the American eatery located at 885 Second Avenue, has recently launched a new healthy dining program. Top nutritionist Joy Bauer has lent her healthy diet expertise to a special JOY BAUER HEALTHY MENU, which features well-balanced, low-calorie interpretations of some of Siro's classic dishes. Now guests can enjoy tasty options such as Grilled Chicken Parmesan (580 calories) and Pat LaFrieda Turkey Burger Sliders (530 calories). For more information please visit www. Sirosny.com",
        eventDateStart: new Date("2015-11-13 11:30:00"),
        eventDateEnd: new Date("2015-11-13 14:00:00"),
        street: "885 Second Avenue",
        streetnumber: "885",
        postalcode: "10017",
        city: "New York",
        locationdescription: "Siro's"
    }
];

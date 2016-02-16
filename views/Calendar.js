var _ = require('underscore');
var moment = require('moment-timezone');
var config = require('../config');
var model = require('../model');
var ical = require('ical-generator');
var Event = model.models.Event;
var EventItem = model.models.EventItem;

var knex = model.bookshelf.knex;
var appName = config.get('appName');

module.exports.getical = function (req, res, next, page, pages, canEdit, collectionModelClass) {
    var cal = ical();

    cal.setDomain('ascloud.de').setName(page.EntityNamePlural);
    cal.setProdID({company: "Anton Schegg", product: "ascloud.de", language: "DE"});

    var now = new Date();
    new Event().query(function (qb) {
        qb.innerJoin('EventItems', 'Events.id', 'EventItems.Event_id');
        qb.orderBy('event_start', 'ASC');
        qb.select(['EventItems.*']);
        qb.where({Page_id: page.Name})
            .andWhere('EventItems.valid_end', null)
            .andWhere('EventItems.event_end', '>=', now)
            .andWhere('EventItems.publish_start', '<=', now)
            .andWhere('EventItems.publish_end', '>=', now);
    }).fetchAll().then(function (dataCollection) {
        if (dataCollection && dataCollection.length > 0) {
            dataCollection.forEach(function (dataModel) {
                cal.addEvent({
                    start: dataModel.get('event_start'),
                    end: dataModel.get('event_end'),
                    summary: dataModel.get('Title'),
                    description: dataModel.get('Description'),
                    location: dataModel.get('Location')
                });
            });
            cal.serve(res);
        }
        else {
            cal.serve(res); // empty cal
        }
    }).catch(function (error) {
        console.log("Error while retrieving Events for ical from the database: " + error);
        var err = new Error(error);
        err.status = 500;
        next(err);
    });
};

module.exports.render = function (req, res, next, page, pages, canEdit, collectionModelClass) {
    var csrfToken;
    if (req.csrfToken && req.session) {
        csrfToken = req.csrfToken();
    }
    var icalUrl = req.originalUrl;
    var idx = icalUrl.indexOf('?');
    if (idx >= 1) {
        icalUrl = icalUrl + "&type=ical";
    }
    else {
        icalUrl = icalUrl + "?type=ical";
    }

    var includeNotPublished = req.query.includeNotPublished === "true";
    if (req.query.includeNotPublished === undefined) {
        includeNotPublished = true;
    }
    var includeOld = req.query.includeOld === "true";
    var includeDeleted = req.query.includeDeleted === "true";
    console.log("inlcude notPublished: " + includeNotPublished + ", old: " + includeOld + ", deleted: " + includeDeleted);

    var now = new Date();
    var nowMoment = new moment(now);

    var query =
        'SELECT ee."Page_id", sub.* from public."Events" as ee ' +
        ' INNER JOIN ' +
        ' (' +
        '   SELECT tt.* FROM public."EventItems" tt' +
        '   INNER JOIN' +
        '   ( ' +
        '       SELECT ei."Event_id", MAX(ei.valid_start) AS max_valid_start FROM public."EventItems" ei GROUP BY ei."Event_id"' +
        '   ) groupedtt ' +
        '   ON (tt."Event_id" = groupedtt."Event_id" AND tt.valid_start = groupedtt.max_valid_start';
    if (!(includeDeleted && canEdit)) {
        console.log("Include only not deleted");
        query += ' and tt.valid_end is null';
    }
    if (!(includeNotPublished && canEdit)) {
        console.log("Include only published");
        query += ' and tt.publish_start <= \'' + now.toISOString() + '\' and tt.publish_end >= \'' + now.toISOString() + '\'';
    }
    if (!(includeOld && canEdit)) {
        console.log("Include only not ended events");
        query += ' and tt.publish_end >= \'' + now.toISOString() + '\'';
    }
    query += ' )';
    query += ' ) as sub ' +
        ' ON ("sub"."Event_id" = "ee"."id") where "ee"."Page_id" = \'' + page.Name + '\' order by "sub"."event_start"';
    knex.raw(query)
        .then(function (dataCollection) {
            var records = [];
            if (dataCollection.rows && dataCollection.rowCount > 0) {
                records = dataCollection.rows.map(function (dataObject) {
                    var dataModel = new EventItem(dataObject);
                    var pastEvent = false;
                    if (nowMoment.isAfter(dataModel.get('publish_end'))) {
                        pastEvent = true;
                    }
                    var futureEvent = false;
                    if (nowMoment.isBefore(dataModel.get('publish_start'))) {
                        futureEvent = true;
                    }
                    var deletedEvent = false;
                    var validEnd = dataModel.get('valid_end');
                    if (validEnd) {
                        deletedEvent = true;
                    }

                    var timezone = dataModel.get('Timezone');
                    if (!timezone) {
                        timezone = "Europe/Berlin";
                    }

                    var dataObj = {
                        id: dataModel.get('Event_id'),
                        Title: dataModel.get('Title'),
                        Location: dataModel.get('Location'),
                        Description: dataModel.get('Description'),
                        event_start: dataModel.get('event_start'),
                        event_end: dataModel.get('event_end'),
                        publish_start: dataModel.get('publish_start'),
                        publish_end: dataModel.get('publish_end'),
                        event_start_time_formatted: moment(dataModel.get('event_start')).tz(timezone).format('HH:mm'),
                        event_end_time_formatted: moment(dataModel.get('event_end')).tz(timezone).format('HH:mm'),
                        event_start_date_formatted: moment(dataModel.get('event_start')).tz(timezone).format('dddd, D. MMMM YYYY'),
                        event_end_date_formatted: moment(dataModel.get('event_end')).tz(timezone).format('dd., D. MMM'),
                        event_start_formatted: moment(dataModel.get('event_start')).tz(timezone).format('L HH:mm'),
                        event_end_formatted: moment(dataModel.get('event_end')).tz(timezone).format('L HH:mm'),
                        publish_start_formatted: moment(dataModel.get('publish_start')).tz(timezone).format('L HH:mm'),
                        publish_end_formatted: moment(dataModel.get('publish_end')).tz(timezone).format('L HH:mm'),
                        timezone: timezone,
                        pastEvent: pastEvent,
                        futureEvent: futureEvent,
                        deletedEvent: deletedEvent

                    };
                    return dataObj;
                });
                res.render(page.View, {
                    csrfToken: csrfToken,
                    bootstrapTheme: config.get('bootstrapStyle'),
                    canEdit: canEdit,
                    appName: appName,
                    title: page.EntityNamePlural,
                    user: req.user,
                    pages: pages,
                    page: page,
                    Records: records,
                    includeNotPublished: includeNotPublished,
                    includeDeleted: includeDeleted,
                    includeOld: includeOld,
                    icalUrl: icalUrl
                });
            } else {
                res.render(page.View, {
                    csrfToken: csrfToken,
                    bootstrapTheme: config.get('bootstrapStyle'),
                    canEdit: canEdit,
                    appName: appName,
                    title: page.EntityNamePlural,
                    user: req.user,
                    pages: pages,
                    page: page,
                    includeNotPublished: includeNotPublished,
                    includeDeleted: includeDeleted,
                    includeOld: includeOld,
                    Records: []
                });
            }
        }).catch(function (error) {
        console.log("Error while retrieving Events from the database: " + error);
        var err = new Error(error);
        err.status = 500;
        next(err);
    });
};

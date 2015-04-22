var _ = require('underscore');
var moment = require('moment-timezone');
var config = require('../config');
var model = require('../model');
var ical = require('ical-generator');
var Event = model.models.Event;

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
    var icalUrl = req.originalUrl;
    var idx = icalUrl.indexOf('?');
    if (idx >= 1) {
        icalUrl = icalUrl + "&type=ical";
    }
    else {
        icalUrl = icalUrl + "?type=ical";
    }

    var includeNotPublished = req.query.includeNotPublished == undefined ? true : req.query.includeNotPublished;
    var includeOld = req.query.includeOld == undefined ? false : req.query.includeOld;
    var includeDeleted = req.query.includeDeleted == undefined ? false : req.query.includeDeleted;

    var now = new Date();
    var nowMoment = new moment(now);
    new Event().query(function (qb) {
        qb.innerJoin('EventItems', 'Events.id', 'EventItems.Event_id');
        qb.orderBy('event_start', 'ASC');
        qb.select(['EventItems.*']);
        if (canEdit) {
            // in case user can edit, include currently not published articles
            qb.where({'Page_id': page.Name})
                .andWhere('EventItems.valid_end', null);
            if (!includeOld) {
                qb.andWhere('EventItems.publish_end', '>=', now);
            }
            if (!includeNotPublished) {
                qb.andWhere('EventItems.publish_start', '>=', now);
            }
        } else {
            qb.where({'Page_id': page.Name})
                .andWhere('EventItems.valid_end', null)
                .andWhere('EventItems.publish_start', '<=', now)
                .andWhere('EventItems.publish_end', '>=', now)
                .andWhere('EventItems.event_end', '>=', now);
        }
    }).fetchAll().then(function (dataCollection) {
        var records = [];
        if (dataCollection && dataCollection.length > 0) {
            records = dataCollection.map(function (dataModel) {
                var notPublished = false;
                if (nowMoment.isBefore(dataModel.get('publish_start')) || nowMoment.isAfter(dataModel.get('publish_end'))) {
                    notPublished = true;
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
                    notPublished: notPublished
                };
                return dataObj;
            });
            res.render(page.View, {
                csrfToken: req.csrfToken(),
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
                csrfToken: req.csrfToken(),
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
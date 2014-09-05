var _ = require('underscore');
var moment = require('moment');
var config = require('../config');
var model = require('../model');
var ical = require('ical-generator');
var Event = model.models.Event;

var appName = config.get('appName');

module.exports.getical = function (req, res, next, page, pages, collectionModelClass) {
    var cal = ical();

    cal.setDomain('ascloud.de').setName(page.EntityNamePlural);
    cal.setProdID({company: "Anton Schegg", product: "ascloud.de", language: "DE"});

    var now = new Date();
    new Event().query(function (qb) {
        qb.orderBy('event_start', 'ASC');
        qb.where({Page_id: page.Name, valid_end: null})
            .andWhere('event_end', '>=', now)
            .andWhere('publish_start', '<=', now)
            .andWhere('publish_end', '>=', now);
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

module.exports.render = function (req, res, next, page, pages, collectionModelClass) {
    var icalUrl = req.originalUrl;
    var idx = icalUrl.indexOf('?');
    if (idx >= 1) {
        icalUrl = icalUrl + "&type=ical";
    }
    else
    {
        icalUrl = icalUrl + "?type=ical";
    }

    var now = new Date();
    new Event().query(function (qb) {
        qb.orderBy('event_start', 'ASC');
        qb.where({Page_id: page.Name, valid_end: null})
            .andWhere('event_end', '>=', now)
            .andWhere('publish_start', '<=', now)
            .andWhere('publish_end', '>=', now);
    }).fetchAll().then(function (dataCollection) {
        var records = [];
        if (dataCollection && dataCollection.length > 0) {
            records = dataCollection.map(function (dataModel) {
                var dataObj = {
                    Title: dataModel.get('Title'),
                    Location: dataModel.get('Location'),
                    Description: dataModel.get('Description'),
                    event_start: dataModel.get('event_start'),
                    event_end: dataModel.get('event_end'),
                    publish_start: dataModel.get('publish_start'),
                    publish_end: dataModel.get('publish_end'),
                    event_start_time_formatted: moment(dataModel.get('event_start')).format('HH:mm'),
                    event_end_time_formatted: moment(dataModel.get('event_end')).format('HH:mm'),
//                    event_start_date_formatted: moment(dataModel.get('event_start')).format('dd., D. MMM'),
                    event_start_date_formatted: moment(dataModel.get('event_start')).format('dddd, D. MMMM'),
                    event_end_date_formatted: moment(dataModel.get('event_end')).format('dd., D. MMM'),
                    event_start_formatted: moment(dataModel.get('event_start')).format('L HH:mm'),
                    event_end_formatted: moment(dataModel.get('event_end')).format('L HH:mm'),
                    publish_start_formatted: moment(dataModel.get('publish_start')).format('L HH:mm'),
                    publish_end_formatted: moment(dataModel.get('publish_end')).format('L HH:mm')
                };
                return dataObj;
            });
            res.render(page.View, {
                csrfToken: req.csrfToken(),
                appName: appName,
                title: page.EntityNamePlural,
                user: req.user,
                pages: pages,
                page: page,
                Records: records,
                icalUrl: icalUrl
            });
        } else {
            res.render(page.View, {
                csrfToken: req.csrfToken(),
                appName: appName,
                title: page.EntityNamePlural,
                user: req.user,
                pages: pages,
                page: page
            });
        }
    }).catch(function (error) {
        console.log("Error while retrieving Events from the database: " + error);
        var err = new Error(error);
        err.status = 500;
        next(err);
    });
};
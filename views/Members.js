var _ = require('underscore');
var moment = require('moment');
var config = require('../config');
var model = require('../model');
var Person = model.models.Person;
var Membership = model.models.Membership;

var appName = config.get('appName');

module.exports.render = function (req, res, next, page, pages, collectionModelClass) {

    new Person().query(function (qb) {
        qb.orderBy('Lastname', 'ASC');
        qb.where({ valid_end: null, 'Membership.LeavingDate': null});
    }).fetchAll({withRelated: 'Membership'}).then(function (dataCollection) {
        var records = [];
        if (dataCollection && dataCollection.length > 0) {
            records = dataCollection.map(function (dataModel) {
                var membership = dataModel.related('Membership');
                var dataObj = {
                    Firstname: dataModel.get('Firstname'),
                    Lastname: dataModel.get('Lastname'),
                    Suffix: dataModel.get('Suffix')
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
                Records: records
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
        console.log("Error while retrieving Persons from the database: " + error);
        var err = new Error(error);
        err.status = 500;
        next(err);
    });
};
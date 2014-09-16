var _ = require('underscore');
var moment = require('moment');
var config = require('../config');
var model = require('../model');
var Person = model.models.Person;
var PersonItem = model.models.PersonItem;
var Membership = model.models.Membership;
var MembershipItem = model.models.MembershipItem;

var appName = config.get('appName');

module.exports.render = function (req, res, next, page, pages, collectionModelClass) {

    new PersonItem().query(function (qb) {
        qb.leftJoin('Persons', 'Persons.id', 'PersonItems.Person_id');
        qb.leftJoin('Memberships', 'Persons.id', 'Memberships.Person_id');
        qb.leftJoin('MembershipItems', 'Memberships.id', 'MembershipItems.Membership_id');
        qb.orderBy('Lastname', 'ASC');
        qb.where({ 'PersonItems.valid_end': null, 'MembershipItems.valid_end': null, 'MembershipItems.LeavingDate': null});
    }).fetchAll().then(function (dataCollection) {
        var records = [];
        if (dataCollection && dataCollection.length > 0) {
            records = dataCollection.map(function (dataModel) {
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
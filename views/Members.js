var _ = require('underscore');
var Promise = require('bluebird/js/main/promise')();
var moment = require('moment');
var config = require('../config');
var model = require('../model');
var getContactDataForPerson = require('./Contacts').getContactDataForPerson;
var PersonItem = model.models.PersonItem;
var PersonContactType = model.models.PersonContactType;
var PersonContactData = model.models.PersonContactData;
var PersonContactDataAddress = model.models.PersonContactDataAddress;
var PersonContactDataPhonenumber = model.models.PersonContactDataPhonenumber;
var PersonContactDataAccount = model.models.PersonContactDataAccount;
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
    }).fetchAll().then(function (personItemCollection) {
        var records = [];
        if (personItemCollection && personItemCollection.length > 0) {
            new PersonContactType().fetchAll()
                .then(function (personContactTypes) {
                    var personContactTypesByName = {};
                    personContactTypes.forEach(function (personContactType) {
                        personContactTypesByName[personContactType.get('Name')] = personContactType.get('id');
                    });

                    Promise.reduce(personItemCollection.models, function (total, dataModel, index, arrayLength) {
                        var dataObj = {
                            Firstname: dataModel.get('Firstname'),
                            Lastname: dataModel.get('Lastname'),
                            Suffix: dataModel.get('Suffix'),
                            Salutation: dataModel.get('Salutation'),
                            Birthday: dataModel.get('Birthday')
                        };
                        records.push(dataObj);

                        return new Promise(function (resolvePerson, rejectPerson) {
                                getContactDataForPerson(dataModel, personContactTypesByName).then(function (contactData) {
                                    dataObj.Addresses = contactData.Addresses;
                                    dataObj.PhoneNumbers = contactData.PhoneNumbers;
                                    dataObj.Accounts = contactData.Accounts;

                                    total.push(dataModel);
                                    console.log("Finish person # " + total.length);
                                    resolvePerson(dataModel);
                                }).catch(function(error){
                                    rejectPerson(error);
                                });
                            }
                        ).return(total);
                    }, []).then(function (allPersons) {
                        res.render(page.View, {
                            csrfToken: req.csrfToken(),
                            appName: appName,
                            title: page.EntityNamePlural,
                            user: req.user,
                            pages: pages,
                            page: page,
                            Records: records
                        });
                    }).catch(function (error) {
                        console.log("Error while processing PersonItems from database: " + error);
                        res.render(page.View, {
                            csrfToken: req.csrfToken(),
                            appName: appName,
                            title: page.EntityNamePlural,
                            user: req.user,
                            pages: pages,
                            page: page,
                            error: "Fehler beim Lesen der Personen aus der Datenbank"
                        });
                    });
                }).catch(function (error) {
                    console.log("Error while retrieving PersonContactTypes from database: " + error);
                    res.render(page.View, {
                        csrfToken: req.csrfToken(),
                        appName: appName,
                        title: page.EntityNamePlural,
                        user: req.user,
                        pages: pages,
                        page: page,
                        error: "Fehler beim Lesen der Personen aus der Datenbank"
                    });
                }
            );
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
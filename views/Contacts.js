var _ = require('underscore');
var Promise = require('bluebird/js/main/promise')();
var config = require('../config');
var model = require('../model');
var PersonItem = model.models.PersonItem;
var PersonContactType = model.models.PersonContactType;
var PersonContactData = model.models.PersonContactData;
var PersonContactDataAddress = model.models.PersonContactDataAddress;
var PersonContactDataPhonenumber = model.models.PersonContactDataPhonenumber;
var PersonContactDataAccount = model.models.PersonContactDataAccount;

var appName = config.get('appName');

// returns a promise, which will be resolved after all contact data has been loaded from the database
module.exports.getContactDataForPerson = function (personItemModel, personContactTypesByName) {
    return new Promise(function (resolvePersonItem, rejectPersonItem) {

        var contactData = {
            Addresses: [],
            PhoneNumbers: [],
            Accounts: []
        };

        var personContactTypeAddress = personContactTypesByName['address'];
        var personContactTypePhone = personContactTypesByName['phone'];
        var personContactTypeEmail = personContactTypesByName['email'];
        var personContactTypeTwitter = personContactTypesByName['twitter'];

        new PersonContactDataAddress().query(function (qb) {
            qb.innerJoin('PersonContactDatas', 'PersonContactDatas.id', 'PersonContactDataAddresses.PersonContactData_id');
            qb.where({
                'Person_id': personItemModel.get('Person_id'),
                'PersonContactType_id': personContactTypeAddress,
                'valid_end': null
            });
            qb.select('PersonContactDatas.Usage');
        }).fetchAll().then(function (personContactAddresses) {
            personContactAddresses.forEach(function (personContactAddress) {
                var addressObj = {
                    Street: personContactAddress.get('Street'),
                    StreetNumber: personContactAddress.get('StreetNumber'),
                    Postalcode: personContactAddress.get('Postalcode'),
                    City: personContactAddress.get('City'),
                    Usage: personContactAddress.get('Usage')
                };
                contactData.Addresses.push(addressObj);
            });

            new PersonContactDataPhonenumber().query(function (qb) {
                qb.innerJoin('PersonContactDatas', 'PersonContactDatas.id', 'PersonContactDataPhonenumbers.PersonContactData_id');
                qb.where({
                    'Person_id': personItemModel.get('Person_id'),
                    'PersonContactType_id': personContactTypePhone,
                    'valid_end': null
                });
                qb.select('PersonContactDatas.Usage');
            }).fetchAll().then(function (personContactPhoneNumbers) {
                personContactPhoneNumbers.forEach(function (personContactPhoneNumber) {
                    var phoneNumberObj = {
                        Number: model.formatPhoneNumber(personContactPhoneNumber.get('Number')),
                        Usage: personContactPhoneNumber.get('Usage')
                    };
                    contactData.PhoneNumbers.push(phoneNumberObj);
                });

                new PersonContactDataAccount().query(function (qb) {
                    qb.innerJoin('PersonContactDatas', 'PersonContactDatas.id', 'PersonContactDataAccounts.PersonContactData_id');
                    qb.innerJoin('PersonContactTypes', 'PersonContactTypes.id', 'PersonContactDatas.PersonContactType_id');
                    qb.where({
                        'Person_id': personItemModel.get('Person_id'),
                        'valid_end': null
                    });
                    qb.where({'PersonContactType_id': personContactTypeEmail})
                        .orWhere({'PersonContactType_id': personContactTypeTwitter});
                    qb.select(['PersonContactDatas.Usage', 'PersonContactTypes.Description']);
                }).fetchAll().then(function (personContactAccount) {
                    personContactAccount.forEach(function (personContactAccount) {
                        var accountObj = {
                            Account: personContactAccount.get('Account'),
                            Usage: personContactAccount.get('Usage'),
                            Type: personContactAccount.get('Description')
                        };
                        contactData.Accounts.push(accountObj);
                    });
                    resolvePersonItem(contactData);
                });
            });
        }).catch(function (error) {
            console.log("Error while reading person contact data: " + error);
            rejectPersonItem(error);
        });
    });
}

module.exports.render = function (req, res, next, page, pages, collectionModelClass) {

    new PersonItem().query(function (qb) {
        qb.leftJoin('Persons', 'Persons.id', 'PersonItems.Person_id');
        qb.leftJoin('ContactItems', 'Persons.id', 'ContactItems.Person_id');
        qb.leftJoin('Contacts', 'Contacts.id', 'ContactItems.Contact_id');
        qb.leftJoin('Memberships', 'Persons.id', 'Memberships.Person_id');
        qb.leftJoin('MembershipItems', 'Memberships.id', 'MembershipItems.Membership_id');
        qb.orderBy('Lastname', 'ASC');
        qb.where({ 'Contacts.Page_id': page.Name, 'PersonItems.valid_end': null, 'ContactItems.valid_end': null, 'MembershipItems.valid_end': null, 'MembershipItems.LeavingDate': null});
    }).fetchAll().then(function (dataCollection) {
        var records = [];
        if (dataCollection && dataCollection.length > 0) {
            new PersonContactType().fetchAll().then(function (personContactTypes) {
                var personContactTypesByName = {};
                personContactTypes.forEach(function (personContactType) {
                    personContactTypesByName[personContactType.get('Name')] = personContactType.get('id');
                });

                Promise.reduce(dataCollection.models, function (total, dataModel, index, arrayLength) {
                    var dataObj = {
                        Firstname: dataModel.get('Firstname'),
                        Lastname: dataModel.get('Lastname'),
                        Suffix: dataModel.get('Suffix'),
                        Salutation: dataModel.get('Salutation'),
                        Birthday: dataModel.get('Birthday')
                    };
                    records.push(dataObj);

                    return new Promise(function (resolvePerson, rejectPerson) {
                            module.exports.getContactDataForPerson(dataModel, personContactTypesByName).then(function (contactData) {
                                dataObj.Addresses = contactData.Addresses;
                                dataObj.PhoneNumbers = contactData.PhoneNumbers;
                                dataObj.Accounts = contactData.Accounts;

                                total.push(dataModel);
                                resolvePerson(dataModel);
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
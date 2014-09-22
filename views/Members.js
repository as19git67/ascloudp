var _ = require('underscore');
var Promise = require('bluebird/js/main/promise')();
var config = require('../config');
var model = require('../model');
var getContactDataForPerson = require('./Contacts').getContactDataForPerson;
var PersonContactType = model.models.PersonContactType;
var PersonContactData = model.models.PersonContactData;
var PersonContactDataAddress = model.models.PersonContactDataAddress;
var PersonContactDataPhonenumber = model.models.PersonContactDataPhonenumber;
var PersonContactDataAccount = model.models.PersonContactDataAccount;
var Membership = model.models.Membership;
var MembershipItem = model.models.MembershipItem;

//var databaseClient = config.get('databaseClient');
//var connectionString = config.get('connectionString');

//var knex = require('knex')({client: databaseClient, connection: connectionString, debug: false });
var knex = model.bookshelf.knex;

var appName = config.get('appName');

module.exports.render = function (req, res, next, page, pages, collectionModelClass) {

    knex.select('Salutation', 'Firstname', 'Lastname', 'Suffix', 'Birthday',
        'PersonItems.Person_id as Person_id',
        'PersonContactDatas.id as PersonContactData_id', 'PersonContactDatas.Usage as PersonContactDataUsage',
        'PersonContactTypes.Name as PersonContactTypeName', 'PersonContactTypes.Description as PersonContactTypeDescription',
        'Memberships.MembershipNumber',
        'MembershipItems.EntryDate', 'MembershipItems.LeavingDate', 'MembershipItems.PassiveSince', 'MembershipItems.LivingElsewhereSince',
        'LeavingReasons.Name as LeavingReasonName',
        'MembershipFees.Name as MembershipFeeName', 'MembershipFees.Amount as MembershipFeeAmount',
        'PersonContactDataAddresses.Street', 'PersonContactDataAddresses.StreetNumber', 'PersonContactDataAddresses.Postalcode', 'PersonContactDataAddresses.City',
        'PersonContactDataPhonenumbers.Number as PersonContactDataPhoneNumber',
        'PersonContactDataAccounts.Account as PersonContactDataAccount'
    ).from('Persons')
        .join('Memberships', 'Memberships.Person_id', 'Persons.id')
        .join('MembershipItems', 'MembershipItems.Membership_id', 'Memberships.id')
        .leftJoin('LeavingReasons', 'LeavingReasons.id', 'MembershipItems.LeavingReason_id')
        .leftJoin('MembershipFees', 'MembershipFees.id', 'MembershipItems.MembershipFee_id')
        .join('PersonItems', 'Persons.id', 'PersonItems.Person_id')
        .leftJoin('PersonContactDatas', 'PersonContactDatas.Person_id', 'Persons.id')
        .innerJoin('PersonContactTypes', 'PersonContactDatas.PersonContactType_id', 'PersonContactTypes.id')
        .leftJoin('PersonContactDataAddresses', 'PersonContactDataAddresses.PersonContactData_id', 'PersonContactDatas.id')
        .leftJoin('PersonContactDataPhonenumbers', 'PersonContactDataPhonenumbers.PersonContactData_id', 'PersonContactDatas.id')
        .leftJoin('PersonContactDataAccounts', 'PersonContactDataAccounts.PersonContactData_id', 'PersonContactDatas.id')
        .where({
            'PersonItems.valid_end': null,
            'PersonContactTypes.Deleted': false,
            'PersonContactDataAddresses.valid_end': null,
            'PersonContactDataPhonenumbers.valid_end': null,
            'PersonContactDataAccounts.valid_end': null,
            'MembershipItems.valid_end': null,
            'MembershipItems.LeavingDate': null
        })
        .orderBy('PersonItems.Lastname', 'ASC')
        .orderBy('Persons.id', 'ASC')
        .then(function (persons) {
            var records = [];
            var lastMemberId;
            var currentPersonObj;
            _.each(persons, function (p) {
                if (p.MembershipNumber != lastMemberId) {
                    lastMemberId = p.MembershipNumber;
                    currentPersonObj = new Object();
                    records.push(currentPersonObj);
                    currentPersonObj.id = p.Person_id;
                    currentPersonObj.MembershipNumber = p.MembershipNumber;
                    currentPersonObj.Salutation = p.Salutation;
                    currentPersonObj.Firstname = p.Firstname;
                    currentPersonObj.Lastname = p.Lastname;
                    currentPersonObj.Suffix = p.Suffix;
                    currentPersonObj.Birthday = model.formatDate(p.Birthday);
                    currentPersonObj.EntryDate = model.formatDate(p.EntryDate);
                    currentPersonObj.Addresses = [];
                    currentPersonObj.PhoneNumbers = [];
                    currentPersonObj.Accounts = [];
                }
                switch (p.PersonContactTypeName) {
                    case 'address':
                        currentPersonObj.Addresses.push({
                            Street: p.Street,
                            StreetNumber: p.StreetNumber,
                            Postalcode: p.Postalcode,
                            City: p.City,
                            Usage: p.PersonContactDataUsage,
                            Type: p.PersonContactTypeDescription
                        });
                        break;
                    case 'phone':
                        currentPersonObj.PhoneNumbers.push({
                            Number: model.formatPhoneNumber(p.PersonContactDataPhoneNumber),
                            Usage: p.PersonContactDataUsage,
                            Type: p.PersonContactTypeDescription});
                        break;
                    default:
                        currentPersonObj.Accounts.push({
                            Account: p.PersonContactDataAccount,
                            Usage: p.PersonContactDataUsage,
                            Type: p.PersonContactTypeDescription
                        });
                }
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
        })
        .catch(function (error) {
            console.log("Error while reading persons with contact data from database: " + error);
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

    return;

    /*
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
     }).catch(function (error) {
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
     */
};
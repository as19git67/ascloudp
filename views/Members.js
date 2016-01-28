var _ = require('underscore');
var Promise = require('bluebird/js/release/promise')();
var config = require('../config');
var model = require('../model');
var members = require('../routes/api/v1/members');
var knex = model.bookshelf.knex;

var appName = config.get('appName');

module.exports.render = function (req, res, next, page, pages, canEdit, collectionModelClass) {

    knex.raw(members.listQuery).then(function (persons) {
        var records = [];
        var lastMemberId;
        var currentPersonObj;
        _.each(persons.rows, function (p) {
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
                currentPersonObj.Birthday = model.formatDate(p.BirthdayNoTZ);
                currentPersonObj.EntryDate = model.formatDate(p.EntryDate);
                currentPersonObj.Addresses = [];
                currentPersonObj.PhoneNumbers = [];
                currentPersonObj.Accounts = [];
            }
            switch (p.PersonContactTypeName) {
                case 'address':
                    if (p.PersonContactDataAddressesId) {
                        currentPersonObj.Addresses.push({
                            Street: p.Street,
                            StreetNumber: p.StreetNumber,
                            Postalcode: p.Postalcode,
                            City: p.City,
                            Usage: p.PersonContactDataUsage,
                            Type: p.PersonContactTypeName,
                            TypeDescription: p.PersonContactTypeDescription
                        });
                    }
                    break;
                case 'phone':
                    if (p.PersonContactDataPhonenumbersId) {
                        currentPersonObj.PhoneNumbers.push({
                            Number: model.formatPhoneNumber(p.PersonContactDataPhoneNumber),
                            Usage: p.PersonContactDataUsage,
                            Type: p.PersonContactTypeName,
                            TypeDescription: p.PersonContactTypeDescription
                        });
                    }
                    break;
                default:
                    if (p.PersonContactDataAccountsId) {
                        currentPersonObj.Accounts.push({
                            Account: p.PersonContactDataAccount,
                            Usage: p.PersonContactDataUsage,
                            Type: p.PersonContactTypeName,
                            TypeDescription: p.PersonContactTypeDescription
                        });
                    }
            }
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
            Records: records
        });
    })
        .catch(function (error) {
            console.log("Error while reading persons with contact data from database: " + error);
            res.render(page.View, {
                csrfToken: req.csrfToken(),
                bootstrapTheme: config.get('bootstrapStyle'),
                canEdit: false,
                appName: appName,
                title: page.EntityNamePlural,
                user: req.user,
                pages: pages,
                page: page,
                error: "Fehler beim Lesen der Personen aus der Datenbank"
            });
        });

};
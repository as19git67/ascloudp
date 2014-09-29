var _ = require('underscore');
var Promise = require('bluebird/js/main/promise')();
var config = require('../config');
var model = require('../model');

var knex = model.bookshelf.knex;

var appName = config.get('appName');

module.exports.render = function (req, res, next, page, pages, canEdit, collectionModelClass) {

    var query = 'select "Salutation", "Firstname", "PersonItems"."Lastname", "Suffix", "Birthday", "PersonItems"."Person_id" as "Person_id",' +
        '"PersonContactDataAddresses"."PersonContactData_id" as "PersonContactDataAddressesId",'+
        '"PersonContactDataPhonenumbers"."PersonContactData_id" as "PersonContactDataPhonenumbersId",'+
        '"PersonContactDataAccounts"."PersonContactData_id" as "PersonContactDataAccountsId",'+
        '"PersonContactDatas"."id" as "PersonContactData_id",' +
        '"PersonContactDatas"."Usage" as "PersonContactDataUsage",' +
        '"PersonContactTypes"."Name" as "PersonContactTypeName",' +
        '"PersonContactTypes"."Description" as "PersonContactTypeDescription", "Memberships"."MembershipNumber", "MembershipItems"."EntryDate", "MembershipItems"."LeavingDate",' +
        '"MembershipItems"."PassiveSince", "MembershipItems"."LivingElsewhereSince", "LeavingReasons"."Name" as "LeavingReasonName", "MembershipFees"."Name" as "MembershipFeeName",' +
        '"MembershipFees"."Amount" as "MembershipFeeAmount", "PersonContactDataAddresses"."Street", "PersonContactDataAddresses"."StreetNumber", "PersonContactDataAddresses"."Postalcode",' +
        '"PersonContactDataAddresses"."City", "PersonContactDataPhonenumbers"."Number" as "PersonContactDataPhoneNumber", "PersonContactDataAccounts"."Account" as "PersonContactDataAccount"' +
        ' from "Persons"' +
        ' inner join "PersonItems" on "Persons"."id" = "PersonItems"."Person_id"' +
        ' inner join "Memberships" on "Memberships"."Person_id" = "Persons"."id"' +
        ' inner join "MembershipItems" on "MembershipItems"."Membership_id" = "Memberships"."id"' +
        ' left join "LeavingReasons" on "LeavingReasons"."id" = "MembershipItems"."LeavingReason_id"' +
        ' left join "MembershipFees" on "MembershipFees"."id" = "MembershipItems"."MembershipFee_id"' +
        ' left join "PersonContactDatas" on "PersonContactDatas"."Person_id" = "Persons"."id"' +
        ' inner join "PersonContactTypes" on "PersonContactDatas"."PersonContactType_id" = "PersonContactTypes"."id"' +
        ' left join "PersonContactDataAddresses" on ("PersonContactDataAddresses"."PersonContactData_id" = "PersonContactDatas"."id" and "PersonContactDataAddresses"."valid_end" is  null)' +
        ' left join "PersonContactDataPhonenumbers" on ("PersonContactDataPhonenumbers"."PersonContactData_id" = "PersonContactDatas"."id" and "PersonContactDataPhonenumbers"."valid_end" is  null)' +
        ' left join "PersonContactDataAccounts" on ("PersonContactDataAccounts"."PersonContactData_id" = "PersonContactDatas"."id" and "PersonContactDataAccounts"."valid_end" is  null)' +
        ' where "PersonItems"."valid_end" is null' +
        ' and "PersonContactTypes"."Deleted" = false' +
        ' and "MembershipItems"."valid_end" is null' +
        ' and "MembershipItems"."LeavingDate" is null' +
        ' order by "PersonItems"."Lastname" ASC, "PersonItems"."Person_id" ASC';
    knex.raw(query)
        /*
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
         .leftJoin('PersonContactDataAddresses',  'PersonContactDataAddresses.PersonContactData_id', 'PersonContactDatas.id')
         .leftJoin('PersonContactDataPhonenumbers', 'PersonContactDataPhonenumbers.PersonContactData_id', 'PersonContactDatas.id')
         .leftJoin('PersonContactDataAccounts', 'PersonContactDataAccounts.PersonContactData_id', 'PersonContactDatas.id')
         .where({
         'PersonItems.valid_end': null,
         'PersonContactTypes.Deleted': false,
         'MembershipItems.valid_end': null,
         'MembershipItems.LeavingDate': null
         })
         .orderBy('PersonItems.Lastname', 'ASC')
         .orderBy('Persons.id', 'ASC')
         */
        .then(function (persons) {
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
                    currentPersonObj.Birthday = model.formatDate(p.Birthday);
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
                                Type: p.PersonContactTypeDescription
                            });
                        }
                        break;
                    case 'phone':
                        if (p.PersonContactDataPhonenumbersId) {
                            currentPersonObj.PhoneNumbers.push({
                                Number: model.formatPhoneNumber(p.PersonContactDataPhoneNumber),
                                Usage: p.PersonContactDataUsage,
                                Type: p.PersonContactTypeDescription});
                        }
                        break;
                    default:
                        if (p.PersonContactDataAccountsId) {
                            currentPersonObj.Accounts.push({
                                Account: p.PersonContactDataAccount,
                                Usage: p.PersonContactDataUsage,
                                Type: p.PersonContactTypeDescription
                            });
                        }
                }
            });

            res.render(page.View, {
                csrfToken: req.csrfToken(),
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
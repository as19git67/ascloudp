var _ = require('underscore');
var model = require('../../../model');
var moment = require('moment');
var PersonItem = model.models.PersonItem;

var knex = model.bookshelf.knex;

// todo check user + role

module.exports.get = function (req, res) {
    var personId = req.params.id;

    var query = 'select "Salutation", "Firstname", "PersonItems"."Lastname", "Suffix", "Birthday", "PersonItems"."Person_id" as "Person_id",' +
        '"PersonContactDataAddresses"."PersonContactData_id" as "PersonContactDataAddressesId",' +
        '"PersonContactDataPhonenumbers"."PersonContactData_id" as "PersonContactDataPhonenumbersId",' +
        '"PersonContactDataAccounts"."PersonContactData_id" as "PersonContactDataAccountsId",' +
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
        ' where "PersonItems"."Person_id" = ' + personId +
        ' and "PersonItems"."valid_end" is null' +
        ' and "PersonContactTypes"."Deleted" = false' +
        ' and "MembershipItems"."valid_end" is null' +
        ' and "MembershipItems"."LeavingDate" is null';
    knex.raw(query).then(function (persons) {
        var records = [];
        var addresses = [];
        var phoneNumbers = [];
        var accounts = [];
        var lastMemberId;
        var currentPersonObj;
        _.each(persons.rows, function (p) {
            if (p.MembershipNumber != lastMemberId) {
                lastMemberId = p.MembershipNumber;
                currentPersonObj = new Object();
                records.push(currentPersonObj);
                currentPersonObj.id = p.Person_id;
                currentPersonObj.membershipNumber = p.MembershipNumber;
                currentPersonObj.salutation = p.Salutation;
                currentPersonObj.firstname = p.Firstname;
                currentPersonObj.lastname = p.Lastname;
                currentPersonObj.suffix = p.Suffix;
                currentPersonObj.birthday = p.Birthday;
                currentPersonObj.entryDate = p.EntryDate;
                currentPersonObj.birthday_formatted = model.formatDate(p.Birthday);
                currentPersonObj.entryDate_formatted = model.formatDate(p.EntryDate);
                currentPersonObj.leavingDate = p.LeavingDate;
                currentPersonObj.passiveSince = p.PassiveSince;
                currentPersonObj.livingElsewhereSince = p.LivingElsewhereSince;
                currentPersonObj.leavingReasonName = p.LeavingReasonName;
                currentPersonObj.membershipFeeName = p.MembershipFeeName;
                currentPersonObj.membershipFeeAmount = p.MembershipFeeAmount;
                currentPersonObj.addresses = [];
                currentPersonObj.phoneNumbers = [];
                currentPersonObj.accounts = [];
            }
            switch (p.PersonContactTypeName) {
                case 'address':
                    if (p.PersonContactDataAddressesId) {
                        addresses.push({
                            id: p.PersonContactData_id,
                            street: p.Street,
                            streetNumber: p.StreetNumber,
                            postalcode: p.Postalcode,
                            city: p.City,
                            usage: p.PersonContactDataUsage,
                            type: p.PersonContactTypeName,
                            typeDescription: p.PersonContactTypeDescription
                        });
                        currentPersonObj.addresses.push(p.PersonContactData_id);
                    }
                    break;
                case 'phone':
                    if (p.PersonContactDataPhonenumbersId) {
                        phoneNumbers.push({
                            id: p.PersonContactData_id,
                            number: p.PersonContactDataPhoneNumber,
                            number_formatted: model.formatPhoneNumber(p.PersonContactDataPhoneNumber),
                            usage: p.PersonContactDataUsage,
                            type: p.PersonContactTypeName,
                            typeDescription: p.PersonContactTypeDescription
                        });
                        currentPersonObj.phoneNumbers.push(p.PersonContactData_id);
                    }
                    break;
                default:
                    if (p.PersonContactDataAccountsId) {
                        accounts.push({
                            id: p.PersonContactData_id,
                            account: p.PersonContactDataAccount,
                            usage: p.PersonContactDataUsage,
                            type: p.PersonContactTypeName,
                            typeDescription: p.PersonContactTypeDescription
                        });
                        currentPersonObj.accounts.push(p.PersonContactData_id);
                    }
            }
        });

        if (records.length > 0) {
            res.setHeader('X-CSRF-Token', req.csrfToken());
            res.json(
                {
                    members: records,
                    addresses: addresses,
                    phoneNumbers: phoneNumbers,
                    accounts: accounts
                }
            );
        } else {
            res.statusCode = 404;
            res.send('Error 404: Person with id ' + personId + ' not found');
        }

    }).catch(function (error) {
        console.log("Error while reading persons with contact data from database: " + error);
        res.statusCode = 500;
        return res.send('Error 500: reading of persons from database failed');
    });
};

module.exports.listQuerySelectFrom =
    'select "Salutation", "Firstname", "PersonItems"."Lastname", "Suffix", "Birthday", "PersonItems"."Person_id" as "Person_id",' +
    '"PersonContactDataAddresses"."PersonContactData_id" as "PersonContactDataAddressesId",' +
    '"PersonContactDataPhonenumbers"."PersonContactData_id" as "PersonContactDataPhonenumbersId",' +
    '"PersonContactDataAccounts"."PersonContactData_id" as "PersonContactDataAccountsId",' +
    '"PersonContactDatas"."id" as "PersonContactData_id",' +
    '"PersonContactDatas"."Usage" as "PersonContactDataUsage",' +
    '"PersonContactTypes"."Name" as "PersonContactTypeName",' +
    '"PersonContactTypes"."Description" as "PersonContactTypeDescription", "Memberships"."MembershipNumber", "MembershipItems"."EntryDate", "MembershipItems"."LeavingDate",' +
    '"MembershipItems"."PassiveSince", "MembershipItems"."LivingElsewhereSince", "LeavingReasons"."Name" as "LeavingReasonName", "MembershipFees"."Name" as "MembershipFeeName",' +
    '"MembershipFees"."Amount" as "MembershipFeeAmount", "PersonContactDataAddresses"."Street", "PersonContactDataAddresses"."StreetNumber", "PersonContactDataAddresses"."Postalcode",' +
    '"PersonContactDataAddresses"."City", "PersonContactDataPhonenumbers"."Number" as "PersonContactDataPhoneNumber", "PersonContactDataAccounts"."Account" as "PersonContactDataAccount"' +
    ' from "Persons"';
module.exports.listQueryJoins =
    ' inner join "PersonItems" on "Persons"."id" = "PersonItems"."Person_id"' +
    ' inner join "Memberships" on "Memberships"."Person_id" = "Persons"."id"' +
    ' inner join "MembershipItems" on "MembershipItems"."Membership_id" = "Memberships"."id"' +
    ' left join "LeavingReasons" on "LeavingReasons"."id" = "MembershipItems"."LeavingReason_id"' +
    ' left join "MembershipFees" on "MembershipFees"."id" = "MembershipItems"."MembershipFee_id"' +
    ' left join "PersonContactDatas" on "PersonContactDatas"."Person_id" = "Persons"."id"' +
    ' inner join "PersonContactTypes" on "PersonContactDatas"."PersonContactType_id" = "PersonContactTypes"."id"' +
    ' left join "PersonContactDataAddresses" on ("PersonContactDataAddresses"."PersonContactData_id" = "PersonContactDatas"."id" and "PersonContactDataAddresses"."valid_end" is  null)' +
    ' left join "PersonContactDataPhonenumbers" on ("PersonContactDataPhonenumbers"."PersonContactData_id" = "PersonContactDatas"."id" and "PersonContactDataPhonenumbers"."valid_end" is  null)' +
    ' left join "PersonContactDataAccounts" on ("PersonContactDataAccounts"."PersonContactData_id" = "PersonContactDatas"."id" and "PersonContactDataAccounts"."valid_end" is  null)';
module.exports.listQueryWhereClauses =
    ' where "PersonItems"."valid_end" is null' +
    ' and "PersonContactTypes"."Deleted" = false' +
    ' and "MembershipItems"."valid_end" is null' +
    ' and "MembershipItems"."LeavingDate" is null';
module.exports.listQueryOrderByClause =
    ' order by "PersonItems"."Lastname" ASC, "PersonItems"."Person_id" ASC, "PersonContactTypes"."Description", "PersonContactDatas"."Usage"';

module.exports.listQuery =
    module.exports.listQuerySelectFrom +
    module.exports.listQueryJoins +
    module.exports.listQueryWhereClauses +
    module.exports.listQueryOrderByClause;

var addPersonContactData = function (personData, currentPersonObj) {
    switch (personData.PersonContactTypeName) {
        case 'address':
            if (personData.PersonContactDataAddressesId) {
                currentPersonObj.Addresses.push({
                    Street: personData.Street,
                    StreetNumber: personData.StreetNumber,
                    Postalcode: personData.Postalcode,
                    City: personData.City,
                    Usage: personData.PersonContactDataUsage,
                    Type: personData.PersonContactTypeDescription
                });
            }
            break;
        case 'phone':
            if (personData.PersonContactDataPhonenumbersId) {
                currentPersonObj.PhoneNumbers.push({
                    Number: model.formatPhoneNumber(personData.PersonContactDataPhoneNumber),
                    Usage: personData.PersonContactDataUsage,
                    Type: personData.PersonContactTypeDescription});
            }
            break;
        default:
            if (personData.PersonContactDataAccountsId) {
                currentPersonObj.Accounts.push({
                    Account: personData.PersonContactDataAccount,
                    Usage: personData.PersonContactDataUsage,
                    Type: personData.PersonContactTypeDescription
                });
            }
    }
};

/*
 Make a hirarchical object structure from a sorted array of person models, which
 are the results of a query on several joined tables.
 */
module.exports.makeHierarchicalObjectStructureFromPersonResultRecords = function (persons) {
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
        addPersonContactData(p, currentPersonObj);
    });
    return records;
};

module.exports.list = function (req, res) {

    knex.raw(module.exports.listQuery).then(function (persons) {
        var records = module.exports.makeHierarchicalObjectStructureFromPersonResultRecords(persons);
        res.json(
            {
                members: records,
                addresses: addresses,
                phoneNumbers: phoneNumbers,
                accounts: accounts
            }
        );

    }).catch(function (error) {
        console.log("Error while reading persons with contact data from database: " + error);
        res.statusCode = 500;
        return res.send('Error 500: reading of persons from database failed');
    });
};

module.exports.put = function (req, res) {
    var personId = req.params.id;

    if (req.body.member) {
        var member = req.body.member;
        console.log("Saving PersonItem with Person_id " + personId);
        new PersonItem({Person_id: personId}).fetch().then(function (person) {
            if (person) {
                var pBirthday;
                var mBirthday;
                if (member.birthday && person.get('Birthday')) {
                    pBirthday = moment(person.get('Birthday'));
                    if (pBirthday.isValid() == false) {
                        pBirthday = undefined;
                    }
                    mBirthday = moment(member.birthday);
                    if (mBirthday.isValid() == false) {
                        mBirthday = undefined;
                    }
                    // console.log("pBirthday: " + pBirthday.format('LLLL'));
                    // console.log("mBirthday: " + mBirthday.format('LLLL'));
                }
                if (
                    pBirthday.isSame(mBirthday) == false ||
                    person.get('Firstname') != member.firstname ||
                    person.get('Lastname') != member.lastname ||
                    person.get('Suffix') != member.suffix ||
                    person.get('Salutation') != member.salutation) {

                    var now = new Date();
                    person.set('valid_end', now);

                    person.save()
                        .then(function (savedPersonHistory) {
                            console.log("PersonItem saved for history");
                            new PersonItem({
                                'Person_id': personId,
                                'Birthday': member.birthday,
                                'Birthday_utc': member.birthday,
                                'Firstname': member.firstname,
                                'Lastname': member.lastname,
                                'Suffix': member.suffix,
                                'Salutation': member.salutation,
                                'valid_start': now
                            }).save().then(function (savedPerson) {
                                    console.log("PersonItem saved");
                                    // return put data again back to caller
                                    module.exports.get(req, res);
                                }).catch(function (error) {
                                    console.log("Error while saving new PersonItem with Person_id " + personId + ": " + error);
                                    res.statusCode = 500;
                                    res.send("Error 500: saving new PersonItem with Person_id " + personId + " failed");
                                });
                        }).catch(function (error) {
                            console.log("Error while updating PersonItem with Person_id " + personId + ": " + error);
                            res.statusCode = 500;
                            res.send("Error 500: updating PersonItem with Person_id " + personId + " failed");
                        });
                }
                else {
                    console.log("Not saving PersonItem because nothing changed.");
                    res.statusCode = 304;   // not changed
                    res.send("304: PersonItem not changed");
                }
            } else {
                res.statusCode = 404;
                res.send('Error 404: PersonItem with Person_id ' + personId + ' not found');
            }
        }).catch(function (error) {
            console.log("Error while reading PersonItem with Person_id " + personId + " from the database: " + error);
            res.statusCode = 500;
            res.send("Error 500: reading PersonItem with Person_id " + personId + " failed");
        });
    } else {
        console.log('Error in member.put: request body does not have members array');
        res.statusCode = 400;
        res.send('Error 400: members in request missing');
    }
};

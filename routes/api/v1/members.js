var _ = require('underscore');
var model = require('../../../model');

var knex = model.bookshelf.knex;

module.exports.get = function (req, res) {
    var personId = req.params.id;

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
            'PersonItems.Person_id': personId,
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
            var addresses = [];
            var phoneNumbers = [];
            var accounts = [];
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
                        addresses.push({
                            id: p.PersonContactData_id,
                            Street: p.Street,
                            StreetNumber: p.StreetNumber,
                            Postalcode: p.Postalcode,
                            City: p.City,
                            Usage: p.PersonContactDataUsage,
                            Type: p.PersonContactTypeDescription
                        });
                        currentPersonObj.Addresses.push(p.PersonContactData_id);
                        break;
                    case 'phone':
                        phoneNumbers.push({
                            id: p.PersonContactData_id,
                            Number: model.formatPhoneNumber(p.PersonContactDataPhoneNumber),
                            Usage: p.PersonContactDataUsage,
                            Type: p.PersonContactTypeDescription});
                        currentPersonObj.PhoneNumbers.push(p.PersonContactData_id);
                        break;
                    default:
                        accounts.push({
                            id: p.PersonContactData_id,
                            Account: p.PersonContactDataAccount,
                            Usage: p.PersonContactDataUsage,
                            Type: p.PersonContactTypeDescription
                        });
                        currentPersonObj.Accounts.push(p.PersonContactData_id);
                }
            });

            res.json(
                {
                    members: records,
                    addresses: addresses,
                    phoneNumbers: phoneNumbers,
                    accounts: accounts
                }
            );

        })
        .catch(function (error) {
            console.log("Error while reading persons with contact data from database: " + error);
            res.statusCode = 500;
            return res.send('Error 500: reading of persons from database failed');
        });
};

module.exports.list = function (req, res) {

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
            var addresses = [];
            var phoneNumbers = [];
            var accounts = [];
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
                        addresses.push({
                            id: p.PersonContactData_id,
                            Street: p.Street,
                            StreetNumber: p.StreetNumber,
                            Postalcode: p.Postalcode,
                            City: p.City,
                            Usage: p.PersonContactDataUsage,
                            Type: p.PersonContactTypeDescription
                        });
                        currentPersonObj.Addresses.push(p.PersonContactData_id);
                        break;
                    case 'phone':
                        phoneNumbers.push({
                            id: p.PersonContactData_id,
                            Number: model.formatPhoneNumber(p.PersonContactDataPhoneNumber),
                            Usage: p.PersonContactDataUsage,
                            Type: p.PersonContactTypeDescription});
                        currentPersonObj.PhoneNumbers.push(p.PersonContactData_id);
                        break;
                    default:
                        accounts.push({
                            id: p.PersonContactData_id,
                            Account: p.PersonContactDataAccount,
                            Usage: p.PersonContactDataUsage,
                            Type: p.PersonContactTypeDescription
                        });
                        currentPersonObj.Accounts.push(p.PersonContactData_id);
                }
            });

            res.json(
                {
                    members: records,
                    addresses: addresses,
                    phoneNumbers: phoneNumbers,
                    accounts: accounts
                }
            );

        })
        .catch(function (error) {
            console.log("Error while reading persons with contact data from database: " + error);
            res.statusCode = 500;
            return res.send('Error 500: reading of persons from database failed');
        });
};

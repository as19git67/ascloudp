var _ = require('underscore');
var model = require('../../../model');
var moment = require('moment');
var PersonItem = model.models.PersonItem;

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
        'PersonContactDataAddresses.Street', 'PersonContactDataAddresses.StreetNumber', 'PersonContactDataAddresses.Postalcode',
        'PersonContactDataAddresses.City',
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
                    addresses.push({
                        id: p.PersonContactData_id,
                        street: p.Street,
                        streetNumber: p.StreetNumber,
                        postalcode: p.Postalcode,
                        city: p.City,
                        usage: p.PersonContactDataUsage,
                        type: p.PersonContactTypeDescription
                    });
                    currentPersonObj.addresses.push(p.PersonContactData_id);
                    break;
                case 'phone':
                    phoneNumbers.push({
                        id: p.PersonContactData_id,
                        number: p.PersonContactDataPhoneNumber,
                        number_formatted: model.formatPhoneNumber(p.PersonContactDataPhoneNumber),
                        usage: p.PersonContactDataUsage,
                        type: p.PersonContactTypeDescription});
                    currentPersonObj.phoneNumbers.push(p.PersonContactData_id);
                    break;
                default:
                    accounts.push({
                        id: p.PersonContactData_id,
                        account: p.PersonContactDataAccount,
                        usage: p.PersonContactDataUsage,
                        type: p.PersonContactTypeDescription
                    });
                    currentPersonObj.accounts.push(p.PersonContactData_id);
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
        'PersonContactDataAddresses.Street', 'PersonContactDataAddresses.StreetNumber', 'PersonContactDataAddresses.Postalcode',
        'PersonContactDataAddresses.City',
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
                    currentPersonObj.membershipNumber = p.MembershipNumber;
                    currentPersonObj.salutation = p.Salutation;
                    currentPersonObj.firstname = p.Firstname;
                    currentPersonObj.lastname = p.Lastname;
                    currentPersonObj.suffix = p.Suffix;
                    currentPersonObj.birthday = p.Birthday;
                    currentPersonObj.entryDate = p.EntryDate;
                    currentPersonObj.birthday_formatted = model.formatDate(p.Birthday);
                    currentPersonObj.entryDate_formatted = model.formatDate(p.EntryDate);
                    currentPersonObj.addresses = [];
                    currentPersonObj.phoneNumbers = [];
                    currentPersonObj.accounts = [];
                }
                switch (p.PersonContactTypeName) {
                case 'address':
                    addresses.push({
                        id: p.PersonContactData_id,
                        street: p.Street,
                        streetNumber: p.StreetNumber,
                        postalcode: p.Postalcode,
                        city: p.City,
                        usage: p.PersonContactDataUsage,
                        type: p.PersonContactTypeDescription
                    });
                    currentPersonObj.addresses.push(p.PersonContactData_id);
                    break;
                case 'phone':
                    phoneNumbers.push({
                        id: p.PersonContactData_id,
                        number: p.PersonContactDataPhoneNumber,
                        number_formatted: model.formatPhoneNumber(p.PersonContactDataPhoneNumber),
                        usage: p.PersonContactDataUsage,
                        type: p.PersonContactTypeDescription});
                    currentPersonObj.phoneNumbers.push(p.PersonContactData_id);
                    break;
                default:
                    accounts.push({
                        id: p.PersonContactData_id,
                        account: p.PersonContactDataAccount,
                        usage: p.PersonContactDataUsage,
                        type: p.PersonContactTypeDescription
                    });
                    currentPersonObj.accounts.push(p.PersonContactData_id);
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

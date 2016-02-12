var _ = require('underscore');
var Promise = require('bluebird/js/release/promise')();
var RejectionError = Promise.RejectionError;
var model = require('../../../model');
var moment = require('moment');
var PersonItem = model.models.PersonItem;
var Membership = model.models.Membership;
var MembershipItem = model.models.MembershipItem;

var knex = model.bookshelf.knex;

module.exports.get = function (req, res) {
    var personId = req.params.id;

    var query = 'select "Salutation", "Firstname", "PersonItems"."Lastname", "Suffix", "BirthdayNoTZ", "PersonItems"."Person_id" as "Person_id",' +
        '"PersonContactDataAddresses"."PersonContactData_id" as "PersonContactDataAddressesId",' +
        '"PersonContactDataPhonenumbers"."PersonContactData_id" as "PersonContactDataPhonenumbersId",' +
        '"PersonContactDataAccounts"."PersonContactData_id" as "PersonContactDataAccountsId",' +
        '"PersonContactDatas"."id" as "PersonContactData_id",' +
        '"PersonContactDatas"."Usage" as "PersonContactDataUsage",' +
        '"PersonContactTypes"."Name" as "PersonContactTypeName",' +
        '"PersonContactTypes"."Description" as "PersonContactTypeDescription", "MembershipItems"."MembershipNumber", "MembershipItems"."EntryDate", "MembershipItems"."LeavingDate",' +
        '"MembershipItems"."PassiveSince", "LeavingReasons"."Name" as "LeavingReasonName", "MembershipFees"."Name" as "MembershipFeeName",' +
        '"MembershipItems"."LeavingReason_id", "MembershipItems"."MembershipFee_id",' +
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
        ' and "MembershipItems"."valid_end" is null';
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
                currentPersonObj.birthday = p.BirthdayNoTZ;
                currentPersonObj.entryDate = p.EntryDate;
                currentPersonObj.leavingDate = p.LeavingDate;
                currentPersonObj.passiveSince = p.PassiveSince;
                currentPersonObj.leavingReasonName = p.LeavingReasonName;
                currentPersonObj.leavingReason_id = p.LeavingReason_id;
                currentPersonObj.membershipFeeName = p.MembershipFeeName;
                currentPersonObj.membershipFee_id = p.MembershipFee_id;
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
            var csrfToken;
            if (req.csrfToken) {
                csrfToken = req.csrfToken();
                res.setHeader('X-CSRF-Token', csrfToken);
            }
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
    'select "Salutation", "Firstname", "PersonItems"."Lastname", "Suffix", "BirthdayNoTZ", "PersonItems"."Person_id" as "Person_id",' +
    '"PersonContactDataAddresses"."PersonContactData_id" as "PersonContactDataAddressesId",' +
    '"PersonContactDataPhonenumbers"."PersonContactData_id" as "PersonContactDataPhonenumbersId",' +
    '"PersonContactDataAccounts"."PersonContactData_id" as "PersonContactDataAccountsId",' +
    '"PersonContactDatas"."id" as "PersonContactData_id",' +
    '"PersonContactDatas"."Usage" as "PersonContactDataUsage",' +
    '"PersonContactTypes"."Name" as "PersonContactTypeName",' +
    '"PersonContactTypes"."Description" as "PersonContactTypeDescription", "MembershipItems"."MembershipNumber", "MembershipItems"."EntryDate", "MembershipItems"."LeavingDate",' +
    '"MembershipItems"."PassiveSince", "LeavingReasons"."Name" as "LeavingReasonName", "MembershipFees"."Name" as "MembershipFeeName",' +
    '"MembershipItems"."LeavingReason_id", "MembershipItems"."MembershipFee_id",' +
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
    ' and "MembershipItems"."valid_end" is null';
//    ' and "MembershipItems"."LeavingDate" is null';
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
                    Type: personData.PersonContactTypeDescription
                });
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
            currentPersonObj = {};
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

function HttpError(message, httpStatus) {
    this.constructor.prototype.__proto__ = Error.prototype; // Make this an instanceof Error.
    Error.call(this); // Does not seem necessary. Perhaps remove this line?
    Error.captureStackTrace(this, this.constructor); // Creates the this.stack getter
    this.name = this.constructor.name; // Used to cause messages like "UserError: message" instead of the default "Error: message"
    this.message = message; // Used to set the message
    this.statusCode = httpStatus;
}

function isDateDifferent(member, sentDateName, person, modelDateName) {
    var pModelDate;
    var mSentDate;

    if (person.get(modelDateName)) {
        pModelDate = moment(person.get(modelDateName));
        if (pModelDate.isValid() == false) {
            pModelDate = undefined;
        }
    }
    if (member[sentDateName]) {
        mSentDate = moment(member[sentDateName]);
        if (mSentDate.isValid() == false) {
            mSentDate = undefined;
        }
    }
    if (pModelDate && mSentDate) {
        return pModelDate.isSame(mSentDate) == false;
    }
    return !(pModelDate == undefined && mSentDate == undefined);
}

function updatePersonItem(transaction, personId, member) {
    return new Promise(function (resolve, reject) {

        console.log("Saving PersonItem with Person_id " + personId);
        new PersonItem({Person_id: personId, 'valid_end': null}).fetch().then(function (person) {
            if (person) {
                var birthdayIsDifferent = isDateDifferent(member, "birthday", person, "BirthdayNoTZ");
                if (birthdayIsDifferent ||
                    person.get('Firstname') != member.firstname ||
                    person.get('Lastname') != member.lastname ||
                    person.get('Suffix') != member.suffix ||
                    person.get('Salutation') != member.salutation
                ) {

                    var now = new Date();
                    person.set('valid_end', now);

                    person.save(null, {transacting: transaction})
                        .then(function (savedPersonHistory) {
                            console.log("PersonItem saved for history");
                            new PersonItem({
                                'Person_id': personId,
                                'BirthdayNoTZ': member.birthday,
                                'Firstname': member.firstname,
                                'Lastname': member.lastname,
                                'Suffix': member.suffix,
                                'Salutation': member.salutation,
                                'valid_start': now
                            }).save(null, {transacting: transaction}).then(function (savedPerson) {
                                console.log("PersonItem saved");
                                resolve(savedPerson);
                            }).catch(function (error) {
                                console.log("Error while saving new PersonItem with Person_id " + personId + ": " + error);
                                reject(new HttpError("Error 500: saving new PersonItem with Person_id " + personId + " failed", 500));
                            });
                        }).catch(function (error) {
                        console.log("Error while updating PersonItem with Person_id " + personId + ": " + error);
                        reject(new HttpError("Error 500: updating PersonItem with Person_id " + personId + " failed", 500));
                    });
                }
                else {
                    console.log("Not saving PersonItem because nothing changed.");
                    resolve(undefined);
                }
            } else {
                reject(new HttpError("Error 404: PersonItem with Person_id " + personId + " not found", 404));
            }
        }).catch(function (error) {
            console.log("Error while reading PersonItem with Person_id " + personId + " from the database: " + error);
            reject(new HttpError("Error 500: reading PersonItem with Person_id " + personId + " failed", 500));
        });
    });
}

function updateMembership(transaction, personId, member) {
    return new Promise(function (resolve, reject) {

        console.log("Saving Membership with Person_id " + personId);
        new Membership({Person_id: personId}).fetch().then(function (membership) {
            if (membership) {
                if (membership.get('MembershipNumber') != member.membershipNumber) {
                    membership.set('MembershipNumber', member.membershipNumber);

                    membership.save(null, {transacting: transaction}).then(function (savedMembership) {
                        console.log("Membership saved");
                        updateMembershipItem(transaction, personId, member).then(function (savedMembership) {
                            if (savedMembership) {
                                console.log("MembershipItem saved");
                            } else {
                                console.log("MembershipItem not saved because nothing changed.");
                            }
                            resolve(savedMembership);
                        }).catch(function (error) {
                            reject(new HttpError("Error 500: updating Membership with Person_id " + personId + " failed", 500));
                        });
                    }).catch(function (error) {
                        console.log("Error while updating Membership with Person_id " + personId + ": " + error);
                        reject(new HttpError("Error 500: updating Membership with Person_id " + personId + " failed", 500));
                    });
                }
                else {
                    console.log("Not saving Membership because nothing changed.");

                    updateMembershipItem(transaction, personId, member).then(function (savedMembership) {
                        if (savedMembership) {
                            console.log("MembershipItem saved");
                        } else {
                            console.log("MembershipItem not saved because nothing changed.");
                        }
                        resolve(savedMembership);
                    }).catch(function (error) {
                        reject(new HttpError("Error 500: updating Membership with Person_id " + personId + " failed", 500));
                    });
                }
            } else {
                reject(new HttpError("Error 404: Membership with Person_id " + personId + " not found", 404));
            }
        }).catch(function (error) {
            console.log("Error while reading Membership with Person_id " + personId + " from the database: " + error);
            reject(new HttpError("Error 500: reading Membership with Person_id " + personId + " failed", 500));
        });
    });
}

function updateMembershipItem(transaction, personId, member) {
    return new Promise(function (resolve, reject) {

        console.log("Saving MembershipItem that belongs to Person with Person_id " + personId);
        new MembershipItem().query(function (qb) {
            qb.innerJoin('Memberships', 'Memberships.id', 'MembershipItems.Membership_id');
            qb.where({'Memberships.Person_id': personId})
                .andWhere('MembershipItems.valid_end', null)
        }).fetch().then(function (membershipItem) {
            if (membershipItem) {
                var membershipId = membershipItem.get('Membership_id');
                console.log("Updating membershipItem with Membership_id=" + membershipId);
                //console.log("MembershipItem loaded: " + JSON.stringify(membershipItem));
                var entryDateIsDifferent = isDateDifferent(member, "entryDate", membershipItem, "EntryDate");
                var leavingDateIsDifferent = isDateDifferent(member, "leavingDate", membershipItem, "LeavingDate");
                var passiveSinceIsDifferent = isDateDifferent(member, "passiveSince", membershipItem, "PassiveSince");
                if (entryDateIsDifferent || leavingDateIsDifferent || passiveSinceIsDifferent ||
                    membershipItem.get('MembershipNumber') != member.membershipNumber ||
                    membershipItem.get('LeavingReason_id') != member.leavingReason_id ||
                    membershipItem.get('MembershipFee_id') != member.membershipFee_id
                ) {

                    var now = new Date();
                    membershipItem.set('valid_end', now);

                    membershipItem.save(null, {transacting: transaction})
                        .then(function (savedMembershipHistory) {
                            console.log("MembershipItem saved for history");
                            //console.log("MembershipItem saved for history: " + JSON.stringify(savedMembershipHistory));
                            new MembershipItem({
                                'Membership_id': membershipId,
                                'MembershipNumber': member.membershipNumber,
                                'EntryDate': member.entryDate,
                                'LeavingDate': member.leavingDate,
                                'PassiveSince': member.passiveSince,
                                'LeavingReason_id': member.leavingReason_id,
                                'MembershipFee_id': member.membershipFee_id,
                                'valid_start': now
                            }).save(null, {transacting: transaction}).then(function (savedMembershipItem) {
                                console.log("MembershipItem saved");
                                //console.log("MembershipItem saved: "+ JSON.stringify(savedMembershipItem));
                                resolve(savedMembershipItem);
                            }).catch(function (error) {
                                console.log("Error while saving new MembershipItem with Membership_id " + membershipId + ": " + error);
                                reject(new HttpError("Error 500: saving new MembershipItem with Membership_id " + membershipId + " failed", 500));
                                //reject({statusCode: 500, message: "Error 500: saving new MembershipItem with Membership_id " + membershipId + " failed"});
                            });
                        }).catch(function (error) {
                        console.log("Error while updating MembershipItem with Membership_id " + membershipId + ": " + error);
                        reject(new HttpError("Error 500: updating MembershipItem with Membership_id " + membershipId + " failed", 500));
                    });
                }
                else {
                    console.log("Not saving MembershipItem because nothing changed.");
                    resolve(undefined);
                }
            } else {
                reject(new HttpError("Error 404: MembershipItem that belongs to Person with Person_id " + personId + " not found", 404));
            }
        }).catch(function (error) {
            console.log("Error while reading MembershipItem that belongs to Person with Person_id " + personId + " from the database: " + error);
            reject(new HttpError("Error 500: reading MembershipItem that belongs to Person with Person_id " + personId + " failed", 500));
        });
    });
}

module.exports.put = function (req, res) {
    var personId = req.params.id;

    if (req.body.member) {
        var member = req.body.member;

        model.bookshelf.transaction(function (t) {
            updatePersonItem(t, personId, member).then(function (savedPerson) {
                if (savedPerson) {
                    updateMembershipItem(t, personId, member).then(function (savedMembership) {
                        t.commit(savedMembership);
                    }).catch(function (error) {
                        console.log("Roll back transaction");
                        t.rollback(error);
                    });
                } else {
                    // update membership if necessary
                    updateMembership(t, personId, member).then(function (savedMembership) {
                        t.commit(savedMembership);
                    }).catch(function (error) {
                        console.log("Roll back transaction");
                        t.rollback(error);
                    });
                }
            }).catch(function (error) {
                console.log("Roll back transaction");
                t.rollback(error);
            });
        }).then(function (savedItem) {
            console.log("Transaction committed");
            if (savedItem) {
                // return put data again back to caller
                module.exports.get(req, res);
            } else {
                res.statusCode = 304;   // not changed
                res.send("304: Person and Membership information not changed");
            }
        }).catch(function (error) {
            console.log("Transaction rolled back");
            res.statusCode = error.statusCode;
            res.send(error.message);
        });
    }
    else {
        console.log('Error in member.put: request body does not have members array');
        res.statusCode = 400;
        res.send('Error 400: members in request missing');
    }
};

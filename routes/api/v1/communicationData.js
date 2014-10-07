var _ = require('underscore');
var Promise = require('bluebird/js/main/promise')();
var model = require('../../../model');
var moment = require('moment');
var PersonContactType = model.models.PersonContactType;
var PersonContactData = model.models.PersonContactData;
var PersonContactDataAddress = model.models.PersonContactDataAddress;
var PersonContactDataPhonenumber = model.models.PersonContactDataPhonenumber;
var PersonContactDataAccount = model.models.PersonContactDataAccount;

// todo check user + role

function makeResponseObject(contactType, newPersonContactDataItem, personContactData) {
    var responseObject = {};
    switch (contactType.Name) {
        case 'address':
            responseObject.addresses = [
                {
                    id: newPersonContactDataItem.PersonContactData_id,
                    street: newPersonContactDataItem.Street,
                    streetNumber: newPersonContactDataItem.StreetNumber,
                    postalcode: newPersonContactDataItem.Postalcode,
                    city: newPersonContactDataItem.City,
                    usage: personContactData.Usage,
                    type: contactType.Description
                }
            ];
            break;
        case 'phoneNumber':
            responseObject.phoneNumbers = [
                {
                    id: newPersonContactDataItem.PersonContactData_id,
                    number: newPersonContactDataItem.Number,
                    usage: personContactData.Usage,
                    type: contactType.Description
                }
            ];
            break;
        case 'account':
            responseObject.accounts = [
                {
                    id: newPersonContactDataItem.PersonContactData_id,
                    account: newPersonContactDataItem.Account,
                    usage: personContactData.Usage,
                    type: contactType.Description
                }
            ];
            break;
    }
    return responseObject;
}

function makePersonContactData(personContactData_id, now, contactTypeName, contactItemDataObject) {
    var personContactData = {
        PersonContactData_id: personContactData_id,
        valid_start: now
    };

    switch (contactTypeName) {
        case 'address':
            personContactData = _.extend(personContactData, {
                Street: contactItemDataObject.street,
                StreetNumber: contactItemDataObject.streetNumber,
                Postalcode: contactItemDataObject.postalcode,
                City: contactItemDataObject.city
            });
            break;
        case 'phone':
            personContactData = _.extend(personContactData, {
                Number: contactItemDataObject.number
            });
            break;
        case 'email':
        case 'twitter':
        case 'facebook':
        case 'microsoft':
        case 'google':
        case 'applepush':
        case 'googlepush':
        case 'mspush':
            personContactData = _.extend(personContactData, {
                Account: contactItemDataObject.account
            });
            break;
    }
    return personContactData;
}

function putContactData(req, res, contactType, personContactData, contactItemDataObject) {

    var contactTypeName = contactType.get('Name');
    var entityClassName;
    switch (contactTypeName) {
        case 'address':
            entityClassName = "PersonContactDataAddress";
            break;
        case 'phone':
            entityClassName = "PersonContactDataPhonenumber";
            break;
        case 'email':
        case 'twitter':
        case 'facebook':
        case 'google':
        case 'microsoft':
        case 'applepush':
        case 'googlepush':
        case 'mspush':
            entityClassName = "PersonContactDataAccount";
            break;
        default:
            console.log("Error: unknown contactTypeName: " + contactTypeName);
            break;
    }

    var now = new Date();
    var personContactData_id = personContactData.get('id');

    new model.models[entityClassName]().where({
        PersonContactData_id: personContactData_id,
        valid_end: null
    }).fetchAll().then(function (allExistingContactItems) {
        console.log("Must set valid_end for " + allExistingContactItems.length + " " + entityClassName + " records.");
        var savePromises = [];
        allExistingContactItems.forEach(function (itemWithoutValidEnd) {
            itemWithoutValidEnd.set('valid_end', now);
            savePromises.push(itemWithoutValidEnd.save());
        });
        Promise.all(savePromises).then(function (allSavedContactItems) {
            console.log("Invalidated " + allSavedContactItems.length + " " + entityClassName + " before adding new record.");
            var personContactData = makePersonContactData(personContactData_id, now, contactTypeName, contactItemDataObject);
            // add new PersonContactDataXXXXX record where valid_end is null
            new model.models[entityClassName](personContactData).save().then(function (newPersonContactDataItem) {
                console.log("New " + contactTypeName + " with PersonContactData_id " + newPersonContactDataItem.get('PersonContactData_id') + " saved");
                res.setHeader('X-CSRF-Token', req.csrfToken());
                var responseObject = makeResponseObject(contactType, newPersonContactDataItem, personContactData);
                res.json(responseObject);
            }).catch(function (error) {
                console.log("Saving " + entityClassName + " failed: " + error);
                // todo: delete already created PersonContactData or use transaction
                //newPersonContactData.delete();
                res.statusCode = 500;
                res.send('Error 500: Saving   failed');
            });
        }).catch(function (error) {
            console.log("Error while updating " + entityClassName + " for PersonContactData_id: " + personContactData_id + ": " + error);
            res.statusCode = 500;
            res.send('Error 500: Updating ' + entityClassName + ' failed');
        });
    }).catch(function (error) {
        console.log("Error while reading " + entityClassName + " for PersonContactData_id where valid_end is null: " + personContactData_id + ": " + error);
        res.statusCode = 500;
        res.send('Error 500: Reading ' + entityClassName + ' failed');
    });
}

function addPersonContactItem(req, res, bodyObjectName, resourceName, contactTypeName) {

    var self = this;

    if (req.body[bodyObjectName]) {
        var requestDataObject = req.body[bodyObjectName];
        var personId = requestDataObject.member;  // in Ember app the person is handled as member and the address belongs to member
        console.log("Saving new " + resourceName + " for Person_id " + personId);
        new PersonContactType({Name: contactTypeName}).fetch().then(function (contactType) {
            if (contactType) {
                var personContactType_id = contactType.get('id');
                new PersonContactData({
                    Person_id: personId,
                    PersonContactType_id: personContactType_id,
                    Usage: requestDataObject.usage
                }).fetch().then(function (personContactData) {
                        if (personContactData) {
                            // use existing PersonContactData
                            putContactData.call(self, req, res, contactType, personContactData, requestDataObject);
                        }
                        else {
                            // create new PersonContactData record
                            new PersonContactData({
                                Person_id: personId,
                                PersonContactType_id: personContactType_id,
                                Usage: requestDataObject.usage
                            }).save().then(function (personContactData) {
                                    putContactData.call(self, req, res, contactType, personContactData, requestDataObject);
                                }).catch(function (error) {
                                    console.log("Saving PersonContactData failed: " + error);
                                    res.statusCode = 500;
                                    res.send('Error 500: Saving PersonContactData failed');
                                }
                            );
                        }
                    }).catch(function (error) {
                        console.log("Reading PersonContactData failed: " + error);
                        res.statusCode = 500;
                        res.send('Error 500: Reading PersonContactData failed');
                    });
            } else {
                res.statusCode = 404;
                res.send("Error 404: PersonContactType '" + contactTypeName + "' not found");
            }
        }).catch(function (error) {
            console.log("Reading PersonContactType failed: " + error);
            res.statusCode = 500;
            res.send('Error 500: Reading PersonContactType failed');
        });
    } else {
        console.log('Error in put: request body does not have ' + bodyObjectName + ' object');
        res.statusCode = 400;
        res.send('Error 400: ' + bodyObjectName + ' in request missing');
    }
}

function markPersonContactDataItemAsDeleted(req, res, entityClassName) {
    var personContactData_id = req.params.id;
    var now = new Date();
    new model.models[entityClassName]().query(function (qb) {
        qb.where({ 'PersonContactData_id': personContactData_id})
            .andWhere({'valid_end': null});
    }).fetchAll().then(function (allExistingContactItems) {
        if (allExistingContactItems.length > 0) {
            console.log("Must set valid_end for " + allExistingContactItems.length + " " + entityClassName + " records.");

            var savePromises = [];
            allExistingContactItems.forEach(function (itemWithoutValidEnd) {
                itemWithoutValidEnd.set('valid_end', now); // mark this record as not-latest
                savePromises.push(itemWithoutValidEnd.save());
            });
            Promise.all(savePromises).then(function (allSavedContactItems) {
                console.log("Invalidated " + allSavedContactItems.length + " " + entityClassName + ".");

                res.statusCode = 204;   // 204 No Content (Deletion was successful and nothing must be told to the caller)
                res.end();
            }).catch(function (error) {
                var errMsg = "Saving " + entityClassName + " to set valid_end failed";
                console.log(errMsg + ": " + error);
                res.statusCode = 500;
                res.send('Error 500: ' + errMsg);
            });
        }
        else {
            console.log("Can't delete " + entityClassName + " with PersonContactData_id=" + personContactData_id + ": not existing");
            res.statusCode = 404;
            res.send('Error 404: ' + entityClassName + ' not found');
        }
    }).catch(function (error) {
        var errMsg = "Reading " + entityClassName + " failed";
        console.log(errMsg + ": " + error);
        res.statusCode = 500;
        res.send('Error 500: ' + errMsg);
    });
}

function checkItemIsDirty(itemWithoutValidEnd, contactTypeName, requestDataObject) {
    var itemIsDirty = false;
    switch (contactTypeName) {
        case 'address':
            if (itemWithoutValidEnd.get('Street') != requestDataObject.street ||
                itemWithoutValidEnd.get('StreetNumber') != requestDataObject.streetNumber ||
                itemWithoutValidEnd.get('Postalcode') != requestDataObject.postalcode ||
                itemWithoutValidEnd.get('City') != requestDataObject.city) {
                itemIsDirty = true;
            }
            break;
        case 'phone':
            if (itemWithoutValidEnd.get('Number') != requestDataObject.number) {
                itemIsDirty = true;
            }
            break;
        case 'email':
        case 'twitter':
        case 'facebook':
        case 'google':
        case 'microsoft':
        case 'applepush':
        case 'googlepush':
        case 'mspush':
            if (itemWithoutValidEnd.get('Account') != requestDataObject.account) {
                itemIsDirty = true;
            }
            break;
        default:
            console.log("Error: unknown contactTypeName: " + contactTypeName);
            break;
    }

    return itemIsDirty;
}

function updatePersonContactDataItem(req, res, bodyObjectName, resourceName, contactTypeName, entityClassName) {
    var personContactData_id = req.params.id;
    var now = new Date();

    if (req.body[bodyObjectName]) {
        var requestDataObject = req.body[bodyObjectName];
        console.log("Updating " + resourceName + " for PersonContactData " + personContactData_id);

        new model.models[entityClassName]().query(function (qb) {
            qb.where({ 'PersonContactData_id': personContactData_id}).andWhere({'valid_end': null});
            qb.orderBy('valid_start', 'DESC')
        }).fetchAll().then(function (allExistingContactItems) {
            if (allExistingContactItems.length > 0) {
                console.log("Must set valid_end for " + allExistingContactItems.length + " " + entityClassName + " records.");

                var savePromises = [];
                var firstRecord = true;
                var itemIsDirty = false;
                allExistingContactItems.forEach(function (itemWithoutValidEnd) {
                    if (firstRecord) {
                        itemIsDirty = checkItemIsDirty(itemWithoutValidEnd, contactTypeName, requestDataObject);
                        // if the latest contact item has been changed set the valid_end to now and add the new data as a new record
                        // otherwise only set the valid_end to now on the remaining records.
                        if (itemIsDirty) {
                            itemWithoutValidEnd.set('valid_end', now);
                            savePromises.push(itemWithoutValidEnd.save());
                        }
                    } else {
                        itemWithoutValidEnd.set('valid_end', now);
                        savePromises.push(itemWithoutValidEnd.save());
                    }
                    firstRecord = false;
                });
                Promise.all(savePromises).then(function (allSavedContactItems) {
                    console.log("Invalidated " + allSavedContactItems.length + " " + entityClassName + " before adding new record.");

                    // todo: use a transaction for all database writes

                    if (itemIsDirty) {
                        new PersonContactType({Name: contactTypeName}).fetch().then(function (contactType) {
                            if (contactType) {
                                var personContactData = makePersonContactData(personContactData_id, now, contactTypeName, requestDataObject);
                                // add new PersonContactDataXXXXX record where valid_end is null and attributes are updated
                                new model.models[entityClassName](personContactData).save().then(function (newPersonContactDataItem) {
                                    console.log("New " + contactTypeName + " with PersonContactData_id " + newPersonContactDataItem.get('PersonContactData_id') + " saved");
                                    res.setHeader('X-CSRF-Token', req.csrfToken());
                                    var responseObject = makeResponseObject(contactType, newPersonContactDataItem, personContactData);
                                    res.json(responseObject);
                                }).catch(function (error) {
                                    console.log("Saving " + entityClassName + " failed: " + error);
                                    // todo: delete already created PersonContactData or use transaction
                                    //newPersonContactData.delete();
                                    res.statusCode = 500;
                                    res.send('Error 500: Saving   failed');
                                });
                            } else {
                                res.statusCode = 404;
                                res.send("Error 404: PersonContactType '" + contactTypeName + "' not found");
                            }
                        }).catch(function (error) {
                            console.log("Reading PersonContactType failed: " + error);
                            res.statusCode = 500;
                            res.send('Error 500: Reading PersonContactType failed');
                        });
                    }
                    else {
                        // values did not change - not saving
                        res.statusCode = 304;
                        res.end();
                    }
                }).catch(function (error) {
                    var errMsg = "Failed to mark " + entityClassName + " old";
                    console.log(errMsg + ": " + error);
                    res.statusCode = 500;
                    res.send("Error 500: " + errMsg);
                });
            } else {
                console.log("Can't update " + entityClassName + " with PersonContactData_id=" + personContactData_id + ": not existing");
                res.statusCode = 404;
                res.send("Error 404: " + entityClassName + " not found");
            }
        }).catch(function (error) {
            console.log("Error while reading " + entityClassName + " for PersonContactData_id where valid_end is null: " + personContactData_id + ": " + error);
            res.statusCode = 500;
            res.send('Error 500: Reading ' + entityClassName + ' failed');
        });
    } else {
        console.log('Error in put: request body does not have ' + bodyObjectName + ' object');
        res.statusCode = 400;
        res.send('Error 400: ' + bodyObjectName + ' in request missing');
    }
}


// NEW

module.exports.postAddress = function (req, res) {
    var bodyObjectName = 'address';
    var resourceName = 'Address';
    var contactTypeName = 'address';
    addPersonContactItem.call(this, req, res, bodyObjectName, resourceName, contactTypeName);
};

module.exports.postPhoneNumber = function (req, res) {
    var bodyObjectName = 'phoneNumber';
    var resourceName = 'Phone Number';
    var contactTypeName = 'phone';
    addPersonContactItem.call(this, req, res, bodyObjectName, resourceName, contactTypeName);
};

module.exports.postAccount = function (req, res) {
    var bodyObjectName = 'account';
    var resourceName = 'Account';
    var contactTypeName = req.body[bodyObjectName].type;
    addPersonContactItem.call(this, req, res, bodyObjectName, resourceName, contactTypeName);
};


// UPDATE

module.exports.putAddress = function (req, res) {
    var entityClassName = "PersonContactDataAddress";
    var bodyObjectName = 'address';
    var resourceName = 'Address';
    var contactTypeName = req.body[bodyObjectName].type;
    updatePersonContactDataItem.call(this, req, res, bodyObjectName, resourceName, contactTypeName, entityClassName);
};

module.exports.putPhoneNumber = function (req, res) {
    var entityClassName = "PersonContactDataPhonenumber";
    var bodyObjectName = 'phoneNumber';
    var resourceName = 'Phone Number';
    var contactTypeName = req.body[bodyObjectName].type;
    updatePersonContactDataItem.call(this, req, res, bodyObjectName, resourceName, contactTypeName, entityClassName);
};

module.exports.putAccount = function (req, res) {
    var entityClassName = "PersonContactDataAccount";
    var bodyObjectName = 'account';
    var resourceName = 'Account';
    var contactTypeName = req.body[bodyObjectName].type;
    updatePersonContactDataItem.call(this, req, res, bodyObjectName, resourceName, contactTypeName, entityClassName);
};

// DELETE

module.exports.deleteAddress = function (req, res) {
    var entityClassName = "PersonContactDataAddress";
    markPersonContactDataItemAsDeleted.call(this, req, res, entityClassName);
};

module.exports.deletePhoneNumber = function (req, res) {
    var entityClassName = "PersonContactDataPhonenumber";
    markPersonContactDataItemAsDeleted.call(this, req, res, entityClassName);
};

module.exports.deleteAccount = function (req, res) {
    var entityClassName = "PersonContactDataAccount";
    markPersonContactDataItemAsDeleted.call(this, req, res, entityClassName);
};

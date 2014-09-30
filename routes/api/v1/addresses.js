var _ = require('underscore');
var Promise = require('bluebird/js/main/promise')();
var model = require('../../../model');
var moment = require('moment');
var PersonContactType = model.models.PersonContactType;
var PersonContactData = model.models.PersonContactData;
var PersonContactDataAddress = model.models.PersonContactDataAddress;

// todo check user + role

// post new address
module.exports.post = function (req, res) {

    function putContactData(contactTypeAddress, personContactData, address) {

        var now = new Date();
        var personContactData_id = personContactData.get('id');

        new PersonContactDataAddress().where({
            PersonContactData_id: personContactData_id,
            valid_end: null
        }).fetchAll().then(function (allAddresses) {
            console.log("Must set valid_end for " + allAddresses.length + " PersonContactDataAddress records.");
            var savePromises = [];
            allAddresses.forEach(function (addressWithoutValidEnd) {
                addressWithoutValidEnd.set('valid_end', now);
                savePromises.push(addressWithoutValidEnd.save());
            });
            Promise.all(savePromises).then(function (allSavedAddresses) {
                console.log("Invalidated " + allSavedAddresses.length + " PersonContactDataAddresses before adding new record.");

                // add new PersonContactDataAddress record where valid_end is null
                new PersonContactDataAddress({
                    PersonContactData_id: personContactData_id,
                    Street: address.street,
                    StreetNumber: address.streetNumber,
                    Postalcode: address.postalcode,
                    City: address.city,
                    valid_start: now
                }).save().then(function (newPersonContactDataAddress) {
                        console.log("New address for person with id " + personContactData.get('Person_id') + " saved");
                        res.setHeader('X-CSRF-Token', req.csrfToken());
                        res.json(
                            {
                                addresses: [
                                    {
                                        id: newPersonContactDataAddress.PersonContactData_id,
                                        street: newPersonContactDataAddress.Street,
                                        streetNumber: newPersonContactDataAddress.StreetNumber,
                                        postalcode: newPersonContactDataAddress.Postalcode,
                                        city: newPersonContactDataAddress.City,
                                        usage: personContactData.Usage,
                                        type: contactTypeAddress.Description
                                    }
                                ]
                            }
                        );
                    }).catch(function (error) {
                        console.log("Saving PersonContactDataAddress failed: " + error);
                        // todo: delete already created PersonContactData or use transaction
                        //newPersonContactData.delete();
                        res.statusCode = 500;
                        res.send('Error 500: Saving PersonContactDataAddress failed');
                    });
            }).catch(function (error) {
                console.log("Error while updating PersonContactDataAddresses for PersonContactData_id: " + personContactData_id + ": " + error);
                res.statusCode = 500;
                res.send('Error 500: Updating PersonContactDataAddress failed');
            });
        }).catch(function (error) {
            console.log("Error while reading PersonContactDataAddresses for PersonContactData_id where valid_end is null: " + personContactData_id + ": " + error);
            res.statusCode = 500;
            res.send('Error 500: Reading PersonContactDataAddress failed');
        });
    }

    if (req.body.address) {
        var address = req.body.address;
        var personId = address.member;  // in Ember app the person is handled as member and the address belongs to member
        console.log("Saving new Address for Person_id " + personId);
        new PersonContactType({Name: 'address'}).fetch().then(function (contactTypeAddress) {
            if (contactTypeAddress) {
                var personContactType_id = contactTypeAddress.get('id');
                new PersonContactData({
                    Person_id: personId,
                    PersonContactType_id: personContactType_id,
                    Usage: address.usage
                }).fetch().then(function (personContactData) {
                        if (personContactData) {
                            // use existing PersonContactData
                            putContactData(contactTypeAddress, personContactData, address);
                        }
                        else {
                            new PersonContactData({
                                Person_id: personId,
                                PersonContactType_id: personContactType_id,
                                Usage: address.usage
                            }).save().then(function (personContactData) {
                                    putContactData(contactTypeAddress, personContactData, address);
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
                res.send("Error 404: PersonContactType 'address' + not found");
            }
        }).catch(function (error) {
            console.log("Reading PersonContactType failed: " + error);
            res.statusCode = 500;
            res.send('Error 500: Reading PersonContactType failed');
        });
    } else {
        console.log('Error in addresses.post: request body does not have addresses array');
        res.statusCode = 400;
        res.send('Error 400: addresses in request missing');
    }
};

module.exports.delete = function (req, res) {
    var personContactData_id = req.params.id;
    var now = new Date();
    new PersonContactDataAddress().query(function (qb) {
        qb.where({ 'PersonContactData_id': personContactData_id})
            .andWhere({'valid_end': null});
    }).fetchAll().then(function (allAddresses) {
        if (allAddresses.length > 0) {
            console.log("Must set valid_end for " + allAddresses.length + " PersonContactDataAddress records.");

            var savePromises = [];
            allAddresses.forEach(function (addressWithoutValidEnd) {
                addressWithoutValidEnd.set('valid_end', now); // mark this record as not-latest
                savePromises.push(addressWithoutValidEnd.save());
            });
            Promise.all(savePromises).then(function (allSavedAddresses) {
                console.log("Invalidated " + allSavedAddresses.length + " PersonContactDataAddresses.");

                res.statusCode = 204;   // 204 No Content (Deletion was successful and nothing must be told to the caller)
                res.end();
            }).catch(function (error) {
                var errMsg = "Saving PersonContactDataAddress to set valid_end failed";
                console.log(errMsg + ": " + error);
                res.statusCode = 500;
                res.send('Error 500: ' + errMsg);
            });
        }
        else {
            console.log("Can't delete PersonContactDataAddress with PersonContactData_id=" + personContactData_id + ": not existing");
            res.statusCode = 404;
            res.send('Error 404: PersonContactDataAddress not found');
        }
    }).catch(function (error) {
        var errMsg = "Reading PersonContactDataAddress failed";
        console.log(errMsg + ": " + error);
        res.statusCode = 500;
        res.send('Error 500: ' + errMsg);
    });
};

// update PersonContactDataAddress
module.exports.put = function (req, res) {
    var personContactData_id = req.params.id;
    var address = req.body.address;
    var now = new Date();
    new PersonContactDataAddress().query(function (qb) {
        qb.where({ 'PersonContactData_id': personContactData_id})
            .andWhere({'valid_end': null});
        qb.orderBy('valid_start', 'DESC')
    }).fetchAll().then(function (allAddresses) {
        if (allAddresses.length > 0) {
            console.log("Must set valid_end for " + allAddresses.length + " PersonContactDataAddress records.");
            var savePromises = [];
            var firstRecord = true;
            var addressIsDirty = false;
            allAddresses.forEach(function (addressWithoutValidEnd) {
                if (firstRecord) {
                    if (addressWithoutValidEnd.get('Street') != address.street ||
                        addressWithoutValidEnd.get('StreetNumber') != address.streetNumber ||
                        addressWithoutValidEnd.get('Postalcode') != address.postalcode ||
                        addressWithoutValidEnd.get('City') != address.city) {
                        addressWithoutValidEnd.set('valid_end', now);
                        savePromises.push(addressWithoutValidEnd.save());
                        addressIsDirty = true;
                    }
                } else {
                    addressWithoutValidEnd.set('valid_end', now);
                    savePromises.push(addressWithoutValidEnd.save());
                }
                firstRecord = false;
            });
            Promise.all(savePromises).then(function (allSavedAddresses) {
                console.log("Invalidated " + allSavedAddresses.length + " PersonContactDataAddresses before adding new record.");

                // todo: use a transaction for all database writes

                if (addressIsDirty) {
                    // create new record with updated values
                    new PersonContactDataAddress({
                        PersonContactData_id: personContactData_id,
                        Street: address.street,
                        StreetNumber: address.streetNumber,
                        Postalcode: address.postalcode,
                        City: address.city,
                        valid_start: now
                    }).save().then(function (savedPersonContactDataAddress) {
                            res.statusCode = 200;
                            res.end();
                        }).catch(function (error) {
                            var errMsg = "Failed to create new PersonContactDataAddress";
                            console.log(errMsg + ": " + error);
                            res.statusCode = 500;
                            res.send("Error 500: " + errMsg);
                        });
                }
                else {
                    // values did not change - not saving
                    res.statusCode = 304;
                    res.end();
                }
            }).catch(function (error) {
                var errMsg = "Failed to mark PersonContactDataAddress old";
                console.log(errMsg + ": " + error);
                res.statusCode = 500;
                res.send("Error 500: " + errMsg);
            });
        } else {
            console.log("Can't delete PersonContactDataAddress with PersonContactData_id=" + personContactData_id + ": not existing");
            res.statusCode = 404;
            res.send('Error 404: PersonContactDataAddress not found');
        }
    }).catch(function (error) {
        console.log("Reading PersonContactDataAddress failed: " + error);
        res.statusCode = 500;
        res.send('Error 500: Reading PersonContactDataAddress failed');
    });
};

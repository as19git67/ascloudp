var _ = require('underscore');
var model = require('../../../model');
var moment = require('moment');
var PersonContactType = model.models.PersonContactType;
var PersonContactData = model.models.PersonContactData;
var PersonContactDataAddress = model.models.PersonContactDataAddress;

// post new address
module.exports.post = function (req, res) {
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
                }).save().then(function (newPersonContactData) {
                        var personContactData_id = newPersonContactData.get('id');
                        new PersonContactDataAddress({
                            PersonContactData_id: personContactData_id,
                            Street: address.street,
                            StreetNumber: address.streetNumber,
                            Postalcode: address.postalcode,
                            City: address.city,
                            valid_start: new Date()
                        }).save()
                            .then(function(newPersonContactDataAddress){
                                console.log("New address for person with id " +  personId + " saved");
                                res.setHeader('X-CSRF-Token', req.csrfToken());
                                res.json(
                                    {
                                        addresses: [{
                                            id: newPersonContactDataAddress.PersonContactData_id,
                                            street: newPersonContactDataAddress.Street,
                                            streetNumber: newPersonContactDataAddress.StreetNumber,
                                            postalcode: newPersonContactDataAddress.Postalcode,
                                            city: newPersonContactDataAddress.City,
                                            usage: newPersonContactData.Usage,
                                            type: contactTypeAddress.Description
                                        }]
                                    }
                                );
                            })
                            .catch(function(error){
                                console.log("Saving PersonContactDataAddress failed: " + error);
                                // todo: delete already created PersonContactData or use transaction
                                //newPersonContactData.delete();
                                res.statusCode = 500;
                                res.send('Error 500: Saving PersonContactDataAddress failed');
                            });
                    }).catch(function (error) {
                        console.log("Saving PersonContactData failed: " + error);
                        res.statusCode = 500;
                        res.send('Error 500: Saving PersonContactData failed');
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

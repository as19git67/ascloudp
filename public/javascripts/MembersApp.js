MembersApp = Em.Application.create({
    LOG_TRANSITIONS: true,
    rootElement: '#memberDetail'
});

MembersApp.ApplicationAdapter = DS.RESTAdapter.extend({
    //    pathForType: function(type) {
    //        var decamelized = Ember.String.decamelize(type);
    //        return Ember.String.pluralize(decamelized);
    //    },
    namespace: 'api/v1'
});

// save the csrfToken from the ajax response and add it at the header for the following request
DS.RESTAdapter.reopen({
    csrfToken: "",
    headers: function () {
        return {
            "X-CSRF-Token": this.get("csrfToken")
        };
    }.property("csrfToken"),
    ajaxSuccess: function (jqXHR, jsonPayload) {
        var token = jqXHR.getResponseHeader('X-CSRF-Token');
        this.set('csrfToken', token);
        return jsonPayload;
    }
});

//DS.RESTAdapter.reopen({
//    buildURL: function(record, suffix) {
//        return this._super(record,suffix).toLowerCase();
//    }
//});

MembersApp.Member = DS.Model.extend({
    membershipNumber: DS.attr('number'),
    salutation: DS.attr('string'),
    firstname: DS.attr('string'),
    lastname: DS.attr('string'),
    suffix: DS.attr('string'),
    birthday: DS.attr('date'),
    entryDate: DS.attr('date'),
    birthday_formatted: DS.attr('string'),
    entryDate_formatted: DS.attr('string'),
    leavingDate: DS.attr('date'),
    passiveSince: DS.attr('date'),
    leavingReasonName: DS.attr('string'),
    membershipFeeName: DS.attr('string'),
    membershipFeeAmount: DS.attr('string'),
    addresses: DS.hasMany(MembersApp.Address),
    phoneNumbers: DS.hasMany(MembersApp.PhoneNumber),
    accounts: DS.hasMany(MembersApp.Account)
});

MembersApp.Address = DS.Model.extend({
    street: DS.attr('string'),
    streetNumber: DS.attr('string'),
    postalcode: DS.attr('string'),
    city: DS.attr('string'),
    usage: DS.attr('string'),
    type: DS.attr('string'),
    member: DS.belongsTo('member')
});

MembersApp.PhoneNumber = DS.Model.extend({
    number: DS.attr('string'),
    usage: DS.attr('string'),
    type: DS.attr('string'),
    member: DS.belongsTo('member')
});

MembersApp.Account = DS.Model.extend({
    account: DS.attr('string'),
    usage: DS.attr('string'),
    type: DS.attr('string'),
    member: DS.belongsTo('member')
});

MembersApp.Router.map(function () {
    this.resource('member', { path: '/' });
});


MembersApp.MemberController = Ember.ObjectController.extend({
    errorMessage: '',
    previouslySelectedElement: null,
    haveAddresses: function () {
        if (this.model) {
            return this.model.get('addresses').content.length > 0;
        } else {
            return false;
        }
    }.property('model.addresses').cacheable(),
    havePhoneNumbers: function () {
        if (this.model) {
            return this.model.get('phoneNumbers').content.length > 0;
        } else {
            return false;
        }
    }.property('model.phoneNumbers').cacheable(),
    haveAccounts: function () {
        if (this.model) {
            return this.model.get('accounts').content.length > 0;
        } else {
            return false;
        }
    }.property('model.accounts').cacheable(),
    setId: function (id) {
        var self = this;
        self.set('errorMessage', "");
        this.store.findById('member', id).then(function (person) {
            if (person) {
                self.set('model', person);
            }
        }).catch(function (error) {
            var errorMessage = error.statusText;
            if (error.responseText) {
                errorMessage += " (" + error.responseText + ")"
            }
            self.set('errorMessage', errorMessage);
        });

    },
    init: function () {
        var self = this;
        $(".memberListItem").click(function () {
            var clickedElement = $(this);
            var id = clickedElement.attr('data-id');
            if (self.previouslySelectedElement) {
                self.previouslySelectedElement.removeClass('panel-primary');
            }
            clickedElement.addClass('panel-primary');
            self.previouslySelectedElement = clickedElement;
            $('#editMember').on('shown.bs.modal', function (e) {
                self.setId(id);
            });
            $('#editMember').modal({backdrop: true});

        });
    },
    deletedAddresses: [],
    actions: {
        discardChanges: function () {
            this.get('model').rollback();
            var addresses = this.model.get('addresses');
            addresses.forEach(function (address) {
                if (address.get('isNew')) {
                    address.deleteRecord();
                } else {
                    if (address.get('isDirty')) {
                        address.rollback();
                    }
                }
            });

            var deletedAddressesArray = Ember.A(this.deletedAddresses);
            deletedAddressesArray.forEach(function(addressMarkedDelete){
                addressMarkedDelete.rollback();
            });
            this.deletedAddresses = [];
        },
        createAddress: function (usage) {
            console.log("createAddress (MemberController) clicked");
            var personId = this.model.get('id');
            var addresses = this.model.get('addresses');
            var newAddress = addresses.createRecord({
                Person_id: personId,
                usage: usage
            });
        },
        deleteAddress: function (addressToDelete) {
            console.log("deleteAddress (MemberController) for " + addressToDelete.get('id') + " clicked");
            var addresses = this.model.get('addresses');
            var self = this;
            addresses.forEach(function (address) {
                if (address.get('id') == addressToDelete.get('id')) {
                    address.deleteRecord();
                    self.deletedAddresses.push(address);
                }
            });
        },
        save: function (controller) {
            var mod = this.get('model');

            var addressesToSavePromises = [];

            // save all addresses that are marked for deletion
            var deletedAddressesArray = Ember.A(this.deletedAddresses);
            deletedAddressesArray.forEach(function(addressMarkedDelete){
                addressesToSavePromises.push(addressMarkedDelete.save());
            });
            this.deletedAddresses = [];

            var addresses = mod.get('addresses');
            addresses.forEach(function (address) {
                if (address.get('isNew') || address.get('isDirty')) {
                    addressesToSavePromises.push(address.save());   // add promise from save to array
                }
            });

            Ember.RSVP.allSettled(addressesToSavePromises).then(function (array) {
                // array == [
                //   { state: 'fulfilled', value: 1 },
                //   { state: 'rejected', reason: Error },
                //   { state: 'rejected', reason: Error }
                // ]
                // Note that for the second item, reason.message will be '2', and for the
                // third item, reason.message will be '3'.
                var haveError = false;
                var errorMessage;
                array.forEach(function (result) {
                    if (!haveError) {
                        var state = result.state;
                        if (state == 'rejected') {
                            var reason = result.reason;
                            if (reason.status != 200 && reason.status != 204) {
                                haveError = true;
                                errorMessage = reason.statusText;
                                if (reason.responseText && reason.responseText.substr(0, 14) != "<!DOCTYPE html") {
                                    errorMessage += " (" + reason.responseText + ")"
                                }
                            }
                        }
                    }
                });

                if (haveError) {
                    errorMessage = "Error while saving addresses: " + errorMessage;
                    console.log(errorMessage);
                    controller.set('errorMessage', errorMessage);
                }
                else {
                    console.log("All new or changed addresses saved. Addresses marked for deletion were deleted.");

                    // todo: check array for rejected promises

                    if (mod.get('isDirty')) {
                        mod.save()
                            .then(function (savedMember) {
                                console.log("Member saved with id " + savedMember.get('id'));
                                $('#editMember').modal('hide');
                                location.reload();
                            })
                            .catch(function (error) {
                                mod.rollback();
                                var errorMessage = error.statusText;
                                if (error.responseText && error.responseText.substr(0, 14) != "<!DOCTYPE html") {
                                    errorMessage += " (" + error.responseText + ")"
                                }
                                console.log("Error while saving member: " + errorMessage);
                                controller.set('errorMessage', errorMessage);
                            });
                    }
                    else {
                        $('#editMember').modal('hide');
                        if (addressesToSavePromises.length > 0) {
                            location.reload();
                        } else {
                            // nothing changed - just close modal dialog
                        }
                    }

                }
            }).catch(function (error) {
                console.log("ERROR while saving new or changed addresses: " + error);
                controller.set('errorMessage', "Neue oder geänderte Adressen konnten nicht gespeichert werden");
            });

        },
        delete: function (controller) {

            // remove recipient from group
            var members = controller.content.get('members');
            members.removeObject(member);

            member.rollback();
            member.deleteRecord();


            controller.content.save().then(
                function (savedMember) {
                    console.log('Member ' + savedMember.get('id') + 'saved');
                },
                function (error) {
                    var errorMessage = error.statusText;
                    if (error.responseText && error.responseText.substr(0, 14) != "<!DOCTYPE html") {
                        errorMessage += " (" + error.responseText + ")"
                    }
                    controller.set('errorMessage', errorMessage);
                }
            );

        }
    }
});

MembersApp.AddressesController = Ember.ArrayController.extend({
    actions: {
        createAddress: function (controller, i) {
            console.log("createAddress clicked");
        }
    }
});

MembersApp.AddressController = Ember.ObjectController.extend({
    actions: {
        createAddress: function (controller, i) {
            console.log("createAddress clicked");
        }
    }
});


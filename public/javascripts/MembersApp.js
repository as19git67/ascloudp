MembersApp = Em.Application.create({
    LOG_TRANSITIONS: true,
    rootElement: '#memberDetail',
    lang: navigator.language || navigator.userLanguage
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
//    birthday_formatted: DS.attr('string'),
    entryDate: DS.attr('date'),
//    entryDate_formatted: DS.attr('string'),
    leavingDate: DS.attr('date'),
//    leavingDate_formatted: DS.attr('string'),
    passiveSince: DS.attr('date'),
//    passiveSince_formatted: DS.attr('string'),
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
    deletedItems: Ember.A([]),
    isNotDirty: Ember.computed('content.isDirty',
        'model.addresses',
        'model.addresses.@each.isDirty',
        'model.phoneNumbers.@each.isDirty',
        'model.accounts.@each.isDirty',
        'deletedItems.length', function () {
            var contentIsDirty = this.get('content.isDirty');
            var modelCollectionsAreDirty = false;
            if (this.deletedItems.length > 0) {
                modelCollectionsAreDirty = true;
            } else {
                var model = this.get('model');
                if (model) {
                    var modelCollections = Ember.A([model.get('addresses'), model.get('phoneNumbers'), model.get('accounts') ]);
                    modelCollections.forEach(function (modelCollection) {
                        modelCollection.forEach(function (model) {
                            if (model.get('isNew')) {
                                modelCollectionsAreDirty = true;
                            } else {
                                if (model.get('isDirty')) {
                                    modelCollectionsAreDirty = true;
                                }
                            }
                        });
                    });
                }
            }
            return !(contentIsDirty || modelCollectionsAreDirty);
        }),
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
    haveMorePhoneNumbersThanAccounts: function () {
        if (this.model) {
            return this.model.get('phoneNumbers').content.length > this.model.get('accounts').content.length;
        } else {
            return false;
        }
    }.property('model.phoneNumbers', 'model.accounts').cacheable(),
    setId: function (id) {
        var self = this;
        self.set('errorMessage', "");
        self.deletedItems.clear();
        this.store.findById('member', id).then(function (person) {
            if (person) {
                person.set('birthday_formatted', person.get('birthday') ? moment(person.get('birthday')).format('L') : '');
                self.set('model', person);
                var idPrefix = "datetimepicker_";
                var pickerElements = $('.input-group.date');
                var pickerSuffixes = [];
                for (var idx = 0; idx < pickerElements.length; idx++) {
                    var pickerElement = pickerElements[idx];
                    var pickerElementId = pickerElement.id;
                    if (pickerElementId && pickerElementId.length > idPrefix.length) {
                        if (pickerElementId.substr(0, idPrefix.length) == idPrefix) {
                            var datePickerName = pickerElementId.substr(idPrefix.length);
                            pickerSuffixes.push(datePickerName);
                            console.log("Found datepicker " + datePickerName);
                            var currentDate = person.get(datePickerName);
                            var dtp = $('#datetimepicker' + '_' + datePickerName);
                            dtp.datetimepicker({language: 'de', pickTime: false});
                            dtp.data("DateTimePicker").setDate(currentDate);
                            dtp.on("dp.change", function (e) {
                                for (var idx = 0; idx < pickerSuffixes.length; idx++) {
                                    var datePickerName = pickerSuffixes[idx];
                                    if (e.target.id == 'datetimepicker' + '_' + datePickerName) {
                                        var changedDate = $('#datetimepicker' + '_' + datePickerName).data("DateTimePicker").getDate();
                                        if (moment.isMoment(changedDate)) {
                                            changedDate = changedDate.toDate();
                                        }
                                        self.store.findById('member', id).then(function (person) {
                                            person.set(datePickerName, changedDate);
                                        });
                                        break;
                                    }
                                }
                            });
                        }
                    }
                }
            }
        }).catch(function (error) {
            var errorMessage = error.statusText;
            if (error.responseText && error.responseText.substr(0, 14) != "<!DOCTYPE html") {
                errorMessage += " (" + error.responseText + ")"
            }
            self.set('errorMessage', errorMessage);
        });

    },

    init: function () {
        moment.locale(MembersApp.lang);
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

    getItemCollection: function (contactType) {
        var itemCollection;
        switch (contactType) {
            case 'address':
                itemCollection = this.model.get('addresses');
                break;
            case 'phone':
                itemCollection = this.model.get('phoneNumbers');
                break;
            case 'account':
                itemCollection = this.model.get('accounts');
                break;
        }
        return itemCollection;
    },

    actions: {
        discardChanges: function () {
            this.get('model').rollback();

            var addresses = this.model.get('addresses');
            var phoneNumbers = this.model.get('phoneNumbers');
            var accounts = this.model.get('accounts');

            var newAddresses = addresses.filterBy('isNew');
            var newPhoneNumbers = phoneNumbers.filterBy('isNew');
            var newAccounts = accounts.filterBy('isNew');

            var changedAddresses = addresses.filterBy('isDirty');
            var changedPhoneNumbers = phoneNumbers.filterBy('isDirty');
            var changedAccounts = accounts.filterBy('isDirty');

            newAddresses.forEach(function (item) {
                item.deleteRecord();
            });
            newPhoneNumbers.forEach(function (item) {
                item.deleteRecord();
            });
            newAccounts.forEach(function (item) {
                item.deleteRecord();
            });

            changedAddresses.forEach(function (item) {
                item.rollback();
            });
            changedPhoneNumbers.forEach(function (item) {
                item.rollback();
            });
            changedAccounts.forEach(function (item) {
                item.rollback();
            });

            this.deletedItems.forEach(function (itemMarkedDelete) {
                itemMarkedDelete.rollback();
                if (itemMarkedDelete instanceof MembersApp.Address) {
                    addresses.pushObject(itemMarkedDelete);
                } else {
                    if (itemMarkedDelete instanceof MembersApp.PhoneNumber) {
                        phoneNumbers.pushObject(itemMarkedDelete);
                    } else {
                        if (itemMarkedDelete instanceof MembersApp.Account) {
                            accounts.pushObject(itemMarkedDelete);
                        }
                    }
                }
            });
            this.deletedItems.clear();
        },
        createContactItem: function (contactType, usage, accountType) {
            console.log("createContactItem (MemberController) clicked");
            var personId = this.model.get('id');
            var itemCollection = this.getItemCollection(contactType);
            if (itemCollection) {
                if (contactType == 'account') {
                    itemCollection.createRecord({
                        Person_id: personId,
                        usage: usage,
                        type: accountType
                    });
                } else {
                    itemCollection.createRecord({
                        Person_id: personId,
                        usage: usage
                    });
                }
            }
        },
        deleteContactItem: function (contactType, usage) {
            console.log("deleteContactItem (MemberController) for " + usage + " clicked");
            var self = this;
            var itemCollection = this.getItemCollection(contactType);
            if (itemCollection) {
                var itemsToDelete = itemCollection.filterBy('usage', usage);
                itemsToDelete.forEach(function (item) {
                    item.deleteRecord();
                    self.deletedItems.pushObject(item);
                });
            }
        },
        save: function (controller) {
            var mod = this.get('model');

            var itemsToSavePromises = [];

            // save all addresses that are marked for deletion
            this.deletedItems.forEach(function (itemMarkedDelete) {
                itemsToSavePromises.push(itemMarkedDelete.save());
            });
            this.deletedItems.clear();

            var modelCollections = Ember.A([mod.get('addresses'), mod.get('phoneNumbers'), mod.get('accounts') ]);
            modelCollections.forEach(function (modelCollection) {
                modelCollection.forEach(function (model) {
                    if (model.get('isNew') || model.get('isDirty')) {
                        itemsToSavePromises.push(model.save());   // add promise from save to array
                    }
                });
            });

            Ember.RSVP.allSettled(itemsToSavePromises).then(function (array) {
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
                    errorMessage = "Error while saving contact data: " + errorMessage;
                    console.log(errorMessage);
                    controller.set('errorMessage', errorMessage);
                }
                else {
                    console.log("All new or changed contact items saved. Items marked for deletion were deleted.");

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
                        if (itemsToSavePromises.length > 0) {
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

            // todo

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

MembersApp.DatePickerComponent = Ember.Component.extend({
    init: function () {
        this._super();
        var id = this.elementId;
        var dtps = $('#' + id).find('.input-group.date');
        if (dtps && dtps.length > 0) {
            var dtp = dtps[0];
            dtp.datetimepicker({language: 'de', pickTime: false});
        }
    }
});

MembersApp.DateTimePicker = Ember.View.extend({
    templateName: 'datepicker2'
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


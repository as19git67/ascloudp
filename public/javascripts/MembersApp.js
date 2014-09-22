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
    headers: function() {
        return {
            "X-CSRF-Token": this.get("csrfToken")
        };
    }.property("csrfToken"),
    ajaxSuccess: function(jqXHR, jsonPayload) {
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
    entryDate_formatted: DS.attr('string')
});

MembersApp.Address = DS.Model.extend({
    street: DS.attr('string'),
    streetNumber: DS.attr('string'),
    postalcode: DS.attr('string'),
    city: DS.attr('string')
});

MembersApp.PhoneNumber = DS.Model.extend({
    number: DS.attr('string')
});

MembersApp.Account = DS.Model.extend({
    account: DS.attr('string')
});

MembersApp.Router.map(function () {
    this.resource('member', { path: '/' });
});


MembersApp.MemberController = Ember.ObjectController.extend({
    errorMessage: '',
    previouslySelectedElement: null,

    setId: function (id) {
        var self = this;
        self.set('errorMessage', "");
        this.store.findById('member', id).then(function (person) {
            if (person && person.get(''))
                self.set('model', person);
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
    actions: {
        save: function (controller) {
            //this.get('model').send('becomeDirty');
            var mod = this.get('model');
            mod.save().then(function (savedMember) {
                    console.log("Member saved with id " + savedMember.get('id'));
                },
                function (error) {
                    mod.rollback();
                    var errorMessage = error.statusText;
                    if (error.responseText && error.responseText.substr(0, 14) != "<!DOCTYPE html") {
                        errorMessage += " (" + error.responseText + ")"
                    }
                    controller.set('errorMessage', errorMessage);
                }
            );
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

        },
        discardChanges: function() {
            this.get('model').rollback();
        }
    }
});

MembersApp.MemberView = Ember.View.extend({

});
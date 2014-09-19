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

MembersApp.MemberRoute = Ember.Route.extend({
    // The code below is the default behavior, so if this is all you
    // need, you do not need to provide a setupController implementation
    // at all.
    setupController: function(controller, model) {
        controller.store.findById('member', "1").then(function (person) {
            controller.set('model', person);
        });
    }
});

MembersApp.MemberController = Ember.ObjectController.extend({
    errorMessage: '',
    previouslySelectedElement: null,

    setId: function (id) {
        var self = this;
        this.store.findById('member', id).then(function (person) {
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
            self.setId(id);
        });
    }
});

MembersApp.MemberView = Ember.View.extend({

});
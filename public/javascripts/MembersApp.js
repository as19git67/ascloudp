MembersApp = Em.Application.create({
    LOG_TRANSITIONS: true,
    rootElement: '#memberDetail'
});

MembersApp.ApplicationAdapter = DS.RESTAdapter.extend({
    pathForType: function(type) {
        var decamelized = Ember.String.decamelize(type);
        return Ember.String.pluralize(decamelized);
    },
    namespace: 'api/v1/'
});

DS.RESTAdapter.reopen({
    buildURL: function(record, suffix) {
        return this._super(record,suffix).toLowerCase();
    }
});

MembersApp.Router.map(function () {
    this.resource('member', { path: '/' });
});

MembersApp.Member = DS.Model.extend({
    MembershipNumber: DS.attr('number'),
    Salutation: DS.attr('string'),
    Firstname: DS.attr('string'),
    Lastname: DS.attr('string'),
    Suffix: DS.attr('string'),
    Birthday: DS.attr('date'),
    EntryDate: DS.attr('date')
});

MembersApp.Address = DS.Model.extend({
    Street: DS.attr('string'),
    Streetnumber: DS.attr('string'),
    Postalcode: DS.attr('string'),
    City: DS.attr('string')
});

MembersApp.PhoneNumber = DS.Model.extend({
    Number: DS.attr('string')
});

MembersApp.Account = DS.Model.extend({
    Account: DS.attr('string')
});

MembersApp.MemberController = Ember.ObjectController.extend({
    setId: function (id) {
        var self = this;
        var p = this.store.findById('member', id);
        p.then(function (person) {
            self.set('model', person);
        }).catch(function (error) {
            alert("ERROR: " + error);
        });

    },
    init: function () {
        var self = this;
        $(".memberListItem").click(function () {
            var clickedElement = $(this);
            var id = clickedElement.attr('data-id');
            self.setId(id);
        });
    }
});

MembersApp.MemberView = Ember.View.extend({

});
MembersApp = Em.Application.create({
    LOG_TRANSITIONS: true,
    rootElement: '#memberDetail'
});

MembersApp.ApplicationAdapter = DS.RESTAdapter.extend({
    namespace: 'api/v1'
});

MembersApp.Router.map(function() {
    this.resource('member', { path: '/' });
});

MembersApp.MemberController = Ember.ObjectController.extend({
    name: "Hallo"
});

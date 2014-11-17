var CalendarItem = Backbone.Model.extend({
    urlRoot : 'api/v1',
    url : function() {
        // Important! It's got to know where to send its REST calls.
        // In this case, POST to '/calendarItems' and PUT to '/calendarItems/:id'
        return this.id ? this.urlRoot + '/events/' + this.id : this.urlRoot + '/events';
    }
});


var CalendarItemView = Backbone.Marionette.ItemView.extend({});

var myView = new CalendarItemView({
    template: Handlebars.compile($('*[data-template-name="calendarItem"]').html()),
    el: '#calendarItemView'
});


$(".calendarListItem").click(function () {
    var clickedElement = $(this);
    var id = clickedElement.attr('data-id');
    var model = new CalendarItem({ id: id});
    myView.model = model;
    model.fetch();
//    myView.render();

    $('#editCalendarEntry').on('shown.bs.modal', function (e) {
    });
    $('#editCalendarEntry').modal({ backdrop: true });

});

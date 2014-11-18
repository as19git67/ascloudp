var CalendarItem = Backbone.Model.extend({
    urlRoot: 'api/v1',
    url: function () {
        // Important! It's got to know where to send its REST calls.
        // In this case, POST to '/calendarItems' and PUT to '/calendarItems/:id'
        return this.id ? this.urlRoot + '/events/' + this.id : this.urlRoot + '/events';
    }
});


var CalendarItemView = Backbone.Marionette.ItemView.extend({
    template: Handlebars.compile($('*[data-template-name="calendarItem"]').html()),
    el: '#calendarItemView',
    initialize: function () {
        if (this.model) {
            console.log("model event handler set");
            this.model.on("change", this.render);
        }
    }
    /*,
    modelEvents: {
        'change': "modelChanged"
    },
    modelChanged: function () {
        console.log(this.model);
       // this.render();
    }
    */
});

var myView = new CalendarItemView;


$(".calendarListItem").click(function () {
    var clickedElement = $(this);
    var id = clickedElement.attr('data-id');
    var model = new CalendarItem({id: id});
    var myView = new CalendarItemView({model: model});
    model.fetch().done(function () {
        console.log("model fetched");
        //myView.render();
    });

    $('#editCalendarEntry').on('shown.bs.modal', function (e) {
    });
    $('#editCalendarEntry').modal({backdrop: true});

});

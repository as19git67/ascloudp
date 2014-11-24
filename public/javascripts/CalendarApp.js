// Save a copy of the old Backbone.sync function so you can call it later.
var oldBackboneSync = Backbone.sync;

// Override Backbone.Sync
Backbone.sync = function (method, model, options) {
    if (method === 'read') {
        console.log('Backbone sync called.');
        console.log('model: ', model);
        console.log('options: ', options);
    } else {
        console.log('setting X-CSRF-Token');
        xhr.setRequestHeader("X-CSRF-Token", this.get("csrfToken"));
    }
    return oldBackboneSync.apply(this, [method, model, options]);
};

var CalendarItem = Backbone.Model.extend({
    urlRoot: 'api/v1/events',    // note: backbone adds id automatically
    fetch: function () {
        var jqXHR = Backbone.Collection.prototype.fetch.call(this, options);
        jqXHR.done(function () {
            // Get all headers:
            console.log('All headers:', jqXHR.getAllResponseHeaders());
            // Or get a specific header:
            console.log('Content-Length:', jqXHR.getResponseHeader('Content-Length'));
        })
    }
});


var CalendarItemView = Backbone.Marionette.ItemView.extend({
    template: Handlebars.compile($('*[data-template-name="calendarItem"]').html()),
    el: '#calendarItemView',
    modelEvents: {
        'change': "modelChanged"
    },
    events: {
        "click #btSave": "saveClicked"
    },
    ui: {
        editCalendarEntry: "#editCalendarEntry",
        errorMessage: "#errorMessage"
    },
    modelChanged: function () {
        console.log("model changed");
        //this.render();
    },
    onRender: function () {
        console.log("View has been rendered");

        this.modelbinder = new Backbone.ModelBinder();
        this.modelbinder.bind(this.model, this.el);

        this.ui.editCalendarEntry.on('shown.bs.modal', function (e) {
            console.log("modal dialg shows calendar entry");
        });
        this.ui.editCalendarEntry.on('hidden.bs.modal', function (e) {
            console.log("modal dialg closed");
            this.destroy(); // release all resources of this view
        });

        // show the modal dialog
        this.ui.editCalendarEntry.modal({backdrop: true});
    },
    saveClicked: function (e) {
        var self = this;
        self.ui.errorMessage.addClass("hidden");
        // todo disable save button

        this.model.save().done(function () {
            self.ui.editCalendarEntry.modal('hide');
        }).fail(function (req) {
            self.ui.errorMessage.text(req.status + " " + req.statusText).removeClass("hidden");
        });
    }

});

$(function () {
    $(".calendarListItem").click(function () {
        var clickedElement = $(this);
        var id = clickedElement.attr('data-id');
        var model = new CalendarItem({id: id});
        new CalendarItemView({model: model}).render();
        model.fetch();
    });
});

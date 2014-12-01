// extend jquery with :data pseudo (alternatively include jquery ui)
$.extend($.expr[":"], {
    data: $.expr.createPseudo ?
        $.expr.createPseudo(function (dataName) {
            return function (elem) {
                return !!$.data(elem, dataName);
            };
        }) :
        // support: jQuery <1.8
        function (elem, i, match) {
            return !!$.data(elem, match[3]);
        }
});

// Save a copy of the old Backbone.sync function so it can be called later.
var oldBackboneSync = Backbone.sync;

// Globally override Backbone.Sync
Backbone.sync = function (method, model, options) {
    var self = this;

    // call this success function and then the one that was specified in the options
    var success = options.success;
    options.success = function (resp) {
        success && success(resp);   // call the original success function
        self._isDirty = false;      // clear isDirty after each successful sync
    };

    // on every ajax request add the csrf token to the header unless its a fetch
    options.beforeSend = function (xhr) {
        if (method != 'fetch') {
            if (self.csrfToken) {
                console.log('setting X-CSRF-Token');
                xhr.setRequestHeader("X-CSRF-Token", self.csrfToken);
            } else {
                console.log('Not setting non existing X-CSRF-Token');
            }
        }
    };
    return oldBackboneSync.apply(this, [method, model, options]);
};

var CalendarItem = Backbone.Model.extend({
    urlRoot: 'api/v1/events',    // note: backbone adds id automatically
    _isDirty: false,
    initialize: function () {

        // If you extend this model, make sure to call this initialize method
        // or add the following line to the extended model as well
        this.listenTo(this, 'change', this.modelChanged);
    },
    fetch: function (options) {
        var self = this;
        // extract CSRF Token from header after read
        var jqXHR = Backbone.Model.prototype.fetch.call(this, options);
        jqXHR.done(function () {
            self.csrfToken = jqXHR.getResponseHeader('X-CSRF-Token');
        })
    },
    modelChanged: function () {
        console.log("model changed");
        this._isDirty = true;
    },
    isDirty: function () {
        return this._isDirty;
    }
});


var CalendarItemView = Backbone.Marionette.ItemView.extend({
    template: Handlebars.compile($('*[data-template-name="calendarItem"]').html()),
    el: '#calendarItemView',
    events: {
        "click #btSave": "saveClicked"
    },
    ui: {
        editCalendarEntry: "#editCalendarEntry",
        errorMessage: "#errorMessage"
    },
    initialize: function () {
        this.modelbinder = new Backbone.ModelBinder();
    },
    onRender: function () {
        var changeTriggers = {
            'select': 'change', '[contenteditable]': 'keyup', ':text': 'keyup'   /* select input[type=text], textarea */
        };  // use keyup instead blur


        // Bind with default bindings but specify custom changeTriggers.
        //   Note that the Modelbinder was enhanced to also bind element with data-bind="enabled:<computeFunction>",
        //   where computeFunction is a model function that is called to get the value for enabled.
        this.modelbinder.bind(this.model, this.el, undefined, { changeTriggers: changeTriggers });

        // show modal dialog
        this.ui.editCalendarEntry.modal({ backdrop: true });

        console.log("View has been rendered");
    },
    saveClicked: function (e) {
        var self = this;
        self.ui.errorMessage.addClass("hidden");

        this.model.save().done(function () {
            self.ui.editCalendarEntry.modal('hide');
            location.reload();
        }).fail(function (req) {
            if (req.responseText && req.responseText.substr(0, 14) != "<!DOCTYPE html") {
                console.log("Saving event failed: " + req.responseText);
            }
            self.ui.errorMessage.text(req.status + " " + req.statusText).removeClass("hidden");
        });
    }

});

$(function () {
    $(".calendarListItem").click(function () {
        var clickedElement = $(this);
        var id = clickedElement.attr('data-id');
        var model = new CalendarItem({ id: id });

        // When waiting for the completion of fetch and then
        // giving this model to the view we don't get the initial
        // modelChanged event.
        // This is by intention to have the save button enabled only
        // if the user changed values in the UI.
        model.fetch({
            success: function () {
                console.log("Event fetched");
                new CalendarItemView({ model: model }).render();
            }
        });
    });
});

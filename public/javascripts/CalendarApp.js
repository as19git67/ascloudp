// Save a copy of the old Backbone.sync function so you can call it later.
var oldBackboneSync = Backbone.sync;

// Override Backbone.Sync
Backbone.sync = function (method, model, options) {
    var self = this;
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
    _isNotDirty: true,
    urlRoot: 'api/v1/events',    // note: backbone adds id automatically
    fetch: function (options) {
        var self = this;
        // extract CSRF Token from header after read
        var jqXHR = Backbone.Model.prototype.fetch.call(this, options);
        jqXHR.done(function () {
            self.csrfToken = jqXHR.getResponseHeader('X-CSRF-Token');
        })
    },
    isNotDirty: function () {
        return this._isNotDirty;
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
    initialize: function () {
        this.modalShown = false;
        this.model.set("_isNotDirty", true);

        Handlebars.registerHelper('bind-attr', function (args, options) {
            var data = args.data;
            var hash = args.hash;
            var keys = Object.keys(hash);
            var attributesAsHtml = "";
            for (var idx = 0; idx < keys.length; idx++) {
                var htmlElementAttributeName = keys[idx];
                var dataAttributeName = hash[htmlElementAttributeName];
                var values = data.root;
                console.log("binding " + htmlElementAttributeName + " to attribute " + dataAttributeName);
                var value = values[dataAttributeName];
                if (value) {
                    if (attributesAsHtml.length > 0) {
                        attributesAsHtml += ' ';
                    }
                    var nextAttribute = htmlElementAttributeName + '="' + value + '"';
                    console.log("Adding html attribute: " + nextAttribute);
                    attributesAsHtml += nextAttribute;
                } else {
                    console.log(dataAttributeName + "=false");
                }
            }

            return attributesAsHtml;
        });
    },
    modelChanged: function () {
        console.log("model changed");
        this.model.set("_isNotDirty", false);
        //       this.render();
    },
    onRender: function () {
        var self = this;

        this.modelbinder = new Backbone.ModelBinder();
        // The view has several form element with a name attribute that should be bound
        // but some bindings require a converter...
        var bindings = Backbone.ModelBinder.createDefaultBindings(this.el, 'name');
        bindings['isNotDirty'] = {
            selector: '[disabled=isNotDirty]',
            elAttribute: 'disabled',
            converter: this.model.isNotDirty
        };

        this.modelbinder.bind(this.model, this.el, bindings);

        this.ui.editCalendarEntry.on('shown.bs.modal', function (e) {
            console.log("modal dialg shows calendar entry");
//            self.modalShown = true;
        });
        this.ui.editCalendarEntry.on('hidden.bs.modal', function (e) {
            console.log("modal dialg closed");
//            self.modalShown = false;
        });

//        // show the modal dialog if not already shown
//        if (this.modalShown == false) {
        this.ui.editCalendarEntry.modal({backdrop: true});
//        }
        console.log("View has been rendered");
    },
    saveClicked: function (e) {
        var self = this;
        self.ui.errorMessage.addClass("hidden");
        // todo disable save button

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
        var model = new CalendarItem({id: id});

        // When waiting for the completion of fetch and then
        // giving this model to the view we don't get the initial
        // modelChanged event.
        // This is by intention to have the save button enabled only
        // if the user changed values in the UI.
        model.fetch({
            success: function () {
                console.log("Event fetched");
                new CalendarItemView({model: model}).render();
            }
        });
    });
});

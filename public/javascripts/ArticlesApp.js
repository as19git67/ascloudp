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

    // call this function and then the one that was specified in the options
    // This function resets _isDirty and stores the CSRF token from the header in this.csrfToken.
    var success = options.success;
    options.success = function (model, resp, jqXHR) {
        success && success(model, resp, jqXHR);   // call the original success function
        self._isDirty = false;      // clear isDirty after each successful sync
        self.csrfToken = jqXHR.getResponseHeader('X-CSRF-Token');
    };

    // on every ajax request add the csrf token to the header unless its a fetch
    options.beforeSend = function (xhr) {
        if (method != 'fetch') {
            if (self.csrfToken) {
                xhr.setRequestHeader("X-CSRF-Token", self.csrfToken);
            }
        }
    };
    return oldBackboneSync.apply(this, [method, model, options]);
};


var ArticleItem = Backbone.Model.extend({
    urlRoot: 'api/v1/articles',    // note: backbone adds id automatically
    _isDirty: false,
    initialize: function () {

        // If you extend this model, make sure to call this initialize method
        // or add the following line to the extended model as well
        this.listenTo(this, 'change', this.modelChanged);
    },
    modelChanged: function () {
        console.log("model changed");
        this._isDirty = true;
    },
    isDirty: function () {
        return this._isDirty;
    }
});

var ArticleItemView = Backbone.Marionette.ItemView.extend({
    template: Handlebars.compile($('*[data-template-name="articleItem"]').html()),
    el: '#articleItemView',
    events: {
        "click #btSave": "saveClicked"
    },
    ui: {
        editArticleEntry: "#editArticleEntry",
        errorMessage: "#errorMessage"
    },
    initialize: function () {
    },
    onRender: function () {
        this.locale = navigator.language || navigator.userLanguage;

        var model = this.model;
        var locale = this.locale;

        this.ui.editArticleEntry.on('shown.bs.modal', function (e) {
            moment.locale(locale);
            var localeData = moment.localeData();
            var longDateFormat = localeData._longDateFormat.L;

            var schema = {
                "type": "object",
                "properties": {}
            };
            var options = {
                "fields": {}
            };
            console.log("MODEL: ", model);

            function setAlpacaField(fieldSchema) {
                var prop = schema.properties[fieldSchema.name] = {};
                var option = options.fields[fieldSchema.name] = {};
                switch (fieldSchema.type) {
                    case "integer":
                        prop.type = "integer";
                        break;
                    case "character varying":
                        prop.type = "string";
                        option.size = fieldSchema.maxLength ? fieldSchema.maxLength : 10;
                        break;
                    case "timestamp with time zone":
                        prop.format = "date";
                        option.type = "date";
                        option.dateFormat = longDateFormat;
                        option.size = longDateFormat.length;
                }
                prop.required = !fieldSchema.nullable;
                prop.title = fieldSchema.label;
                option.placeholder = fieldSchema.description;
            }

            _.each(model.get('article'), function (attr) {
                if (attr instanceof Object) {
                    var value = attr.value;
                    var fieldSchema = attr.schema;
                    setAlpacaField(fieldSchema);
                }
            });
            _.each(model.get('article_sections'), function (sect) {
                _.each(sect.attributes, function(attr) {
                    if (attr instanceof Object) {
                        var value = attr.value;
                        var fieldSchema = attr.schema;
                        setAlpacaField(fieldSchema);
                    }
                });
            });

            Alpaca.setDefaultLocale(locale);
            $("#form").alpaca({
                "schema": schema,
                "options": options,
                "view": {
                    "parent": "bootstrap-create-horizontal",
                    "messages": {
                        "de": {
                            required: "Eingabe erforderlich",
                            invalid: "Eingabe ungültig",
                            months: ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"],
                            timeUnits: {
                                SECOND: "Sekunden",
                                MINUTE: "Minuten",
                                HOUR: "Stunden",
                                DAY: "Tage",
                                MONTH: "Monate",
                                YEAR: "Jahre"
                            },
                            "notOptional": "Dieses Feld ist nicht optional",
                            "disallowValue": "Diese Werte sind nicht erlaubt: {0}",
                            "invalidValueOfEnum": "Diese Feld sollte einen der folgenden Werte enthalten: {0}. [{1}]",
                            "notEnoughItems": "Die Mindestanzahl von Elementen ist {0}",
                            "tooManyItems": "Die Maximalanzahl von Elementen ist {0}",
                            "valueNotUnique": "Diese Werte sind nicht eindeutig",
                            "notAnArray": "Keine Liste von Werten",
                            "invalidDate": "Das Datum muss in folgender Form eingegben werden: {0}",
                            "invalidEmail": "Ungültige e-Mail Adresse, z.B.: info@cloudcms.com",
                            "stringNotAnInteger": "Eingabe ist keine Ganz Zahl.",
                            "invalidIPv4": "Ungültige IPv4 Adresse, z.B.: 192.168.0.1",
                            "stringValueTooSmall": "Die Mindestanzahl von Zeichen ist {0}",
                            "stringValueTooLarge": "Die Maximalanzahl von Zeichen ist {0}",
                            "stringValueTooSmallExclusive": "Die Anzahl der Zeichen muss größer sein als {0}",
                            "stringValueTooLargeExclusive": "Die Anzahl der Zeichen muss kleiner sein als {0}",
                            "stringDivisibleBy": "Der Wert muss durch {0} dividierbar sein",
                            "stringNotANumber": "Die Eingabe ist keine Zahl",
                            "invalidPassword": "Ungültiges Passwort.",
                            "invalidPhone": "Ungültige Telefonnummer, z.B.: (123) 456-9999",
                            "invalidPattern": "Diese Feld stimmt nicht mit folgender Vorgabe überein {0}",
                            "stringTooShort": "Dieses Feld sollte mindestens {0} Zeichen enthalten",
                            "stringTooLong": "Dieses Feld sollte höchstens {0} Zeichen enthalten"
                        }
                    },
                    "callbacks": {
                        "required": function () {
                            var fieldEl = this.getFieldEl();
                            // required fields get a little star in their label
                            var label = $(fieldEl).find("label.alpaca-control-label");
                            $('<span class="alpaca-icon-required glyphicon glyphicon-star"></span>').appendTo(label);
                        }
                    }
                },

                "viewx": {
                    "parent": "bootstrap-edit",
                    "layout": {
                        "template": "twoColumnGridLayout",
                        "bindings": {
                            "name": "leftcolumn",
                            "birthday": "leftcolumn",
                            "city": "rightcolumn"
                        }
                    },
                    "templates": {
                        "twoColumnGridLayout": '<div class="row"><div class="col-md-6" id="leftcolumn"></div><div class="col-md-6" id="rightcolumn"></div></div>'
                    }
                }
            });
        });

        // show modal dialog
        this.ui.editArticleEntry.modal({backdrop: true});

        console.log("View has been rendered");
    },
    saveClicked: function (e) {
        var self = this;
        self.ui.errorMessage.addClass("hidden");

        this.model.save().done(function () {
            self.ui.editArticleEntry.modal('hide');
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
    $(".articleListItem").click(function () {
        var clickedElement = $(this);
        var id = clickedElement.attr('data-id');
        var model = new ArticleItem({id: id});

        // When waiting for the completion of fetch and then
        // giving this model to the view we don't get the initial
        // modelChanged event.
        // This is by intention to have the save button enabled only
        // if the user changed values in the UI.
        model.fetch({
            success: function () {
                console.log("Article fetched");
                new ArticleItemView({model: model}).render();
            }
        });
    });
});

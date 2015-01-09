(function (factory) {
    if (typeof define === 'function' && define.amd) {
        // AMD. Register as an anonymous module.
        define(['underscore', 'jquery', 'backbone', 'handlebars'], factory);
    }
    else if (typeof module !== 'undefined' && module.exports) {
        // CommonJS
        module.exports = factory(
            require('underscore'),
            require('jquery'),
            require('backbone')
        );
    }
    else {
        // Browser globals
        factory(_, $, Backbone);
    }
}
(function (_, $, Backbone, Handlebars) {

    if (!Backbone) {
        throw 'Please include Backbone.js before Backbone.Forms.js';
    }
    if (!Handlebars) {
        throw 'Please include Handlebars.js before Backbone.Forms.js';
    }

    Backbone.Forms = function (model, options) {
        _.bindAll.apply(_, [this].concat(_.functions(this)));

        this._model = model;
        this._options = options;
        if (!this._options) {
            this._options = {};
        }

        if (this._options.template && this._options.template instanceof Handlebars) {
            this._templateGenerationNecessary = false;
        }
        else {
            this._templateGenerationNecessary = true;
        }
    };

    Backbone.Forms.VERSION = '1.0.0';

    _.extend(Backbone.Forms.prototype, Backbone.Events, {
        // Initialize is an empty function by default. Override it with your own
        // initialization logic.
        initialize: function () {
        },
        show: function() {
            if (this._templateGenerationNecessary) {
                generateTemplateFrom
            }
        }
    });

    Backbone.Forms.extend = Backbone.View.extend; // "re-use" backbone helper
}));

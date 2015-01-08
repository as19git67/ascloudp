(function (factory) {
    if (typeof define === 'function' && define.amd) {
        // AMD. Register as an anonymous module.
        define(['underscore', 'jquery', 'backbone', 'Backbone.ModelBinder'], factory);
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
(function (_, $, Backbone) {

    if (!Backbone) {
        throw 'Please include Backbone.js before Backbone.ModelBinder.js';
    }

    Backbone.ComponentBinder = function (el, options) {
        _.bindAll.apply(_, [this].concat(_.functions(this)));
        this._el = el;
        this._options = options;
        if (!this._options) {
            this._options = {};
        }
    };

    var _componentBinders = Backbone.ComponentBinder._componentBinders = [];

    // static function to add component binders to the "registry" of component binders
    Backbone.ComponentBinder.AddComponentBinder = function (ComponentBinder) {
        if (ComponentBinder.prototype instanceof Backbone.ComponentBinder) {
            _componentBinders.push(ComponentBinder);
        }
    };

    // static function to get a component binder instance that is responsible for the given jquery element
    Backbone.ComponentBinder.GetComponentBinder = function (el, options) {
        var componentBinderCount;
        for (componentBinderCount = 0; componentBinderCount < _componentBinders.length; componentBinderCount++) {
            var componentBinder = new _componentBinders[componentBinderCount](el, options);
            if (componentBinder.isResponsible()) {
                return componentBinder;
            }
        }
        return undefined;
    };

    Backbone.ComponentBinder.VERSION = '1.0.0';

    _.extend(Backbone.ComponentBinder.prototype, Backbone.Events, {
        // Initialize is an empty function by default. Override it with your own
        // initialization logic.
        initialize: function () {
        },
        isResponsible: function () {
            return false;
        },
        getValue: function () {
            return this.el.val();
        },
        handleModelChanged: function (model, attributeName) {
        },
        setValue: function (value) {
            var oldValue = this._el.val();
            this._el.val(value);
            if (oldValue != value) {
                this.trigger('change', this);
            }
        },
        enable: function () {
            this._el.prop('disabled', false);
        },
        disable: function () {
            this._el.prop('disabled', true);
        }
    });

    Backbone.ComponentBinder.extend = Backbone.View.extend; // "re-use" backbone helper
}));

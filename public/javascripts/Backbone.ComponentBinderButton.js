(function (factory) {
    if (typeof define === 'function' && define.amd) {
        // AMD. Register as an anonymous module.
        define(['underscore', 'jquery', 'backbone', 'Backbone.ModelBinder', 'Backbone.ComponentBinder'], factory);
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

    if (!Backbone.ComponentBinder) {
        throw 'Please include Backbone.ComponentBinder.js before Backbone.ComponentBinderButton.js';
    }

    var ComponentBinderButton = Backbone.ComponentBinder.extend({
        isResponsible: function () {
            if (this._el instanceof $) {
                return this._el.is(":button");
            } else {
                console.log("el is not a jquery element");
                return false;
            }
        },
        handleModelChanged: function (model, attributeName) {
            if (attributeName == this._options.attributeName) {
                if (model.isDirty) {
                    if (model.isDirty()) {
                        this.enable();
                    } else {
                        this.disable();
                    }
                }
            }
        }
    });

    // add this component binder to the registry
    Backbone.ComponentBinder.AddComponentBinder(ComponentBinderButton);

    return ComponentBinderButton;

}));

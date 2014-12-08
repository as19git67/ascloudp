(function(root, factory) {

    // Set up ComponentBinderDatePicker appropriately for the environment. Start with AMD.
    if (typeof define === 'function' && define.amd) {
        define(['underscore', 'jquery', 'exports'], function(_, $, exports) {
            // Export global even in AMD case in case this script is loaded with
            // others that may still expect a global ComponentBinderDatePicker.
            root.ComponentBinderDatePicker = factory(root, exports, _, $);
        });

        // Next for Node.js or CommonJS. jQuery may not be needed as a module.
    } else if (typeof exports !== 'undefined') {
        var _ = require('underscore');
        factory(root, exports, _);

        // Finally, as a browser global.
    } else {
        root.ComponentBinderDatePicker = factory(root, {}, root._, (root.jQuery || root.Zepto || root.ender || root.$));
    }

}(this, function(root, ModelBinderElements, _, $) {

    // Initial Setup
    // -------------

    // Save the previous value of the `ComponentBinderDatePicker` variable, so that it can be
    // restored later on, if `noConflict` is used.
    var previousModelBinderElements = root.ComponentBinderDatePicker;


    // Current version of the library.
    ModelBinderElements.VERSION = '1.0.0';

    // For ComponentBinderDatePicker purposes, jQuery, Zepto or Ender owns
    // the `$` variable.
    ModelBinderElements.$ = $;

    // Runs ComponentBinderDatePicker in *noConflict* mode, returning the `ComponentBinderDatePicker` variable
    // to its previous owner. Returns a reference to this ComponentBinderDatePicker object.
    ModelBinderElements.noConflict = function () {
        root.ComponentBinderDatePicker = previousModelBinderElements;
        return this;
    };

    var BindElement = ModelBinderElements.BindElement = function(el, options) {
        if (el && obj instanceof jQuery) {
            this.el = el;
            options || (options = {});

            this.language = options.language ? options.language : navigator ? navigator.language || navigator.userLanguage : undefined;
            this.initialize.apply(this, arguments);
        }
    };

    // Attach all inheritable methods to the BindElement prototype.
    _.extend(BindElement.prototype, {
        // Initialize is an empty function by default. Override it with your own
        // initialization logic.
        initialize: function(){},

        getValue: function() {
             return this.el.val();
        },
        setValue: function(value) {
            this.el.val(value);
        },
        enable: function() {
            this.el.prop('disabled', false);
        },
        disable: function() {
            this.el.prop('disabled', true);
        }
    });



        // Helpers
    // -------

    // Helper function to correctly set up the prototype chain, for subclasses.
    // Similar to `goog.inherits`, but uses a hash of prototype properties and
    // class properties to be extended.
    var extend = function(protoProps, staticProps) {
        var parent = this;
        var child;

        // The constructor function for the new subclass is either defined by you
        // (the "constructor" property in your `extend` definition), or defaulted
        // by us to simply call the parent's constructor.
        if (protoProps && _.has(protoProps, 'constructor')) {
            child = protoProps.constructor;
        } else {
            child = function(){ return parent.apply(this, arguments); };
        }

        // Add static properties to the constructor function, if supplied.
        _.extend(child, parent, staticProps);

        // Set the prototype chain to inherit from `parent`, without calling
        // `parent`'s constructor function.
        var Surrogate = function(){ this.constructor = child; };
        Surrogate.prototype = parent.prototype;
        child.prototype = new Surrogate;

        // Add prototype properties (instance properties) to the subclass,
        // if supplied.
        if (protoProps) _.extend(child.prototype, protoProps);

        // Set a convenience property in case the parent's prototype is needed
        // later.
        child.__super__ = parent.prototype;

        return child;
    };

    BindElement.extend = extend;


    var DatePickerBindElement = ModelBinderElements.DatePickerBindElement = BindElement.extend({
        initialize: function(){
            var self = this;
            this.el.datetimepicker({language: this.language, pickTime: false});
            this.dateValueAsMoment = this.el.data("DateTimePicker").getDate();

            this.el.on("dp.change", function (e) {
                var changedDateAsMoment = e.date;
                // check whether the changed date differs to the date in this.dateValueAsMoment
                if (self.dateValueAsMoment) {
                    if (self.dateValueAsMoment.isValid()) {
                        if (!self.dateValueAsMoment.isSame(changedDateAsMoment)) {
                            self._setDate(changedDateAsMoment);
                        }
                    }
                } else {
                    if (changedDateAsMoment) {
                        self._setDate(changedDateAsMoment);
                    }
                }
            });
            this.picker.on("dp.error", function (e){
                // set date to null if picker raises error event (which will be done if the input field is emptied)
                self._setDate(null);
            });
        },
        _setDate: function(dateAsMoment) {
            this.dateValueAsMoment = dateAsMoment;
            // todo: trigger change event
        },
        getValue: function() {
            return this.dateValueAsMoment ? this.dateValueAsMoment.toDate() : undefined;
        },
        setValue: function(value) {
            // todo: check for change and trigger change event if date value really changed
            this.dateValueAsMoment = moment(value);
            this.el.data("DateTimePicker").setDate(this.dateValueAsMoment);
        }
    });


    return ModelBinderElements;

}));

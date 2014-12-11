(function (factory) {
    if (typeof define === 'function' && define.amd) {
        // AMD. Register as an anonymous module.
        define(['underscore', 'jquery', 'backbone', 'Backbone.ModelBinder', 'Backbone.ComponentBinder'], factory);
    }
    else if(typeof module !== 'undefined' && module.exports) {
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
(function(_, $, Backbone){

    if(!Backbone.ComponentBinder){
        throw 'Please include Backbone.ComponentBinder.js before Backbone.ComponentBinderDatePicker.js';
    }

    var ComponentBinderDatePicker = Backbone.ComponentBinder.extend({
        isResponsible: function() {
            if (this._el instanceof $)
            {
                if (this._el.hasClass('date')) {
                    return true;
                }
                else
                {
                    return false;
                }
            } else {
                console.log("el is not a jquery element");
                return false;
            }
        },
        initialize: function(){
            var self = this;
            this._el.datetimepicker({language: this._options.language, pickTime: false});
            this.dateValueAsMoment = this._el.data("DateTimePicker").getDate();

            this._el.on("dp.change", function (e) {
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
            this._el.on("dp.error", function (e){
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
            this._el.data("DateTimePicker").setDate(this.dateValueAsMoment);
        }
    });

    // add this component binder to the registry
    Backbone.ComponentBinder.AddComponentBinder(ComponentBinderDatePicker);

    return ComponentBinderDatePicker;

}));

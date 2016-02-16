var express = require('express');
var _ = require('underscore');
var router = express.Router();
var config = require('../config');
var model = require('../model');
var passportStrategies = require('../passportStrategies');
var rolePermissions = require('../Roles');

var rp = new rolePermissions(model.models);
var appName = config.get('appName');
var title = 'Einstellungen';

var configKeys = ["bootstrapStyle"];

function prepareResponse(req, res, next) {
    var csrfToken;
    if (req.csrfToken && req.session) {
        csrfToken = req.csrfToken();
    }
    model.getPagesForUser(req.user).then(function (pages) {

        var lookupValues = {
            "bootstrapStyle": [
                {name: "bootstrap", description: "bootstrap default style"},
                {name: "feuerwehr", description: "Feuerwehr"},
                {name: "yeti", description: "Yeti"},
                {name: "csu", description: "Blue"}
            ]
        };
        var settingsUI = [];
        _.each(configKeys, function (configKey) {
            var configValue = config.get(configKey);
            settingsUI.push({key: configKey, value: configValue, lookupValues: lookupValues});
        });

        res.render('settings', {
            csrfToken: csrfToken,
            bootstrapTheme: config.get('bootstrapStyle'),
            appName: appName,
            title: title,
            settingsUI: settingsUI,
            user: req.user,
            pages: pages
        });
    }).catch(function (error) {
        var err = new Error(error);
        err.status = 500;
        next(err);
    });
}
router.get('/', passportStrategies.ensureAuthenticated, rp.middleware(), function (req, res, next) {
        prepareResponse(req, res, next);
    }
);

router.post('/', passportStrategies.ensureAuthenticated, rp.middleware(),
    function (req, res, next) {
        if (req.body.save) {
            _.each(configKeys, function (configKey) {
                var configValue = req.body[configKey];
                if (configValue) {
                    config.set(configKey, configValue);
                }
            });
            config.save(function (error) {
                if (error) {
                    var err = new Error(error);
                    err.status = 500;
                    next(err);
                } else {
                    prepareResponse(req, res, next);
                }
            });
        }
        else {
            prepareResponse(req, res, next);
        }
    });

module.exports = router;

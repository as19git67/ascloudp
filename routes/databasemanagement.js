var express = require('express');
var router = express.Router();
var config = require('../config');
var model = require('../model');
var modelDataDefault = require('../modelDataDefault');
var passportStrategies = require('../passportStrategies');
var rolePermissions = require('../Roles');

var rp = new rolePermissions(model.models);

router.get('/', passportStrategies.ensureAuthenticated, rp.middleware(), function (req, res) {
    var appName = config.get('appName');
    var csrfToken;
    if (req.csrfToken) {
        csrfToken = req.csrfToken();
    }
    res.render('databaseManagement', {
        csrfToken: csrfToken,
        bootstrapTheme: config.get('bootstrapStyle'),
        appName: appName,
        title: 'Datenbankverwaltung',
        user: req.user
    });
});

router.post('/', passportStrategies.ensureAuthenticated, rp.middleware(), function (req, res) {
    var appName = config.get('appName');
    var csrfToken;
    if (req.csrfToken) {
        csrfToken = req.csrfToken();
    }

    if (req.body.dbinit) {
        model.createSchema()
            .then(function () {
                console.log("Database schema created");
                req.logout();
                res.redirect('/');
            })
            .catch(function (err) {
                console.log("ERROR when creating the database schema: " + err);
                var errorText = "Fehler beim Erzeugen der Datenbanktabellen. " + err;
                res.render('databaseManagement', {
                    csrfToken: csrfToken,
                    bootstrapTheme: config.get('bootstrapStyle'),
                    appName: appName,
                    title: 'Datenbankverwaltung',
                    user: req.user,
                    error: errorText
                });
            });
    } else {
        if (req.body.dbloadTestData) {
            modelDataDefault.importTestData()
                .then(function () {
                    console.log("Default Testdaten importiert");
                    req.logout();
                    res.redirect('/');
                })
                .catch(function (err) {
                    console.log("ERROR when importing test data: " + err);
                    var errorText = "Fehler beim Importieren der Test Daten. " + err;
                    res.render('databaseManagement', {
                        csrfToken: csrfToken,
                        bootstrapTheme: config.get('bootstrapStyle'),
                        appName: appName,
                        title: 'Datenbankverwaltung',
                        user: req.user,
                        error: errorText
                    });
                });
        } else {
            res.redirect('/');
        }
    }
});

module.exports = router;

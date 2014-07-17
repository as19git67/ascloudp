var express = require('express');
var router = express.Router();
var config = require('../config');

/* GET Admin page. */
router.get('/', function (req, res) {
    var appName = config.get('appName');
    res.render('admin', {
        appName: appName,
        title: 'Administration',
        user: req.user
    });
});

router.post('/', function (req, res) {
    var appName = config.get('appName');

    var model = require('../model');
    model.createSchema()
        .then(function () {
            console.log("Database schema created");
            var statusText = "Datenbanktabellen neu erzeugt";
            res.render('admin', {
                appName: appName,
                title: 'Administration',
                user: req.user,
                status: statusText
            });
        })
        .catch(function (err) {
            console.log("ERROR when creating the database schema: " + err);
            var errorText = "Fehler beim erzeugen der Datenbanktabellen. " + err;
            res.render('admin', {
                appName: appName,
                title: 'Administration',
                user: req.user,
                error: errorText
            });
        });
});

module.exports = router;

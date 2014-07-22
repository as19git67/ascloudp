var express = require('express');
var router = express.Router();
var config = require('../config');
var passportStrategies = require('../passportStrategies');

/* GET login page. */
router.get('/', function (req, res) {
    if (req.user) {
        var appName = config.get('appName');
        passportStrategies.findUser(req.user, function (err, user) {
            if (err) {
                res.render('loginManageAccount', {
                    csrfToken: req.csrfToken(),
                    appName: appName,
                    title: 'Fehler beim Zugriff auf die Benutzereinstellungen',
                    error: err
                });
            } else {
                if (user) {
                    res.render('loginManageAccount', {
                        csrfToken: req.csrfToken(),
                        appName: appName,
                        title: 'Benutzereinstellungen',
                        user: req.user
                    });
                } else {
                    console.log("Can't manage user: user not found in database.");
                    res.redirect('/');
                }
            }
        });
    } else {
        console.log("No user object in request. Redirecting to /");
        res.redirect('/');
    }
});

module.exports = router;

var express = require('express');
var router = express.Router();
var config = require('../config');
var passport = require('passport');

/* GET login page. */
router.get('/', function (req, res) {
    if (req.user) {
        var appName = config.get('appName');
        res.render('loginManageAccount', {
            csrfToken: req.csrfToken(),
            appName: appName,
            title: 'Benutzereinstellungen',
            user: req.user
        });
    } else {
        res.redirect('/');
    }
});

module.exports = router;

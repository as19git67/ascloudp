var express = require('express');
var router = express.Router();
var config = require('../config');
var model = require('../model');

/* GET home page. */
router.get('/', function (req, res) {
    var appName = config.get('appName');
    var csrfToken;
    if (req.csrfToken) {
        csrfToken = req.csrfToken();
    }
    model.getPagesForUser(req.user).then(function (pages) {
        if (pages.length > 0) {
            var page = pages[0];
            res.redirect('/' + page.Name);
        } else {
            res.render('index', {
                csrfToken: csrfToken,
                bootstrapTheme: config.get('bootstrapStyle'),
                appName: appName,
                title: 'Start',
                user: req.user,
                pages: pages
            });
        }
    });
});

module.exports = router;

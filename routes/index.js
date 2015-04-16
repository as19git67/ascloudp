var express = require('express');
var router = express.Router();
var config = require('../config');
var model = require('../model');

/* GET home page. */
router.get('/', function (req, res) {
    var appName = config.get('appName');
    model.getPagesForUser(req.user).then(function (pages) {
        if (pages.length > 0) {
            var page = pages[0];
            res.redirect('/' + page.Name);
        } else {
            res.render('index', {
                csrfToken: req.csrfToken(),
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

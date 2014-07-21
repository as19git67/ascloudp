var express = require('express');
var router = express.Router();
var config = require('../config');

/* GET logoff page. */
router.get('/', function (req, res) {
    var appName = config.get('appName');
    res.render('logoff', {
      csrfToken: req.csrfToken(),
        appName: appName,
        title: 'Logoff',
        user: req.user
    });
});

router.post('/', function (req, res) {
    req.logout();
    res.redirect('/');
});

module.exports = router;

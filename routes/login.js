var express = require('express');
var router = express.Router();
var config = require('../config');

/* GET login page. */
router.get('/', function (req, res) {
    var appName = config.get('appName');
    res.render('login', {
        appName: appName,
        title: 'Login' });
});

module.exports = router;

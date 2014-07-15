var express = require('express');
var router = express.Router();
var config = require('../config');


/* GET home page. */
router.get('/', function (req, res) {
    var appName = config.get('appName');
    res.render('index', {
        appName: appName,
        title: 'Start',
        user: req.user
    });
});

module.exports = router;

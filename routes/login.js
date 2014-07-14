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

router.post('/', function (req, res) {
    switch (req.body.provider ) {
        case 'Azure':
            res.redirect('/auth/azure');
            break;
        case 'Twitter':
            res.redirect('/auth/twitter');
            break;
        case 'Facebook':
            res.redirect('/auth/facebook');
            break;
        case 'Google':
            res.redirect('/auth/google');
            break;
        default:
            res.redirect('/');
    }
});

module.exports = router;

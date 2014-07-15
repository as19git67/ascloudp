var express = require('express');
var router = express.Router();
var config = require('../config');

/* GET loginRegister page. */
router.get('/', function (req, res) {
    var appName = config.get('appName');
    if (req.user && req.user.profile) {
        var provider = req.user.profile.provider;
        provider = provider.charAt(0).toUpperCase() + provider.slice(1);
        res.render('loginRegister', {
            appName: appName,
            title: 'Registrierung.',
            email: req.user.email,
            provider: provider
        });
    } else {
        // todo error message
        res.redirect('login');
    }
});

router.post('/', function (req, res) {
    var email = req.body.email;
    // todo: store user in DB
    if (req.body.nexturl) {
        res.redirect(req.body.nexturl);
    } else {
        res.redirect('/');
    }
});


module.exports = router;

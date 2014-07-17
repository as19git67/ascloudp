var express = require('express');
var router = express.Router();
var config = require('../config');
var passport = require('passport');

/* GET login page. */
router.get('/', function (req, res) {
    var appName = config.get('appName');
    res.render('login', {
        appName: appName,
        title: 'Login',
        user: req.user
    });
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
            res.redirect('/login/auth/google');
            break;
        default:
            res.redirect('/');
    }
});


// GET /auth/google
//   Use passport.authenticate() as route middleware to authenticate the
//   request.  The first step in Google authentication will involve redirecting
//   the user to google.com.  After authenticating, Google will redirect the
//   user back to this application at /auth/google/return
router.get('/auth/google', passport.authenticate('google', {
    failureRedirect: '/login',
    scope: 'https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile'}));

// GET /auth/google/return
//   Use passport.authenticate() as route middleware to authenticate the
//   request.  If authentication fails, the user will be redirected back to the
//   login page.  Otherwise, the primary route function function will be called,
//   which, in this example, will redirect the user to the home page.
router.get('/auth/google/return', passport.authenticate('google', { failureRedirect: '/login' }), function (req, res) {
    if (req.user) {
        if (req.user.isNotLocalUser) {
            res.redirect('/loginRegister');
        } else {
            var username = req.user.UserName;
            console.log(username + ' is a locally registered user. No need to register again.');
            if (req.body.nexturl) {
                res.redirect(req.body.nexturl);
            } else {
                res.redirect('/');
            }
        }
    } else {
        console.log('No user profile from Google oauth callback');
        res.redirect('/');
    }
});

module.exports = router;

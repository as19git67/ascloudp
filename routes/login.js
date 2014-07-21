var express = require('express');
var router = express.Router();
var config = require('../config');
var passport = require('passport');

/* GET login page. */
router.get('/', function (req, res) {
    var appName = config.get('appName');
    res.render('login', {
        csrfToken: req.csrfToken(),
        appName: appName,
        title: 'Login',
        user: req.user
    });
});

router.post('/', function (req, res, next) {
    var appName = config.get('appName');

    var provider = req.body.provider;
    if (!provider) {
        provider = appName;
    }
    switch (provider) {

        case 'Azure':
            res.redirect('/login/auth/azure');
            break;
        case 'Twitter':
            res.redirect('/login/auth/twitter');
            break;
        case 'Facebook':
            res.redirect('/login/auth/facebook');
            break;
        case 'Google':
            console.log('calling passport.authenticate for google');
            //   Use passport.authenticate() as route middleware to authenticate the
            //   request.  The first step in Google authentication will involve redirecting
            //   the user to google.com.  After authenticating, Google will redirect the
            //   user back to this application at /login/auth/google/return
            passport.authenticate('google', {
                    failureRedirect: '/login',
                    scope: 'https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile'},
                function (err, user, info) {
                    if (err) {
                        return next(err);
                    }
                    if (!user) {
                        return res.redirect('/login');
                    }
                    req.logIn(user, function (err) {
                        if (err) {
                            return next(err);
                        }
                        return res.redirect('/');
                    });
                })(req, res, next);
            break;
        default:
            console.log('calling passport.authenticate for local');
            passport.authenticate('local', function (err, user, info) {
                if (err) {
                    return next(err);
                }
                if (!user) {
                    return res.redirect('/login');
                }
                req.logIn(user, function (err) {
                    if (err) {
                        return next(err);
                    }
                    return res.redirect('/');
                });
            })(req, res, next);
    }
});

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


router.get('/auth/twitter', passport.authenticate('twitter'));
router.get('/auth/twitter/callback', passport.authenticate('twitter', { failureRedirect: '/login' }), function (req, res) {
    res.redirect('/loginRegister');
//
//    if (req.body.nexturl) {
//        res.redirect(req.body.nexturl);
//    } else {
//        res.redirect('/');
//    }
});

// GET /auth/facebook
//   Use passport.authenticate() as route middleware to authenticate the
//   request.  The first step in Facebook authentication will involve
//   redirecting the user to facebook.com.  After authorization, Facebook will
//   redirect the user back to this application at /auth/facebook/callback
router.get('/auth/facebook', passport.authenticate('facebook'), function (req, res) {
    // The request will be redirected to Facebook for authentication, so this
    // function will not be called.
});

// GET /auth/facebook/callback
//   Use passport.authenticate() as route middleware to authenticate the
//   request.  If authentication fails, the user will be redirected back to the
//   login page.  Otherwise, the primary route function function will be called,
//   which, in this example, will redirect the user to the home page.
router.get('/auth/facebook/callback', passport.authenticate('facebook', { failureRedirect: '/login' }), function (req, res) {
    if (req.body.nexturl) {
        res.redirect(req.body.nexturl);
    } else {
        res.redirect('/');
    }
});

module.exports = router;

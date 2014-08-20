var express = require('express');
var router = express.Router();
var config = require('../config');
var passport = require('passport');
var passportStrategies = require('../passportStrategies');
var model = require('../model');
var Audit = model.models.Audit;
var User = model.models.User;
var UserLogin = model.models.UserLogin;

var appName = config.get('appName');

/* GET login page. */
router.get('/', function (req, res) {
    var strategies = passportStrategies.getEnabledStrategies();
    model.getPagesForUser(req.user).then(function (pages) {
        res.render('login', {
            csrfToken: req.csrfToken(),
            appName: appName,
            title: 'Login',
            user: req.user,
            pages: pages,
            passportStrategies: strategies
        });
    });
});

router.post('/', function (req, res, next) {
    if (req.user && req.body.provider && !req.user.isNotLocalUser) {
        req.session.loginToLink = req.user.id;
    } else {
        delete req.session['loginToLink'];
    }

    var provider = req.body.provider;
    if (!provider) {
        provider = appName;
    }
    switch (provider) {
    case 'Google':
        console.log('calling passport.authenticate for google');
        passport.authenticate('google', {
                failureRedirect: '/login',
                scope: 'https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile'},
            handlePassportAuthenticate(next, res, req))(req, res, next);
        break;
    case 'Twitter':
        passport.authenticate('twitter', {failureRedirect: '/login'}, handlePassportAuthenticate(next, res, req))(req, res, next);
        break;
    case 'Facebook':
        passport.authenticate('facebook', {failureRedirect: '/login'}, handlePassportAuthenticate(next, res, req))(req, res, next);
        break;
    case 'Azure':
        res.redirect('/login/auth/azure');
        break;
    default:
        console.log('calling passport.authenticate for local');
        passport.authenticate('local', {failureRedirect: '/login'}, handlePassportAuthenticate(next, res, req))(req, res, next);
    }
});

// GET /auth/google/return
//   Use passport.authenticate() as route middleware to authenticate the
//   request.  If authentication fails, the user will be redirected back to the
//   login page.  Otherwise, the primary route function function will be called,
//   which, in this example, will redirect the user to the home page.
router.get('/auth/google/return', passport.authenticate('google', { failureRedirect: '/login' }), function (req, res, next) {
    if (req.user) {
        handleExternalLoginCallback(req, res, next);
    } else {
        console.log('No user profile from Google oauth callback');
        res.redirect('/');
    }
});

router.get('/auth/twitter/callback', passport.authenticate('twitter', { failureRedirect: '/login' }), function (req, res, next) {
    if (req.user) {
        handleExternalLoginCallback(req, res, next);
    } else {
        console.log('No user profile from Twitter oauth callback');
        res.redirect('/');
    }
});

router.get('/auth/facebook/callback', passport.authenticate('facebook', { failureRedirect: '/login' }), function (req, res, next) {
    if (req.user) {
        handleExternalLoginCallback(req, res, next);
    } else {
        console.log('No user profile from Facebook oauth callback');
        res.redirect('/');
    }
});

function handlePassportAuthenticate(next, res, req) {
    return function (err, user, info) {
        if (err) {
            return next(err);
        }
        if (!user) {
            console.log('Authentication failed.');
            model.getPagesForUser(req.user).then(function (pages) {
                res.render('login', {
                    csrfToken: req.csrfToken(),
                    appName: config.get('appName'),
                    title: 'Login failed',
                    user: req.user,
                    pages: pages,
                    passportStrategies: passportStrategies.getEnabledStrategies(),
                    error: "Der eingegebene Benutzername (Email) oder das Passwort ist falsch."
                });
            });
        }
        req.logIn(user, function (err) {
            if (err) {
                return next(err);
            }
            return res.redirect('/');
        });
    };
}

function handleExternalLoginCallback(req, res, next) {
    // req.user is always set

    // check for user_id set in previous post request to /login
    if (req.session.loginToLink && req.user.profile) {
        linkUser(req, res, next);
    } else {
        if (req.user.isNotLocalUser) {
            res.redirect('/loginRegister');
        } else {
            if (req.user.UserName) {
                var username = req.user.UserName;
                console.log(username + ' is a locally registered user. No need to register again.');
            }
            if (req.body.nexturl) {
                res.redirect(req.body.nexturl);
            } else {
                res.redirect('/');
            }
        }
    }
}

function linkUser(req, res, next) {
    var loggedInUserId = req.session.loginToLink;
    console.log('link user. loggedInUserId: ' + loggedInUserId);
    delete req.session['loginToLink'];

    new User({'id': loggedInUserId}).fetch({
        withRelated: ['UserLogin']
    }).then(function (userModel) {
        if (userModel) {
            var profile = req.user.profile;
            var providerKey = profile.id;
            var provider = profile.provider;
            new UserLogin({
                LoginProvider: provider,
                ProviderKey: providerKey,
                User_id: loggedInUserId})
                .save()
                .then(function (userLoginModel) {
                    console.log("New UserLogin saved in DB. UserID: " +
                                userLoginModel.get('User_id') + ", Provider: " + userLoginModel.get('LoginProvider'));

                    new Audit({
                            ChangedAt: new Date(),
                            Table: userModel.tableName,
                            ChangedBy: userModel.get('UserName'),
                            Description: "UserLogin added to user. Provider: " + provider
                        }
                    ).save().then(function () {

                            req.login(userModel.attributes, function (err) {
                                if (err) {
                                    console.log('Failed to re-passport.login with newly registered user: ' + err);
                                }
                                res.redirect('/loginManageAccount');
                            });
                        }
                    );
                })
                .catch(function (error) {
                    console.log("Error while saving new UserLogin in DB: " + error);
                    var err = new Error(error);
                    err.status = 500;
                    next(err);
                });

        } else {
            console.log("Can't manage user: user not found in database.");
            res.redirect('/');
        }
    }).catch(function (error) {
        console.log("Error while accessing users in the database: " + error);
        var err = new Error(error);
        err.status = 500;
        next(err);
    });
}

module.exports = router;

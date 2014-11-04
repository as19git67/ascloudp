var express = require('express');
var router = express.Router();
var config = require('../config');
var model = require('../model');
var User = model.models.User;
var UserLogin = model.models.UserLogin;
var passportStrategies = require('../passportStrategies');

var appName = config.get('appName');

/* GET loginRegister page. */
router.get('/', function (req, res) {
    var email = '';
    if (req.user) {
        model.getPagesForUser(req.user).then(function (pages) {
            var profile = req.user.profile;

            var provider = profile.provider;
            switch (provider) {
            case 'twitter':
                email = profile.username;
                break;
            default:
                var emails = req.user.profile.emails;
                if (emails && emails.length > 0) {
                    if (emails[0].value) {
                        email = emails[0].value;
                    }
                }
            }
            provider = provider.charAt(0).toUpperCase() + provider.slice(1);
            res.render('loginRegister', {
                csrfToken: req.csrfToken(),
                bootstrapTheme: config.get('bootstrapStyle'),
                appName: appName,
                title: 'Registrierung.',
                email: email,
                pages: pages,
                provider: provider
            });
        });
    } else {
        // todo error message
        res.redirect('login');
    }
});

router.post('/', function (req, res, next) {
    if (req.user && req.user.profile) {
        model.getPagesForUser(req.user).then(function (pages) {
            var profile = req.user.profile;
            var email = '';
            var emails = profile.emails;
            if (emails && emails.length > 0) {
                email = emails[0].value;
            }
            var providerKey = profile.id;
            var provider = profile.provider;

            var familyName = '';
            var givenName = '';
            if (profile.name) {
                familyName = profile.name.familyName;
                givenName = profile.name.givenName;
            }
            var displayName = profile.displayName;

            var username = req.body.email;

            // prüfe auf bereits existierenden Eintrag in der DB mit gleichem Usernamen
            passportStrategies.findByUsername(username, function (err, user) {
                if (err) {
                    res.render('loginRegister', {
                        csrfToken: req.csrfToken(),
                        bootstrapTheme: config.get('bootstrapStyle'),
                        appName: appName,
                        title: 'Registrierung.',
                        email: email,
                        pages: pages,
                        provider: provider,
                        error: err
                    });
                }
                else {
                    if (user) {
                        res.render('loginRegister', {
                            csrfToken: req.csrfToken(),
                            bootstrapTheme: config.get('bootstrapStyle'),
                            appName: appName,
                            title: 'Registrierung.',
                            email: email,
                            pages: pages,
                            provider: provider,
                            error: "Es existiert bereits ein Account mit diesem Benutzernamen"
                        });
                    } else {
                        // TODO: use DB transaction for both save operations

                        new User({
                            Email: email,
                            EmailConfirmed: false,
                            PhoneNumberConfirmed: false,
                            TwoFactorEnabled: false,
                            LockoutEnabled: false,
                            AccessFailedCount: 0,
                            UserName: username
                        }).save()
                            .then(function (model) {
                                var userId = model.id;
                                console.log("New User saved in DB. ID: " + userId);
                                new UserLogin({
                                    LoginProvider: provider,
                                    ProviderKey: providerKey,
                                    User_id: userId})
                                    .save()
                                    .then(function (userLoginModel) {
                                        console.log("New UserLogin saved in DB. UserID: " +
                                                    userLoginModel.get('User_id') + ", Provider: " + userLoginModel.get('LoginProvider'));
                                        // redirect to next page
                                        if (req.body.nexturl) {
                                            res.redirect(req.body.nexturl);
                                        } else {
                                            res.redirect('/');
                                        }
                                    })
                                    .catch(function (error) {
                                        model.destroy().then(function () {
                                            console.log("Error while saving new UserLogin in DB: " + error);
                                            var err = new Error(error);
                                            err.status = 500;
                                            next(err);
                                        });
                                    });
                            }).catch(function (error) {
                                console.log("Error while saving new user in DB: " + error);
                                var err = new Error(error);
                                err.status = 500;
                                next(err);
                            });
                    }
                }
            });
        });
    } else {
        console.log("No user or user.profile in request object");
        res.redirect('/');
    }
});

module.exports = router;

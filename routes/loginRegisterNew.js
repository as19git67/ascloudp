var express = require('express');
var router = express.Router();
var config = require('../config');
var model = require('../model');
var User = model.models.User;
var UserLogin = model.models.UserLogin;
var passportStrategies = require('../passportStrategies');


/* GET loginRegisterNew page. */
router.get('/', function (req, res) {
    var appName = config.get('appName');
    var email = '';
    if (req.user) {
        var emails = req.user.profile.emails;
        if (emails && emails.length > 0) {
            email = emails[0].value;
        }
    }
    res.render('loginRegisterNew', {
        appName: appName,
        title: 'Neuen Benutzer registrieren.',
        email: email,
        provider: appName   // für lokale User benutze appName als Provider
    });
});

router.post('/', function (req, res, next) {
    var appName = config.get('appName');
    var email = req.body.email;
    var password = req.body.Password;
    var passwordConfirmation = req.body.ConfirmPassword;

    var provider = appName;

    // prüfe auf bereits existierenden Eintrag in der DB mit gleichem Usernamen
    passportStrategies.findByUsername(username, function (err, user) {
        if (err) {
            res.render('loginRegisterNew', {
                appName: appName,
                title: 'Neuer Benutzer registriert.',
                email: email,
                provider: provider,
                error: err
            });
        }
        else {
            if (user) {
                res.render('loginRegisterNew', {
                    appName: appName,
                    title: 'Fehler bei der Benutzerregistrierung.',
                    email: email,
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


module.exports = router;

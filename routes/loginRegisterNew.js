var express = require('express');
var router = express.Router();
var config = require('../config');
var model = require('../model');
var User = model.models.User;
var UserLogin = model.models.UserLogin;
var passportStrategies = require('../passportStrategies');

var appName = config.get('appName');

/* GET loginRegisterNew page. */
router.get('/', function (req, res) {
    var email = '';
    if (req.user) {
        var emails = req.user.profile.emails;
        if (emails && emails.length > 0) {
            email = emails[0].value;
        }
    }
    model.getPagesForUser(req.user).then(function (pages) {
        res.render('loginRegisterNew', {
            csrfToken: req.csrfToken(),
            appName: appName,
            title: 'Neuen Benutzer registrieren.',
            email: email,
            pages: pages,
            provider: appName   // für lokale User benutze appName als Provider
        });
    });
});

router.post('/', function (req, res, next) {
    var username = req.body.Email;
    var password = req.body.Password;
    var passwordConfirmation = req.body.ConfirmPassword;

    var provider = appName;

    model.getPagesForUser(req.user).then(function (pages) {
        if (password != passwordConfirmation) {
            res.render('loginRegisterNew', {
                csrfToken: req.csrfToken(),
                appName: appName,
                title: 'Benutzerregistrierung',
                email: username,
                pages: pages,
                provider: provider,
                error: 'Passwort und Wiederholung stimmen nicht überein.'
            });
            return;
        }

        // prüfe auf bereits existierenden Eintrag in der DB mit gleichem Usernamen
        passportStrategies.findByUsername(username, function (err, user) {
            if (err) {
                console.log('Fehler bei der Suche nach registriertem Benutzer: ' + username);
                res.render('loginRegisterNew', {
                    csrfToken: req.csrfToken(),
                    appName: appName,
                    title: 'Fehler bei der Registrierung.',
                    email: username,
                    pages: pages,
                    provider: provider,
                    error: err
                });
            }
            else {
                if (user) {
                    res.render('loginRegisterNew', {
                        csrfToken: req.csrfToken(),
                        appName: appName,
                        title: 'Fehler bei der Benutzerregistrierung.',
                        email: username,
                        pages: pages,
                        provider: provider,
                        error: "Es existiert bereits ein Account mit diesem Benutzernamen"
                    });
                } else {
                    var salt = model.createSalt();

                    new User({
                        Email: username,
                        EmailConfirmed: false,
                        PhoneNumberConfirmed: false,
                        TwoFactorEnabled: false,
                        LockoutEnabled: false,
                        AccessFailedCount: 0,
                        UserName: username,
                        PasswordSalt: salt,
                        PasswordHash: model.encryptPassword(password, salt)
                    }).save()
                        .then(function (model) {
                            var userId = model.id;
                            console.log("New User saved in DB. ID: " + userId);
                            // login immediately with new registered user
                            req.login(model.attributes, function (err) {
                                if (err) {
                                    console.log('Failed to do passport.login with newly registered user: ' + err);
                                    res.render('loginRegisterNew', {
                                        csrfToken: req.csrfToken(),
                                        appName: appName,
                                        title: 'Fehler bei der Benutzerregistrierung',
                                        email: username,
                                        pages: pages,
                                        provider: provider,
                                        error: "Anmeldung mit neu registriertem Benutzer war nicht möglich."
                                    });
                                } else {
                                    // redirect to next page
                                    if (req.body.nexturl) {
                                        res.redirect(req.body.nexturl);
                                    } else {
                                        res.redirect('/');
                                    }
                                }
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
});

module.exports = router;

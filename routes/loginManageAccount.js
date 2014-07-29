var express = require('express');
var router = express.Router();
var config = require('../config');
var model = require('../model');
var Audit = model.models.Audit;
var User = model.models.User;
var UserLogin = model.models.UserLogin;
var passportStrategies = require('../passportStrategies');


// TODO: passwort ändern auch wenn kein passwort gesetzt, da nur via extern eingeloggt

router.get('/', passportStrategies.ensureAuthenticated, function (req, res, next) {
    if (req.user) {

        new User({'id': req.user.id}).fetch({
            withRelated: ['UserLogin']
        }).then(function (userModel) {
            if (userModel) {
                var responseData = prepareResponseDataFromUser(userModel, req);
                res.render('loginManageAccount', responseData);
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
    } else {
        console.log("No user object in request. Redirecting to /");
        res.redirect('/');
    }
});

router.post('/', passportStrategies.ensureAuthenticated, function (req, res, next) {
    if (req.user) {
        if (req.body.changePassword) {
            console.log('Changing password for user with id ' + req.user.id);
            new User({'id': req.user.id}).fetch({
                withRelated: ['UserLogin']
            }).then(function (userModel) {
                if (userModel) {
                    var responseData = prepareResponseDataFromUser(userModel, req);
                    if (req.body.changePassword) {
                        var oldPassword = req.body.OldPassword;
                        var newPassword = req.body.NewPassword;
                        var confirmPassword = req.body.ConfirmPassword;
                        var oldSalt = req.user.PasswordSalt;
                        var hashedPassword = model.encryptPassword(oldPassword, oldSalt);
                        if (userModel.get('PasswordHash') != hashedPassword) {
                            responseData.error = "Das Passwort ist falsch.";
                            res.render('loginManageAccount', responseData);
                        } else {
                            if (newPassword != confirmPassword) {
                                responseData.error = "Die Passwortwiederholung stimmt nicht mit dem neuen Passwort überein.";
                                res.render('loginManageAccount', responseData);
                            }
                            else {
                                var salt = model.createSalt();
                                userModel.set('PasswordHash', model.encryptPassword(newPassword, salt));
                                userModel.set('PasswordSalt', salt);
                                userModel.save().then(function () {
                                    new Audit({
                                            ChangedAt: new Date(),
                                            Table: userModel.tableName,
                                            ChangedBy: userModel.get('UserName'),
                                            Description: "Password changed"
                                        }
                                    ).save().then(function () {
                                            responseData.info = "Das Passwort wurde geändert.";
                                            res.render('loginManageAccount', responseData);
                                        }
                                    );
                                }).catch(function (error) {
                                    console.log("Error while accessing users in the database: " + error);
                                    var err = new Error(error);
                                    err.status = 500;
                                    next(err);
                                });
                            }
                        }
                    }
                } else {
                    console.log("Can't change users password: user not found in database.");
                    res.redirect('/');
                }
            }).catch(function (error) {
                console.log("Error while accessing users in the database: " + error);
                var err = new Error(error);
                err.status = 500;
                next(err);
            });
        }
        else {
            if (req.body.unlink) {
                var provider = req.body.loginProvider;
                var providerKey = req.body.providerKey;
                var user_id = req.user.id;
                console.log("removing " + provider + " login that is linked to user " + user_id);

                new UserLogin({
                    LoginProvider: provider,
                    ProviderKey: providerKey,
                    User_id: user_id}).fetch({
                        withRelated: ['User']
                    }).then(function (userLogin) {
                        if (userLogin) {
                            var userModel = userLogin.related('User');
                            userLogin.destroy().then(function () {
                                var userDesc = userModel.get('UserName') + ' (' + user_id + ')';
                                console.log("UserLogin removed from user " + userDesc + ", Provider: " + provider);
                                new Audit({
                                        ChangedAt: new Date(),
                                        Table: userModel.tableName,
                                        ChangedBy: userModel.get('UserName'),
                                        Description: "UserLogin removed from user " + userDesc + ", Provider: " + provider
                                    }
                                ).save().then(function () {

                                        // reload user and render same page again

                                        new User({'id': user_id}).fetch({
                                            withRelated: ['UserLogin']
                                        }).then(function (userModel) {
                                            if (userModel) {
                                                var responseData = prepareResponseDataFromUser(userModel, req);
                                                responseData.info = "Der " + provider + " Login wurde entfernt.";
                                                res.render('loginManageAccount', responseData);
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
                                    });
                            });
                        }
                        else {
                            console.log("Can't manage unlink external login from user: user not found in database.");
                            res.redirect('/');
                        }
                    })
                    .catch(function (error) {
                        console.log("Error while deleting from UserLogin in DB: " + error);
                        var err = new Error(error);
                        err.status = 500;
                        next(err);
                    });
            } else {
                console.log("post to loginManageAccount with unknown submitted value - don't know what to do");
                res.redirect('/');
            }
        }
    } else {
        console.log("No user object in request. Redirecting to /");
        res.redirect('/');
    }

});

function prepareResponseDataFromUser(userModel, req) {
    var appName = config.get('appName');
    var strategies = passportStrategies.getEnabledStrategies();
    var canAssociateWithAzure = strategies.azure;
    var canAssociateWithTwitter = strategies.twitter;
    var canAssociateWithGoogle = strategies.google;
    var canAssociateWithFacebook = strategies.facebook;

    var user = {
        Email: userModel.get('Email') ? userModel.get('Email') : '',
        UserName: userModel.get('UserName') ? userModel.get('UserName') : '',
        User_id: userModel.get('id'),
        UserLogins: []
    };
    var userLogins = userModel.related('UserLogin');
    if (userLogins.length > 0) {
        userLogins.each(function (userLogin) {
            var provider = userLogin.get('LoginProvider');
            user.UserLogins.push({
                UserLogin_id: userLogin.get('id'),
                LoginProvider: provider,
                ProviderKey: userLogin.get('ProviderKey')
            });

            // disable buttons for already associated login providers
            switch (provider) {
                case 'azure':
                    canAssociateWithAzure = false;
                    break;
                case 'twitter':
                    canAssociateWithTwitter = false;
                    break;
                case 'google':
                    canAssociateWithGoogle = false;
                    break;
                case 'facebook':
                    canAssociateWithFacebook = false;
                    break;
            }

        });
    }
    var responseData = {
        csrfToken: req.csrfToken(),
        appName: appName,
        title: 'Benutzereinstellungen',
        user: user,
        canAssociateWithAzure: canAssociateWithAzure,
        canAssociateWithTwitter: canAssociateWithTwitter,
        canAssociateWithGoogle: canAssociateWithGoogle,
        canAssociateWithFacebook: canAssociateWithFacebook
    };
    return responseData;
}

module.exports = router;

var express = require('express');
var router = express.Router();
var config = require('../config');
var model = require('../model');
var User = model.models.User;
var UserLogin = model.models.UserLogin;

router.get('/', function (req, res, next) {
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

router.post('/', function (req, res, next) {
    if (req.user) {
        new User({'id': req.user.id}).fetch({
            withRelated: ['UserLogin']
        }).then(function (userModel) {
            if (userModel) {
                var responseData = prepareResponseDataFromUser(userModel, req);
                if (req.body.changePassword) {
                    var oldPassword = req.body.OldPassword;
                    var newPassword = req.body.NewPassword;
                    var confirmPassword = req.body.ConfirmPassword;
                    // todo: check hashed password
                    if (oldPassword != userModel.get('PasswordHash')) {
                        responseData.error = "Das Passwort ist falsch.";
                        res.render('loginManageAccount', responseData);
                    } else {
                        if (newPassword != confirmPassword) {
                            responseData.error = "Die Passwortwiederholung stimmt nicht mit dem neuen Passwort überein.";
                            res.render('loginManageAccount', responseData);
                        }
                        else {
                            userModel.set('PasswordHash', newPassword);
                            userModel.save().then(function () {
                                responseData.info = "Das Passwort wurde geändert.";
                                res.render('loginManageAccount', responseData);
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

function prepareResponseDataFromUser(userModel, req) {
    var appName = config.get('appName');
    var canAssociateWithAzure = true;
    var canAssociateWithTwitter = true;
    var canAssociateWithGoogle = true;
    var canAssociateWithFacebook = true;

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

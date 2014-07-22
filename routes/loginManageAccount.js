var express = require('express');
var router = express.Router();
var config = require('../config');
var model = require('../model');
var User = model.models.User;
var UserLogin = model.models.UserLogin;

router.get('/', function (req, res, next) {
    if (req.user) {
        var appName = config.get('appName');
        new User({'id': req.user.id}).fetch({
            withRelated: ['UserLogin']
        }).then(function (userModel) {
            var canAssociateWithAzure = true;
            var canAssociateWithTwitter = true;
            var canAssociateWithGoogle = true;
            var canAssociateWithFacebook = true;

            if (userModel) {
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
                res.render('loginManageAccount', {
                    csrfToken: req.csrfToken(),
                    appName: appName,
                    title: 'Benutzereinstellungen',
                    user: user,
                    canAssociateWithAzure: canAssociateWithAzure,
                    canAssociateWithTwitter: canAssociateWithTwitter,
                    canAssociateWithGoogle: canAssociateWithGoogle,
                    canAssociateWithFacebook: canAssociateWithFacebook
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
    } else {
        console.log("No user object in request. Redirecting to /");
        res.redirect('/');
    }
});

module.exports = router;

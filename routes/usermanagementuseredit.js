var express = require('express');
var router = express.Router();
var config = require('../config');
var model = require('../model');
var User = model.models.User;
var UserLogin = model.models.UserLogin;
var passportStrategies = require('../passportStrategies');

/* GET user list page. */
router.get('/:userId', passportStrategies.ensureAuthenticated, function (req, res, next) {
        var appName = config.get('appName');
        var title = 'User Management - Benutzerdetails';
        var userId = req.params.userId;
        new User({'id': userId}).fetch({
            withRelated: ['UserLogin']
        }).then(function (user) {
            if (user) {
                var userLoginsArray = [];
                var userObj = {
                    User_id: user.get('id'),
                    Email: user.get('Email'),
                    UserName: user.get('UserName'),
                    UserLogins: userLoginsArray
                };
                var userLogins = user.related('UserLogin');
                if (userLogins.length > 0) {
                    userLogins.each(function (userLogin) {
                        userLoginsArray.push({
                            UserLogin_id: userLogin.get('id'),
                            LoginProvider: userLogin.get('LoginProvider'),
                            ProviderKey: userLogin.get('ProviderKey')

                        });
                    });
                }
                res.render('usermanagementuseredit', {
                    csrfToken: req.csrfToken(),
                    appName: appName,
                    title: title,
                    user: req.user,
                    error: "",
                    userData: userObj
                });
            }
            else {
                console.log('No user with ID ' + userId);
                res.redirect('/');
            }
        }).catch(function (error) {
                var err = new Error(error);
                err.status = 500;
                next(err);
            }
        );
    }
);

module.exports = router;

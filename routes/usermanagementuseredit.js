var express = require('express');
var router = express.Router();
var config = require('../config');
var model = require('../model');
var User = model.models.User;
var UserLogin = model.models.UserLogin;

/* GET user list page. */
router.get('/:userId', function (req, res) {
        var appName = config.get('appName');
        var title = 'User Management - Benutzerdetails';
        var userId = req.params.userId;
        new User().fetch({
            User_id: userId,
            withRelated: ['UserLogin']
        }).then(function (user) {
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
                appName: appName,
                title: title,
                user: req.user,
                error: "",
                userData: userObj
            });
        })
            .catch(function (error) {
                res.render('usermanagementuseredit', {
                        appName: appName,
                        title: title,
                        user: req.user,
                        error: 'Error: ' + error,
                        userData: {}
                    }
                );
            }
        );
    }
);

module.exports = router;

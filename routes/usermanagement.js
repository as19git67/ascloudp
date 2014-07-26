var express = require('express');
var router = express.Router();
var config = require('../config');
var model = require('../model');
var User = model.models.User;
var UserLogin = model.models.UserLogin;
var passportStrategies = require('../passportStrategies');

/* GET user list page. */
router.get('/', passportStrategies.ensureAuthenticated, function (req, res) {
        var appName = config.get('appName');
        var title = 'User Management - Benutzer';

        new User().fetchAll({withRelated: ['UserLogin']})
            .then(function (userlist) {
                var users = [];
                userlist.each(function (user) {
                    var userObj = {
                        User_id: user.get('id'),
                        Email: user.get('Email'),
                        UserName: user.get('UserName'),
                        LoginProvider: []
                    };

                    var userLogins = user.related('UserLogin');
                    if (userLogins.length > 0) {
                        userLogins.each(function (userLogin) {
                            userObj.LoginProvider.push(userLogin.get('LoginProvider'));
                        });
                    }
                    users.push(userObj);
                });
                res.render('usermanagementlist', {
                    csrfToken: req.csrfToken(),
                    appName: appName,
                    title: title,
                    user: req.user,
                    error: "",
                    userlist: users
                });
            })
            .catch(function (error) {
                res.render('usermanagementlist', {
                        csrfToken: req.csrfToken(),
                        appName: appName,
                        title: title,
                        user: req.user,
                        error: 'Error: ' + error,
                        userlist: []
                    }
                );
            }
        );
    }
);

module.exports = router;

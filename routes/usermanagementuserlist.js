var express = require('express');
var router = express.Router();
var config = require('../config');
var model = require('../model');
var User = model.models.User;
var UserLogin = model.models.UserLogin;
var passportStrategies = require('../passportStrategies');
var rolePermissions = require('../Roles');

var rp = new rolePermissions(model.models);
var appName = config.get('appName');

router.get('/', passportStrategies.ensureAuthenticated, rp.middleware(), function (req, res) {
        var title = 'User Management - Benutzer';

        model.getPagesForUser(req.user).then(function (pages) {
            new User().fetchAll({withRelated: ['UserLogin']}).then(function (userlist) {
                var users = [];
                userlist.each(function (user) {
                    var userObj = {
                        User_id: user.get('id'),
                        Email: user.get('Email'),
                        UserName: user.get('UserName'),
                        UserLoginProviders_formatted: "",
                        LoginProvider: []
                    };

                    var userLogins = user.related('UserLogin');
                    if (userLogins.length > 0) {
                        userLogins.each(function (userLogin) {
                            if (userObj.UserLoginProviders_formatted.length > 0) {
                                userObj.UserLoginProviders_formatted = userObj.UserLoginProviders_formatted + ', ';
                            }
                            var loginProvider = userLogin.get('LoginProvider');
                            loginProvider = loginProvider.charAt(0).toUpperCase() + loginProvider.substr(1);
                            userObj.UserLoginProviders_formatted = userObj.UserLoginProviders_formatted + loginProvider;
                            userObj.LoginProvider.push(userLogin.get('LoginProvider'));
                        });
                    }
                    users.push(userObj);
                });
                res.render('usermanagementuserlist', {
                    csrfToken: req.csrfToken(),
                    bootstrapTheme: config.get('bootstrapStyle'),
                    appName: appName,
                    title: title,
                    user: req.user,
                    pages: pages,
                    error: "",
                    userlist: users
                });
            })
                .catch(function (error) {
                    res.render('usermanagementuserlist', {
                            csrfToken: req.csrfToken(),
                            bootstrapTheme: config.get('bootstrapStyle'),
                            appName: appName,
                            title: title,
                            user: req.user,
                            pages: pages,
                            error: 'Error: ' + error,
                            userlist: []
                        }
                    );
                }
            );
        });
    }
);

module.exports = router;

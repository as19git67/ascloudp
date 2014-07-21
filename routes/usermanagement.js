var express = require('express');
var router = express.Router();
var config = require('../config');
var model = require('../model');
var User = model.models.User;
var UserLogin = model.models.UserLogin;

/* GET user list page. */
router.get('/', function (req, res) {
        var appName = config.get('appName');
        var title = 'User Management - Benutzer';

        new User().fetchAll({withRelated: ['UserLogin']})
            .then(function (userlist) {
                var users = [];
                userlist.each(function (user) {

                    var userLogins = user.related('UserLogin');
                    if (userLogins.length > 0) {
                        userLogins.each(function (userLogin) {
                            var userObj = {
                                User_id: user.get('id'),
                                Email: user.get('Email'),
                                UserName: user.get('UserName'),
                                UserLogin_id: userLogin.get('id'),
                                LoginProvider: userLogin.get('LoginProvider'),
                                ProviderKey: userLogin.get('ProviderKey')
                            };
                            users.push(userObj);
                        });
                    } else {
                        var userObj = {
                            User_id: user.get('id'),
                            Email: user.get('Email'),
                            UserName: user.get('UserName')
                        };
                        users.push(userObj);
                    }
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

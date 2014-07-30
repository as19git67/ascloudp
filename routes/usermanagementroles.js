var express = require('express');
var router = express.Router();
var config = require('../config');
var model = require('../model');
var Role = model.models.Role;
var User = model.models.User;
var UserLogin = model.models.UserLogin;
var passportStrategies = require('../passportStrategies');

router.get('/', passportStrategies.ensureAuthenticated, function (req, res) {
        var appName = config.get('appName');
        var title = 'Rollenmanagement - Alle Rollen';

        new Role().fetchAll({withRelated: ['UserRole']})
            .then(function (roleList) {
                var roles = [];
                roleList.each(function (role) {
                    var roleObj = {
                        Role_id: role.get('id'),
                        Name: role.get('Name'),
                        UserRoles: []
                    };

                    var userRoles = role.related('UserRole');
                    if (userRoles.length > 0) {
                        userRoles.each(function (userRole) {
                            role.UserRoles.push(userRole.get('User_id'));
                        });
                    }
                    roles.push(roleObj);
                });
                res.render('usermanagementroles', {
                    csrfToken: req.csrfToken(),
                    appName: appName,
                    title: title,
                    user: req.user,
                    roles: roles
                });
            })
            .catch(function (error) {
                res.render('usermanagementroles', {
                        csrfToken: req.csrfToken(),
                        appName: appName,
                        title: title,
                        user: req.user,
                        error: 'Error: ' + error,
                        roles: []
                    }
                );
            }
        );
    }
);


router.post('/', function (req, res, next) {
    if (req.user) {
        new User({'id': req.user.id}).fetch({
            withRelated: ['UserLogin']
        }).then(function (userModel) {
            if (userModel) {

                var provider = req.body.provider;


                if (req.body.nexturl) {
                    res.redirect(req.body.nexturl);
                } else {
                    res.redirect('/');
                }
            }
            else {
                if (req.body.nexturl) {
                    res.redirect(req.body.nexturl);
                } else {
                    res.redirect('/');
                }

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

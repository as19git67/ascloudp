var express = require('express');
var _ = require('underscore');
var router = express.Router();
var config = require('../config');
var model = require('../model');
var Role = model.models.Role;
var User = model.models.User;
var UserLogin = model.models.UserLogin;
var passportStrategies = require('../passportStrategies');
var Profiles = require('../profiles');

router.get('/', passportStrategies.ensureAuthenticated, function (req, res) {
        var appName = config.get('appName');
        var title = 'User Management - Rollen';

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
    var title = 'User Management - Rollen';
    if (req.user) {
        if (req.body.addNewRole) {

            var roleName = req.body.newRoleName;
            if (roleName && roleName.trim().length > 0) {

                new Role({'Name': roleName}).save()
                    .then(function (newRoleModel) {
                        res.redirect('/admin/userManagementRoles');
                    })
                    .catch(function (error) {
                        console.log("Error while saving new role in the database: " + error);
                        var err = new Error(error);
                        err.status = 500;
                        next(err);
                    }
                );
            }
            else
            {
                console.log("Not saving role without name");
                res.redirect('/admin/userManagementRoles');
            }
        }
        else {
            console.log("No known post parameter in request. Redirecting to /");
            res.redirect('/');
        }
    } else {
        console.log("No user object in request. Redirecting to /");
        res.redirect('/');
    }
});

module.exports = router;

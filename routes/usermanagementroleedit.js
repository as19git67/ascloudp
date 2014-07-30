var express = require('express');
var router = express.Router();
var config = require('../config');
var model = require('../model');
var Role = model.models.Role;
var User = model.models.User;
var UserLogin = model.models.UserLogin;
var passportStrategies = require('../passportStrategies');

router.get('/:roleId', passportStrategies.ensureAuthenticated, function (req, res, next) {
        var title;
        var appName = config.get('appName');
        var roleId = req.params.roleId;
        if (roleId) {
            title = 'Rollenmanagement - Rolle ändern';
        } else {
            title = 'Rollenmanagement - Neue Rolle';
        }

        new Role({id: roleId}).fetch({withRelated: ['RolePermission']})
            .then(function (role) {
                var roleObj = {
                    Role_id: role.get('id'),
                    Name: role.get('Name'),
                    RolePermissions: []
                };

                var rolePermissions = role.related('RolePermission');
                if (rolePermissions.length > 0) {
                    rolePermissions.each(function (rolePermission) {
                        roleObj.RolePermission.push(rolePermission.attributes);
                    });
                }
                res.render('usermanagementroleedit', {
                    csrfToken: req.csrfToken(),
                    appName: appName,
                    title: title,
                    user: req.user,
                    role: roleObj
                });
            })
            .catch(function (error) {
                res.render('usermanagementroleedit', {
                        csrfToken: req.csrfToken(),
                        appName: appName,
                        title: title,
                        user: req.user,
                        error: 'Error: ' + error,
                        role: {}
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

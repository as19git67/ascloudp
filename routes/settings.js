var express = require('express');
var _ = require('underscore');
var router = express.Router();
var config = require('../config');
var model = require('../model');
var passportStrategies = require('../passportStrategies');
var rolePermissions = require('../Roles');

var rp = new rolePermissions(model.models);
var appName = config.get('appName');
var title = 'Einstellungen';

router.get('/', passportStrategies.ensureAuthenticated, rp.middleware(), function (req, res, next) {
        model.getPagesForUser(req.user).then(function (pages) {

            var configKeys = ["bootstrapStyle"];
            var lookupValues = {"bootstrapStyle": [{name: "default", description: "bootstrap default style"}, {name: "ff", description: "Feuerwehr"}]};
            var settingsUI = [];
            _.each(configKeys, function (configKey) {
                var configValue = config.get(configKey);
                settingsUI.push({key: configKey, value: configValue, lookupValues: lookupValues});
            });

            res.render('settings', {
                csrfToken: req.csrfToken(),
                appName: appName,
                title: title,
                settingsUI: settingsUI,
                user: req.user,
                pages: pages
            });
        }).catch(function (error) {
            var err = new Error(error);
            err.status = 500;
            next(err);
        });

    }
);

router.post('/', passportStrategies.ensureAuthenticated, rp.middleware(), function (req, res, next) {
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
            else {
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

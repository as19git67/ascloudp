var express = require('express');
var _ = require('underscore');
var router = express.Router();
var config = require('../config');
var model = require('../model');
var passportStrategies = require('../passportStrategies');
var rolePermissions = require('../Roles');

var rp = new rolePermissions(model.models);
var appName = config.get('appName');
var title = 'Content Management - Seiten';

router.get('/', passportStrategies.ensureAuthenticated, rp.middleware(), function (req, res, next) {

        model.getPages().then(function (pages) {

            res.render('pagemanagementpagelist', {
                csrfToken: req.csrfToken(),
                bootstrapTheme: config.get('bootstrapStyle'),
                appName: appName,
                title: title,
                user: req.user,
                pages: pages
            });
        });
    }
);

module.exports = router;

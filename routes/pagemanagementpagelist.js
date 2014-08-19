var express = require('express');
var _ = require('underscore');
var router = express.Router();
var config = require('../config');
var model = require('../model');
var Page = model.models.Page;
var passportStrategies = require('../passportStrategies');
var rolePermissions = require('../Roles');

var rp = new rolePermissions(model.models);
var appName = config.get('appName');
var title = 'Content Management - Seiten';

router.get('/', passportStrategies.ensureAuthenticated, rp.middleware(), function (req, res, next) {

        new Page().query(function (qb) {
            qb.orderBy('Order', 'ASC');
        }).fetchAll()
            .then(function (pageList) {
                var pages = [];
                pageList.each(function (page) {
                    var pageObj = {
                        Page_id: page.get('id'),
                        Name: page.get('Name'),
                        EntityNameSingular: page.get('EntityNameSingular'),
                        EntityNamePlural: page.get('EntityNamePlural'),
                        Model: page.get('Model'),
                        View: page.get('View')
                    };
                    pages.push(pageObj);
                });
                res.render('pagemanagementpagelist', {
                    csrfToken: req.csrfToken(),
                    appName: appName,
                    title: title,
                    user: req.user,
                    pages: pages
                });
            })
            .catch(function (error) {
                res.render('pagemanagementpagelist', {
                        csrfToken: req.csrfToken(),
                        appName: appName,
                        title: title,
                        user: req.user,
                        error: 'Error: ' + error,
                        pages: []
                    }
                );
            }
        );
    }
);

module.exports = router;

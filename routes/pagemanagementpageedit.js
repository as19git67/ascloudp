var express = require('express');
var _ = require('underscore');
var router = express.Router();
var config = require('../config');
var Promise = require('bluebird/js/main/promise')();
var model = require('../model');
var Audit = model.models.Audit;
var Page = model.models.Page;
var passportStrategies = require('../passportStrategies');
var rolePermissions = require('../Roles');

var rp = new rolePermissions(model.models);

var appName = config.get('appName');
var title = "Content Management - Seiten";

router.get('/:pageId', passportStrategies.ensureAuthenticated, rp.middleware(2), function (req, res, next) {
    var pageId = req.params.pageId;
    if (pageId) {
        model.getPagesForUser(req.user).then(function (pages) {
            new Page()
                .query(function (qb) {
                    qb.where('id', pageId);
                })
                .fetch()
                .then(function (page) {
                    var pageObj = {
                        id: page.get('id'),
                        AnonymousAccess: page.get('AnonymousAccess'),
                        Name: page.get('Name'),
                        EntityNameSingular: page.get('EntityNameSingular'),
                        EntityNamePlural: page.get('EntityNamePlural'),
                        View: page.get('View'),
                        isSingleEntity: page.isSingleEntity()
                    };
                    if (pageObj.isSingleEntity) {
                        pageObj.Model = page.get('Model');
                    } else {
                        pageObj.Collection = page.get('Collection');
                    }

                    res.render('pagemanagementpageedit', {
                        csrfToken: req.csrfToken(),
                        bootstrapTheme: config.get('bootstrapStyle'),
                        appName: appName,
                        title: title,
                        user: req.user,
                        pages: pages,
                        pageData: pageObj
                    });
                }).catch(function (error) {
                    var err = new Error(error);
                    err.status = 500;
                    next(err);
                });
        }).catch(function (error) {
                var err = new Error(error);
                err.status = 500;
                next(err);
            }
        );

    }
    else {
        console.log('pageId in request URL missing');
        res.redirect('/admin/pageManagementPageList');
    }
});

module.exports = router;

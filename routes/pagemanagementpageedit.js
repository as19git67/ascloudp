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

var dataTypes = {
    PageContent: 'model',
    Articles: 'collection',
    Contacts: 'collection',
    Events: 'collection',
    Links: 'collection',
    Persons: 'collection'
};

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
                    res.render('pagemanagementpageedit', makeResponseObject(req, pages, page));
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

router.post('/:pageId', passportStrategies.ensureAuthenticated, rp.middleware(2), function (req, res, next) {
        if (req.body.cancel) {
            res.redirect('/admin/pageManagementPageList');
        } else {
            var pageId = req.params.pageId;
            if (pageId) {
                model.getPagesForUser(req.user).then(function (pages) {
                    new Page()
                        .query(function (qb) {
                            qb.where('id', pageId);
                        })
                        .fetch()
                        .then(function (page) {
                            if (page) {
                                model.bookshelf.transaction(function (t) {

                                    if (req.body.save) {
                                        page.set('AnonymousAccess', req.body.AnonymousAccess == 'on');
                                        page.set('EntityNameSingular', req.body.EntityNameSingular);
                                        page.set('EntityNamePlural', req.body.EntityNamePlural);
                                        page.set('View', req.body.View);


                                        if (req.body.Model) {

                                            var dataType = dataTypes[req.body.Model];
                                            if (dataType == 'model') {
                                                page.set('Model', req.body.Model);
                                                page.set('Collection', '');
                                            } else {
                                                page.set('Model', '');
                                                page.set('Collection', req.body.Model);
                                            }


                                            page.save(null, {transacting: t})
                                                .then(function (savedPage) {
                                                    console.log("Page with id= " + pageId + " (" + page.get('Name') + ") updated.");
                                                    t.commit(savedPage);
                                                }).catch(function (error) {
                                                    console.log("ERROR while saving page with id=" + pageId, error);
                                                    t.rollback("Die Seite konnte wegen eines Fehlers nicht gespeichert werden.");
                                                });
                                        } else {
                                            console.log("ERROR while saving page with id=" + pageId + ". Missing Model in post data");
                                            t.rollback("Die Seite konnte wegen eines Fehlers nicht gespeichert werden.");
                                        }
                                    } else {
                                        if (req.body.deletePage) {
                                            page.destroy().then(function () {
                                                console.log("Page with id " + pageId + " was deleted.");
                                                t.commit();
                                            }).catch(function (error) {
                                                console.log("Error while deleting page with id " + pageId + ". Error: " + error);
                                                t.rollback("Die Seite konnte wegen eines Fehlers nicht gelöscht werden.");
                                            });
                                        } else {
                                            console.log("None of the expected form fields were submitted. Do nothing.");
                                            t.rollback();
                                        }
                                    }
                                }).then(function (committedPage) {
                                    // transaction committed
                                    if (committedPage) {
                                        var respObj = makeResponseObject(req, pages, committedPage);
                                        respObj.info = "Die Änderungen wurden gespeichert";
                                        res.render('pagemanagementpageedit', respObj);
                                    } else {
                                        res.redirect('/admin/pageManagementPageList');
                                    }
                                }).catch(function (err) {
                                    if (err) {
                                        // transaction was rolled back
                                        // reload page and inject error
                                        new Page()
                                            .query(function (qb) {
                                                qb.where('id', pageId);
                                            })
                                            .fetch()
                                            .then(function (reloadedPage) {
                                                var respObj = makeResponseObject(req, pages, reloadedPage);
                                                respObj.error = err;
                                                res.render('pagemanagementpageedit', respObj);
                                            })
                                            .catch(function (error) {
                                                var err = new Error(error);
                                                err.status = 500;
                                                next(err);
                                            });

                                    } else {
                                        res.redirect('/admin/pageManagementPageList');
                                    }
                                });
                            }
                            else {
                                var err = new Error("Page with id=" + pageId + " not existing");
                                err.status = 404;
                                next(err);
                            }
                        })
                        .catch(function (error) {
                            var err = new Error(error);
                            err.status = 500;
                            next(err);
                        });
                }).catch(function (error) {
                    var err = new Error(error);
                    err.status = 500;
                    next(err);
                });
            }
            else {
                console.log('pageId in request URL missing');
                res.redirect('/admin/pageManagementPageList');
            }
        }
    }
);

function makeResponseObject(req, pages, page) {
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
        pageObj.Model = page.get('Collection');
    }
    var respObj = {
        csrfToken: req.csrfToken(),
        bootstrapTheme: config.get('bootstrapStyle'),
        appName: appName,
        title: title,
        user: req.user,
        pages: pages,
        pageData: pageObj,
        dataTypes: dataTypes,
        views: ['genericHTML', 'Articles', 'Calendar', 'Contacts', 'Links', 'Members']
    };
    return respObj;
}

module.exports = router;

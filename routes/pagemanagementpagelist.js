var express = require('express');
var _ = require('underscore');
var router = express.Router();
var config = require('../config');
var model = require('../model');
var Promise = require('bluebird/js/main/promise')();

var passportStrategies = require('../passportStrategies');
var rolePermissions = require('../Roles');

var Page = model.models.Page;
var Pages = model.models.Pages;

var rp = new rolePermissions(model.models);
var appName = config.get('appName');
var title = 'Content Management - Seiten';

router.get('/', passportStrategies.ensureAuthenticated, rp.middleware(), function (req, res, next) {

        model.getPages()
            .then(function (pages) {
                if (pages.length > 0) {
                    pages[0].isFirst = true;
                    pages[pages.length - 1].isLast = true;
                }
                res.render('pagemanagementpagelist', {
                    csrfToken: req.csrfToken(),
                    bootstrapTheme: config.get('bootstrapStyle'),
                    appName: appName,
                    title: title,
                    user: req.user,
                    pages: pages
                });
            })
            .catch(function (error) {
                var err = new Error(error);
                err.status = 500;
                next(err);
            });
    }
);

router.post('/', passportStrategies.ensureAuthenticated, rp.middleware(), function (req, res, next) {

    model.getPages()
        .then(function (pages) {

            for (var i = 0; i < pages.length; i++) {
                var page = pages[i];
                var paramName = 'move_down_' + page.Page_id;
                if (req.body[paramName]) {
                    if (i + 1 < pages.length) {
                        var nextPage = pages[i + 1];
                        pages[i + 1] = page;
                        pages[i] = nextPage;
                    }
                    break;
                }
                paramName = 'move_up_' + page.Page_id;
                if (req.body[paramName]) {
                    if (i - 1 >= 0) {
                        var prevPage = pages[i - 1];
                        pages[i - 1] = page;
                        pages[i] = prevPage;
                    }
                    break;
                }
            }

            var maxOrder = 0;
            var minOrder = Number.MAX_VALUE;
            _.each(pages, function (p) {
                if (p.Order > maxOrder) {
                    maxOrder = p.Order;
                }
                if (p.Order < minOrder) {
                    minOrder = p.Order;
                }
            });

            var startIndex = 10;
            if ((pages.length - 1) * 10 + startIndex > minOrder) {
                console.log("Use high order numbers");
                startIndex = maxOrder + 10;
            }
            var pagesById = {};
            for (var j = 0; j < pages.length; j++) {
                pages[j].Order = j * 10 + startIndex;
                pagesById[pages[j].Page_id] = pages[j];
            }

            model.bookshelf.transaction(function (t) {

                var queryPromises = [];
                var savePromises = [];
                for (var ii = 0; ii < pages.length; ii++) {
                    queryPromises.push(new Promise(function (resolve, reject) {
                            new Page()
                                .query(function (qb) {
                                    qb.where('id', pages[ii].Page_id);
                                })
                                .fetch(null, {transacting: t})
                                .then(function (page) {
                                    if (page) {
                                        var newOrder = pagesById[page.id].Order;
                                        page.set('Order', newOrder);
                                        console.log("Set Order=" + newOrder + " of page " + page.id);
                                        savePromises.push(page.save(null, {transacting: t}).catch(function(err) {
                                            console.log("ERROR updating page for reordering", err);
                                        }));  // add promise
                                        resolve();
                                    } else {
                                        reject("Error: page not found");
                                    }
                                })
                                .catch(function (error) {
                                    console.log("ERROR while reading page with id=" + pages[ii].Page_id + " to update order.", error);
                                    reject(error);
                                });
                        })
                    );
                }

                Promise.all(queryPromises)
                    .then(function () {
                        console.log("All pages read for update");

                        console.log("Waiting for " + savePromises.length + " promises");
                        Promise.all(savePromises)
                            .then(function (results) {
                                console.log("All page orders updated");
                                t.commit();
                            }).catch(function (error) {
                                console.log("ERROR while saving page orders", error);
                                t.rollback(error);
                            });

                    })
                    .catch(function (error) {
                        console.log("ERROR while reading pages to update orders", error);
                        t.rollback(error);
                    });

            }).then(function () {
                // transaction was committed
                model.getPages()
                    .then(function (reloadedPages) {
                        if (reloadedPages.length > 0) {
                            reloadedPages[0].isFirst = true;
                            reloadedPages[reloadedPages.length - 1].isLast = true;
                        }
                        res.render('pagemanagementpagelist', {
                            csrfToken: req.csrfToken(),
                            bootstrapTheme: config.get('bootstrapStyle'),
                            appName: appName,
                            title: title,
                            user: req.user,
                            pages: reloadedPages
                        });
                    })
                    .catch(function (error) {
                        var err = new Error(error);
                        err.status = 500;
                        next(err);
                    });

            }).catch(function (error) {
                // transaction was rolled back
                console.log("ERROR saving Pages when changing the order.", error);
                model.getPages()
                    .then(function (reloadedPages) {
                        if (reloadedPages.length > 0) {
                            reloadedPages[0].isFirst = true;
                            reloadedPages[reloadedPages.length - 1].isLast = true;
                        }
                        res.render('pagemanagementpagelist', {
                            csrfToken: req.csrfToken(),
                            bootstrapTheme: config.get('bootstrapStyle'),
                            appName: appName,
                            title: title,
                            user: req.user,
                            pages: reloadedPages,
                            error: "Die Seitenreihenfolge konnte nicht gespeichert werden"
                        });
                    })
                    .catch(function (error) {
                        var err = new Error(error);
                        err.status = 500;
                        next(err);
                    });
            });
        })
        .catch(function (error) {
            var err = new Error(error);
            err.status = 500;
            next(err);
        });
});

module.exports = router;

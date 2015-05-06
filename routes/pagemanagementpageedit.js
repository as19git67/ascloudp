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


// new page
router.post('/', passportStrategies.ensureAuthenticated, rp.middleware(2), function (req, res, next) {
    if (req.body.cancel) {
        res.redirect('/admin/pageManagementPageList');
    } else {
        if (req.body.Name || (req.body.newPageName && req.body.newPageName.trim().length > 0)) {
            model.getPagesForUser(req.user).then(function (pages) {
                model.bookshelf.knex('Pages').max('Order')
                    .then(function (maxOrder) {
                        var order = 10;
                        if (maxOrder && maxOrder.length == 1) {
                            order = maxOrder[0].max + 10;
                        }
                        if (req.body.addNewPage) {
                            // render initial form for new page
                            var newPage = new Page({
                                id: '',
                                Order: order,
                                Name: req.body.newPageName.toLowerCase(), // comes from pageManagementPageList
                                AnonymousAccess: false,
                                EntityNameSingular: '',
                                EntityNamePlural: ''
                            });
                            res.render('pagemanagementpageedit', makeResponseObject(req, pages, newPage));
                        } else {
                            var page = new Page({
                                Name: req.body.Name.toLowerCase(),
                                Order: req.body.Order,
                                AnonymousAccess: req.body.AnonymousAccess == 'on',
                                EntityNameSingular: req.body.EntityNameSingular,
                                EntityNamePlural: req.body.EntityNamePlural,
                                View: req.body.View
                            });
                            model.bookshelf.transaction(function (t) {
                                if (req.body.save) {
                                    if (req.body.Model) {

                                        var dataType = dataTypes[req.body.Model];
                                        if (dataType == 'model') {
                                            page.set('Model', req.body.Model);
                                            page.set('Collection', null);
                                        } else {
                                            page.set('Model', null);
                                            page.set('Collection', req.body.Model);
                                        }
                                        page.save(null, {transacting: t})
                                            .then(function (savedPage) {
                                                var changeText = "Page with id= " + page.get('id') + " (" + page.get('Name') + ") added.";
                                                console.log(changeText);
                                                new Audit({
                                                    ChangedAt: new Date(),
                                                    Table: 'Pages',
                                                    ChangedBy: req.user.UserName,
                                                    Description: changeText
                                                }).save()
                                                    .then(function () {
                                                        // todo search roles with right to pagemanagementedit - post and add permission for the new page to this roles
                                                        t.commit(savedPage);
                                                    })
                                                    .catch(function (error) {
                                                        console.log("ERROR while saving audit when adding page with id= " + page.get('id') + " (" + page.get('Name'), error);
                                                        t.rollback("Die Seite konnte wegen eines Fehlers nicht gespeichert werden.");
                                                    });
                                            }).catch(function (error) {
                                                console.log("ERROR while saving new page with Name=" + page.get('Name'), error);
                                                t.rollback("Die Seite konnte wegen eines Fehlers nicht gespeichert werden.");
                                            });
                                    } else {
                                        console.log("ERROR while saving new page with Name=" + page.get('Name') + ". Missing Model in post data");
                                        t.rollback("Die Seite konnte wegen eines Fehlers nicht gespeichert werden.");
                                    }
                                } else {
                                    console.log("ERROR while saving new page with Name=" + page.get('Name') + ". Missing action (save, cancel, ...) in post data");
                                    t.rollback("Die Seite konnte wegen eines Fehlers nicht gespeichert werden.");
                                }
                            }).then(function (committedPage) {
                                // transaction committed
                                res.redirect('/admin/pageManagementPageList');
                            }).catch(function (err) {
                                if (err) {
                                    // transaction was rolled back
                                    page.set('id', '');
                                    var respObj = makeResponseObject(req, pages, page);
                                    respObj.error = err;
                                    res.render('pagemanagementpageedit', respObj);
                                } else {
                                    res.redirect('/admin/pageManagementPageList');
                                }
                            });
                        }
                    })
                    .catch(function (err) {
                        var err = new Error(error);
                        err.status = 500;
                        next(err);
                    });
            }).catch(function (error) {
                var err = new Error(error);
                err.status = 500;
                next(err);
            });
        } else {
            res.redirect('/admin/pageManagementPageList');
        }
    }
});

function deletePageContentForPage(transaction, pageName, pageId) {
    return new Promise(function (resolve, reject) {
        model.bookshelf.knex('PageContents')
            .transacting(transaction)
            .where('Page_id', pageName)
            .del()
            .then(function (cntDeleted) {
                console.log(cntDeleted + " PageContents for page " + pageName + " were deleted.");
                model.bookshelf.knex('Pages')
                    .transacting(transaction)
                    .where('id', pageId)
                    .del()
                    .then(function () {
                        console.log("Page with id " + pageId + " (" + pageName + ") was deleted.");
                        resolve();
                    }).catch(function (error) {
                        console.log("Error while deleting page with id " + pageId + ". Error: " + error);
                        reject("Die Seite konnte wegen eines Fehlers nicht gelöscht werden.");
                    });
            })
            .catch(function (err) {
                console.log("Error while deleting PageContent for Page_id=" + pageId + ". Error: " + error);
                reject("Die Seite konnte wegen eines Fehlers nicht gelöscht werden.");
            });
    });
}

function deleteLinksForPage(t, pageName) {
    return new Promise(function (resolve, reject) {
        model.bookshelf.knex('LinkItems')
            .transacting(t)
            .whereIn('Link_id', function () {
                this.select('id')
                    .transacting(t)
                    .from('Links')
                    .where('Page_id', pageName);
            })
            .del()
            .then(function (cntLinkItemsDeleted) {
                model.bookshelf.knex('Links')
                    .transacting(t)
                    .where('Page_id', pageName)
                    .del()
                    .then(function (cntLinksDeleted) {
                        resolve();
                    })
                    .catch(function (error) {
                        console.log("Error while deleting Links for Page=" + pageName + ". Error: " + error);
                        reject("Die Seite konnte wegen eines Fehlers nicht gelöscht werden.");
                    });
            })
            .catch(function (error) {
                console.log("Error while deleting LinkItems for Page=" + pageName + ". Error: " + error);
                reject("Die Seite konnte wegen eines Fehlers nicht gelöscht werden.");
            });
    });
}

function deleteEventsForPage(t, pageName) {
    return new Promise(function (resolve, reject) {
        model.bookshelf.knex('EventItems')
            .transacting(t)
            .whereIn('Event_id', function () {
                this.select('id')
                    .transacting(t)
                    .from('Events')
                    .where('Page_id', pageName);
            })
            .del()
            .then(function (cntLinkItemsDeleted) {
                model.bookshelf.knex('Events')
                    .transacting(t)
                    .where('Page_id', pageName)
                    .del()
                    .then(function (cntLinksDeleted) {
                        resolve();
                    })
                    .catch(function (error) {
                        console.log("Error while deleting Events for Page=" + pageName + ". Error: " + error);
                        reject("Die Seite konnte wegen eines Fehlers nicht gelöscht werden.");
                    });
            })
            .catch(function (error) {
                console.log("Error while deleting EventItems for Page=" + pageName + ". Error: " + error);
                reject("Die Seite konnte wegen eines Fehlers nicht gelöscht werden.");
            });
    });
}

function deleteArticlesForPage(t, pageName) {
    return new Promise(function (resolve, reject) {
        model.bookshelf.knex('ArticleImages')
            .transacting(t)
            .whereIn('Article_id', function () {
                this.select('id')
                    .transacting(t)
                    .from('Articles')
                    .where('Page_id', pageName);
            })
            .del()
            .then(function (cntArticleImagesDeleted) {
                model.bookshelf.knex('ArticleItems')
                    .transacting(t)
                    .whereIn('Article_id', function () {
                        this.select('id')
                            .transacting(t)
                            .from('Articles')
                            .where('Page_id', pageName);
                    })
                    .del()
                    .then(function (cntArticleItemsDeleted) {
                        model.bookshelf.knex('Articles')
                            .transacting(t)
                            .where('Page_id', pageName)
                            .del()
                            .then(function (cntArticlesDeleted) {
                                resolve();
                            })
                            .catch(function (error) {
                                console.log("Error while deleting Articles for Page=" + pageName + ". Error: " + error);
                                reject("Die Seite konnte wegen eines Fehlers nicht gelöscht werden.");
                            });
                    })
                    .catch(function (error) {
                        console.log("Error while deleting ArticleItems for Page=" + pageName + ". Error: " + error);
                        reject("Die Seite konnte wegen eines Fehlers nicht gelöscht werden.");
                    });
            })
            .catch(function (error) {
                console.log("Error while deleting ArticleImages for Page=" + pageName + ". Error: " + error);
                reject("Die Seite konnte wegen eines Fehlers nicht gelöscht werden.");
            });
    });
}

function deleteContactsForPage(t, pageName) {
    return new Promise(function (resolve, reject) {
        model.bookshelf.knex('ContactItems')
            .transacting(t)
            .whereIn('Contact_id', function () {
                this.select('id')
                    .transacting(t)
                    .from('Contacts')
                    .where('Page_id', pageName);
            })
            .del()
            .then(function (cntContactItemsDeleted) {
                model.bookshelf.knex('Contacts')
                    .transacting(t)
                    .where('Page_id', pageName)
                    .del()
                    .then(function (cntContactsDeleted) {
                        resolve();
                    })
                    .catch(function (error) {
                        console.log("Error while deleting Contacts for Page=" + pageName + ". Error: " + error);
                        reject("Die Seite konnte wegen eines Fehlers nicht gelöscht werden.");
                    });
            })
            .catch(function (error) {
                console.log("Error while deleting ContacttItems for Page=" + pageName + ". Error: " + error);
                reject("Die Seite konnte wegen eines Fehlers nicht gelöscht werden.");
            });
    });
}

function deletePermissionsForPage(t, pageName) {
    return new Promise(function (resolve, reject) {
        model.bookshelf.knex('RoleMenus')
            .transacting(t)
            .where('Menu', pageName)
            .del()
            .then(function (cntMenuItemsDeleted) {
                model.bookshelf.knex('RolePermissions')
                    .transacting(t)
                    .where('Resource', '/' + pageName)
                    .del()
                    .then(function (cntResourcePermissionsDeleted) {
                        resolve();
                    })
                    .catch(function (error) {
                        console.log("Error while deleting RolePermissions for Page=" + pageName + ". Error: " + error);
                        reject("Die Seite konnte wegen eines Fehlers nicht gelöscht werden.");
                    });
            })
            .catch(function (error) {
                console.log("Error while deleting RoleMenus for Page=" + pageName + ". Error: " + error);
                reject("Die Seite konnte wegen eines Fehlers nicht gelöscht werden.");
            });
    });
}

// edit page
router.post('/:pageId', passportStrategies.ensureAuthenticated, rp.middleware(2), function (req, res, next) {
        if (req.body.cancel) {
            res.redirect('/admin/pageManagementPageList');
        } else {
            model.getPagesForUser(req.user).then(function (pages) {
                if (req.body.addNewPage) {
                    var newPage = Page({
                        Name: req.body.newPageName, // comes from pageManagementPageList
                        AnonymousAccess: false
                    });
                    res.render('pagemanagementpageedit', makeResponseObject(req, pages, newPage));
                } else {
                    var pageId = req.params.pageId;
                    if (pageId) {
                        new Page()
                            .query(function (qb) {
                                qb.where('id', pageId);
                            })
                            .fetch()
                            .then(function (page) {
                                if (page) {
                                    model.bookshelf.transaction(function (t) {

                                        if (req.body.save) {
                                            var changeInfo = "";
                                            if (page.get('AnonymousAccess') != req.body.AnonymousAccess == 'on') {
                                                changeInfo += 'AnonymousAccess changed from ' + page.get('AnonymousAccess') + ' to ' + req.body.AnonymousAccess == 'on';
                                            }
                                            page.set('AnonymousAccess', req.body.AnonymousAccess == 'on');

                                            if (page.get('EntityNameSingular') != req.body.EntityNameSingular) {
                                                if (changeInfo.length > 0) {
                                                    changeInfo += ", ";
                                                }
                                                changeInfo += 'EntityNameSingular changed from ' + page.get('EntityNameSingular') + ' to ' + req.body.EntityNameSingular;
                                            }
                                            page.set('EntityNameSingular', req.body.EntityNameSingular);

                                            if (page.get('EntityNamePlural') != req.body.EntityNamePlural) {
                                                if (changeInfo.length > 0) {
                                                    changeInfo += ", ";
                                                }
                                                changeInfo += 'EntityNamePlural changed from ' + page.get('EntityNamePlural') + ' to ' + req.body.EntityNamePlural;
                                            }
                                            page.set('EntityNamePlural', req.body.EntityNamePlural);

                                            if (page.get('View') != req.body.View) {
                                                if (changeInfo.length > 0) {
                                                    changeInfo += ", ";
                                                }
                                                changeInfo += 'View changed from ' + page.get('View') + ' to ' + req.body.View;
                                            }
                                            page.set('View', req.body.View);

                                            if (req.body.Model) {

                                                var dataType = dataTypes[req.body.Model];
                                                if (dataType == 'model') {
                                                    if (page.get('Model') != req.body.Model) {
                                                        if (changeInfo.length > 0) {
                                                            changeInfo += ", ";
                                                        }
                                                        changeInfo += 'Model changed from ' + page.get('Model') + ' to ' + req.body.Model;
                                                    }
                                                    page.set('Model', req.body.Model);
                                                    page.set('Collection', null);
                                                } else {
                                                    if (page.get('Collection') != req.body.Model) {
                                                        if (changeInfo.length > 0) {
                                                            changeInfo += ", ";
                                                        }
                                                        changeInfo += 'Collection changed from ' + page.get('Collection') + ' to ' + req.body.Model;
                                                    }
                                                    page.set('Model', null);
                                                    page.set('Collection', req.body.Model);
                                                }

                                                page.save(null, {transacting: t})
                                                    .then(function (savedPage) {
                                                        var changeText = "Page (" + page.get('id') + ", " + page.get('Name') + "): " + changeInfo;
                                                        console.log(changeText);
                                                        new Audit({
                                                            ChangedAt: new Date(),
                                                            Table: 'Pages',
                                                            ChangedBy: req.user.UserName,
                                                            Description: changeText
                                                        }).save()
                                                            .then(function () {
                                                                t.commit(savedPage);
                                                            })
                                                            .catch(function (error) {
                                                                console.log("ERROR while saving audit when saving page with id= " + page.get('id') + " (" + page.get('Name'), error);
                                                                t.rollback("Die Seite konnte wegen eines Fehlers nicht gespeichert werden.");
                                                            });
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
                                                var pageName = page.get('Name');
                                                console.log('Deleting page ' + pageName);
                                                deleteLinksForPage(t, pageName).then(function () {
                                                    deleteArticlesForPage(t, pageName).then(function () {
                                                        deleteEventsForPage(t, pageName).then(function () {
                                                            deleteContactsForPage(t, pageName).then(function () {
                                                                deletePageContentForPage(t, pageName, pageId).then(function () {
                                                                    deletePermissionsForPage(t, pageName)
                                                                        .then(function () {
                                                                            t.commit();
                                                                        })
                                                                        .catch(function (error) {
                                                                            t.rollback(error);
                                                                        })
                                                                }).catch(function (error) {
                                                                    t.rollback(error);
                                                                })
                                                            }).catch(function (error) {
                                                                t.rollback(error);
                                                            })
                                                        }).catch(function (error) {
                                                            t.rollback(error);
                                                        })
                                                    }).catch(function (error) {
                                                        t.rollback(error);
                                                    })
                                                }).catch(function (error) {
                                                    t.rollback(error);
                                                })
                                            } else {
                                                console.log("None of the expected form fields were submitted. Do nothing.");
                                                t.rollback();
                                            }
                                        }
                                    }).then(function () {
                                        // transaction committed
                                        if (req.body.deletePage) {
                                            res.redirect('/admin/pageManagementPageList');
                                        } else {
                                            var respObj = makeResponseObject(req, pages, page);
                                            respObj.info = "Die Änderungen wurden gespeichert";
                                            res.render('pagemanagementpageedit', respObj);
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
                    }
                    else {
                        console.log('pageId in request URL missing');
                        res.redirect('/admin/pageManagementPageList');
                    }
                }
            }).catch(function (error) {
                var err = new Error(error);
                err.status = 500;
                next(err);
            });
        }
    }
);

function makeResponseObject(req, pages, page) {
    var pageObj = {
        id: page.get('id'),
        Order: page.get('Order'),
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

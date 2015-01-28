var _ = require('underscore');
var Promise = require('bluebird/js/main/promise')();
var model = require('../../../model');
var moment = require('moment');
var Article = model.models.Article;
var ArticleItem = model.models.ArticleItem;
var Audit = model.models.Audit;

var knex = model.bookshelf.knex;

function respondWithArticleItemData(req, res, articleItem) {
    getArticleItemSchema().then(function (article_schema) {

        var csrfToken = req.csrfToken();
        res.cookie('X-CSRF-Token', csrfToken); // for angularjs use a cookie instead a header parameter
        res.json(
            {
                article: {
                    article_id: articleItem.get('Article_id'),
                    date: articleItem.get('Date'),
                    text: articleItem.get('Text'),
                    author: articleItem.get('Author'),
                    publish_start: articleItem.get('publish_start'),
                    publish_end: articleItem.get('publish_end')
                },
                article_schema: article_schema
            }
        );
    }).catch(function (error) {
        console.log("Error while reading columnInfo for ArticleItem from database: " + error);
        res.statusCode = 500;
        return res.send('Error 500: reading schema info for articles from database failed');
    });
}

module.exports.get = function (req, res) {
    if (req.query && req.query.type && req.query.type == "schema") {
        getArticleItemSchema().then(function (article_schema) {
            var csrfToken = req.csrfToken();
            res.cookie('X-CSRF-Token', csrfToken); // for angularjs use a cookie instead a header parameter
            res.json(
                {
                    article_schema: article_schema
                }
            );
        }).catch(function (error) {
            console.log("Error while reading columnInfo for ArticleItem from database: " + error);
            res.statusCode = 500;
            return res.send('Error 500: reading schema info for articles from database failed');
        });
    } else {
        var articleId = req.params.id;
        var whereClause = {Article_id: articleId};
        var includeDeleted = false;
        if (req.query && req.query.include && req.query.include.indexOf("deleted") >= -1) {
            includeDeleted = true;
        }
        if (includeDeleted == false) {
            whereClause.valid_end = null;
        }

        new ArticleItem(whereClause).fetch().then(function (articleItem) {
            if (articleItem) {
                respondWithArticleItemData(req, res, articleItem);
            } else {
                res.statusCode = 404;
                res.send('Error 404: ArticleItem with Article_id ' + articleId + ' not found');
            }

        }).catch(function (error) {
            console.log("Error while reading articles from database: " + error);
            res.statusCode = 500;
            return res.send('Error 500: reading of articles from database failed');
        });
    }
};
module.exports.getImage = function (req, res) {
    var articleId = req.params.id;

    if (req.query && req.query.flowChunkNumber) {
        // get requests from flow.js (if testChunks is true)
        var flowChunkNumber = req.query.flowChunkNumber;
        var flowIdentifier = req.query.flowIdentifier;
        console.log("Flow asks for chunk id " + flowChunkNumber + " of file id " + flowIdentifier + " for article with id " + articleId);
        res.statusCode = 200; // OK
        res.send('200 OK');
    } else {
        res.statusCode = 500;
        res.send('500 Wrong query parameter');
    }
};

function getArticleItemSchema() {
    return new Promise(function (resolve, reject) {
        var tableName = new ArticleItem().tableName;
        knex(tableName).columnInfo()
            .then(function (articleItemSchema) {
                var article_schema = {
                    date: _.extend(articleItemSchema['Date'], {name: "date", label: "Datum", description: "Artikeldatum"}),
                    text: _.extend(articleItemSchema['Text'], {
                        label: "Artikeltext",
                        description: "Text des Artikels"
                    }),
                    author: _.extend(articleItemSchema['Author'], {
                        label: "Verfasser",
                        description: "Autor des Artikels"
                    }),
                    publish_start: _.extend(articleItemSchema['publish_start'], {
                        label: "Start Veröffentlichung",
                        description: "Beginn der Veröffentlichung des Artikels"
                    }),
                    publish_end: _.extend(articleItemSchema['publish_end'], {
                        label: "Ende Veröffentlichung",
                        description: "Ende der Veröffentlichung des Artikels"
                    })
                };
                resolve(article_schema);
            })
            .catch(function (error) {
                reject(error);
            });

    });
}

function isDateDifferent(articleItem, dbTableColumn, reqBody, sentDateName) {
    var pModelDate;
    var mSentDate;

    if (articleItem.get(dbTableColumn)) {
        pModelDate = moment(articleItem.get(dbTableColumn));
        if (pModelDate.isValid() == false) {
            pModelDate = undefined;
        }
    }
    if (reqBody[sentDateName]) {
        mSentDate = moment(reqBody[sentDateName]);
        if (mSentDate.isValid() == false) {
            mSentDate = undefined;
        }
    }
    if (pModelDate && mSentDate) {
        return pModelDate.isSame(mSentDate) == false;
    }
    return !(pModelDate == undefined && mSentDate == undefined);
}


// edit article
module.exports.put = function (req, res) {
    var articleId = req.params.id;


    new ArticleItem({Article_id: articleId, valid_end: null}).fetch().then(function (articleItem) {
        if (articleItem) {
            var articleDateIsDifferent = isDateDifferent(articleItem, "Date", req.body, "date");
            if (!articleDateIsDifferent) {
                var publishStartIsDifferent = isDateDifferent(articleItem, "publish_start", req.body, "publish_start");
                if (!publishStartIsDifferent) {
                    var publishEndIsDifferent = isDateDifferent(articleItem, "publish_end", req.body, "publish_end");
                    if (!publishEndIsDifferent) {
                        var authorIsDifferent = articleItem.get('Author') != req.body.author;
                        if (!authorIsDifferent) {
                            var textIsDifferent = articleItem.get('Text') != req.body.text;
                            if (!textIsDifferent) {
                                // until here, nothing has changed
                                console.log("Not saving ArticleItem because nothing changed.");
                                res.statusCode = 304;   // not changed
                                res.send("304: Article not changed");
                                return;
                            }
                        }
                    }
                }
            }

            // start a transaction because articleItem and audit are updated
            model.bookshelf.transaction(function (t) {
                var now = new Date();

                // invalidate current articleItem record
                articleItem.set('valid_end', now);
                articleItem.save(null, {transacting: t}).then(function () {

                    // create new ArticleItem
                    new ArticleItem({
                        Article_id: articleId,
                        Date: req.body.date,
                        Author: req.body.author,
                        Text: req.body.text,
                        publish_start: req.body.publish_start,
                        publish_end: req.body.publish_end,
                        valid_start: now
                    }).save(null, {transacting: t}).then(function (savedArticleItem) {
                            var userName = req.user.UserName ? req.user.UserName : req.user.id;
                            new Audit({
                                    ChangedAt: new Date(),
                                    Table: savedArticleItem.tableName,
                                    ChangedBy: userName,
                                    Description: "ArticleItem changed by user " + userName + ". Id of new item in ArticleItem is " + savedArticleItem.id
                                }
                            ).save().then(function () {
                                    t.commit(savedArticleItem);
                                }).catch(function (error) {
                                    console.log("Error while saving Audit for new ArticleItem to database:", error);
                                    console.log("Roll back transaction");
                                    t.rollback({
                                        statusCode: 500,
                                        message: 'Error 500: saving of article to database failed'
                                    });
                                });
                        }).catch(function (error) {
                            console.log("Error while saving new ArticleItem to database:", error);
                            console.log("Roll back transaction");
                            t.rollback({statusCode: 500, message: 'Error 500: saving of article to database failed'});
                        });
                }).catch(function (error) {
                    console.log("Error while updating ArticleItem in database:", error);
                    console.log("Roll back transaction");
                    t.rollback({statusCode: 500, message: 'Error 500: saving of article to database failed'});
                });
            }).then(function (savedItem) {
                console.log("Transaction (saving ArticleItem) committed");
                if (savedItem) {
                    // return put data again back to caller
                    respondWithArticleItemData(req, res, savedItem);
                } else {
                    res.statusCode = 304;   // not changed
                    res.send("304: Article information not changed");
                }
            }).catch(function (error) {
                console.log("Transaction (saving ArticleItem) rolled back");
                res.statusCode = error.statusCode;
                res.send(error.message);
            });

        } else {
            console.log("Article with id " + articleId + " not found. Rolling back transaction");
            t.rollback({statusCode: 404, message: 'Error 404: ArticleItem with id ' + articleId + ' not found'});
        }
    }).catch(function (error) {
        console.log("Error while reading article from database:", error);
        console.log("Roll back transaction");
        t.rollback({statusCode: 500, message: 'Error 500: reading of article from database failed'});
    });
};

// create new article
module.exports.post = function (req, res) {
    model.bookshelf.transaction(function (t) {

        var now = new Date();

        new Article({
            Page_id: req.body.pageid
        }).save(null, {transacting: t}).then(function (newArticle) {
                // create new ArticleItem
                new ArticleItem({
                    Article_id: newArticle.get('id'),
                    Date: req.body.date,
                    Author: req.body.author,
                    Text: req.body.text,
                    publish_start: req.body.publish_start,
                    publish_end: req.body.publish_end,
                    valid_start: now
                }).save(null, {transacting: t}).then(function (savedArticleItem) {
                        var userName = req.user.UserName ? req.user.UserName : req.user.id;
                        new Audit({
                                ChangedAt: new Date(),
                                Table: savedArticleItem.tableName,
                                ChangedBy: userName,
                                Description: "New Article created for page " + req.body.pageid + " by user " + userName + ". Id of new item in ArticleItem is " + savedArticleItem.id
                            }
                        ).save().then(function () {
                                t.commit(savedArticleItem);
                            }).catch(function (error) {
                                console.log("Error while saving Audit for new ArticleItem to database:", error);
                                console.log("Roll back transaction");
                                t.rollback({
                                    statusCode: 500,
                                    message: 'Error 500: saving of article to database failed'
                                });
                            });
                    }).catch(function (error) {
                        console.log("Error while saving new ArticleItem to database:", error);
                        console.log("Roll back transaction");
                        t.rollback({statusCode: 500, message: 'Error 500: saving of article to database failed'});
                    });
            }).catch(function (error) {
                console.log("Error while saving new Article to database:", error);
                console.log("Roll back transaction");
                t.rollback({statusCode: 500, message: 'Error 500: saving of article to database failed'});
            });

    }).then(function (savedItem) {
        console.log("Transaction (saving ArticleItem) committed");
        if (savedItem) {
            // return put data again back to caller
            respondWithArticleItemData(req, res, savedItem);
        } else {
            res.statusCode = 304;   // not changed
            res.send("304: Article information not changed");
        }
    }).catch(function (error) {
        console.log("Transaction (saving ArticleItem) rolled back");
        res.statusCode = error.statusCode;
        res.send(error.message);
    });

};

// delete article -> set valid_end to now
module.exports.delete = function (req, res) {
    var articleId = req.params.id;


    new ArticleItem({Article_id: articleId, valid_end: null}).fetch().then(function (articleItem) {
        if (articleItem) {

            // start a transaction because articleItem and audit are updated
            model.bookshelf.transaction(function (t) {
                var now = new Date();

                // invalidate current ArticleItem record
                articleItem.set('valid_end', now);
                articleItem.save(null, {transacting: t}).then(function (savedArticleItem) {

                    var userName = req.user.UserName ? req.user.UserName : req.user.id;
                    new Audit({
                            ChangedAt: new Date(),
                            Table: new ArticleItem().tableName,
                            ChangedBy: userName,
                            Description: "ArticleItem deleted by user " + userName + ". Id of deleted item in ArticleItem is " + savedArticleItem.id
                        }
                    ).save().then(function () {
                            t.commit(savedArticleItem);
                        }).catch(function (error) {
                            console.log("Error while saving Audit for new ArticleItem to database:", error);
                            console.log("Roll back transaction");
                            t.rollback({
                                statusCode: 500,
                                message: 'Error 500: deleting of article in database failed'
                            });
                        });
                }).catch(function (error) {
                    console.log("Error while updating ArticleItem in database:", error);
                    console.log("Roll back transaction");
                    t.rollback({statusCode: 500, message: 'Error 500: deleting of article in database failed'});
                });
            }).then(function (savedItem) {
                console.log("Transaction (saving ArticleItem) committed");
                res.statusCode = 204;   // HTTP 204 No Content: The server successfully processed the request, but is not returning any content
                res.send("204: Article deleted");
            }).catch(function (error) {
                console.log("Transaction (deleting (update) ArticleItem) rolled back");
                res.statusCode = error.statusCode;
                res.send(error.message);
            });

        } else {
            console.log("Article with id " + articleId + " not found. Rolling back transaction");
            t.rollback({statusCode: 404, message: 'Error 404: ArticleItem with id ' + articleId + ' not found'});
        }
    }).catch(function (error) {
        console.log("Error while reading article from database:", error);
        console.log("Roll back transaction");
        t.rollback({statusCode: 500, message: 'Error 500: reading of article from database failed'});
    });
};

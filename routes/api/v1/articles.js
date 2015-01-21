var _ = require('underscore');
var Promise = require('bluebird/js/main/promise')();
var model = require('../../../model');
var moment = require('moment');
var Article = model.models.Article;
var ArticleItem = model.models.ArticleItem;
var ArticleSectionItem = model.models.ArticleSectionItem;
var Audit = model.models.Audit;

var knex = model.bookshelf.knex;


module.exports.get = function (req, res) {
    var articleId = req.params.id;

    new ArticleItem({Article_id: articleId, valid_end: null}).fetch().then(function (articleItem) {
        if (articleItem) {
            knex(articleItem.tableName).columnInfo().then(function (articleItemSchema) {

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
                        article_schema: {
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
                        }
                    }
                );
            });
        } else {
            res.statusCode = 404;
            res.send('Error 404: ArticleItem with Article_id ' + articleId + ' not found');
        }

    }).catch(function (error) {
        console.log("Error while reading articles from database: " + error);
        res.statusCode = 500;
        return res.send('Error 500: reading of articles from database failed');
    });
};

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

                // invalidate current eventItem record
                var now = new Date();
                articleItem.set('valid_end', now);
                articleItem.save(null, {transacting: t}).then(function () {

                    // create new eventItem
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
                    module.exports.get(req, res);
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
            console.log("Event with id " + eventId + " not found. Rolling back transaction");
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

};


var _ = require('underscore');
var Promise = require('bluebird/js/main/promise')();
var model = require('../../../model');
var moment = require('moment');
var Article = model.models.Article;
var ArticleItem = model.models.ArticleItem;
var Audit = model.models.Audit;


module.exports.get = function (req, res) {
    var articleId = req.params.id;

    new ArticleItem({ Article_id: articleId, valid_end: null }).fetch().then(function (articleItem) {
        if (articleItem) {
            res.setHeader('X-CSRF-Token', req.csrfToken());
            res.json(
                {
                    article_id: articleItem.get('Article_id'),
                    date: articleItem.get('Date'),
                    title: articleItem.get('Title'),
                    subtitle: articleItem.get('Subtitle'),
                    author: articleItem.get('Author'),
                    publish_start: articleItem.get('publish_start'),
                    publish_end: articleItem.get('publish_end')
                }
            );
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

// edit article
module.exports.put = function (req, res) {
    var articleId = req.params.id;

    model.bookshelf.transaction(function (t) {

        new ArticleItem({ Article_id: articleId, valid_end: null }).fetch().then(function (articleItem) {
            if (articleItem) {
                // invalidate current eventItem record
                var now = new Date();
                articleItem.set('valid_end', now);
                articleItem.save(null, { transacting: t }).then(function () {

                    // create new eventItem
                    new ArticleItem({
                        Article_id: articleId,
                        Date: req.body.date,
                        Title: req.body.title,
                        Subtitle: req.body.subtitle,
                        Author: req.body.author,
                        publish_start: req.body.publish_start,
                        publish_end: req.body.publish_end,
                        valid_start: now
                    }).save(null, { transacting: t }).then(function (savedArticleItem) {
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
                                    t.rollback({ statusCode: 500, message: 'Error 500: saving of article to database failed' });
                                });
                        }).catch(function (error) {
                            console.log("Error while saving new ArticleItem to database:", error);
                            console.log("Roll back transaction");
                            t.rollback({ statusCode: 500, message: 'Error 500: saving of article to database failed' });
                        });
                }).catch(function (error) {
                    console.log("Error while updating ArticleItem in database:", error);
                    console.log("Roll back transaction");
                    t.rollback({ statusCode: 500, message: 'Error 500: saving of article to database failed' });
                });
            } else {
                console.log("Event with id " + eventId + " not found. Rolling back transaction");
                t.rollback({ statusCode: 404, message: 'Error 404: ArticleItem with id ' + articleId + ' not found' });
            }

        }).catch(function (error) {
            console.log("Error while reading article from database:", error);
            console.log("Roll back transaction");
            t.rollback({ statusCode: 500, message: 'Error 500: reading of article from database failed' });
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
};

// create new article
module.exports.post = function (req, res) {

};


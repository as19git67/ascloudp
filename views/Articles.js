var _ = require('underscore');
var Promise = require('bluebird/js/main/promise')();
var config = require('../config');
var model = require('../model');
var moment = require('moment');
var rho = require('rho');
var ArticleItem = model.models.ArticleItem;

var appName = config.get('appName');

module.exports.render = function (req, res, next, page, pages, canEdit, collectionModelClass) {
    var now = new Date();
    var nowMoment = new moment(now);

    new ArticleItem().query(function (qb) {
        qb.innerJoin('Articles', 'Articles.id', 'ArticleItems.Article_id');
        if (canEdit) {
            // in case user can edit, include currently not published articles
                qb.where({'Page_id': page.Name, 'valid_end': null});
        } else {
            qb.where({'Page_id': page.Name, 'valid_end': null})
                .andWhere('publish_start', '<=', now)
                .andWhere('publish_end', '>=', now);
        }
        qb.orderBy('publish_start', 'DESC');
    }).fetchAll().then(function (dataCollection) {
        var records = [];
        _.each(dataCollection.models, function (articleItem) {
            var notPublished = false;
            if (nowMoment.isBefore(articleItem.get('publish_start')) || nowMoment.isAfter(articleItem.get('publish_end'))) {
                notPublished = true;
            }
            var article = {};
            var text = articleItem.get('Text');
            article.article_id = articleItem.get('Article_id');
            article.rawHtml = rho.toHtml(text);
            article.author = articleItem.get('Author');
            article.date_formatted = moment(articleItem.get('Date')).format('dddd, D. MMMM YYYY');
            article.publish_start_formatted = moment(articleItem.get('publish_start')).format('dddd, D. MMMM YYYY');
            article.publish_end_formatted = moment(articleItem.get('publish_end')).format('dddd, D. MMMM YYYY');
            article.notPublished = notPublished;
            records.push(article);
        });

        res.render(page.View, {
            csrfToken: req.csrfToken(),
            bootstrapTheme: config.get('bootstrapStyle'),
            canEdit: canEdit,
            appName: appName,
            title: page.EntityNamePlural,
            user: req.user,
            pages: pages,
            page: page,
            Records: records
        });
    }).catch(function (error) {
        console.log("Error while retrieving ArticleItems from the database: " + error);
        var err = new Error(error);
        err.status = 500;
        next(err);
    });
};

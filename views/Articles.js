var _ = require('underscore');
var Promise = require('bluebird/js/main/promise')();
var config = require('../config');
var model = require('../model');
var moment = require('moment');
var rho = require('rho');
var ArticleItem = model.models.ArticleItem;
var ArticleSectionItem = model.models.ArticleSectionItem;
var ArticleReferenceItem = model.models.ArticleReferenceItem;

var appName = config.get('appName');

module.exports.render = function (req, res, next, page, pages, canEdit, collectionModelClass) {
    var now = new Date();

    new ArticleItem().query(function (qb) {
        qb.innerJoin('Articles', 'Articles.id', 'ArticleItems.Article_id');
        qb.where({'Page_id': page.Name, 'valid_end': null})
            .andWhere('publish_start', '<=', now)
            .andWhere('publish_end', '>=', now);
        qb.orderBy('publish_start', 'DESC');
    }).fetchAll().then(function (dataCollection) {
        var records = [];
        _.each(dataCollection.models, function (articleItem) {
            var article = {};
            var text = articleItem.get('Text');
            article.rawHtml = rho.toHtml(text);
            article.author = articleItem.get('Author');
            article.date_formatted = moment(articleItem.get('Date')).format('dddd, D. MMMM YYYY');
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

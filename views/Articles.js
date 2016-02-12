var _ = require('underscore');
var Promise = require('bluebird/js/release/promise')();
var config = require('../config');
var model = require('../model');
var moment = require('moment');
var md = require('markdown-it')();
var ArticleItem = model.models.ArticleItem;

var appName = config.get('appName');

module.exports.render = function (req, res, next, page, pages, canEdit, collectionModelClass) {
    var now = new Date();
    var nowMoment = new moment(now);

    var newMode = req.query.new !== undefined;

    if (newMode && canEdit) {
        res.render(page.View + "Edit", {
            csrfToken: req.csrfToken(),
            bootstrapTheme: config.get('bootstrapStyle'),
            canEdit: canEdit,
            pages: pages,
            appName: appName,
            user: req.user,
            page: page
        });
    } else {
        // select all articles

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
                records.push(getArticleData(nowMoment, articleItem));
            });

            page.socialShareEnabled = true; // todo: get from page settings
            page.socialShareEnabledInList = false;

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
    }
};

function getArticleData(nowMoment, articleItem) {
    var notPublished = false;
    if (nowMoment.isBefore(articleItem.get('publish_start')) || nowMoment.isAfter(articleItem.get('publish_end'))) {
        notPublished = true;
    }
    var article = {};
    var text = articleItem.get('Text');

    var expectedMatches = 2;
    var re = /.*\!\[(.*)\]\((.*)\).*/;
    var ma = re.exec(text);
    if (!ma) {
        expectedMatches = 1;
        re = /.*\!\((.*)\).*/;
        ma = re.exec(text);
    }
    // Erstes gefundene Bild als image setzen
    if (!
            article.image) {
        if (ma &&
            ma.length > expectedMatches) {
            article.imageAlt =
                expectedMatches - 1;
            article.image = ma[expectedMatches];
        }
    }

    // add image-responsive class to image tags

    var rawHtml = "";
    if (text && text.length > 0) {
        md.renderer.rules.table_open = function () {
            return '<table class="table">';
        };
        rawHtml = md.render(text);
    }
    // add class attribute to all image tags to apply bootstrap styles
    rawHtml = rawHtml.replace(/<img\s*src=/g,
        "<img class=\"img-responsive\" src=");
    article.article_id = articleItem.get(
        'Article_id');
    article.title =
        articleItem.get('Title');
    article.leadText = articleItem.get('LeadText');
    if (article.leadText) {
        article.leadText = article.leadText.trim();
        if (article.leadText.length > 0) {
            if (article.leadText.charAt(article.leadText.length - 1) != '.') {
                article.leadText += '. ';
            }
        }
    }
    article.rawHtml = rawHtml;
    article.author = articleItem.get('Author');
    article.date_formatted = moment(articleItem.get('Date')).format('dddd, D. MMMM YYYY');
    article.publish_start_formatted = moment(articleItem.get('publish_start')).format('dddd, D. MMMM YYYY');
    article.publish_end_formatted = moment(articleItem.get('publish_end')).format('dddd, D. MMMM YYYY');
    article.notPublished = notPublished;
    return article;
}

module.exports.getArticleData = getArticleData;

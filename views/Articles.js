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

            /*
             var title;
             var lineBreakLen = 2;
             var i1 = text.indexOf('\r\n');
             if (i1 < 0) {
             lineBreakLen = 1;
             i1 = text.indexOf('\n');
             }
             if (i1 >= 0) {
             var line = text.substring(0, i1);
             var i2 = line.lastIndexOf('#');
             if (i2 >= 0) {
             title = line.substr(i2 + 1);
             text = text.substr(i1 + lineBreakLen);
             }
             }
             if (text.length > 0 && text[0] == '\r') {
             text = text.substr(1);
             }
             if (text.length > 0 && text[0] == '\n') {
             text = text.substr(1);
             }
             */

            var expectedMatches = 2;
            var re = /.*\!\[(.*)\]\((.*)\).*/;
            var ma = re.exec(text);
            if (!ma) {
                expectedMatches = 1;
                re = /.*\!\((.*)\).*/;
                ma = re.exec(text);
            }

            // Erstes gefundene Bild als image setzen
            if (!article.image) {
                if (ma && ma.length > expectedMatches) {
                    article.imageAlt = expectedMatches - 1;
                    article.image = ma[expectedMatches];
                }
            }

            /*
             // Alle Bilder aus dem Text rausnehmen
             if (expectedMatches == 2) {
             re = /.*\!\[(.*)\]\((.*)\).*!/;
             text = text.replace(re, "");
             }
             if (expectedMatches == 1) {
             re = /.*\!\((.*)\).*!/;
             text = text.replace(re, "");
             }
             */

            // add image-responsive class to image tags
            var rawHtml = rho.toHtml(text);
            // add class attribute to all image tags to apply bootstrap styles
            rawHtml = rawHtml.replace(/<img\s*src=/g, "<img class=\"img-responsive\" src=");
            article.article_id = articleItem.get('Article_id');
            article.title = articleItem.get('Title');
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
            records.push(article);
        });

        page.socialShareEnabled = true; // todo: get frompage settings

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

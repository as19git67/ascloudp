var _ = require('underscore');
var config = require('../config');
var model = require('../model');
var moment = require('moment');
var ArticlesView = require('./Articles');
var ArticleItem = model.models.ArticleItem;

var appName = config.get('appName');

module.exports.render = function (req, res, next, page, pages, canEdit, collectionModelClass) {
    var now = new Date();
    var nowMoment = new moment(now);

    if (req.params.id) {

        var editMode = req.query.edit !== undefined;

        if (editMode && canEdit) {
            res.render(page.View + "Edit", {
                csrfToken: req.csrfToken(),
                bootstrapTheme: config.get('bootstrapStyle'),
                canEdit: canEdit,
                appName: appName,
                user: req.user,
                page: page,
                id: req.params.id
            });

        } else {
            // select by Article_id

            new ArticleItem().query(function (qb) {
                qb.innerJoin('Articles', 'Articles.id', 'ArticleItems.Article_id');
                if (canEdit) {
                    // in case user can edit, include currently not published articles
                    qb.where({'Page_id': page.Name, 'valid_end': null})
                        .andWhere('ArticleItems.Article_id', '=', req.params.id);
                } else {
                    qb.where({'Page_id': page.Name, 'valid_end': null})
                        .andWhere('ArticleItems.Article_id', '=', req.params.id)
                        .andWhere('publish_start', '<=', now)
                        .andWhere('publish_end', '>=', now);
                }
                qb.orderBy('publish_start', 'DESC');
            }).fetchAll().then(function (dataCollection) {
                if (dataCollection && dataCollection.length > 0) {

                    var article = ArticlesView.getArticleData(nowMoment, dataCollection.first());

                    page.socialShareEnabled = true; // todo: get from page settings

                    res.render(page.DetailView, {
                        csrfToken: req.csrfToken(),
                        bootstrapTheme: config.get('bootstrapStyle'),
                        canEdit: canEdit,
                        appName: appName,
                        title: article.title,
                        user: req.user,
                        pages: pages,
                        page: page,
                        article: article
                    });
                } else {
                    console.log("ArticleItem with Article_id=" + req.params.id + " does not exist");
                    var err = new Error("Wrong Article_id");
                    err.status = 404;
                    next(err);
                }
            }).catch(function (error) {
                console.log("Error while retrieving ArticleItem from the database: " + error);
                var err = new Error(error);
                err.status = 500;
                next(err);
            });
        }
    } else {
        console.log("ERROR: can't render article detail without article id in request");
        var err = new Error("Missing Article_id");
        err.status = 400;
        next(err);
    }
};

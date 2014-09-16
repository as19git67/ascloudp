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

module.exports.render = function (req, res, next, page, pages, collectionModelClass) {
    var now = new Date();

    new ArticleItem().query(function (qb) {
        qb.innerJoin('Articles', 'Articles.id', 'ArticleItems.Article_id');
        qb.where({ 'Page_id': page.Name, 'valid_end': null})
            .andWhere('publish_start', '<=', now)
            .andWhere('publish_end', '>=', now);
        qb.orderBy('publish_start', 'DESC');
    }).fetchAll().then(function (dataCollection) {
        var records = [];
        if (dataCollection && dataCollection.length > 0) {
            Promise.reduce(dataCollection.models, function (total, article, index, arrayLength) {
                var sectionReferenceObjs = [];
                var articleSectionObjs = [];
                return new Promise(function (resolveArticle, rejectArticle) {

                    new ArticleSectionItem().query(function (qb) {
                        qb.innerJoin('ArticleSections', 'ArticleSections.id', 'ArticleSectionItems.ArticleSection_id');
                        qb.innerJoin('Articles', 'Articles.id', 'ArticleSections.Article_id');
                        qb.where('ArticleSections.Article_id', article.get('id')).andWhere('valid_end', null);
                        qb.orderBy('Order', 'ASC');
                    }).fetchAll().then(function (articleSections) {
                        Promise.map(articleSections.models, function (articleSection) {
                            var section = {
                                title: articleSection.get('Title'),
                                imageUrl: articleSection.get('ImageUrl'),
                                imageDescription: articleSection.get('ImageDescription')
                            };
                            var text = articleSection.get('Text');
                            section.rawHtml = rho.toHtml(text);
                            articleSectionObjs.push(section);

                            // get section references
                            return new Promise(function (resolveArticleSection, rejectArticleSection) {
                                new ArticleReferenceItem().query(function (qb) {
                                    qb.innerJoin('ArticleReferences', 'ArticleReferences.id', 'ArticleReferenceItems.ArticleReference_id');
                                    qb.innerJoin('ArticleSections', 'ArticleSections.id', 'ArticleReferences.ArticleSection_id');
                                    qb.where('ArticleReferences.ArticleSection_id', articleSection.get('id')).andWhere('valid_end', null);
                                }).fetchAll().then(function (sectionReferences) {
                                    sectionReferences.forEach(function (sectionReference) {
                                        var reference = {
                                            text: sectionReference.get('Text')
                                        };
                                        sectionReferenceObjs.push(reference);
                                    });
                                    // resolve section after processing all references
                                    resolveArticleSection(articleSection);
                                }).catch(function (error) {
                                    console.log("Error while reading article section references: " + error);
                                    rejectArticleSection(error);
                                });
                            });

                        }).then(function (allArticleSections) {
                            var articleObj = {
                                date: article.get('Date'),
                                date_formatted: moment(article.get('Date')).format('dddd, D. MMMM YYYY'),
                                title: article.get('Title'),
                                subtitle: article.get('Subtitle'),
                                author: article.get('Author'),
                                sections: articleSectionObjs,
                                references: sectionReferenceObjs
                            };
                            records.push(articleObj);
                            resolveArticle(article);
                        }).catch(function (error) {
                            console.log("Error while processing article sections: " + error);
                            rejectArticle(error);
                        });

                    }).catch(function (error) {
                        console.log("Error while reading article from database: " + error);
                        rejectArticle(error);
                    });
                }).then(function () {
                        total.push(article);
                    }).return(total);
            }, []).then(function (articles) {

                res.render(page.View, {
                    csrfToken: req.csrfToken(),
                    appName: appName,
                    title: page.EntityNamePlural,
                    user: req.user,
                    pages: pages,
                    page: page,
                    Records: records
                });
            });
        } else {
            res.render(page.View, {
                csrfToken: req.csrfToken(),
                appName: appName,
                title: page.EntityNamePlural,
                user: req.user,
                pages: pages,
                page: page
            });
        }
    }).catch(function (error) {
        console.log("Error while retrieving ArticleItems from the database: " + error);
        var err = new Error(error);
        err.status = 500;
        next(err);
    });
};
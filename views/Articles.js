var _ = require('underscore');
var config = require('../config');
var model = require('../model');
var moment = require('moment');
var rho = require('rho');
var Article = model.models.Article;
var ArticleItem = model.models.ArticleItem;

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
            records = dataCollection.map(function (dataModel) {
                var articleSections = dataModel.related('ArticleSection');
                var sections = articleSections.map(function (sectionData) {
                    var section = {
                        title: sectionData.get('Title'),
                        imageUrl: sectionData.get('ImageUrl'),
                        imageDescription: sectionData.get('ImageDescription')
                    };
                    var text = sectionData.get('Text');
                    section.rawHtml = rho.toHtml(text);
                    return section;
                });
                var articleReferences = dataModel.related('ArticleReference');
                var references = articleReferences.map(function (referenceData) {
                    var reference = {
                        text: referenceData.get('Text')
                    };
                    return reference;
                });
                var dataObj = {
                    date: dataModel.get('Date'),
                    date_formatted: moment(dataModel.get('Date')).format('dddd, D. MMMM'),
                    title: dataModel.get('Title'),
                    subtitle: dataModel.get('Subtitle'),
                    author: dataModel.get('Author'),
                    sections: sections,
                    references: references
                };
                return dataObj;
            });
            res.render(page.View, {
                csrfToken: req.csrfToken(),
                appName: appName,
                title: page.EntityNamePlural,
                user: req.user,
                pages: pages,
                page: page,
                Records: records
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
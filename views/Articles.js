var _ = require('underscore');
var config = require('../config');
var model = require('../model');
var moment = require('moment');
var Article = model.models.Article;

var appName = config.get('appName');

module.exports.render = function (req, res, next, page, pages, collectionModelClass) {
    var now = new Date();
    new Article().query(function (qb) {
        qb.orderBy('publish_start', 'DESC');
        qb.where({ 'Articles.Page_id': page.Name, 'Articles.valid_end': null})
            .andWhere('publish_start', '<=', now)
            .andWhere('publish_end', '>=', now);

    }).fetchAll({withRelated: ['ArticleSection']}).then(function (dataCollection) {
        var records = [];
        if (dataCollection && dataCollection.length > 0) {
            records = dataCollection.map(function (dataModel) {
                var articleSections = dataCollection.related('ArticleSection');
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
                var dataObj = {
                    date: dataModel.get('Date'),
                    date_formatted: moment(dataModel.get('Date')).format('dddd, D. MMMM'),
                    title: dataModel.get('Title'),
                    subtitle: dataModel.get('Subtitle'),
                    author: dataModel.get('Author'),
                    sections: sections
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
        console.log("Error while retrieving Articles from the database: " + error);
        var err = new Error(error);
        err.status = 500;
        next(err);
    });
};
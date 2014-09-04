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
        qb.where({ 'Articles.Page_id': page.Name, 'Articles.Deleted': false, 'Articles.valid_end': null})
            .andWhere('publish_start', '<=', now)
            .andWhere('publish_end', '>=', now);

    }).fetchAll().then(function (dataCollection) {
        var records = [];
        if (dataCollection && dataCollection.length > 0) {
            records = dataCollection.map(function (dataModel) {
                var rawRho = "";
                var rawHtml = undefined;
                var text = dataModel.get('Text');
                if (text) {
                    rawRho = dataModel.get('Text');
                    rawHtml = rho.toHtml(rawRho);
                } else {
                    console.log("Warning: rendering page " + page.Name + " without content");
                }
                var dataObj = {
                    date: dataModel.get('Date'),
                    date_formatted: moment(dataModel.get('Date')).format('dddd, D. MMMM'),
                    title: dataModel.get('Title'),
                    subtitle: dataModel.get('Subtitle'),
                    author: dataModel.get('Author'),
                    // todo dynamically make section array
                    sections: [{rawHtml: rawHtml}]
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
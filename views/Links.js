var _ = require('underscore');
var config = require('../config');
var model = require('../model');
var Link = model.models.Link;
var LinkItem = model.models.LinkItem;

var appName = config.get('appName');

module.exports.render = function (req, res, next, page, pages, collectionModelClass) {

    new LinkItem().query(function (qb) {
        qb.leftJoin('Links', 'Links.id', 'LinkItems.Link_id');
        qb.orderBy('Description', 'ASC');
        qb.where({ 'Page_id': page.Name,  'valid_end': null});
    }).fetchAll().then(function (dataCollection) {
        var records = [];
        if (dataCollection && dataCollection.length > 0) {
            records = dataCollection.map(function (dataModel) {
                var dataObj = {
                    href: dataModel.get('Url'),
                    linkText: dataModel.get('Description')
                };
                return dataObj;
            });
            res.render(page.View, {
                csrfToken: req.csrfToken(),
                bootstrapTheme: config.get('bootstrapStyle'),
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
                bootstrapTheme: config.get('bootstrapStyle'),
                appName: appName,
                title: page.EntityNamePlural,
                user: req.user,
                pages: pages,
                page: page
            });
        }
    }).catch(function (error) {
        console.log("Error while retrieving Links from the database: " + error);
        var err = new Error(error);
        err.status = 500;
        next(err);
    });
};

var _ = require('underscore');
var config = require('../config');
var model = require('../model');
var Link = model.models.Link;

var appName = config.get('appName');

module.exports.render = function (req, res, next, page, pages, collectionModelClass) {

    new Link().query(function (qb) {
        qb.orderBy('linkText', 'ASC');
        qb.where({ 'Links.Page_id': page.Name, 'Links.Deleted': false, 'Linkss.valid_end': null});
    }).fetchAll().then(function (dataCollection) {
        var records = [];
        if (dataCollection && dataCollection.length > 0) {
            records = dataCollection.map(function (dataModel) {
                var dataObj = {
                    href: dataModel.get('Href'),
                    linkText: dataModel.get('LinkText')
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
        console.log("Error while retrieving Links from the database: " + error);
        var err = new Error(error);
        err.status = 500;
        next(err);
    });
};
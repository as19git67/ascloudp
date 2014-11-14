var _ = require('underscore');
var config = require('../config');
var model = require('../model');
var members = require('../routes/api/v1/members');
var PersonItem = model.models.PersonItem;

var knex = model.bookshelf.knex;

var appName = config.get('appName');


module.exports.render = function (req, res, next, page, pages, canEdit, collectionModelClass) {
    var query = members.listQuerySelectFrom +
        ' join "ContactItems" on "Persons"."id" = "ContactItems"."Person_id"' +
        ' join "Contacts" on "Contacts"."id" = "ContactItems"."Contact_id"' +
        members.listQueryJoins + members.listQueryWhereClauses +
        ' and "Contacts"."Page_id" = \'' + page.Name + '\'' +
        ' and "ContactItems"."valid_end" is null' +
        members.listQueryOrderByClause;

    knex.raw(query).then(function (persons) {
            var records = members.makeHierarchicalObjectStructureFromPersonResultRecords(persons);
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

        }
    ).catch(function (error) {
            console.log("Error while reading persons with contact data from database: " + error);
            var err = new Error(error);
            err.status = 500;
            next(err);
        }
    );
};

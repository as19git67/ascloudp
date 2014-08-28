var _ = require('underscore');
var moment = require('moment');
var config = require('../config');
var model = require('../model');

module.exports.render = function(req, res, next, page, pages, collectionModelClass) {
    new model.models.PageCollectionColumn().query(function (qb) {
        qb.where({Page_id: page.Name});
        qb.orderBy('Order', 'ASC');
    }).fetchAll().then(function (columnInfos) {
        var recordFields = [];
        columnInfos.forEach(function (columnInfo) {
            var fieldInfo = {
                Name: columnInfo.get('Name'),
                Type: columnInfo.get('Type'),
                Mandatory: columnInfo.get('Mandatory'),
                Caption: columnInfo.get('Caption')
            };
            recordFields.push(fieldInfo);
        });

        new collectionModelClass().query(function (qb) {
            // todo: retrieve only columns referenced by columnInfo
            // todo: orderby from page configuration
            // todo: retrieve related when columns from other tables are referenced in columnInfo
            qb.orderBy('id', 'ASC');
        }).fetchAll().then(function (dataCollection) {
            var records = [];
            if (dataCollection && dataCollection.length > 0) {
                records = dataCollection.map(function (dataModel) {
                    var dataObj = [];
                    // get attribtues by columnInfo
                    _.each(recordFields, function (recField) {
                        var attributeFromModel = dataModel.get(recField.Name);
                        var value = attributeFromModel;
                        var value_formatted;
                        var value_type = typeof value;
                        var column_type = recField.Type;

                        switch (value_type) {
                            case "boolean":
                                value_formatted = value ? "Ja" : "Nein";
                                break;
                            default:
                                if (value) {
                                    if (value instanceof Date) {
                                        if (column_type == "date") {
                                            value_formatted = moment(value).format('L');
                                        }
                                        else {
                                            if (column_type == "datetime") {
                                                value_formatted = moment(value).format('L LT');
                                            } else {
                                                if (column_type == "time") {
                                                    value_formatted = moment(value).format('LT');
                                                } else {
                                                    value_formatted = moment(value).format();
                                                }
                                            }
                                        }
                                    } else {
                                        value_formatted = value.toString();
                                    }
                                } else {
                                    value_formatted = "";
                                }
                                break;

                        }
                        dataObj.push({ Name: recField.Name,
                            Caption: recField.Caption,
                            Type: recField.Type,
                            Mandatory: recField.Mandatory,
                            value: value,
                            value_formatted: value_formatted
                        });

                    });
                    return dataObj;
                });
            }
            canPost = false; // todo
            res.render("genericList", {
                appName: config.get('appName'),
                title: page.EntityNamePlural,
                user: req.user,
                pages: pages,
                canEdit: canPost,
                RecordFields: recordFields,
                Records: records
            });
        });
    });

};

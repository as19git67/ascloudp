var _ = require('underscore');
var Promise = require('bluebird/js/main/promise')();
var model = require('./model');

module.exports = function () {

    return new Promise(function (resolve, reject) {
        var profiles =
        {
            admin_menu: {
                description: "Administrationshauptmenü anzeigen",
                resources: ["/admin"],
                permissions: ["get"],
                menus: ["admin"]
            },
            admin_databasemanagement: {
                description: "Datenbankverwaltung",
                resources: ["/admin/databaseManagement"],
                permissions: ["get", "post"],
                menus: ["admin.databasemanagement"]
            },
            pagemanagement_list_read: {
                description: "Seitenverwaltung: Seiten anzeigen",
                resources: ["/admin/pageManagementPageList"],
                permissions: ["get"],
                menus: ["admin.pages"]
            },
            pagemanagement_page_display: {
                description: "Seitenverwaltung: Seiteneigenschaften anzeigen",
                resources: ["/admin/pageManagementPageEdit"],
                permissions: ["get"],
                menus: ["admin.page"]
            },
            pagemanagement_page_edit: {
                description: "Seitenverwaltung: Seiteneigenschaften ändern",
                resources: ["/admin/pageManagementPageEdit"],
                permissions: ["get", "post"],
                menus: ["admin.page"]
            },
            account_display: {
                description: "Eigene Benutzerdaten anzeigen",
                resources: ["/loginManageAccount"],
                permissions: ["get"],
                menus: ["login.manage"]
            },
            account_edit: {
                description: "Eigene Benutzerdaten ändern",
                resources: ["/loginManageAccount"],
                permissions: ["post"],
                menus: ["login.manage"]
            },
            usermanagement_list_read: {
                description: "Usermangement: Benutzerliste anzeigen",
                resources: ["/admin/userManagementUserList"],
                permissions: ["get"],
                menus: ["admin.users"]
            },
            usermanagement_user_display: {
                description: "Usermangement: Benutzer anzeigen",
                resources: ["/admin/userManagementUserEdit"],
                permissions: ["get"],
                menus: ["admin.user"]
            },
            usermanagement_user_edit: {
                description: "Usermangement: Benutzer ändern",
                resources: ["/admin/userManagementUserEdit"],
                permissions: ["get", "post"],
                menus: ["admin.user"]
            },
            rolemanagement_list_read: {
                description: "Rollenverwaltung: Rollenliste anzeigen",
                resources: ["/admin/usermanagementroles"],
                permissions: ["get"],
                menus: ["admin.roles"]
            },
            rolemanagement_user_display: {
                description: "Rollenverwaltung: Rolle anzeigen",
                resources: ["/admin/usermanagementroleedit"],
                permissions: ["get"],
                menus: ["admin.role"]
            },
            rolemanagement_user_edit: {
                description: "Rollenverwaltung: Rolle ändern",
                resources: ["/admin/usermanagementroleedit", "/admin/userManagementRoles"],
                permissions: ["get", "post"],
                menus: ["admin.role", "admin.roles"]
            }
        };

        model.getPages().then(function (pages) {
            _.each(pages, function (page) {
                var m = model.models[page.Model];  // get model by name
                if (m) {
                    var mObj = new m();
                    var isColl = false;
                    if (model.bookshelf.Collection.prototype.isPrototypeOf(mObj)) {
                        isColl = true;
                    }
                    /*
                     if (mObj instanceof model.bookshelf.Collection) {
                     isColl = true;
                     }
                     */
                    var entityName = isColl ? page.EntityNamePlural : page.EntityNameSingular;
                    profiles[page.Name + '_display'] = {
                        description: "Seite: anzeigen von " + entityName,
                        resources: ["/" + page.Name],
                        permissions: ["get"],
                        menus: [page.Name]
                    };
                    profiles[page.Name + '_edit'] = {
                        description: "Seite: ändern von " + entityName,
                        resources: ["/" + page.Name],
                        permissions: ["get", "post"],
                        menus: [page.Name]
                    };
                }
            });

            var allProfiles = _.map(profiles, function (value, key, list) {
                value.id = key;
                value.resources = _.map(value.resources, function (value) {
                    return value.toLowerCase();
                });
                value.permissions = _.map(value.permissions, function (value) {
                    return value.toLowerCase();
                });
                return value;
            });

            resolve(allProfiles);
        }).catch(function (error) {
            console.log("Error while getting pages to build page profiles: " + error);
            reject(error);
        });
    });
};



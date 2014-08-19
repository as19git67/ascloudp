var _ = require('underscore');

module.exports = function () {

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

    return _.map(profiles, function (value, key, list) {
        value.id = key;
        value.resources = _.map(value.resources, function(value){
            return value.toLowerCase();
        });
        value.permissions = _.map(value.permissions, function(value){
            return value.toLowerCase();
        });
        return value;
    });
};



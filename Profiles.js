var _ = require('underscore');

module.exports = function () {

    var profiles =
    {
        admin_menu: {
            description: "Administrationshauptmenü anzeigen",
            resources: ["/admin"],
            permissions: ["get"]
        },
        admin_databasemanagement: {
            description: "Datenbankverwaltung",
            resources: ["/admin/databaseManagement"],
            permissions: ["get", "post"]
        },
        account_display: {
            description: "Eigene Benutzerdaten anzeigen",
            resources: ["/loginManageAccount"],
            permissions: ["get"]
        },
        account_edit: {
            description: "Eigene Benutzerdaten ändern",
            resources: ["/loginManageAccount"],
            permissions: ["post"]
        },
        usermanagement_list_read: {
            description: "Usermangement: Benutzerliste anzeigen",
            resources: ["/admin/userManagementUserList"],
            permissions: ["get"]
        },
        usermanagement_user_display: {
            description: "Usermangement: Benutzer anzeigen",
            resources: ["/admin/userManagementUserEdit"],
            permissions: ["get"]
        },
        usermanagement_user_edit: {
            description: "Usermangement: Benutzer ändern",
            resources: ["/admin/userManagementUserEdit"],
            permissions: ["get", "post"]
        },
        rolemanagement_list_read: {
            description: "Rollenverwaltung: Rollenliste anzeigen",
            resources: ["/admin/usermanagementroles"],
            permissions: ["get"]
        },
        rolemanagement_user_display: {
            description: "Rollenverwaltung: Rolle anzeigen",
            resources: ["/admin/usermanagementroleedit"],
            permissions: ["get"]
        },
        rolemanagement_user_edit: {
            description: "Rollenverwaltung: Rolle ändern",
            resources: ["/admin/usermanagementroleedit"],
            permissions: ["get", "post"]
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



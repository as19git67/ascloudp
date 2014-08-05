var _ = require('underscore');

module.exports = function () {

    var profiles =
    {
        admin_menu: {
            description: "Administrationshauptmenü anzeigen",
            resources: ["/admin"],
            permissions: ["get"]
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
        }
    };

    return _.map(profiles, function (value, key, list) {
        value.id = key;
        return value;
    });
};



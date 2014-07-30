
module.exports = {
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

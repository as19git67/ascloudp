var express = require('express');
var _ = require('underscore');
var Promise = require('bluebird');
var router = express.Router();
var config = require('../config');
var model = require('../model');
var Role = model.models.Role;
var RolePermission = model.models.RolePermission;
var RolePermissions = model.models.RolePermissions;
var User = model.models.User;
var UserLogin = model.models.UserLogin;
var passportStrategies = require('../passportStrategies');
var getProfiles = require('../Profiles');
var rolePermissions = require('../Roles');

var rp = new rolePermissions(model.models);

router.get('/:roleId', passportStrategies.ensureAuthenticated, rp.middleware(2), function (req, res, next) {
    var appName = config.get('appName');
    var title = 'User Management - Rollendetails';
    var roleId = req.params.roleId;

    new Role({id: roleId}).fetch({withRelated: ['RolePermission']})
        .then(function (role) {
            var profiles = getProfiles();

            var roleObj = {
                Role_id: role.get('id'),
                Name: role.get('Name'),
                RolePermissions: []
            };

            var rolePermissions = role.related('RolePermission');
            if (rolePermissions.length > 0) {
                rolePermissions.each(function (rolePermission) {
                    roleObj.RolePermissions.push(rolePermission.attributes);
                });
            }

            // Suche role permissions in den Profilen und setze diese ggf als "checked" wenn alle Resourcen und Permissions
            // an der Rolle dran hängen

            _.each(profiles, function (profile) {

                var RoleHasResourcesAndPermissions = true;
                _.each(profile.resources, function (resource) {
                    var RoleHasResourceAndPermissions = true;
                    _.each(profile.permissions, function (permission) {
                        var RoleHasResourceAndPermission = false;
                        for (var i = 0; i < roleObj.RolePermissions.length; i++) {
                            var rolePermission = roleObj.RolePermissions[i];
                            if (rolePermission.Resource == resource && rolePermission.Permission == permission) {
                                RoleHasResourceAndPermission = true;
                                break;
                            }
                        }
                        if (!RoleHasResourceAndPermission) {
                            RoleHasResourceAndPermissions = false;
                        }
                    });
                    if (!RoleHasResourceAndPermissions) {
                        RoleHasResourcesAndPermissions = false;
                    }
                });
                profile.assignedToRole = RoleHasResourcesAndPermissions;
            });

            res.render('usermanagementroleedit', {
                csrfToken: req.csrfToken(),
                appName: appName,
                title: title,
                user: req.user,
                profiles: profiles,
                role: roleObj
            });
        })
        .catch(function (error) {
            var errMsg = "Die Rolle konnte wegen eines Fehlers nicht von der Datenbank geladen werden.";
            var errMsgDetailed = "Error while retrieving role from database. RoleId: " + roleId + ". " + error;
            handleError(errMsg, errMsgDetailed, req, res, {id: roleId });
        });
});

router.post('/', passportStrategies.ensureAuthenticated, rp.middleware(2), function (req, res, next) {
    var appName = config.get('appName');
    var title = 'User Management - Rollendetails';
    if (req.user) {
        if (req.body.cancel) {
            res.redirect('/admin/userManagementRoles');
        }
        else {
            if (req.body.save) {

                var roleName = req.body.rolename;
                var roleId = req.body.Role_id;

                // build array of role permissions from selected checkboxes of profiles in UI
                var allProfiles = getProfiles();
                var selectedRolePermissions = [];
                var checkHash = {};

                _.each(allProfiles, function (profile) {
                    var cbName = "cb_" + profile.id;
                    if (req.body[cbName] && req.body[cbName] == profile.id) {
                        _.each(profile.resources, function (resource) {
                            _.each(profile.permissions, function (permission) {
                                var checkKey = resource + "_" + permission;
                                if (!checkHash[checkKey]) {
                                    selectedRolePermissions.push(
                                        {
                                            Role_id: roleId,
                                            Resource: resource,
                                            Permission: permission
                                        }
                                    );
                                    checkHash[checkKey] = true;
                                }
                            });
                        });
                    }
                });

                new Role({id: roleId}).fetch().then(function (roleModel) {
                    // todo transaction

                    // delete all role permissions assigned to the role and add those which are selected by the user
                    model.bookshelf.knex('RolePermissions').where('Role_id', roleId).del().then(function () {

                        var rolePermissions = RolePermissions.forge(selectedRolePermissions);

                        Promise.all(rolePermissions.invoke('save')).then(function () {
                            console.log("All role permissions are saved");

                            roleModel.set('Name', roleName);
                            // todo set further parameter
                            roleModel.save().then(function (savedRoleModel) {
                                console.log("Role '" + savedRoleModel.get('Name') + "' saved with id " + savedRoleModel.get('id'));
                                res.redirect('/admin/userManagementRoles');
                            }).catch(function (error) {
                                var errMsg = "Die Rolle konnte wegen eines Fehlers nicht gespeichert werden.";
                                var errMsgDetailed = "Error while saving role '" + roleName + "' to database. RoleId: " + roleId + ". " + error;
                                handleError(errMsg, errMsgDetailed, req, res, {id: roleId, Name: roleName });
                            });
                        }).catch(function (error) {
                            var errMsg = "Die Rolle konnte wegen eines Fehlers nicht gespeichert werden.";
                            var errMsgDetailed = "Error saving role permissions for role " + roleId + ". " + error;
                            handleError(errMsg, errMsgDetailed, req, res, {id: roleId, Name: roleName });
                        });
                    }).catch(function (error) {
                        var errMsg = "Die Rolle konnte wegen eines Fehlers nicht gespeichert werden.";
                        var errMsgDetailed = "Error deleting role permissions. RoleId: " + roleId + ". " + error;
                        handleError(errMsg, errMsgDetailed, req, res, {id: roleId, Name: roleName });
                    });

                }).catch(function (error) {
                    var errMsg = "Die Rolle konnte wegen eines Fehlers nicht von der Datenbank geladen werden.";
                    var errMsgDetailed = "Error while retrieving role from database. RoleId: " + roleId + ". " + error;
                    handleError(errMsg, errMsgDetailed, req, res, {id: roleId, Name: roleName });
                });
            }
            else {
                if (req.body.deleteRole) {
                    var roleId = req.body.Role_id;
                    console.log("Deleting role with id " + roleId);
                    new Role({id: roleId}).fetch().then(function (roleModel) {
                        if (roleModel) {
                            console.log("Role with id " + roleId + " has name " + roleModel.get('Name') + " and will be deleted.");
                            // todo db transaction
                            model.bookshelf.knex('RolePermissions').where('Role_id', roleId).del().then(function () {

                                roleModel.destroy().then(function () {
                                    console.log("Role with id " + roleId + " was deleted.");
                                    res.redirect('/admin/userManagementRoles');
                                }).catch(function (error) {
                                    console.log("Error while deleting role with id " + roleId + ". Error: " + error);
                                    res.render('usermanagementroleedit', {
                                        csrfToken: req.csrfToken(),
                                        appName: appName,
                                        title: title,
                                        user: req.user,
                                        profiles: getProfiles(),
                                        error: "Die Rolle konnte wegen eines Fehlers nicht gelöscht werden.",
                                        role: {
                                            id: roleId,
                                            Name: roleName
                                        }
                                    });
                                });
                            }).catch(function (error) {
                                var errMsg = "Die Rolle konnte wegen eines Fehlers nicht gelöscht werden.";
                                var errMsgDetailed = "Error deleting role permissions. RoleId: " + roleId + ". " + error;
                                handleError(errMsg, errMsgDetailed, req, res, {id: roleId, Name: roleName });
                            });
                        }
                        else {
                            console.log("Role with id " + roleId + " does not exist in the database.");
                            res.redirect('/admin/userManagementRoles');
                        }
                    }).catch(function (error) {
                            console.log("Error while saving role in the database: " + error);
                            var err = new Error(error);
                            err.status = 500;
                            next(err);
                        }
                    );
                } else {
                    console.log("None of the expected form fields were submitted. Do nothing.");
                    res.redirect('/admin/userManagementRoles');
                }
            }
        }
    }
    else {
        console.log("No user object in request. Redirecting to /");
        res.redirect('/');
    }
});

function handleError(errMsg, errMsgDetailed, req, res, roleObj) {
    var appName = config.get('appName');
    var title = 'User Management - Rollendetails';
    console.log(errMsgDetailed);
    res.render('usermanagementroleedit', {
        csrfToken: req.csrfToken(),
        appName: appName,
        title: title,
        user: req.user,
        profiles: getProfiles(),
        error: errMsg,
        role: roleObj
    });
}

module.exports = router;

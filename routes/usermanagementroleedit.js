var express = require('express');
var _ = require('underscore');
var router = express.Router();
var config = require('../config');
var model = require('../model');
var Role = model.models.Role;
var User = model.models.User;
var UserLogin = model.models.UserLogin;
var passportStrategies = require('../passportStrategies');
var Profiles = require('../profiles');

function getProfiles() {
    var profiles = _.map(Profiles, function (value, key, list) {
        value.id = key;
        return value;
    });
    return profiles;
}

router.get('/:roleId', passportStrategies.ensureAuthenticated, function (req, res, next) {
        var appName = config.get('appName');
        var title = 'User Management - Rollendetails';
        var roleId = req.params.roleId;

        new Role({id: roleId}).fetch({withRelated: ['RolePermission']})
            .then(function (role) {
                var roleObj = {
                    Role_id: role.get('id'),
                    Name: role.get('Name'),
                    RolePermissions: []
                };

                var rolePermissions = role.related('RolePermission');
                if (rolePermissions.length > 0) {
                    rolePermissions.each(function (rolePermission) {
                        roleObj.RolePermission.push(rolePermission.attributes);
                    });
                }
                res.render('usermanagementroleedit', {
                    csrfToken: req.csrfToken(),
                    appName: appName,
                    title: title,
                    user: req.user,
                    profiles: getProfiles(),
                    role: roleObj
                });
            })
            .catch(function (error) {
                res.render('usermanagementroleedit', {
                        csrfToken: req.csrfToken(),
                        appName: appName,
                        title: title,
                        user: req.user,
                        profiles: {},
                        error: 'Error: ' + error,
                        role: {
                            Name: "id: " + roleId
                        }
                    }
                );
            }
        );
    }
);

router.post('/', function (req, res, next) {
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

                    new Role({id: roleId}).fetch().then(function (roleModel) {
                        roleModel.set('Name', roleName);
                        // todo set further parameter
                        roleModel.save().then(function (savedRoleModel) {
                            console.log("Role '" + savedRoleModel.get('Name') + "' saved with id " + savedRoleModel.get('id'));
                            res.redirect('/admin/userManagementRoles');
                        }).catch(function (error) {
                            console.log("Error while saving role '" + roleName + "' to database. RoleId: " + roleId);
                            res.render('usermanagementroleedit', {
                                csrfToken: req.csrfToken(),
                                appName: appName,
                                title: title,
                                user: req.user,
                                profiles: getProfiles(),
                                error: "Die Rolle konnte wegen eines Fehlers nicht in der Datenbank gespeichert werden.",
                                role: {
                                    id: roleId,
                                    Name: roleName
                                }
                            });
                        });
                    }).catch(function (error) {
                        console.log("Error while retrieving role from database. RoleId: " + roleId);
                        res.render('usermanagementroleedit', {
                            csrfToken: req.csrfToken(),
                            appName: appName,
                            title: title,
                            user: req.user,
                            profiles: getProfiles(),
                            error: "Die Rolle konnte wegen eines Fehlers nicht von der Datenbank geladen werden.",
                            role: {
                                id: roleId,
                                Name: roleName
                            }
                        });
                    });
                }
                else {
                    if (req.body.deleteRole) {
                        var roleId = req.body.Role_id;
                        console.log("Deleting role with id " + roleId);
                        new Role({id: roleId}).fetch().then(function (roleModel) {
                            if (roleModel) {
                                console.log("Role with id " + roleId + " has name " + roleModel.get('Name') + " and will be deleted.");
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
    }
);

module.exports = router;

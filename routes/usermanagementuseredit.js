var express = require('express');
var _ = require('underscore');
var router = express.Router();
var config = require('../config');
var Promise = require('bluebird/js/main/promise')();
var model = require('../model');
var Audit = model.models.Audit;
var User = model.models.User;
var UserLogin = model.models.UserLogin;
var Role = model.models.Role;
var UserRole = model.models.UserRole;
var UserRoles = model.models.UserRoles;
var passportStrategies = require('../passportStrategies');

var appName = config.get('appName');

/* GET user list page. */
function prepareResponse(userId) {
    return  new Promise(function (resolve, reject) {
        new User({'id': userId}).fetch({
            withRelated: ['UserLogin', 'UserRole.Role']
        }).then(function (user) {
            if (user) {
                var userLoginsArray = [];
                var userObj = {
                    User_id: user.get('id'),
                    Email: user.get('Email'),
                    UserName: user.get('UserName'),
                    UserLoginProviders_formatted: "",
                    UserLogins: userLoginsArray,
                    roles: []
                };
                var userLogins = user.related('UserLogin');
                if (userLogins.length > 0) {
                    userLogins.each(function (userLogin) {
                        if (userObj.UserLoginProviders_formatted.length > 0) {
                            userObj.UserLoginProviders_formatted = userObj.UserLoginProviders_formatted + ', ';
                        }
                        var loginProvider = userLogin.get('LoginProvider');
                        loginProvider = loginProvider.charAt(0).toUpperCase() + loginProvider.substr(1);
                        userObj.UserLoginProviders_formatted = userObj.UserLoginProviders_formatted + loginProvider;

                        userLoginsArray.push({
                            UserLogin_id: userLogin.get('id'),
                            LoginProvider: userLogin.get('LoginProvider'),
                            ProviderKey: userLogin.get('ProviderKey')
                        });
                    });
                }
                var roleHash = {};
                var userRoles = user.related('UserRole');
                userRoles.each(function (userRole) {
                    var role = userRole.related('Role');
                    roleHash[role.get('id')] = role;
                });

                new Role().query(function (qb) {
                    qb.orderBy('Name', 'ASC');
                }).fetchAll().then(function (roles) {
                    roles.each(function (roleModel) {
                        var roleId = roleModel.get('id');
                        var roleName = roleModel.get('Name');
                        var assignedToUser = roleHash[roleId] != undefined;
                        userObj.roles.push({ id: roleId, Name: roleName, assignedToUser: assignedToUser});
                    });
                    resolve({userObj: userObj, userModel: user});
                }).catch(function (error) {
                    console.log("Error while getting roles from database: " + error);
                    reject(error);
                });
            }
            else {
                console.log('No user with ID ' + userId);
                resolve('/admin/userManagementUserList');
            }
        });
    });
}

router.get('/:userId', passportStrategies.ensureAuthenticated, function (req, res, next) {
        var userId = req.params.userId;
        if (userId) {
            var title = 'User Management - Benutzerdetails';
            prepareResponse(userId).then(function (data) {
                var userObj = data.userObj;
                if (typeof userObj === "string") {
                    res.redirect(userObj);
                } else {
                    res.render('usermanagementuseredit', {
                        csrfToken: req.csrfToken(),
                        appName: appName,
                        title: title,
                        user: req.user,
                        userData: userObj
                    });
                }
            }).catch(function (error) {
                    var err = new Error(error);
                    err.status = 500;
                    next(err);
                }
            );

        } else {
            console.log('userId in request URL missing');
            res.redirect('/admin/userManagementUserList');
        }
    }
);

function makeRoleNamesFormatted(roles, allRoleNamesById) {
    var roles_formatted = "";
    _.each(roles, function (role) {
        if (roles_formatted.length > 0) {
            roles_formatted += ", ";
        }
        roles_formatted += allRoleNamesById[role.Role_id];
    });
    return roles_formatted;
}

router.post('/', passportStrategies.ensureAuthenticated, function (req, res, next) {
    if (req.user) {
        var userId = req.body.User_id;
        if (userId) {
            var title = 'User Management - Benutzerdetails';
            prepareResponse(userId).then(function (data) {
                var userModel = data.userModel;
                var userObj = data.userObj;

                if (typeof userObj === "string") {
                    res.redirect(userObj);
                } else {
                    if (req.body.deleteAccount) {
                        console.log("Deleting user " + userId + ' (' + userObj.Email + ')');
                        model.bookshelf.knex('UserRoles').where('User_id', userId).del().then(function () {
                            model.bookshelf.knex('UserLogins').where('User_id', userId).del().then(function () {
                                userModel.destroy().then(function () {
                                    console.log("user " + userId + ' (' + userObj.Email + ') has been deleted.');
                                    res.redirect('/admin/userManagementUserList');
                                });
                            });
                        });
                    } else {
                        if (req.body.cancel) {
                            res.redirect('/admin/userManagementUserList');
                        } else {
                            if (req.body.save) {
                                var origUserName = userObj.UserName;
                                var emailChanged = false;
                                var userNameChanged = false;
                                var changeText = "";
                                console.log("Saving user " + userId + ' (' + userObj.Email + ')');
                                if (userObj.Email != req.body.email) {
                                    changeText = "Email: " + userObj.Email + " -> " + req.body.email;
                                    userModel.set('Email', req.body.email);
                                    emailChanged = true;
                                }
                                if (origUserName != req.body.username) {
                                    if (emailChanged) {
                                        changeText = changeText + ', ';
                                    }
                                    changeText = changeText + "UserName: " + origUserName + " -> " + req.body.username;
                                    userModel.set('UserName', req.body.username);
                                    userNameChanged = true;
                                }

                                new Role().fetchAll()
                                    .then(function (roleList) {

                                        new UserRole().where({User_id: userId}).fetchAll().then(function (userRoleModels) {
                                            var allRoleNamesById = {};
                                            var checkUserRoles = {};
                                            userRoleModels.each(function (userRoleModel) {
                                                var rId = userRoleModel.get('Role_id');
                                                var uId = userRoleModel.get('User_id');
                                                console.log("UserRole for user " + userId + ": role " + rId + ", user: " + uId);
                                                checkUserRoles[rId] = rId;
                                            });

                                            var rolesToAdd = [];
                                            var rolesToRemove = [];
                                            roleList.each(function (roleModel) {
                                                var roleId = roleModel.get('id');
                                                var roleName = roleModel.get('Name');
                                                var formPostName = "cb_role_" + roleId;
                                                var assignToUser = req.body[formPostName] == roleId;
                                                allRoleNamesById[roleId] = roleName;
                                                if (checkUserRoles[roleId]) {
                                                    console.log("Role " + roleId + " (" + roleName + ") was assigned before");
                                                    if (!assignToUser) {
                                                        rolesToRemove.push(roleId);
                                                        console.log("REMOVE role (" + roleName + ") from user");
                                                    }
                                                }
                                                else {
                                                    console.log("Role " + roleId + " (" + roleName + ") was not assigned before");
                                                    if (assignToUser) {
                                                        rolesToAdd.push({User_id: userId, Role_id: roleId});
                                                        console.log("ASSIGN role (" + roleName + ") to user");
                                                    }
                                                }
                                            });

                                            function renderResponse(info) {
                                                prepareResponse(userId).then(function (data) {
                                                    var userObj = data.userObj;

                                                    if (typeof userObj === "string") {
                                                        res.redirect(userObj);
                                                    } else {
                                                        res.render('usermanagementuseredit', {
                                                            csrfToken: req.csrfToken(),
                                                            appName: appName,
                                                            title: title,
                                                            user: req.user,
                                                            info: info,
                                                            userData: userObj
                                                        });
                                                    }
                                                }).catch(function (error) {
                                                    var err = new Error(error);
                                                    err.status = 500;
                                                    next(err);
                                                });
                                            }

                                            function adjustRoleAssignments(haveOtherChanges) {
                                                var savedMessage = "Die Änderungen wurden gespeichert.";

                                                function handleRoleUnassignments() {
                                                    model.bookshelf.knex('UserRoles').where('User_id', userId).whereIn('Role_id',
                                                        rolesToRemove).del().then(function () {
                                                            var rolesFormatted = makeRoleNamesFormatted(rolesToRemove, allRoleNamesById);
                                                            var changeText = "Roles removed from user " + origUserName + " (" + userId + "): " + rolesFormatted;
                                                            new Audit({
                                                                    ChangedAt: new Date(),
                                                                    Table: 'UserRoles',
                                                                    ChangedBy: req.user.UserName,
                                                                    Description: changeText
                                                                }
                                                            ).save().then(function () {
                                                                    renderResponse(savedMessage);
                                                                }
                                                            );
                                                        });
                                                }

                                                if (rolesToAdd.length > 0) {
                                                    var userRolesToAdd = UserRoles.forge(rolesToAdd);
                                                    Promise.all(userRolesToAdd.invoke('save')).then(function () {
                                                        var rolesFormatted = makeRoleNamesFormatted(rolesToAdd, allRoleNamesById);
                                                        var changeText = "Roles added to user " + origUserName + " (" + userId + "): " + rolesFormatted;
                                                        var tableName = userRolesToAdd.models[0].tableName;
                                                        new Audit({
                                                                ChangedAt: new Date(),
                                                                Table: tableName,
                                                                ChangedBy: req.user.UserName,
                                                                Description: changeText
                                                            }
                                                        ).save().then(function () {
                                                                if (rolesToRemove.length > 0) {
                                                                    handleRoleUnassignments();
                                                                } else {
                                                                    renderResponse(savedMessage);
                                                                }
                                                            }
                                                        );
                                                    });
                                                } else {
                                                    if (rolesToRemove.length > 0) {
                                                        handleRoleUnassignments();
                                                    } else {
                                                        if (haveOtherChanges) {
                                                            renderResponse(savedMessage);
                                                        } else {
                                                            renderResponse("Nichts wurde geändert und deshalb wurde nichts gespeichert.");
                                                        }
                                                    }
                                                }
                                            }

                                            if (emailChanged || userNameChanged) {
                                                userModel.save().then(function () {
                                                    new Audit({
                                                            ChangedAt: new Date(),
                                                            Table: userModel.tableName,
                                                            ChangedBy: req.user.UserName,
                                                            Description: changeText
                                                        }
                                                    ).save().then(function () {
                                                            adjustRoleAssignments(true);
                                                        }
                                                    );
                                                }).catch(function (error) {
                                                    console.log("ERROR while saving user: " + error);
                                                    res.render('usermanagementuseredit', {
                                                        csrfToken: req.csrfToken(),
                                                        appName: appName,
                                                        title: title,
                                                        user: req.user,
                                                        error: "Fehler beim Speichern der Benutzerinformationen.",
                                                        userData: userObj
                                                    });
                                                });
                                            }
                                            else {
                                                adjustRoleAssignments(false);
                                            }
                                        });
                                    });

                            }
                            else {
                                var infoMessage = "Externer Login wurde nicht gelöscht.";
                                var prefixToSearchInKeys = "delete_UserLogin_";
                                var prefixLen = prefixToSearchInKeys.length;
                                for (var bodyItemKey in req.body) {
                                    if (!req.body.hasOwnProperty(bodyItemKey)) {
                                        continue;
                                    }

                                    if (bodyItemKey.substr(0, prefixLen) == prefixToSearchInKeys) {
                                        console.log("Action: " + bodyItemKey);
                                        var idStr = bodyItemKey.substr(prefixLen);
                                        var UserLogin_id = parseInteger(idStr);
                                        console.log("Deleting userLogin " + UserLogin_id + " from user " + userId + ' (' + userObj.Email + ')');
                                        var provider = "";
                                        infoMessage = "Externer Login (" + provider + ") wurde gelöscht.";
                                        break;
                                    }
                                }

                                res.render('usermanagementuseredit', {
                                    csrfToken: req.csrfToken(),
                                    appName: appName,
                                    title: title,
                                    user: req.user,
                                    info: infoMessage,
                                    userData: userObj
                                });
                            }
                        }
                    }
                }
            }).catch(function (error) {
                    var err = new Error(error);
                    err.status = 500;
                    next(err);
                }
            );
        } else {
            console.log("No body.User_id in request. Redirecting to /");
            res.redirect('/');
        }
    }

    else {
        console.log("No user object in request. Redirecting to /");
        res.redirect('/');
    }
});

module.exports = router;

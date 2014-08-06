var express = require('express');
var router = express.Router();
var config = require('../config');
var Promise = require('bluebird/js/main/promise')();
var model = require('../model');
var Audit = model.models.Audit;
var User = model.models.User;
var UserLogin = model.models.UserLogin;
var Role = model.models.Role;
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
                        // todo: confirmation message
                        res.redirect('/admin/userManagementUserList');
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
                                if (emailChanged || userNameChanged) {
                                    userModel.save().then(function () {
                                        new Audit({
                                                ChangedAt: new Date(),
                                                Table: userModel.tableName,
                                                ChangedBy: origUserName,
                                                Description: changeText
                                            }
                                        ).save().then(function () {
                                                res.redirect('/admin/userManagementUserList');
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
                                    res.render('usermanagementuseredit', {
                                        csrfToken: req.csrfToken(),
                                        appName: appName,
                                        title: title,
                                        user: req.user,
                                        info: "Keine Änderungen. Es wurde nichts gespeichert.",
                                        userData: userObj
                                    });
                                }
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

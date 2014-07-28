var express = require('express');
var router = express.Router();
var config = require('../config');
var model = require('../model');
var User = model.models.User;
var UserLogin = model.models.UserLogin;
var passportStrategies = require('../passportStrategies');

/* GET user list page. */
function prepareResponse(user) {
    var userLoginsArray = [];
    var userObj = {
        User_id: user.get('id'),
        Email: user.get('Email'),
        UserName: user.get('UserName'),
        UserLogins: userLoginsArray
    };
    var userLogins = user.related('UserLogin');
    if (userLogins.length > 0) {
        userLogins.each(function (userLogin) {
            userLoginsArray.push({
                UserLogin_id: userLogin.get('id'),
                LoginProvider: userLogin.get('LoginProvider'),
                ProviderKey: userLogin.get('ProviderKey')

            });
        });
    }
    return userObj;
}

router.get('/:userId', passportStrategies.ensureAuthenticated, function (req, res, next) {
        var userId = req.params.userId;
        var appName = config.get('appName');
        var title = 'User Management - Benutzerdetails';
        new User({'id': userId}).fetch({
            withRelated: ['UserLogin']
        }).then(function (user) {
            if (user) {
                var userObj = prepareResponse(user);
                res.render('usermanagementuseredit', {
                    csrfToken: req.csrfToken(),
                    appName: appName,
                    title: title,
                    user: req.user,
                    userData: userObj
                });
            }
            else {
                console.log('No user with ID ' + userId);
                res.redirect('/');
            }
        }).catch(function (error) {
                var err = new Error(error);
                err.status = 500;
                next(err);
            }
        );
    }
);

router.post('/', passportStrategies.ensureAuthenticated, function (req, res, next) {
    if (req.user) {
        var userId = req.body.User_id;
        if (userId) {
            var appName = config.get('appName');
            var title = 'User Management - Benutzerdetails';
            new User({'id': userId}).fetch({
                withRelated: ['UserLogin']
            }).then(function (user) {
                if (user) {
                    var userObj = prepareResponse(user);

                    if (req.body.deleteAccount) {
                        console.log("Deleting user " + userId + ' (' + user.get('Email') + ')');
                        // todo: confirmation message
                        res.redirect('/admin/userManagement');
                    } else {
                        if (req.body.cancel) {
                            res.redirect('/admin/userManagement');
                        } else {
                            if (req.body.save) {
                                console.log("Saving user " + userId + ' (' + user.get('Email') + ')');
                                user.set('Email', req.body.email);
                                user.set('UserName', req.body.username);
                                user.save().then(function () {
                                    res.redirect('/admin/userManagement');
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
                                        console.log("Deleting userLogin " + UserLogin_id + " from user " + userId + ' (' + user.get('Email') + ')');
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
                else {
                    console.log('No user with ID ' + userId);
                    res.redirect('/');
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

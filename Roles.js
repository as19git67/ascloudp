var Promise = require('bluebird/js/main/promise')();
var model = require('./model');
var _ = require('underscore');

var Roles = function () {
};

/**
 isAllowed( userId, resource, permissions, function(err, allowed) )

 Checks if the given user is allowed to access the resource for the given
 permissions (note: it must fulfill all the permissions).

 @param {String|Number} User id.
 @param {String} resource to ask permissions for.
 @param {String|Array} asked permissions.
 @param {Function} Callback called wish the result.
 */
Roles.prototype.isAllowed = function (userId, resource, permissions, cb) {

    var _this = this;
    permissions = makeArray(permissions);

    // get user's role permissions filtered by user, resource and permissions
    model.bookshelf.knex('UserRoles')
        .join('RolePermissions', 'RolePermissions.Role_id', '=', 'UserRoles.Role_id')
        .where('UserRoles.User_id', userId)
        .where('RolePermissions.Resource', resource.toLowerCase())
        .whereIn('RolePermissions.Permission', permissions)
        .select('UserRoles.User_id', 'RolePermissions.*')
        .then(function (results) {
            _.each(results, function (r) {
                console.log("User has permission " + r.Permission + " for resource " + r.Resource);
            });
            if (results.length > 0) {
                cb(null, true);
            } else {
                cb(null, false);
            }
        }).catch(function (error) {
            console.log("ERROR while checking role permissions: " + error);
            cb(error);
        });
};

function makeArray(arr) {
    return Array.isArray(arr) ? arr : [arr];
}

Roles.prototype.canPost = function (req, numPathComponents) {
    var roles = this;

    return new Promise(function (resolve, reject) {

        if ((req.user) && (req.user.id)) {
            var _userId = req.user.id;
            var url = req.originalUrl.split('?')[0];
            var resource;
            if (!numPathComponents) {
                resource = url;
            } else {
                resource = url.split('/').slice(0, numPathComponents + 1).join('/');
            }

            var actions = ["post"];

            roles.isAllowed(_userId, resource, actions, function (err, allowed) {
                if (err) {
                    console.log('Error checking permissions to access resource');
                    reject(err);
                } else if (allowed === false) {
                    console.log('Not allowed ' + actions + ' on ' + resource + ' by user ' + _userId);
                    resolve(false);
                } else {
                    console.log('Allowed ' + actions + ' on ' + resource + ' by user ' + _userId);
                    resolve(true);
                }
            });
        } else {
            // not authenticated -> can't post in any case
            resolve(false);
        }
    });
};

// Express Middleware

Roles.prototype.middleware = function (numPathComponents, userId, actions) {

    var roles = this;

    var HttpError = function (errorCode, msg) {
        this.status = errorCode;
        this.message = msg;

        Error.captureStackTrace(this, arguments);
        Error.call(this, msg);
    };

    return function (req, res, next) {
        var _userId = userId,
            resource,
            url;

        // call function to fetch userId
        if (typeof userId === 'function') {
            _userId = userId(req, res);
        }
        if (!userId) {
            if ((req.user) && (req.user.id)) {
                _userId = req.user.id;
            } else {
                next(new HttpError(401, 'User not authenticated'));
                return;
            }
        }

        url = req.originalUrl.split('?')[0];
        if (!numPathComponents) {
            resource = url;
        } else {
            resource = url.split('/').slice(0, numPathComponents + 1).join('/');
        }

        if (!actions) {
            actions = req.method.toLowerCase();
        }

        console.log('Requesting ' + actions + ' on ' + resource + ' by user ' + _userId);

        roles.isAllowed(_userId, resource, actions, function (err, allowed) {
            if (err) {
                next(new Error('Error checking permissions to access resource'));
            } else if (allowed === false) {
                console.log('Not allowed ' + actions + ' on ' + resource + ' by user ' + _userId);
                next(new HttpError(401, 'Insufficient permissions to access resource'));
            } else {
                console.log('Allowed ' + actions + ' on ' + resource + ' by user ' + _userId);
                next();
            }
        });
    };
};

module.exports = Roles;


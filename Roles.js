var Roles = function (models) {
    this.AuditModel = models.Audit;
    this.UserModel = models.User;
    this.RoleModel = models.Role;
    this.RolePermissionModel = models.RolePermission;
    this.UserRoleModel = models.UserRole;
};


/**
 isAllowed( userId, resource, permissions, function(err, allowed) )

 Checks if the given user is allowed to access the resource for the given
 permissions (note: it must fulfill all the permissions).

 @param {String|Number} User id.
 @param {String|Array} resource(s) to ask permissions for.
 @param {String|Array} asked permissions.
 @param {Function} Callback called wish the result.
 */
Roles.prototype.isAllowed = function (userId, resource, permissions, cb) {

    var _this = this;

    // get user's roles
    new this.UserModel({'id': userId}).fetch({
        withRelated: ['UserRole']
    }).then(function (userModel) {
        if (userModel) {
            var roles = userModel.related('UserRole');
            if (roles.length > 0) {
                _this.areAnyRolesAllowed(roles, resource, permissions, function (err, isAllowed) {
                    if (err) {
                        cb(err);
                    } else {
                        cb(null, isAllowed);
                    }
                });
            }
            else {
                cb(null, false);
            }
        }
        else {
            console.log("User with id " + userId + " does not exist in database. Returning false for isAllowed.");
            cb(null, false);
        }
    }).catch(function (error) {
            cb(error);
        }
    );
};

/**
 areAnyRolesAllowed( roles, resource, permissions, function(err, allowed) )

 Returns true if any of the given roles have the right permissions.

 @param {String|Array} Role(s) to check the permissions for.
 @param {String} resource(s) to ask permissions for.
 @param {String|Array} asked permissions.
 @param {Function} Callback called with the result.
 */
Roles.prototype.areAnyRolesAllowed = function (roles, resource, permissions, cb) {

    roles = makeArray(roles);
    permissions = makeArray(permissions);

    if (roles.length === 0) {
        cb(null, false);
    } else {
        return this._checkPermissions(roles, resource, permissions).nodeify(cb);
    }
};

//
// NOTE: This function will not handle circular dependencies and result in a crash.
//
Roles.prototype._checkPermissions = function (roles, resource, permissions) {
    var _this = this;

    return this.backend.unionAsync(allowsBucket(resource), roles).then(function (resourcePermissions) {
        if (resourcePermissions.indexOf('*') !== -1) {
            return true;
        } else {
            permissions = permissions.filter(function (p) {
                return resourcePermissions.indexOf(p) === -1;
            });

            if (permissions.length === 0) {
                return true;
            } else {
                return _this.backend.unionAsync('parents', roles).then(function (parents) {
                    if (parents && parents.length) {
                        return _this._checkPermissions(parents, resource, permissions);
                    } else {
                        return false;
                    }
                });
            }
        }
    });
};

//-----------------------------------------------------------------------------
//
// Helpers
//
//-----------------------------------------------------------------------------

function makeArray(arr) {
    return Array.isArray(arr) ? arr : [arr];
}

/**
 Express Middleware

 */
Roles.prototype.middleware = function (numPathComponents, userId, actions) {

    var roles = this;

    var HttpError = function (errorCode, msg) {
        this.errorCode = errorCode;
        this.msg = msg;

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
            if ((req.session) && (req.session.userId)) {
                _userId = req.session.userId;
            } else {
                next(new HttpError(401, 'User not authenticated'));
                return;
            }
        }

        url = req.url.split('?')[0];
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
                roles.allowedPermissions(_userId, resource, function (err, obj) {
                    console.log('Allowed permissions: ' + util.inspect(obj));
                });
                next(new HttpError(401, 'Insufficient permissions to access resource'));
            } else {
                console.log('Allowed ' + actions + ' on ' + resource + ' by user ' + _userId);
                next();
            }
        });
    };
};

module.exports = Roles;


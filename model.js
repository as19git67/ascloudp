var config = require('./config');
var Promise = require('bluebird/js/main/promise')();
var _ = require('underscore');
var getProfiles = require('./profiles');

var databaseClient = config.get('databaseClient');
var connectionString = config.get('connectionString');

var knex = require('knex')({client: databaseClient, connection: connectionString });
var bookshelf = require('bookshelf')(knex);

var crypto = require('crypto');

function authenticate() {
    var user = getUsername().then(function (username) {
        return getUser(username);
    });

    return user.then(function (user) {
        return getPassword();
    }).then(function (password) {
        // Guaranteed that user promise is fulfilled, so .value() can be called here
        if (user.value().passwordHash !== hash(password)) {
            throw new Error("Can't authenticate");
        }
    });
}

exports.createSchemaIfNotExists = function () {
    return new Promise(function (resolve, reject) {
        knex.schema.hasTable('RolePermissions').then(function (exists) {
            if (exists) {
                knex.schema.hasTable('UserLogins').then(function (exists) {
                    if (exists) {
                        console.log('DB schema exists.');
                        resolve();
                    } else {
                        console.log('Must create DB schema.');
                        exports.createSchema().then(
                            function () {
                                console.log('DB schema created.');
                                resolve();
                            },
                            reject);
                    }
                });
            } else {
                console.log('Must create DB schema.');
                exports.createSchema().then(
                    function () {
                        console.log('DB schema created.');
                        resolve();
                    },
                    reject);
            }
        });
    });
};

exports.createSchema = function () {
    return Promise.reduce([
            function () {
                return  knex.schema.dropTableIfExists('Audits');
            },
            function () {
                return  knex.schema.dropTableIfExists('UserClaims');
            },
            function () {
                return  knex.schema.dropTableIfExists('UserLogins');
            },
            function () {
                return  knex.schema.dropTableIfExists('UserRoles');
            },
            function () {
                return  knex.schema.dropTableIfExists('Users');
            },
            function () {
                return  knex.schema.dropTableIfExists('RolePermissions');
            },
            function () {
                return  knex.schema.dropTableIfExists('Roles');
            },
            // ### CREATION STARTS HERE
            function () {
                return  knex.schema.createTable('Roles', function (t) {
                    t.increments('id').primary();
                    t.string('Name').unique().notNullable();
                });
            },
            function () {
                return  knex.schema.createTable('RolePermissions', function (t) {
                    t.increments('id').primary();
                    t.integer('Role_id').notNullable().references('id').inTable('Roles').index();
                    t.string('Resource').notNullable().index();
                    t.string('Permission', 6).notNullable().index();
                    t.unique(['Role_id', 'Resource', 'Permission']);
                });
            },
            function () {
                return  knex.schema.createTable('Users', function (t) {
                    t.increments('id').primary();
                    t.string('Email', 256);
                    t.boolean('EmailConfirmed').notNullable();
                    t.string('PasswordHash');
                    t.string('PasswordSalt');
                    t.string('SecurityStamp');
                    t.string('PhoneNumber');
                    t.boolean('PhoneNumberConfirmed').notNullable();
                    t.boolean('TwoFactorEnabled').notNullable();
                    t.dateTime('LockoutEndDateUtc');
                    t.boolean('LockoutEnabled').notNullable();
                    t.integer('AccessFailedCount').notNullable();
                    t.string('UserName', 256).unique().notNullable();
                });
            },
            function () {
                return  knex.schema.createTable('UserRoles', function (t) {
                    t.increments('id').primary();
                    t.integer('User_id').notNullable().references('id').inTable('Users').index();
                    t.integer('Role_id').notNullable().references('id').inTable('Roles').index();
                    t.unique(['User_id', 'Role_id']);
                });
            },
            function () {
                return knex.schema.createTable('UserLogins', function (t) {
                    t.increments('id').primary();
                    t.string('LoginProvider', 128).notNullable();
                    t.string('ProviderKey', 128).notNullable();
                    t.integer('User_id').notNullable().references('id').inTable('Users').index();
                    t.unique(['LoginProvider', 'ProviderKey']);
                });
            },
            function () {
                return knex.schema.createTable('UserClaims', function (t) {
                    t.increments('id').primary();
                    t.integer('User_id').notNullable().references('id').inTable('Users').index();
                    t.string('ClaimType');
                    t.string('ClaimValue');
                });
            },
            function () {
                return  knex.schema.createTable('Audits', function (t) {
                    t.increments('id').primary();
                    t.timestamp('ChangedAt').notNullable().index();
                    t.string('Table').notNullable().index();
                    t.string('ChangedBy').notNullable().index();
                    t.string('Description').notNullable();
                });
            },
            function () {
                return new Promise(function (resolve, reject) {
                    var username = config.get('adminUser');
                    var password = config.get('initialAdminPassword');
                    if (username && username.trim().length > 0 && password && password.trim().length > 0) {
                        var adminRoleName = "Administrator";
                        var salt = createSalt();

                        new User({
                            Email: username,
                            EmailConfirmed: false,
                            PhoneNumberConfirmed: false,
                            TwoFactorEnabled: false,
                            LockoutEnabled: false,
                            AccessFailedCount: 0,
                            UserName: username,
                            PasswordSalt: salt,
                            PasswordHash: encryptPassword(password, salt)})
                            .save()
                            .then(function (newUserModel) {
                                var userId = newUserModel.get('id');
                                console.log("Admin User '" + username + "' added to DB. ID: " + userId);

                                new Role({Name: adminRoleName}).save().then(function (newRoleModel) {
                                    var roleId = newRoleModel.get('id');
                                    console.log("Role " + newRoleModel.get('Name') + " added to DB. ID: " + roleId);
                                    new UserRole({ User_id: userId, Role_id: roleId}).save().then(function (userRole) {
                                        console.log("Role " + newRoleModel.get('Name') + " assigned to " + newUserModel.get('UserName'));

                                        // add all profiles to Administrator role
                                        var profiles = getProfiles();
                                        var allRolePermissions = [];
                                        var checkHash = {};

                                        _.each(profiles, function (profile) {
                                            _.each(profile.resources, function (resource) {
                                                _.each(profile.permissions, function (permission) {
                                                    // use hash map to quickly check for unique resource and permission
                                                    var checkKey = resource + "_" + permission;
                                                    if (!checkHash[checkKey]) {
                                                        allRolePermissions.push(
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
                                        });
                                        var rolePermissions = RolePermissions.forge(allRolePermissions);
                                        console.log("Adding role permissions to role " + newRoleModel.get('Name'));
                                        Promise.all(rolePermissions.invoke('save')).then(function () {
                                            console.log("Role permissions added to role " + newRoleModel.get('Name'));
                                            resolve();
                                        }).catch(function (error) {
                                            console.log("Error while saving role permissions for role " + newRoleModel.get('Name'));
                                            reject(error);
                                        });

                                    }).catch(function (error) {
                                        console.log("Error while assigning role " + newRoleModel.get('Name') + " to user " + newUserModel.get('UserName'));
                                        reject(error);
                                    });

                                }).catch(function (error) {
                                    console.log("Error while adding new role " + adminRoleName);
                                    reject(error);
                                });
                            });
                    }
                    else {
                        console.log("Not adding admin user, because it is not configured.");
                        resolve();
                    }
                });
            }
        ],
        function (total, current, index, arrayLength) {
            console.log("createSchema step " + (index + 1) + " von " + arrayLength);
            return current().then(function () {
            }).return(total + 1);
        }, 0);

};

var User = bookshelf.Model.extend({
    tableName: 'Users',
    UserLogin: function () {
        return this.hasMany(UserLogin);
    },
    UserRole: function () {
        return this.hasMany(UserRole);
    }
});

var UserLogin = bookshelf.Model.extend({
    tableName: 'UserLogins',
    User: function () {
        return this.belongsTo(User);
    }
});

var Role = bookshelf.Model.extend({
    tableName: 'Roles',
    UserRole: function () {
        return this.hasMany(UserRole);
    },
    RolePermission: function () {
        return this.hasMany(RolePermission);
    }
});

var UserRole = bookshelf.Model.extend({
    tableName: 'UserRoles',
    User: function () {
        return this.belongsTo(User);
    },
    Role: function () {
        return this.belongsTo(Role);
    }
});

var RolePermission = bookshelf.Model.extend({
    tableName: 'RolePermissions',
    Role: function () {
        return this.belongsTo(Role);
    }
});

var RolePermissions = bookshelf.Collection.extend({
    model: RolePermission
});

var Audit = bookshelf.Model.extend({
    tableName: 'Audits'
});

var createSalt = function () {
    var salt = crypto.randomBytes(32).toString('base64');
    return salt;
};

var encryptPassword = function (password, salt) {
    return crypto.createHmac('sha1', salt).update(password).digest('hex');
    //more secure – return crypto.pbkdf2Sync(password, this.salt, 10000, 512);
};

var checkPassword = function (hashedPassword, password, salt) {
    if (!hashedPassword) {
        return false;
    }
    return encryptPassword(password, salt) === hashedPassword;
};

module.exports.createSalt = createSalt;
module.exports.encryptPassword = encryptPassword;
module.exports.checkPassword = checkPassword;
module.exports.models = {
    User: User,
    UserLogin: UserLogin,
    Role: Role,
    RolePermission: RolePermission,
    RolePermissions: RolePermissions,
    UserRole: UserRole,
    Audit: Audit
};

module.exports.bookshelf = bookshelf;

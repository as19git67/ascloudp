var config = require('./config');
var Promise = require('bluebird/js/main/promise')();
var _ = require('underscore');
var getProfiles = require('./Profiles');

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
        knex.schema.hasTable('RoleMenus').then(function (exists) {
            if (exists) {
                knex.schema.hasTable('PageContents').then(function (exists) {
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
                return  knex.schema.dropTableIfExists('PageContents');
            },
            function () {
                return  knex.schema.dropTableIfExists('Pages');
            },
            function () {
                return  knex.schema.dropTableIfExists('Memberships');
            },
            function () {
                return  knex.schema.dropTableIfExists('Persons');
            },
            function () {
                return  knex.schema.dropTableIfExists('LeavingReasons');
            },
            function () {
                return  knex.schema.dropTableIfExists('MembershipFees');
            },
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
                return  knex.schema.dropTableIfExists('RoleMenus');
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
                return  knex.schema.createTable('RoleMenus', function (t) {
                    t.increments('id').primary();
                    t.integer('Role_id').notNullable().references('id').inTable('Roles').index();
                    t.string('Menu').notNullable().index();
                    t.unique(['Role_id', 'Menu']);
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
                return  knex.schema.createTable('Persons', function (t) {
                    t.increments('id').primary();
                    t.string('Salutation');
                    t.string('Firstname', 20);
                    t.string('Lastname', 30).notNullable().index();
                    t.string('Suffix', 10);
                    t.dateTime('Birthday');
                    t.boolean('Deleted').notNullable().defaultTo(false);
                    t.timestamp('valid_start').index();
                    t.timestamp('valid_end').index();
                });
            },
            function () {
                return  knex.schema.createTable('MembershipFees', function (t) {
                    t.increments('id').primary();
                    t.string('Name').notNullable();
                    var precision = 6;  // number of possible digits including after comma
                    var scale = 2;  // 2 digits after comma
                    t.decimal('Amount', precision, scale).notNullable();
                    t.boolean('Deleted').notNullable().defaultTo(false);
                    t.unique('Name', 'Amount');
                });
            },
            function () {
                return  knex.schema.createTable('LeavingReasons', function (t) {
                    t.increments('id').primary();
                    t.string('Name').unique();
                    t.boolean('Deleted').notNullable().defaultTo(false);
                });
            },
            function () {
                return  knex.schema.createTable('Memberships', function (t) {
                    t.increments('id').primary();
                    t.integer('MembershipNumber').notNullable().index();
                    t.integer('Person_id').notNullable().references('id').inTable('Persons').index();
                    t.dateTime('EntryDate').notNullable().index();
                    t.dateTime('LeavingDate').index();
                    t.integer('LeavingReason_id').references('id').inTable('LeavingReasons');
                    t.dateTime('PassiveSince').index();
                    t.dateTime('LivingElsewhereSince').index();
                    t.integer('MembershipFee_id').references('id').inTable('MembershipFees');
                    t.boolean('Deleted').notNullable().defaultTo(false);
                    t.timestamp('valid_start').index();
                    t.timestamp('valid_end').index();
                });
            },
            function () {
                return  knex.schema.createTable('Pages', function (t) {
                    t.increments('id').primary();
                    t.string('Name', 25).notNullable().unique();
                    t.integer('Order').notNullable().unique();
                    t.string('EntityNameSingular').notNullable();
                    t.string('EntityNamePlural').notNullable();
                    t.string('Model');
                    t.string('Collection');
                    t.string('View').notNullable();
                });
            },
            function () {
                return  knex.schema.createTable('PageContents', function (t) {
                    t.increments('id').primary();
                    t.string('Page_id').references('Name').inTable('Pages');
                    t.string('RawHTML', 50000);
                    t.boolean('Deleted').notNullable().defaultTo(false);
                    t.timestamp('valid_start').index();
                    t.timestamp('valid_end').index();
                });
            },
            function () {
                return new Promise(function (resolve, reject) {
                    var allPages = [
                        {Order: 1, Name: "termine", EntityNameSingular: "Termin", EntityNamePlural: "Termine", Collection: "Events", View: "genericList"},
                        {Order: 2, Name: "mitglieder", EntityNameSingular: "Mitglied", EntityNamePlural: "Mitglieder", Collection: "Memberships", View: "genericList"},
                        {Order: 3, Name: "kontakte", EntityNameSingular: "Kontakt", EntityNamePlural: "Kontakte", Collection: "Contacts", View: "genericList"},
                        {Order: 4, Name: "mitmachen", EntityNameSingular: "Mitmachen", EntityNamePlural: "Mitmachinfos", Model: "PageContent", View: "genericHTML"}
                    ];
                    var pages = Pages.forge(allPages);
                    console.log("Adding pages.");
                    Promise.all(pages.invoke('save')).then(function () {
                        console.log("Pages added to database.");
                        resolve();
                    }).catch(function (error) {
                        console.log("Error while saving pages: " + error);
                        reject(error);
                    });
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
                                        getProfiles().then(function (profiles) {
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

                                            var allRoleMenus = [];
                                            checkHash = {};
                                            _.each(profiles, function (profile) {
                                                _.each(profile.menus, function (menu) {
                                                    if (!checkHash[menu]) {
                                                        allRoleMenus.push({ Role_id: roleId, Menu: menu });
                                                        checkHash[menu] = true;
                                                    }
                                                });
                                            });

                                            var rolePermissions = RolePermissions.forge(allRolePermissions);
                                            console.log("Adding role permissions to role " + newRoleModel.get('Name'));
                                            Promise.all(rolePermissions.invoke('save')).then(function () {
                                                console.log("Role permissions added to role " + newRoleModel.get('Name'));

                                                var roleMenus = RoleMenus.forge(allRoleMenus);
                                                console.log("Adding role menus to role " + newRoleModel.get('Name'));
                                                Promise.all(roleMenus.invoke('save')).then(function () {
                                                    console.log("Role menus added to role " + newRoleModel.get('Name'));
                                                    resolve();
                                                }).catch(function (error) {
                                                    console.log("Error while saving role menus for role " + newRoleModel.get('Name') + ": " + error);
                                                    reject(error);
                                                });
                                            }).catch(function (error) {
                                                console.log("Error while saving role permissions for role " + newRoleModel.get('Name') + ": " + error);
                                                reject(error);
                                            });

                                        }).catch(function (error) {
                                            console.log("Error getting profiles: " + error);
                                            reject(error);
                                        });

                                    }).catch(function (error) {
                                        console.log("Error while assigning role " + newRoleModel.get('Name') + " to user " + newUserModel.get('UserName') +
                                                    ": " + error);
                                        reject(error);
                                    });

                                }).catch(function (error) {
                                    console.log("Error while adding new role " + adminRoleName + ": " + error);
                                    reject(error);
                                });
                            });
                    }
                    else {
                        console.log("Not adding admin user, because it is not configured.");
                        resolve();
                    }
                });
            },
            function () {
                return new Promise(function (resolve, reject) {
                    var allMembershipFees = [
                        { Name: 'Aktiv 7€', Amount: 7.00 },
                        { Name: 'Aktiv Jugendlich 7€', Amount: 7.00 },
                        { Name: 'Passiv 0€', Amount: 0.00 }
                    ];
                    var membershipFees = MembershipFees.forge(allMembershipFees);
                    console.log("Adding membership fees.");
                    Promise.all(membershipFees.invoke('save')).then(function () {
                        console.log("Membership fees added to database.");
                        resolve();
                    }).catch(function (error) {
                        console.log("Error while saving membership fees: " + error);
                        reject(error);
                    });
                });
            },
            function () {
                return new Promise(function (resolve, reject) {
                    var allLeavingReasons = [
                        {Name: "Tod"},
                        {Name: "Austritt"},
                        {Name: "Entlassen"}
                    ];
                    var leavingReasons = LeavingReasons.forge(allLeavingReasons);
                    console.log("Adding leaving reasons.");
                    Promise.all(leavingReasons.invoke('save')).then(function () {
                        console.log("Leaving reasons added to database.");
                        resolve();
                    }).catch(function (error) {
                        console.log("Error while saving leaving reason: " + error);
                        reject(error);
                    });
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
    },
    RoleMenu: function () {
        return this.hasMany(RoleMenu);
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

var UserRoles = bookshelf.Collection.extend({
    model: UserRole
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

var RoleMenu = bookshelf.Model.extend({
    tableName: 'RoleMenus',
    Role: function () {
        return this.belongsTo(Role);
    }
});

var RoleMenus = bookshelf.Collection.extend({
    model: RoleMenu
});

var Audit = bookshelf.Model.extend({
    tableName: 'Audits'
});

var Person = bookshelf.Model.extend({
    tableName: 'Persons',
    Membership: function () {
        return this.hasMany(Membership);
    }
});

var Membership = bookshelf.Model.extend({
    tableName: 'Memberships',
    Person: function () {
        return this.belongsTo(Person);
    },
    LeavingReason: function () {
        return this.hasOne(LeavingReason);
    },
    MembershipFee: function () {
        return this.belongsTo(MembershipFee);
    }
});

var Memberships = bookshelf.Collection.extend({
    model: Membership
});

var MembershipFee = bookshelf.Model.extend({
    tableName: 'MembershipFees',
    Membership: function () {
        return this.belongsTo(Membership);
    }
});

var MembershipFees = bookshelf.Collection.extend({
    model: MembershipFee
});

var LeavingReason = bookshelf.Model.extend({
    tableName: 'LeavingReasons',
    Membership: function () {
        return this.belongsTo(Membership);
    }
});

var LeavingReasons = bookshelf.Collection.extend({
    model: LeavingReason
});

var Page = bookshelf.Model.extend({
    tableName: 'Pages',
    isSingleEntity: function () {
        // return true, if this page is configured to display a single entity and no list of it
        return this.get('Collection') == undefined;
    }
});

var Pages = bookshelf.Collection.extend({
    model: Page,
    PageContent: function () {
        return this.hasOne(PageContent);
    }
});

var PageContent = bookshelf.Model.extend({
    tableName: 'PageContents',
    Page: function () {
        return this.belongsTo(Page);
    }
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

// Always resolve with pages array, even if an error occurs. Then pages is [].
var getPages = function () {
    return new Promise(function (resolve, reject) {
        var pages = [];
        new Page().query(function (qb) {
            qb.orderBy('Order', 'ASC');
        }).fetchAll()
            .then(function (pageList) {
                pageList.each(function (page) {
                    var pageObj = {
                        Page_id: page.get('id'),
                        Name: page.get('Name'),
                        EntityNameSingular: page.get('EntityNameSingular'),
                        EntityNamePlural: page.get('EntityNamePlural'),
                        View: page.get('View'),
                        isSingleEntity: page.isSingleEntity()
                    };
                    if (pageObj.isSingleEntity) {
                        pageObj.Model = page.get('Model');
                    } else {
                        pageObj.Collection = page.get('Collection');
                    }
                    pages.push(pageObj);
                });
                resolve(pages);
            }).catch(function (error) {
                console.log("Retrieving pages from database failed: " + error);
                resolve(pages);
            });
    });
};

var getPagesForUser = function (userId) {
    return getPages();
};

module.exports.createSalt = createSalt;
module.exports.encryptPassword = encryptPassword;
module.exports.checkPassword = checkPassword;
module.exports.getPages = getPages;
module.exports.getPagesForUser = getPagesForUser;

module.exports.models = {
    User: User,
    UserLogin: UserLogin,
    Role: Role,
    RolePermission: RolePermission,
    RolePermissions: RolePermissions,
    RoleMenu: RoleMenu,
    RoleMenus: RoleMenus,
    UserRole: UserRole,
    UserRoles: UserRoles,
    Audit: Audit,
    Person: Person,
    Membership: Membership,
    Memberships: Memberships,
    LeavingReason: LeavingReason,
    LeavingReasons: LeavingReasons,
    Page: Page,
    Pages: Pages,
    PageContent: PageContent
};

module.exports.pageModels = {
    members: {
        name: "Mitglieder",
        model: Memberships
    },
    member: {
        name: "Mitglied",
        model: Membership
    }
};

module.exports.bookshelf = bookshelf;

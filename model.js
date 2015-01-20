var config = require('./config');
var Promise = require('bluebird/js/main/promise')();
var _ = require('underscore');
var moment = require('moment');
var model = require('./model');
var getProfiles = require('./Profiles');

var databaseClient = config.get('databaseClient');
var connectionString = config.get('connectionString');

var knex = require('knex')({client: databaseClient, connection: connectionString, debug: false});
var bookshelf = require('bookshelf')(knex);

var crypto = require('crypto');

exports.createSchemaIfNotExists = function () {
    return new Promise(function (resolve, reject) {
        knex.schema.hasTable('RoleMenus').then(function (exists) {
            if (exists) {
                knex.schema.hasTable('PersonContactDataPhonenumbers').then(function (exists) {
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
                return knex.schema.dropTableIfExists('LinkItems');
            },
            function () {
                return knex.schema.dropTableIfExists('Links');
            },
            function () {
                return knex.schema.dropTableIfExists('ContactItems');
            },
            function () {
                return knex.schema.dropTableIfExists('Contacts');
            },
            function () {
                return knex.schema.dropTableIfExists('EventItems');
            },
            function () {
                return knex.schema.dropTableIfExists('Events');
            },
            function () {
                return knex.schema.dropTableIfExists('ArticleReferenceItems');
            },
            function () {
                return knex.schema.dropTableIfExists('ArticleReferences');
            },
            function () {
                return knex.schema.dropTableIfExists('ArticleSectionItems');
            },
            function () {
                return knex.schema.dropTableIfExists('ArticleSections');
            },
            function () {
                return knex.schema.dropTableIfExists('ArticleItems');
            },
            function () {
                return knex.schema.dropTableIfExists('Articles');
            },
            function () {
                return knex.schema.dropTableIfExists('PageCollectionColumns');
            },
            function () {
                return knex.schema.dropTableIfExists('PageContents');
            },
            function () {
                return knex.schema.dropTableIfExists('Pages');
            },
            function () {
                return knex.schema.dropTableIfExists('MembershipItems');
            },
            function () {
                return knex.schema.dropTableIfExists('Memberships');
            },
            function () {
                return knex.schema.dropTableIfExists('PersonContactDataAccounts');
            },
            function () {
                return knex.schema.dropTableIfExists('PersonContactDataPhonenumbers');
            },
            function () {
                return knex.schema.dropTableIfExists('PersonContactDataAddresses');
            },
            function () {
                return knex.schema.dropTableIfExists('PersonContactDatas');
            },
            function () {
                return knex.schema.dropTableIfExists('PersonContactTypes');
            },
            function () {
                return knex.schema.dropTableIfExists('PersonItems');
            },
            function () {
                return knex.schema.dropTableIfExists('Persons');
            },
            function () {
                return knex.schema.dropTableIfExists('LeavingReasons');
            },
            function () {
                return knex.schema.dropTableIfExists('MembershipFees');
            },
            function () {
                return knex.schema.dropTableIfExists('Audits');
            },
            function () {
                return knex.schema.dropTableIfExists('UserClaims');
            },
            function () {
                return knex.schema.dropTableIfExists('UserLogins');
            },
            function () {
                return knex.schema.dropTableIfExists('UserRoles');
            },
            function () {
                return knex.schema.dropTableIfExists('Users');
            },
            function () {
                return knex.schema.dropTableIfExists('RolePermissions');
            },
            function () {
                return knex.schema.dropTableIfExists('RoleMenus');
            },
            function () {
                return knex.schema.dropTableIfExists('Roles');
            },
            // ### CREATION STARTS HERE
            function () {
                return knex.schema.createTable('Roles', function (t) {
                    t.increments('id').primary();
                    t.string('Name').unique().notNullable();
                });
            },
            function () {
                return knex.schema.createTable('RolePermissions', function (t) {
                    t.increments('id').primary();
                    t.integer('Role_id').notNullable().references('id').inTable('Roles').index();
                    t.string('Resource').notNullable().index();
                    t.string('Permission', 6).notNullable().index();
                    t.unique(['Role_id', 'Resource', 'Permission']);
                });
            },
            function () {
                return knex.schema.createTable('RoleMenus', function (t) {
                    t.increments('id').primary();
                    t.integer('Role_id').notNullable().references('id').inTable('Roles').index();
                    t.string('Menu').notNullable().index();
                    t.unique(['Role_id', 'Menu']);
                });
            },
            function () {
                return knex.schema.createTable('Users', function (t) {
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
                return knex.schema.createTable('UserRoles', function (t) {
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
                return knex.schema.createTable('Audits', function (t) {
                    t.increments('id').primary();
                    t.timestamp('ChangedAt').notNullable().index();
                    t.string('Table').notNullable().index();
                    t.string('ChangedBy').notNullable().index();
                    t.string('Description').notNullable();
                });
            },
            function () {
                return knex.schema.createTable('Persons', function (t) {
                    t.increments('id').primary();
                });
            },
            function () {
                return knex.schema.createTable('PersonItems', function (t) {
                    t.increments('id').primary();
                    t.integer('Person_id').notNullable().references('id').inTable('Persons').index();
                    t.string('Salutation');
                    t.string('Firstname', 20);
                    t.string('Lastname', 30).notNullable().index();
                    t.string('Suffix', 10);
                    t.dateTime('Birthday');
                    t.timestamp('valid_start').index();
                    t.timestamp('valid_end').index();
                });
            },
            function () {
                return knex.schema.createTable('PersonContactTypes', function (t) {
                    t.increments('id').primary();
                    t.string('Name', 10).unique();
                    t.string('Description', 20).notNullable();
                    t.boolean('Deleted').notNullable().defaultTo(false);
                });
            },
            function () {
                return new Promise(function (resolve, reject) {
                    var allContactTypes = [
                        {Name: "address", Description: "Adresse"},
                        {Name: "email", Description: "Email"},
                        {Name: "phone", Description: "Telefon"},
                        {Name: "twitter", Description: "Twitter"},
                        {Name: "facebook", Description: "Facebook"},
                        {Name: "microsoft", Description: "Microsoft"},
                        {Name: "google", Description: "Google"},
                        {Name: "applepush", Description: "Apple Push"},
                        {Name: "googlepush", Description: "Google Push"},
                        {Name: "mspush", Description: "Microsoft Push"}
                    ];
                    var contactTypes = PersonContactTypes.forge(allContactTypes);
                    console.log("Adding contact types.");
                    Promise.all(contactTypes.invoke('save')).then(function () {
                        console.log("Contact types added to database.");
                        resolve();
                    }).catch(function (error) {
                        console.log("Error while saving contact types: " + error);
                        reject(error);
                    });
                });
            },
            function () {
                return knex.schema.createTable('PersonContactDatas', function (t) {
                    t.increments('id').primary();
                    t.integer('Person_id').notNullable().references('id').inTable('Persons').index();
                    t.integer('PersonContactType_id').notNullable().references('id').inTable('PersonContactTypes').index();
                    t.string('Usage', 15).notNullable();
//                    t.unique(['Person_id', 'PersonContactType_id', 'Usage']);
                });
            },
            function () {
                return knex.schema.createTable('PersonContactDataAddresses', function (t) {
                    t.increments('id').primary();
                    t.integer('PersonContactData_id').notNullable().references('id').inTable('PersonContactDatas').index();
                    t.string('Street', 30).index();
                    t.string('StreetNumber', 5);
                    t.integer('Postalcode').notNullable().index();
                    t.string('City').notNullable().index();
                    t.timestamp('valid_start').index();
                    t.timestamp('valid_end').index();
                });
            },
            function () {
                return knex.schema.createTable('PersonContactDataPhonenumbers', function (t) {
                    t.increments('id').primary();
                    t.integer('PersonContactData_id').notNullable().references('id').inTable('PersonContactDatas').index();
                    t.string('Number', 30).notNullable();
                    t.timestamp('valid_start').index();
                    t.timestamp('valid_end').index();
                });
            },
            function () {
                return knex.schema.createTable('PersonContactDataAccounts', function (t) {
                    t.increments('id').primary();
                    t.integer('PersonContactData_id').notNullable().references('id').inTable('PersonContactDatas');
                    t.string('Account', 50).notNullable();
                    t.timestamp('valid_start').index();
                    t.timestamp('valid_end').index();
                });
            },
            function () {
                return knex.schema.createTable('MembershipFees', function (t) {
                    t.increments('id').primary();
                    t.string('Name').notNullable();
                    var precision = 6;  // number of possible digits including after comma
                    var scale = 2;  // 2 digits after comma
                    t.decimal('Amount', precision, scale).notNullable();
                    t.boolean('Deleted').notNullable().defaultTo(false);
                    t.unique(['Name', 'Amount']);
                });
            },
            function () {
                return knex.schema.createTable('LeavingReasons', function (t) {
                    t.increments('id').primary();
                    t.string('Name').unique();
                    t.boolean('Deleted').notNullable().defaultTo(false);
                });
            },
            function () {
                return knex.schema.createTable('Memberships', function (t) {
                    t.increments('id').primary();
                    t.integer('MembershipNumber').notNullable().unique(); // unique constraint only in this table
                    t.integer('Person_id').notNullable().references('id').inTable('Persons');
                });
            },
            function () {
                return knex.schema.createTable('MembershipItems', function (t) {
                    t.increments('id').primary();
                    t.integer('Membership_id').notNullable().references('id').inTable('Memberships');
                    t.integer('MembershipNumber').notNullable();
                    t.dateTime('EntryDate').notNullable().index();
                    t.dateTime('LeavingDate').index();
                    t.integer('LeavingReason_id').references('id').inTable('LeavingReasons');
                    t.dateTime('PassiveSince').index();
                    t.integer('MembershipFee_id').references('id').inTable('MembershipFees');
                    t.timestamp('valid_start').index();
                    t.timestamp('valid_end').index();
                });
            },
            function () {
                return knex.schema.createTable('Pages', function (t) {
                    t.increments('id').primary();
                    t.string('Name', 25).notNullable().unique();
                    t.integer('Order').notNullable().unique();
                    t.boolean('AnonymousAccess').notNullable().defaultTo(false);
                    t.string('EntityNameSingular').notNullable();
                    t.string('EntityNamePlural').notNullable();
                    t.string('Model');
                    t.string('Collection');
                    t.string('View').notNullable();
                    t.unique(['Name', 'Order']);
                });
            },
            function () {
                return knex.schema.createTable('PageContents', function (t) {
                    t.increments('id').primary();
                    t.string('Page_id').references('Name').inTable('Pages').notNullable();
                    t.string('Text', 50000);
                    t.timestamp('valid_start').index();
                    t.timestamp('valid_end').index();
                    t.unique(['Page_id']);
                });
            },
            function () {
                return knex.schema.createTable('PageCollectionColumns', function (t) {
                    t.increments('id').primary();
                    t.string('Page_id').references('Name').inTable('Pages').notNullable();
                    t.integer('Order').notNullable().index();
                    t.string('Name').notNullable();
                    t.string('Caption');
                    t.string('Type').notNullable();
                    t.boolean('Mandatory').notNullable();
                    t.unique(['Page_id', 'Order']);
                    t.unique(['Page_id', 'Name']);
                });
            },
            function () {
                return knex.schema.createTable('Articles', function (t) {
                    t.increments('id').primary();
                    t.string('Page_id').references('Name').inTable('Pages');
                });
            },
            function () {
                return knex.schema.createTable('ArticleItems', function (t) {
                    t.increments('id').primary();
                    t.integer('Article_id').references('id').inTable('Articles');
                    t.datetime('Date').notNullable().index();
                    t.string('Author');
                    t.string('Text', 100000);
                    t.timestamp('publish_start').notNullable().index();
                    t.timestamp('publish_end').index();
                    t.timestamp('valid_start').index();
                    t.timestamp('valid_end').index();
                });
            },
            function () {
                return knex.schema.createTable('Events', function (t) {
                    t.increments('id').primary();
                    t.string('Page_id').references('Name').inTable('Pages').notNullable();
                });
            },
            function () {
                return knex.schema.createTable('EventItems', function (t) {
                    t.increments('id').primary();
                    t.integer('Event_id').references('id').inTable('Events').notNullable();
                    t.string('Title', 75).notNullable();
                    t.string('Location', 200);
                    t.string('Description', 5000);
                    t.timestamp('event_start').notNullable().index();
                    t.timestamp('event_end').notNullable().index();
                    t.timestamp('publish_start').index();
                    t.timestamp('publish_end').index();
                    t.timestamp('valid_start').index();
                    t.timestamp('valid_end').index();
                });
            },
            function () {
                return knex.schema.createTable('Contacts', function (t) {
                    t.increments('id').primary();
                    t.string('Page_id').references('Name').inTable('Pages').notNullable();
                });
            },
            function () {
                return knex.schema.createTable('ContactItems', function (t) {
                    t.increments('id').primary();
                    t.integer('Contact_id').references('id').inTable('Contacts').notNullable();
                    t.integer('Person_id').notNullable().references('id').inTable('Persons').index();
                    t.timestamp('valid_start').index();
                    t.timestamp('valid_end').index();
                });
            },
            function () {
                return knex.schema.createTable('Links', function (t) {
                    t.increments('id').primary();
                    t.string('Url').unique();
                    t.string('Page_id').references('Name').inTable('Pages').notNullable();
                });
            },
            function () {
                return knex.schema.createTable('LinkItems', function (t) {
                    t.increments('id').primary();
                    t.integer('Link_id').references('id').inTable('Links').notNullable();
                    t.string('Url');
                    t.string('Description');
                    t.timestamp('valid_start').index();
                    t.timestamp('valid_end').index();
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
                            PasswordHash: encryptPassword(password, salt)
                        })
                            .save()
                            .then(function (newUserModel) {
                                var userId = newUserModel.get('id');
                                console.log("Admin User '" + username + "' added to DB. ID: " + userId);

                                new Role({Name: adminRoleName}).save().then(function (newRoleModel) {
                                    var roleId = newRoleModel.get('id');
                                    console.log("Role " + newRoleModel.get('Name') + " added to DB. ID: " + roleId);
                                    new UserRole({User_id: userId, Role_id: roleId}).save().then(function (userRole) {
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
                                                        allRoleMenus.push({Role_id: roleId, Menu: menu});
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
                                                    console.log("Error while saving role menus for role " + newRoleModel.get('Name') + ": " +
                                                    error);
                                                    reject(error);
                                                });
                                            }).catch(function (error) {
                                                console.log("Error while saving role permissions for role " + newRoleModel.get('Name') + ": " +
                                                error);
                                                reject(error);
                                            });

                                        }).catch(function (error) {
                                            console.log("Error getting profiles: " + error);
                                            reject(error);
                                        });

                                    }).catch(function (error) {
                                        console.log("Error while assigning role " + newRoleModel.get('Name') + " to user " +
                                        newUserModel.get('UserName') +
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
                        {Name: 'Aktiv 7€', Amount: 7.00},
                        {Name: 'Aktiv Jugendlich 7€', Amount: 7.00},
                        {Name: 'Passiv 0€', Amount: 0.00}
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
    PersonItem: function () {
        return this.hasMany(PersonItem);
    },
    Membership: function () {
        return this.hasMany(Membership);
    },
    PersonContactData: function () {
        return this.hasMany(PersonContactData);
    }
});

var PersonItem = bookshelf.Model.extend({
    tableName: 'PersonItems',
    Person: function () {
        return this.belongsTo(Person);
    }
});

var Persons = bookshelf.Collection.extend({
    model: Person
});

var PersonContactData = bookshelf.Model.extend({
    tableName: 'PersonContactDatas',
    Person: function () {
        return this.belongsTo(Person);
    },
    PersonContactType: function () {
        return this.hasOne(PersonContactType);
    },
    PersonContactDataAddress: function () {
        return this.hasOne(PersonContactDataAddress);
    },
    PersonContactDataPhonenumber: function () {
        return this.hasOne(PersonContactDataPhonenumber);
    },
    PersonContactDataAccount: function () {
        return this.hasOne(PersonContactDataAccount);
    }
});

var PersonContactDatas = bookshelf.Collection.extend({
    model: PersonContactData
});

var PersonContactType = bookshelf.Model.extend({
    tableName: 'PersonContactTypes',
    PersonContactData: function () {
        return this.belongsTo(PersonContactData);
    }
});

var PersonContactTypes = bookshelf.Collection.extend({
    model: PersonContactType
});

var PersonContactDataAddress = bookshelf.Model.extend({
    tableName: 'PersonContactDataAddresses',
    PersonContactData: function () {
        return this.belongsTo(PersonContactData);
    }
});

var PersonContactDataAddresses = bookshelf.Collection.extend({
    model: PersonContactDataAddress
});

var PersonContactDataPhonenumber = bookshelf.Model.extend({
    tableName: 'PersonContactDataPhonenumbers',
    PersonContactData: function () {
        return this.belongsTo(PersonContactData);
    }
});

var PersonContactDataPhonenumbers = bookshelf.Collection.extend({
    model: PersonContactDataPhonenumber
});

var PersonContactDataAccount = bookshelf.Model.extend({
    tableName: 'PersonContactDataAccounts',
    PersonContactData: function () {
        return this.belongsTo(PersonContactData);
    }
});

var PersonContactDataAccounts = bookshelf.Collection.extend({
    model: PersonContactDataAccount
});

var Membership = bookshelf.Model.extend({
    tableName: 'Memberships',
    Person: function () {
        return this.belongsTo(Person);
    }
});

var MembershipItem = bookshelf.Model.extend({
    tableName: 'MembershipItems',
    Membership: function () {
        return this.belongsTo(Membership);
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
    MembershipItem: function () {
        return this.belongsTo(MembershipItem);
    }
});

var MembershipFees = bookshelf.Collection.extend({
    model: MembershipFee
});

var LeavingReason = bookshelf.Model.extend({
    tableName: 'LeavingReasons',
    MembershipItem: function () {
        return this.belongsTo(MembershipItem);
    }
});

var LeavingReasons = bookshelf.Collection.extend({
    model: LeavingReason
});

var Page = bookshelf.Model.extend({
    tableName: 'Pages',
    PageContent: function () {
        return this.hasOne(PageContent);
    },
    PageCollectionColumn: function () {
        return this.hasMany(PageCollectionColumn);
    },
    Article: function () {
        return this.hasMany(Article);
    },
    Event: function () {
        return this.hasMany(Event);
    },
    Contact: function () {
        return this.hasMany(Contact);
    },
    isSingleEntity: function () {
        // return true, if this page is configured to display a single entity and no list of it
        return this.get('Collection') == undefined;
    }
});

var Pages = bookshelf.Collection.extend({
    model: Page
});

var PageContent = bookshelf.Model.extend({
    tableName: 'PageContents',
    Page: function () {
        return this.belongsTo(Page);
    }
});

var PageContents = bookshelf.Collection.extend({
    model: PageContent
});

var PageCollectionColumn = bookshelf.Model.extend({
    tableName: 'PageCollectionColumns',
    Page: function () {
        return this.belongsTo(Page);
    }
});

var PageCollectionColumns = bookshelf.Collection.extend({
    model: PageCollectionColumn
});

var Event = bookshelf.Model.extend({
    tableName: 'Events',
    Page: function () {
        return this.belongsTo(Page);
    },
    EventItem: function () {
        return this.hasMany(EventItem);
    }
});

var EventItem = bookshelf.Model.extend({
    tableName: 'EventItems',
    Event: function () {
        return this.belongsTo(Event);
    }
});

var Events = bookshelf.Collection.extend({
    model: Event
});

var Article = bookshelf.Model.extend({
    tableName: 'Articles',
    Page: function () {
        return this.belongsTo(Page);
    },
    ArticleItem: function () {
        return this.hasMany(ArticleItem);
    }
});

var ArticleItem = bookshelf.Model.extend({
    tableName: 'ArticleItems',
    Article: function () {
        return this.belongsTo(Article);
    }
});

var Articles = bookshelf.Collection.extend({
    model: Article
});

var Contact = bookshelf.Model.extend({
    tableName: 'Contacts',
    Page: function () {
        return this.belongsTo(Page);
    },
    ContactItem: function () {
        return this.hasMany(ContactItem);
    }
});

var ContactItem = bookshelf.Model.extend({
    tableName: 'ContactItems',
    Contact: function () {
        return this.belongsTo(Contact);
    }
});

var Contacts = bookshelf.Collection.extend({
    model: Contact
});

var Link = bookshelf.Model.extend({
    tableName: 'Links',
    Page: function () {
        return this.belongsTo(Page);
    },
    LinkItem: function () {
        return this.hasMany(LinkItem);
    }
});

var LinkItem = bookshelf.Model.extend({
    tableName: 'LinkItems',
    Link: function () {
        return this.belongsTo(Link);
    }
});

var Links = bookshelf.Collection.extend({
    model: Link
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
                        AnonymousAccess: page.get('AnonymousAccess'),
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

var getPagesForUser = function (user) {
    return new Promise(function (resolve, reject) {
        getPages().then(function (pages) {
            var pagesForUser = [];
            if (user && !user.isNotLocalUser && user.id) {
                var permissions = ['get'];
                // get user's role permissions filtered by user, resource and permissions
                model.bookshelf.knex('UserRoles')
                    .join('RolePermissions', 'RolePermissions.Role_id', '=', 'UserRoles.Role_id')
                    .where('UserRoles.User_id', user.id)
                    .whereIn('RolePermissions.Permission', permissions)
                    .select('UserRoles.User_id', 'RolePermissions.*')
                    .then(function (results) {
                        _.each(pages, function (page) {
                            if (page.AnonymousAccess) {
                                pagesForUser.push(page);
                            } else {
                                var resourceToCheck = "/" + page.Name;
                                var res = _.findWhere(results, {Resource: resourceToCheck});
                                if (res) {
                                    console.log("User has permission " + res.Permission + " for resource " + res.Resource);
                                    pagesForUser.push(page);
                                }
                            }
                        });
                        resolve(pagesForUser);
                    }).catch(function (error) {
                        console.log("ERROR while checking role permissions in getPagesForUser: " + error);
                        reject(error);
                    });
            } else {
                pages.forEach(function (page) {
                    if (page.AnonymousAccess) {
                        pagesForUser.push(page);
                    }
                });
                resolve(pagesForUser);
            }
        });
    });
};

var formatDateTime = function (date) {
    var mDate = moment(date);
    if (mDate.isValid()) {
        return mDate.format('D. MMMM YYYY  HH:mm');
    } else {
        return "";
    }
};

var formatDateTimeShort = function (date) {
    var mDate = moment(date);
    if (mDate.isValid()) {
        return mDate.format('L HH:mm');
    } else {
        return "";
    }
};

var formatDateTimeLong = function (date) {
    var mDate = moment(date);
    if (mDate.isValid()) {
        return mDate.format('dddd, D. MMMM YYYY  HH:mm');
    } else {
        return "";
    }
};

var formatDate = function (date) {
    var mDate = moment(date);
    if (mDate.isValid()) {
        return mDate.format('D. MMMM YYYY');
    } else {
        return "";
    }
};

var formatDateShort = function (date) {
    var mDate = moment(date);
    if (mDate.isValid()) {
        return mDate.format('L');
    } else {
        return "";
    }
};

var formatDateLong = function (date) {
    var mDate = moment(date);
    if (mDate.isValid()) {
        return mDate.format('dddd, D. MMMM YYYY');
    } else {
        return "";
    }
};

var formatTime = function (date) {
    var mDate = moment(date);
    if (mDate.isValid()) {
        return mDate.format('HH:mm');
    } else {
        return "";
    }
};

var formatTimeLong = function (date) {
    var mDate = moment(date);
    if (mDate.isValid()) {
        return mDate.format('HH:mm:ss');
    } else {
        return "";
    }
};

var formatPhoneNumber = function (phoneNumber) {
    var numberFormatted = phoneNumber;
    if (numberFormatted.substr(0, 3) == '+49') {
        numberFormatted = '0' + numberFormatted.substr(3);
    }
    if (numberFormatted.substr(0, 5) == '08233') {
        numberFormatted = '08233 ' + numberFormatted.substr(5);
    } else {
        var firstThree = numberFormatted.substr(0, 3);
        if (firstThree == '015' || firstThree == '016' || firstThree == '017') {
            numberFormatted = numberFormatted.substr(0, 4) + ' ' + numberFormatted.substr(4);
        }
    }

    return numberFormatted;
};

module.exports.createSalt = createSalt;
module.exports.encryptPassword = encryptPassword;
module.exports.checkPassword = checkPassword;
module.exports.getPages = getPages;
module.exports.getPagesForUser = getPagesForUser;
module.exports.formatDateTime = formatDateTime;
module.exports.formatDateTimeShort = formatDateTimeShort;
module.exports.formatDateTimeLong = formatDateTimeLong;
module.exports.formatDate = formatDate;
module.exports.formatDateShort = formatDateShort;
module.exports.formatDateLong = formatDateLong;
module.exports.formatTime = formatTime;
module.exports.formatTimeLong = formatTimeLong;
module.exports.formatPhoneNumber = formatPhoneNumber;

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
    PersonItem: PersonItem,
    Persons: Persons,
    PersonContactType: PersonContactType,
    PersonContactTypes: PersonContactTypes,
    PersonContactData: PersonContactData,
    PersonContactDatas: PersonContactDatas,
    PersonContactDataAddress: PersonContactDataAddress,
    PersonContactDataAddresses: PersonContactDataAddresses,
    PersonContactDataPhonenumber: PersonContactDataPhonenumber,
    PersonContactDataPhonenumbers: PersonContactDataPhonenumbers,
    PersonContactDataAccount: PersonContactDataAccount,
    PersonContactDataAccounts: PersonContactDataAccounts,
    Membership: Membership,
    MembershipItem: MembershipItem,
    Memberships: Memberships,
    LeavingReason: LeavingReason,
    LeavingReasons: LeavingReasons,
    Page: Page,
    Pages: Pages,
    PageContent: PageContent,
    PageContents: PageContents,
    PageCollectionColumn: PageCollectionColumn,
    PageCollectionColumns: PageCollectionColumns,
    Event: Event,
    EventItem: EventItem,
    Events: Events,
    Article: Article,
    ArticleItem: ArticleItem,
    Articles: Articles,
    Contact: Contact,
    ContactItem: ContactItem,
    Contacts: Contacts,
    Link: Link,
    LinkItem: LinkItem,
    Links: Links
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


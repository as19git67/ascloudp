var config = require('./config');
var Promise = require('bluebird/js/main/promise')();

var databaseClient = config.get('databaseClient');
var connectionString = config.get('connectionString');

var knex = require('knex')({client: databaseClient, connection: connectionString });
var bookshelf = require('bookshelf')(knex);

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
        knex.schema.hasTable('Roles').then(function (exists) {
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
    });
};

exports.createSchema = function () {
    return Promise.reduce([
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
                return  knex.schema.createTable('Users', function (t) {
                    t.increments('id').primary();
                    t.string('Email', 256);
                    t.boolean('EmailConfirmed').notNullable();
                    t.string('PasswordHash');
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
                    t.integer('User_id').notNullable().references('id').inTable('Users').index();
                    t.integer('Role_id').notNullable().references('id').inTable('Roles').index();
                    t.primary(['User_id', 'Role_id']);
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
    }
});

var UserLogin = bookshelf.Model.extend({
    tableName: 'UserLogins',
    User: function () {
        return this.belongsTo(User);
    }
});

var Role = bookshelf.Model.extend({
    tableName: 'Roles'
});

module.exports.models = {
    User: User,
    UserLogin: UserLogin,
    Role: Role
};

module.exports.bookshelf = bookshelf;

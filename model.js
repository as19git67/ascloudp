var config = require('./config');
var Promise = require('bluebird/js/main/promise')();

var databaseClient = config.get('databaseClient');
var connectionString = config.get('connectionString');

var knex = require('knex')({client: databaseClient, connection: connectionString });
var bookshelf = require('bookshelf')(knex);

/*function sequence(tasks) {
 var current = Promise.cast();
 for (var k = 0; k < tasks.length; ++k) {
 console.log("performing db step " + k);
 current = current.then(tasks[k]).catch(function (err) {
 console.log("step " + k + " failed: " + err);
 });
 }
 return current;
 }*/

exports.createSchema = function () {
    return Promise.reduce([
            function () {
                return  knex.schema.dropTableIfExists('UserRoles');
            },
            function () {
                return  knex.schema.dropTableIfExists('Roles');
            },
            function () {
                return  knex.schema.createTable('Roles', function (t) {
                    t.increments('id').primary();
                    t.string('Name').unique().notNullable();
                });
            },
            function () {
                return  knex.schema.dropTableIfExists('Users');
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
                    t.integer('UserId').notNullable().references('id').inTable('Users').index();
                    t.integer('RoleId').notNullable().references('id').inTable('Roles').index();
                    t.primary(['UserId', 'RoleId']);
                });
            },
            function() {
                return knex.schema.createTable('UserLogins', function(t) {
                    t.string('LoginProvider', 128).notNullable();
                    t.string('ProviderKey', 128).notNullable();
                });
            }
        ],
        function (total, current, index, arrayLength) {
            console.log("createSchema step " + (index + 1) + " von " + arrayLength);
            return current().then(function () {
            }).return(total + 1);
        }, 0);

    /*
     return sequence([
     function () {
     return knex.schema.dropTableIfExists('Roles')
     },
     knex.schema.createTable('Roles', function (t) {
     t.increments('id').primary();
     t.string('Name').unique().notNullable();
     }),
     knex.schema.dropTableIfExists('Users'),
     knex.schema.createTable('Users', function (t) {
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
     }),
     knex.schema.dropTableIfExists('UserRoles'),
     knex.schema.createTable('UserRoles', function (t) {
     t.integer('UserId').notNullable().references(id).inTable('Users').index();
     t.integer('RoleId').notNullable().references(id).inTable('Roles').index();
     table.primary(['UserId', 'RoleId']);
     })
     ]);
     */
};

var User = bookshelf.Model.extend({
    tableName: 'users',
    initialize: function () {
    }
});

var Role = bookshelf.Model.extend({
    tableName: 'roles'
});

module.exports.models = {
    User: User,
    Role: Role
};

module.exports.bookshelf = bookshelf;

var config = require('./config');
var Promise = require('bluebird/js/release/promise')();
var _ = require('underscore');
var moment = require('moment');
var fs = require('fs');

//var model = require('./model');
var getProfiles = require('./Profiles');

var databaseClient = config.get('databaseClient');
var connectionString = config.get('connectionString');

var knex = require('knex')(
    {
      client: databaseClient,
      connection: connectionString,
      debug: false,
      acquireConnectionTimeout: 40000,
      pool: {min: 1, max: 30}
    });

var bookshelf = require('bookshelf')(knex);

var crypto = require('crypto');

function extractFromArticleItem(articleItem) {
  var title;
  var text = articleItem.get('Text');
  var lineBreakLen = 2;
  var i1 = text.indexOf('\r\n');
  if (i1 < 0) {
    lineBreakLen = 1;
    i1 = text.indexOf('\n');
  }
  var line;
  if (i1 < 0) {
    line = text;
  } else {
    line = text.substring(0, i1);
  }
  var i2 = line.lastIndexOf('#');
  if (i2 >= 0) {
    title = line.substr(i2 + 1).trim();
    if (i1 < 0) {
      text = "";
    } else {
      text = text.substr(i1 + lineBreakLen);
    }
  }

  if (text.length > 0 && text[0] === '\r') {
    text = text.substr(1);
  }
  if (text.length > 0 && text[0] === '\n') {
    text = text.substr(1);
  }

  var textWithoutImages;
  // Alle Bilder aus dem Text rausnehmen
  re = /.*\!\[(.*)\]\((.*)\).*/;
  textWithoutImages = text.replace(re, "");
  re = /.*\!\((.*)\).*/;
  textWithoutImages = textWithoutImages.replace(re, "").trim();

  // take first paragraph as leadText
  var leadText = "";
  if (textWithoutImages.length > 0) {
    lineBreakLen = 2;
    i1 = textWithoutImages.indexOf('\r\n');
    if (i1 < 0) {
      lineBreakLen = 1;
      i1 = textWithoutImages.indexOf('\n');
    }
    if (i1 < 0) {
      leadText = textWithoutImages.trim();
    } else {
      leadText = textWithoutImages.substring(0, i1).trim();
    }
    // falls die erste Zeile nur eine Leerzeile war, nochmal mit der nächsten Zeile
    if (leadText.length === 0) {
      textWithoutImages = textWithoutImages.substr(i1 + lineBreakLen);
      i1 = textWithoutImages.indexOf('\r\n');
      if (i1 < 0) {
        i1 = textWithoutImages.indexOf('\n');
      }
      if (i1 >= 0) {
        leadText = textWithoutImages.substring(0, i1).trim();
      }
    }
  }
  if (!title) {
    title = "";
  }
  if (!leadText) {
    leadText = "";
  }
  return {title: title.substr(0, 255), text: text, leadText: leadText.substr(0, 1000)};
}

exports.upgradeSchema = function (upgradeVersion) {
  return new Promise(function (resolve, reject) {
        switch (upgradeVersion) {
        case 1:
          bookshelf.transaction(function (t) {
            // upgrade Articles table to have title and leadtext
            knex.schema.table('ArticleItems', function (table) {
              table.string('Title');
              table.string('LeadText', 1000);
            }).then(function () {
              new ArticleItem()
                  .query(function (qb) {
                    qb.orderBy('publish_start', 'DESC');
                  })
                  .fetchAll().then(function (articleItemList) {
                Promise.reduce(articleItemList.models, function (total, articleItem) {
                  var __ret = extractFromArticleItem(articleItem);
                  var title = __ret.title;
                  var text = __ret.text;
                  var leadText = __ret.leadText;

                  articleItem.set('Title', title);
                  articleItem.set('LeadText', leadText);
                  articleItem.set('Text', text);

                  return articleItem.save(null, {transacting: t}).then(function (updatedArticleItem) {
                    console.log("ArticleItem saved. Article_id: " + updatedArticleItem.get('Article_id') + " Title: " +
                                updatedArticleItem.get('Title'));
                    return total + 1;
                  });

                }, 0).then(function (total) {
                  console.log(total + " Articles upgraded in ArticleItems");
                  t.commit();
                })
                    .catch(function (err) {
                      console.log("ERROR while upgrading ArticleItems");
                      t.rollback(err);
                    });
              })
                  .catch(function (err) {
                    console.log("ERROR while upgrading ArticleItems schema");
                    t.rollback(err);
                  });
            }).catch(function (err) {
              console.log("ERROR while fetching all ArticleItems");
              t.rollback(err);
            });
          }).then(function () {
            console.log("Transaction (upgrading ArticleItems in upgrade " + upgradeVersion + ") committed");
            resolve();
            /*
             knex.schema.table('ArticleItems', function (table) {
             table.string('Title').notNullable();
             table.string('LeadText', 1000).notNullable();
             }).then(function () {
             resolve();
             }).catch(function (error) {
             console.log("ERROR while adding not null constrains");
             reject(error);
             });
             */
          }).catch(function (error) {
            console.log(error);
            console.log("Transaction (upgrading ArticleItems in upgrade " + upgradeVersion + ") rolled back");
            reject(error);
          });

          break;
        case 2:
          knex.schema.table('EventItems', function (table) {
            table.string('Timezone');
          }).then(function () {
            console.log("Transaction (upgrading EventItems in upgrade " + upgradeVersion + ") finished");
            resolve();
          }).catch(function (error) {
            console.log(error);
            console.log("Transaction (upgrading EventItems in upgrade " + upgradeVersion + ") failed");
            reject(error);
          });

          break;
        case 3:
          knex.schema.createTable('AppSettings', function (t) {
            t.string('key').primary();
            t.string('type').notNullable();
            t.string('value', 10000);
          }).then(function () {
            console.log("Transaction (creating AppSettings table in upgrade " + upgradeVersion + ") finished");
            resolve();
          }).catch(function (error) {
            console.log(error);
            console.log("Transaction (creating AppSettings table in upgrade " + upgradeVersion + ") failed");
            reject(error);
          });

          break;
        case 4:
          knex.schema.table('ArticleImages', function (table) {
            table.string('flowIdentifier').index();
          }).then(function () {
            console.log("Transaction (upgrading ArticleImages in upgrade " + upgradeVersion + ") finished");
            resolve();
          }).catch(function (error) {
            console.log(error);
            console.log("Transaction (upgrading ArticleImages in upgrade " + upgradeVersion + ") failed");
            reject(error);
          });

          break;
        case 5:
          knex.schema.createTable('Assets', function (t) {
            t.increments('id').primary();
            t.string('Page_id').references('Name').inTable('Pages').notNullable();
            t.integer('Item_id').index();
            t.binary('Data').notNullable();
            t.binary('Thumbnail');
            t.string('Filename').notNullable().index();
            t.string('MimeType').notNullable().index();
            t.integer('Size').notNullable();
            t.string('Description');
            t.string('flowIdentifier').index();
          }).then(function () {
            console.log("Transaction (creating Assets table in upgrade " + upgradeVersion + ") finished");
            resolve();
          }).catch(function (error) {
            console.log(error);
            console.log("Transaction (creating Assets table in upgrade " + upgradeVersion + ") failed");
            reject(error);
          });

          break;
        case 6:
          bookshelf.transaction(function (t) {
            knex.schema.table('PersonItems', function (table) {
              table.timestamp('BirthdayNoTZ', true);
            }).then(function () {
              console.log("BirthdayNoTZ field in PersonItems created");
              new PersonItem().fetchAll().then(function (persons) {
                moment.locale("de");
                Promise.reduce(persons.models, function (total, person) {

                  var bd = moment(person.get('Birthday'));
                  if (bd.isValid()) {
                    var tzOffset = bd.utcOffset();
                    if (tzOffset === 0) {
                      if (bd.hour() !== 0) {
                        tzOffset = (24 - bd.hour()) * 60;
                      }
                    }
                    bd.add(tzOffset, 'minutes');
                    person.set('BirthdayNoTZ', bd.utc().toDate());
                  }
                  return person.save(null, {transacting: t}).then(function (updatedPersonItem) {
                    console.log("PersonItem saved. Person_id: " + updatedPersonItem.get('Person_id') + " Lastname: " +
                                updatedPersonItem.get('Lastname'));
                    return total + 1;
                  });

                }, 0).then(function (total) {
                  console.log(total + " Articles upgraded in ArticleItems");
                  t.commit();
                })
                    .catch(function (err) {
                      console.log("ERROR while upgrading ArticleItems");
                      t.rollback(err);
                    });

              })
                  .catch(function (err) {
                    console.log("ERROR while upgrading birthday in PersonItems");
                    t.rollback(err);
                  });
            }).catch(function (err) {
              console.log("ERROR while fetching all PersonItems");
              t.rollback(err);
            });

          }).then(function () {
            console.log("Transaction (upgrading PersonItems in upgrade " + upgradeVersion + ") committed");
            knex.schema.table('PersonItems', function (table) {
              table.dropColumn('Birthday');
            }).then(function () {
              console.log("Old Birthday field dropped from PersonItems");
              resolve();
            }).catch(function (err) {
              console.log("ERROR while dropping Birthday field from PersonItems");
              reject(err);
            });

          }).catch(function (error) {
            console.log(error);
            console.log("Transaction (upgrading PersonItems in upgrade " + upgradeVersion + ") rolled back");

            knex.schema.table('PersonItems', function (table) {
              table.dropColumn('BirthdayNoTZ');
            }).then(function () {
              console.log("dropped column BirthdayNoTZ while upgrading PersonItems in upgrade " + upgradeVersion + ")");
              reject(error);
            }).catch(function (error) {
              console.log("Dropping column BirthdayNoTZ failed while upgrading PersonItems in upgrade " + upgradeVersion + ")");
              reject(error);
            });
          });

          break;
        default:
          resolve();
        }
      }
  );
};

exports.upgradeSchemaV0 = function (upgradeVersion) {
  return new Promise(function (resolve, reject) {
    switch (upgradeVersion) {
    case 1:

      var ArticleItem2 = bookshelf.Model.extend({
        tableName: 'ArticleItems2',
        Article: function () {
          return this.belongsTo(Article);
        }
      });
      bookshelf.transaction(function (t) {
        // upgrade Articles table to have title and leadtext
        knex.schema.createTable('ArticleItems2', function (t) {
          t.increments('id').primary();
          t.integer('Article_id').references('id').inTable('Articles');
          t.datetime('Date').notNullable().index();
          t.string('Author');
          t.string('Title');
          t.string('LeadText', 1000);
          t.string('Text', 100000);
          t.timestamp('publish_start').notNullable().index();
          t.timestamp('publish_end').index();
          t.timestamp('valid_start').index();
          t.timestamp('valid_end').index();
        }).then(function () {
          // kopiere alle Einträge von ArticleItems nach ArticleItems2
          new ArticleItem()
              .query(function (qb) {
                qb.orderBy('publish_start', 'DESC');
              })
              .fetchAll()
              .then(function (articleItemList) {
                Promise.reduce(articleItemList, function (total, articleItem) {
                  var __ret = extractFromArticleItem(articleItem);
                  var title = __ret.title;
                  var text = __ret.text;
                  var leadText = __ret.leadText;
                  return new ArticleItem2({
                    Article_id: articleItem.get('Article_id'),
                    Date: articleItem.get('Date'),
                    Author: articleItem.get('Author'),
                    Title: title,
                    LeadText: leadText,
                    Text: text,
                    publish_start: articleItem.get('publish_start'),
                    publish_end: articleItem.get('publish_end'),
                    valid_start: articleItem.get('valid_start'),
                    valid_end: articleItem.get('valid_end')
                  })
                      .save(null, {transacting: t})
                      .then(function (savedArticle) {
                        console.log("ArticleItem2 saved. Article_id: " + savedArticle.get('Article_id') + " Title: " +
                                    savedArticle.get('Title'));
                        return total + 1;
                      })
                }, 0)
                    .then(function (total) {
                      console.log(total + " Articles saved in ArticleItem2");
                      //Total is 30
                      knex.schema.dropTable('ArticleItems')
                          .then(function () {
                            knex.schema.renameTable('ArticleItems2', 'ArticleItems')
                                .then(function () {
                                  t.commit();
                                })
                                .catch(function (err) {
                                  t.rollback(err);
                                });
                          })
                          .catch(function (err) {
                            t.rollback(err);
                          });
                    })
                    .catch(function (err) {
                      console.log("ERROR while creating new ArticleItem2: ", err);
                      t.rollback(err);
                    });
              }).catch(function (err) {
            t.rollback(err);
          });
        })
            .catch(function (err) {
              console.log("Error while creating ArticleItem2 table", err);
              t.rollback(err);
            });
      }).then(function () {
        console.log("Transaction (upgrading ArticleItems in upgrade " + upgradeVersion + ") committed");
        resolve();
      }).catch(function (error) {
        console.log("Transaction (upgrading ArticleItems in upgrade " + upgradeVersion + ") rolled back");
        reject(error);
      });
      break;
    default:
      resolve();
    }
  });
};

function performUpgradeSchema2(resolve, reject) {
  knex.schema.hasColumn('EventItems', 'Timezone').then(function (exists) {
    if (exists) {
      console.log('DB schema up to date.');
      resolve();
    } else {
      console.log('Must upgrade DB schema (V2).');
      exports.upgradeSchema(2).then(
          function () {
            console.log('DB schema upgraded.');
            resolve();
          },
          reject);
    }
  });
}

exports.createSchemaIfNotExists = function () {
  return new Promise(function (resolve6, reject6) {
    return new Promise(function (resolve5, reject5) {
      new Promise(function (resolve4, reject4) {
        new Promise(function (resolve3, reject3) {

          new Promise(function (resolve, reject) {
            knex.schema.hasTable('RoleMenus').then(function (exists) {
              if (exists) {
                knex.schema.hasTable('PersonContactDataPhonenumbers').then(function (exists) {
                  if (exists) {
                    knex.schema.hasColumn('ArticleItems', 'Title').then(function (exists) {
                      if (exists) {
                        performUpgradeSchema2(resolve, reject);
                      } else {
                        console.log('Must upgrade DB schema.');
                        exports.upgradeSchema(1).then(
                            function () {
                              performUpgradeSchema2(resolve, reject);
                            }, reject);
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
              } else {
                console.log('Must create DB schema.');
                exports.createSchema().then(
                    function () {
                      console.log('DB schema created.');
                      resolve();
                    },
                    reject);
              }
            }).catch(function (error) {
              reject(error);
            });
          }).then(function () {
            knex.schema.hasTable('AppSettings')
                .then(function (exists) {
                  if (exists) {
                    resolve3();
                  } else {
                    console.log('Must upgrade DB schema (V3).');
                    exports.upgradeSchema(3)
                        .then(function () {
                          console.log('DB schema upgraded to V3.');
                          resolve3();
                        }, reject3);
                  }
                })
                .catch(function (error) {
                  reject3(error);
                });
          })
              .catch(function (error) {
                reject3(error);
              });
        })
            .then(function () {
              knex.schema.hasColumn('ArticleImages', 'flowIdentifier').then(function (exists) {
                if (exists) {
                  resolve4();
                } else {
                  console.log('Must upgrade DB schema (V4).');
                  exports.upgradeSchema(4)
                      .then(function () {
                        console.log('DB schema upgraded to V4.');
                        resolve4();
                      }, reject4);
                }
              })
                  .catch(function (error) {
                    reject4(error);
                  });
            });
      })
          .then(function () {
            knex.schema.hasTable('Assets').then(function (exists) {
              if (exists) {
                resolve5();
              } else {
                console.log('Must upgrade DB schema (V5).');
                exports.upgradeSchema(5)
                    .then(function () {
                      console.log('DB schema upgraded to V5.');
                      resolve5();
                    }, reject5);
              }
            })
                .catch(function (error) {
                  reject5(error);
                });
          });
    })
        .then(function () {
          knex.schema.hasColumn('PersonItems', 'BirthdayNoTZ').then(function (exists) {
            if (exists) {
              resolve6();
            } else {
              console.log('Must upgrade DB schema (V6).');
              exports.upgradeSchema(6)
                  .then(function () {
                    console.log('DB schema upgraded to V6.');
                    resolve6();
                  }, reject6);
            }
          })
              .catch(function (error) {
                reject6(error);
              });
        });
  })
};

exports.deleteInclompleteUploads = function () {
  return new Promise(function (resolve, reject) {
    knex.schema.hasTable('Uploads').then(function (exists) {
      if (exists) {
        new Uploads()
            .fetch()
            .then(function (chunks) {

              chunks.each(function (chunk) {
                var tf = chunk.attributes.tempFile;
                if (fs.existsSync(tf)) {
                  fs.unlinkSync(tf);
                }
              });

              console.log("deleting all chunks from Uploads table");
              bookshelf.knex('Uploads')
                  .del()
                  .then(function () {
                    console.log("Uploads cleared");
                    resolve();
                  })
                  .catch(function (error) {
                    console.log("ERROR while deleting all entries from Uploads");
                    reject(error);
                  });
            })
            .catch(function (error) {
              console.log("ERROR while reading all entries from Uploads");
              reject(error);
            });
      }
      else {
        console.log("Uploads table does not exist");
        resolve();
      }
    });
  });
};

exports.createSchema = function () {
  return Promise.reduce([
        function () {
          return knex.schema.dropTableIfExists('AppSettings');
        },
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
          return knex.schema.dropTableIfExists('Uploads');
        },
        function () {
          return knex.schema.dropTableIfExists('Assets');
        },
        function () {
          return knex.schema.dropTableIfExists('ArticleImages');
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
            t.dateTime('BirthdayNoTZ', true);   // true means postgres does not store timezone with timestamp
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
            t.string('Title').notNullable();
            t.string('LeadText').notNullable();
            t.string('Text', 100000);
            t.timestamp('publish_start').notNullable().index();
            t.timestamp('publish_end').index();
            t.timestamp('valid_start').index();
            t.timestamp('valid_end').index();
          });
        },
        function () {
          return knex.schema.createTable('ArticleImages', function (t) {
            t.increments('id').primary();
            t.integer('Article_id').references('id').inTable('Articles').index();
            t.binary('Image').notNullable();
            t.binary('Thumbnail').notNullable();
            t.string('Filename').notNullable().index();
            t.string('MimeType').notNullable().index();
            t.integer('Size').notNullable();
            t.string('Description').index();
            t.string('flowIdentifier').index();
            t.timestamp('valid_start').index();
            t.timestamp('valid_end').index();
          });
        },
        function () {
          return knex.schema.createTable('Assets', function (t) {
            t.increments('id').primary();
            t.string('Page_id').references('Name').inTable('Pages').notNullable();
            t.integer('Item_id').index();
            t.binary('Data').notNullable();
            t.binary('Thumbnail');
            t.string('Filename').notNullable().index();
            t.string('MimeType').notNullable().index();
            t.integer('Size').notNullable();
            t.string('Description');
            t.string('flowIdentifier').index();
          });
        },
        function () {
          return knex.schema.createTable('Uploads', function (t) {
            t.increments('id').primary();
            t.integer('flowChunkNumber').notNullable().index();
            t.integer('flowChunkSize').notNullable();
            t.integer('flowCurrentChunkSize').notNullable();
            t.string('flowFilename').notNullable();
            t.string('flowIdentifier').notNullable().index();
            t.string('flowRelativePath').notNullable();
            t.integer('flowTotalChunks').notNullable();
            t.integer('flowTotalSize').notNullable();
            t.string('tempFile').notNullable().unique();
            t.string('mimeType').notNullable();
            t.unique(['flowIdentifier', 'flowChunkNumber']);
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
            t.string('Timezone');
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
          return knex.schema.createTable('AppSettings', function (t) {
            t.string('key').primary();
            t.string('type').notNullable();
            t.string('value', 10000);
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

var ArticleImage = bookshelf.Model.extend({
  tableName: 'ArticleImages',
  Article: function () {
    return this.belongsTo(Article);
  }
});

var ArticleImages = bookshelf.Collection.extend({
  model: ArticleImage
});

var Articles = bookshelf.Collection.extend({
  model: Article
});

var Upload = bookshelf.Model.extend({
  tableName: 'Uploads'
});

var Uploads = bookshelf.Collection.extend({
  model: Upload
});

var Asset = bookshelf.Model.extend({
  tableName: 'Assets'
});

var Assets = bookshelf.Collection.extend({
  model: Asset
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

var AppSetting = bookshelf.Model.extend({
  tableName: 'AppSettings'
});

var AppSettings = bookshelf.Collection.extend({
  model: AppSetting
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

var saveNewPassword = function (userModel, newPassword) {
  return new Promise(function (resolve, reject) {
    bookshelf.transaction(function (t) {
      var salt = createSalt();
      userModel.set('PasswordHash', encryptPassword(newPassword, salt));
      userModel.set('PasswordSalt', salt);
      userModel.save(null, {transacting: t})
          .then(function () {
            new Audit({
              ChangedAt: new Date(),
              Table: userModel.tableName,
              ChangedBy: userModel.get('UserName'),
              Description: "Password changed"
            }).save(null, {transacting: t})
                .then(function (auditEntry) {
                  t.commit();
                })
                .catch(function (err) {
                  console.log("Error while saving audit for password change:", err);
                  t.rollback(
                      "Speichern der Auditinformationen in der Datenbank für die Passwortänderung gescheitert. Das Passwort wurde nicht geändert.");
                });
          })
          .catch(function (err) {
            console.log("Error while saving UserModel for password change:", err);
            t.rollback(
                "Speichern der Benutzerinformationen in der Datenbank für die Passwortänderung gescheitert. Das Passwort wurde nicht geändert.");
          });
    })
        .then(function () {
          console.log("Password changed for " + userModel.get('UserName'));
          resolve();
        })
        .catch(function (err) {
          reject(err);
        });
  });
};

// Always resolve with pages array, even if an error occurs. Then pages is [].
var getPages = function () {
  return new Promise(function (resolve, reject) {
    var pages = [];
    new Page().query(function (qb) {
      qb.orderBy('Order', 'ASC'); // index.js depends on the order: redirects always to the first page
    }).fetchAll()
        .then(function (pageList) {
          pageList.each(function (page) {
            var pageObj = {
              Page_id: page.get('id'),
              Order: page.get('Order'),
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

// calculate name of detail view
function setDetailView(page) {
  // todo: add to page configuration
  if (!page.isSingleEntity) {
    page.DetailView = page.View + 'Detail';
  }
}

var getPagesForUser = function (user) {
  return new Promise(function (resolve, reject) {
    getPages().then(function (pages) {
      var pagesForUser = [];
      if (user && !user.isNotLocalUser && user.id) {
        var permissions = ['get'];
        // get user's role permissions filtered by user, resource and permissions
        bookshelf.knex('UserRoles')
            .join('RolePermissions', 'RolePermissions.Role_id', '=', 'UserRoles.Role_id')
            .where('UserRoles.User_id', user.id)
            .whereIn('RolePermissions.Permission', permissions)
            .select('UserRoles.User_id', 'RolePermissions.*')
            .then(function (results) {
              _.each(pages, function (page) {
                setDetailView(page);
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
            setDetailView(page);
            pagesForUser.push(page);
          }
        });
        resolve(pagesForUser);
      }
    });
  });
};

var putAppSetting = function (key, value, type) {
  switch (type) {
  case 'boolean':
  case 'number':
  case 'string':
  case 'symbol':
    t = type;
    break;
  case 'image':
    t = 'image';
    break;
  default:
    t = typeof value;
    break;
  }
  return new AppSetting({
    key: key,
    value: value,
    type: t
  }).save();
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
module.exports.saveNewPassword = saveNewPassword;
module.exports.getPages = getPages;
module.exports.getPagesForUser = getPagesForUser;
module.exports.putAppSetting = putAppSetting;
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
  ArticleImage: ArticleImage,
  ArticleImages: ArticleImages,
  Upload: Upload,
  Uploads: Uploads,
  Asset: Asset,
  Assets: Assets,
  Contact: Contact,
  ContactItem: ContactItem,
  Contacts: Contacts,
  Link: Link,
  LinkItem: LinkItem,
  Links: Links,
  AppSetting: AppSetting,
  AppSettings: AppSettings
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


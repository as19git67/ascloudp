var config = require('./config');
var Promise = require('bluebird/js/main/promise')();
var _ = require('underscore');
var moment = require('moment');
var model = require('./model');
var getProfiles = require('./Profiles');

var databaseClient = config.get('databaseClient');
var connectionString = config.get('connectionString');

var knex = require('knex')({client: databaseClient, connection: connectionString, debug: false });
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

exports.importTestDataFFW = function () {
    return Promise.reduce([
            function () {
                return knex('LinkItems').del();
            },
            function () {
                return knex('Links').del();
            },
            function () {
                return knex('ContactItems').del();
            },
            function () {
                return knex('Contacts').del();
            },
            function () {
                return knex('ArticleReferenceItems').del();
            },
            function () {
                return knex('ArticleReferences').del();
            },
            function () {
                return knex('ArticleSectionItems').del();
            },
            function () {
                return knex('ArticleSections').del();
            },
            function () {
                return knex('ArticleItems').del();
            },
            function () {
                return knex('Articles').del();
            },
            function () {
                return knex('EventItems').del();
            },
            function () {
                return knex('Events').del();
            },
            function () {
                return knex('MembershipItems').del();
            },
            function () {
                return knex('Memberships').del();
            },
            function () {
                return knex('PersonContactDataAddresses').del();
            },
            function () {
                return knex('PersonContactDataPhonenumbers').del();
            },
            function () {
                return knex('PersonContactDataAccounts').del();
            },
            function () {
                return knex('PersonContactDatas').del();
            },
            function () {
                return knex('PersonItems').del();
            },
            function () {
                return knex('Persons').del();
            },
            function () {
                return knex('PageCollectionColumns').del();
            },
            function () {
                return knex('PageContents').del();
            },
            function () {
                return knex('Pages').del();
            },
            function () {
                // MITGLIEDER
                return new Promise(function (resolve, reject) {

                    Promise.map(ffwMitglieder, function (value) {
                        var now = new Date();
                        var regexp = /(.+)\s([0-9]+[a-z|A-Z]?)/;
                        var streetRegexResult = regexp.exec(value.Straße);
                        var street = "";
                        var streetNumber = "";
                        if (streetRegexResult == null || streetRegexResult.length < 3) {
                            street = value.Straße;
                        } else {
                            street = streetRegexResult[1];
                            streetNumber = streetRegexResult[2];
                        }

                        regexp = /([a-z|A-Z|ä|ö|ü|ß|Ä|Ö|Ü]+)(,\s?)?(jun\.|sen\.|Jun|Sen|Jun\.|Sen\.)?/;
                        var nameRegexResult = regexp.exec(value.Nachname);
                        var lastname = "";
                        var suffix = "";
                        if (nameRegexResult == null || nameRegexResult.length < 4) {
                            lastname = value.Nachname;
                        } else {
                            if (nameRegexResult[2] == null || nameRegexResult[2] == null) {
                                lastname = value.Nachname;
                            } else {
                                lastname = nameRegexResult[1];
                                suffix = nameRegexResult[3];
                                if (suffix == 'Jun' || suffix == 'Jun.') {
                                    suffix = 'jun.';
                                } else {
                                    if (suffix == 'Sen' || suffix == 'Sen.') {
                                        suffix = 'sen.';
                                    }
                                }
                            }
                        }

                        var pObj = {
                            Salutation: value.Anrede,
                            Firstname: value.Vorname,
                            Lastname: lastname,
                            Birthday: value.Geboren,
                            valid_start: now

                        };
                        if (suffix && suffix.length > 0) {
                            pObj.Suffix = suffix;
                        }

                        return new Promise(function (resolvePerson, rejectPerson) {
                            new Person().save().then(function (newPerson) {

                                pObj.Person_id = newPerson.get('id');
                                new PersonItem(pObj).save().then(function (newPersonItem) {
                                    var lr;
                                    var ld;
                                    if (value.verstorben) {
                                        lr = 'Tod';
                                        ld = value.verstorben;
                                    } else if (value.Ausgetreten) {
                                        lr = 'Austritt';
                                        ld = value.Ausgetreten;
                                    }
                                    var ed = value.Eingetreten;
                                    if (!ed && !value.verzogenDatum) {
                                        ed = "1900-01-01T00:00:00";
                                    }

                                    new Membership({
                                        Person_id: newPerson.get('id'),
                                        MembershipNumber: value.ID
                                    }).save()
                                        .then(function (newMember) {
                                            new MembershipItem({
                                                Membership_id: newMember.get('id'),
                                                EntryDate: ed,
                                                LeavingDate: ld,
                                                //t.integer('LeavingReason_id').references('id').inTable('LeavingReasons');
                                                PassiveSince: value.Übergang_Passiv,
                                                LivingElsewhereSince: value.verzogenDatum,
                                                valid_start: now
                                            }).save()
                                                .then(function (newMemberItem) {
                                                    //console.log("Member added: " + newMember.get('MembershipNumber'));
                                                    new PersonContactType().fetchAll().then(function (personContactTypes) {
                                                        var personContactTypesByName = {};
                                                        personContactTypes.forEach(function (personContactType) {
                                                            personContactTypesByName[personContactType.get('Name')] = personContactType.get('id');
                                                        });
                                                        var personContactTypeAddress = personContactTypesByName['address'];
                                                        var personContactTypePhone = personContactTypesByName['phone'];
                                                        if (personContactTypeAddress && personContactTypePhone) {
                                                            new PersonContactData({
                                                                Person_id: newPerson.get('id'),
                                                                PersonContactType_id: personContactTypeAddress,
                                                                Usage: 'Privat'
                                                            }).save().then(function (newPersonContactDataAddress) {

                                                                    function addMorePart1() {
                                                                        resolvePerson({ person: newPerson, membership: newMember});

                                                                        //"Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null
                                                                        /*
                                                                         var awards = createAwardsArray(element, newPerson);
                                                                         if (awards.length > 0) {
                                                                         MemberAward.bulkCreate(awards).success(function () {
                                                                         console.log("Added awards to member " + newPerson.firstname + " " + newPerson.lastname +
                                                                         " (id: " + newMembership.person_id + ")");
                                                                         callback();

                                                                         }).error(function (error) {
                                                                         console.log('MemberAward.bulkCreate had ERRORS');
                                                                         console.log(error);
                                                                         callback(error);
                                                                         });
                                                                         } else {
                                                                         callback();
                                                                         }
                                                                         */
                                                                    }

                                                                    new PersonContactDataAddress({
                                                                        PersonContactData_id: newPersonContactDataAddress.get('id'),
                                                                        Street: street,
                                                                        StreetNumber: streetNumber,
                                                                        Postalcode: value.PLZ,
                                                                        City: value.Ort,
                                                                        valid_start: now
                                                                    }).save().then(function (newPersonContactDataAddress) {
                                                                            console.log('PersonContactDataAddress added');
                                                                            if (value.Mobiltelefon && value.Mobiltelefon != '') {
                                                                                new PersonContactData({
                                                                                    Person_id: newPerson.get('id'),
                                                                                    PersonContactType_id: personContactTypePhone,
                                                                                    Usage: 'Mobil'
                                                                                }).save().then(function (newPersonContactDataPhone) {
                                                                                        console.log('New PersonContactData for mobile phone added');
                                                                                        var number = value.Mobiltelefon;
                                                                                        if (number.length > 1 && number.charAt(0) == '0') {
                                                                                            number = '+49' + number.substr(1);
                                                                                        } else {
                                                                                            console.log('WARNING: wrong phone number format: ' + number);
                                                                                        }
                                                                                        new PersonContactDataPhone({
                                                                                            PersonContactData_id: newPersonContactDataPhone.get('id'),
                                                                                            Number: number,
                                                                                            valid_start: now
                                                                                        }).save().then(function (newPersonContactDataPhone) {
                                                                                                console.log('newPersonContactDataPhone added: ' +
                                                                                                            newPersonContactDataPhone.get('Number'));
                                                                                                addMorePart1();
                                                                                            }).catch(function (error) {
                                                                                                console.log('PersonContactDataAddress.create had ERRORS');
                                                                                                console.log(error);
                                                                                                rejectPerson(error);
                                                                                            }
                                                                                        );
                                                                                    }).catch(function (error) {
                                                                                        console.log('PersonContactData.create had ERRORS');
                                                                                        console.log(error);
                                                                                        rejectPerson(error);
                                                                                    });
                                                                            } else {
                                                                                addMorePart1();
                                                                            }
                                                                        }).catch(function (error) {
                                                                            console.log('PersonContactDataAddress.create had ERRORS');
                                                                            console.log(error);
                                                                            rejectPerson(error);
                                                                        });

                                                                }).catch(function (error) {
                                                                    console.log("Error while saving PersonContactData: " + error);
                                                                    rejectPerson(error);

                                                                }
                                                            );
                                                        }
                                                        else {
                                                            var errMsg = "PersonContactType address or phone does not exist in the database.";
                                                            console.log(errMsg);
                                                            rejectPerson(errMsg);
                                                        }
                                                    }).catch(function (error) {
                                                        console.log("Error while fetching PersonContactType: " + error);
                                                        rejectPerson(error);
                                                    });
                                                }).catch(function (error) {
                                                    console.log("Error while saving MembershipItem: " + error);
                                                    rejectPerson(error);
                                                });
                                        }).catch(function (error) {
                                            console.log("Error while saving Membership: " + error);
                                            rejectPerson(error);
                                        });
                                }).catch(function (error) {
                                    console.log("Error while saving PersonItem: " + error);
                                    rejectPerson(error);
                                });
                            }).catch(function (error) {
                                console.log("Error while saving Person: " + error);
                                rejectPerson(error);
                            });
                        });

                    }).then(function (savedObj) {
                        console.log("Persons and Memberships added to database.");
                        resolve();
                    }).catch(function (error) {
                        console.log("Error while saving persons and memberships: " + error);
                        reject(error);
                    });
                });
            },
            function () {
                // SEITEN
                return new Promise(function (resolve, reject) {
                    var allPages = [
                        {Order: 1, Name: "termine", AnonymousAccess: true, EntityNameSingular: "Termin", EntityNamePlural: "Termine", Collection: "Events", View: "Calendar"},
                        {Order: 2, Name: "ausbildung", AnonymousAccess: true, EntityNameSingular: "Ausbildung", EntityNamePlural: "Ausbildungsmöglichkeiten", Model: "PageContent", View: "genericHTML"},
                        {Order: 3, Name: "einsaetze", AnonymousAccess: true, EntityNameSingular: "Einsatz", EntityNamePlural: "Einsätze", Collection: "Articles", View: "Articles"},
                        {Order: 4, Name: "fahrzeuge", AnonymousAccess: true, EntityNameSingular: "Fahrzeug", EntityNamePlural: "Fahrzeuge", Model: "PageContent", View: "genericHTML"},
                        {Order: 5, Name: "kontakte", AnonymousAccess: true, EntityNameSingular: "Kontakt", EntityNamePlural: "Kontakte", Collection: "Persons", View: "Contacts"},
                        {Order: 6, Name: "links", AnonymousAccess: true, EntityNameSingular: "Link", EntityNamePlural: "Links", Collection: "Links", View: "Links"},
                        {Order: 7, Name: "mitmachen", AnonymousAccess: true, EntityNameSingular: "Mitmachen", EntityNamePlural: "Mitmachinfos", Model: "PageContent", View: "genericHTML"},
                        {Order: 8, Name: "wir", AnonymousAccess: true, EntityNameSingular: "Über Uns", EntityNamePlural: "Über Uns", Collection: "Articles", View: "Articles"},
                        {Order: 9, Name: "vorstand", AnonymousAccess: true, EntityNameSingular: "Vorstandsmitglied", EntityNamePlural: "Vorstand", Collection: "Contacts", View: "Contacts"},
                        {Order: 10, Name: "mitglieder", AnonymousAccess: false, EntityNameSingular: "Mitglied", EntityNamePlural: "Mitglieder", Collection: "Persons", View: "Members"}
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
                // SEITEN MIT GENERICHTML
                return new Promise(function (resolve, reject) {
                    var allPageContents = [
                        {Page_id: "ausbildung", Text: "## Ausbildungsmaterial\r\n\r### Feuerwehr Dienstvorschriften:\r\n\rErklärungen und weiterführende Links zu den Feuerwehr Dienstvorschriften können in der Wikipedia nachgeschlagen werden: http://de.wikipedia.org/wiki/Feuerwehr-Dienstvorschrift\r\n\r### Lehrmittel:\r\n\rDie Staatliche Feuerwehrschule in Würzburg stellt Lehrmaterial bereit: Lehr- und Lernmittel\r\n\r"},
                        {Page_id: "mitmachen", Text: "## Mitglied bei der Freiwilligen Feuerwehr Merching werden\r\n\r### Wer kann beitreten?\r\n\rDie Freiwillige Feuerwehr Merching freut sich immer über neue Mitglieder. Ab dem Alter von 14 Jahren kann man beitreten. Mit 16 Jahren kann man dann beschränkt bei Einsätzen dabei sein und ab dem 18. Lebenjahr ist man voll einsatzfähig.\r\n\r"},
                        {Page_id: "fahrzeuge", Text: "## HLF 20/16\r\n\rHier wird das Bild erscheinen\r\n\r## LF 16\r\n\rHier wird das Bild erscheinen\r\n\r"}
                    ];
                    var pageContents = PageContents.forge(allPageContents);
                    console.log("Adding PageContents.");
                    Promise.all(pageContents.invoke('save')).then(function () {
                        console.log("PageContents added to database.");
                        resolve();
                    }).catch(function (error) {
                        console.log("Error while saving PageContents: " + error);
                        reject(error);
                    });
                });
            },
            function () {
                return new Promise(function (resolve, reject) {
                    var allPageCollectionColumns = [
                        {Order: 1, Page_id: "mitglieder", Name: "Salutation", Caption: "Anrede", Type: "string", Mandatory: false},
                        {Order: 2, Page_id: "mitglieder", Name: "Firstname", Caption: "Vorname", Type: "string", Mandatory: false},
                        {Order: 3, Page_id: "mitglieder", Name: "Lastname", Caption: "Nachname", Type: "string", Mandatory: true},
                        {Order: 4, Page_id: "mitglieder", Name: "Suffix", Caption: "Suffix", Type: "string", Mandatory: false},
                        {Order: 5, Page_id: "mitglieder", Name: "Birthday", Caption: "Geburtstag", Type: "date", Mandatory: false},
                        {Order: 6, Page_id: "mitglieder", Name: "Membership.MembershipNumber", Caption: "Mitgliedsnummer", Type: "integer", Mandatory: true}
                    ];
                    var pageCollectionColumns = PageCollectionColumns.forge(allPageCollectionColumns);
                    console.log("Adding PageCollectionColumns.");
                    Promise.all(pageCollectionColumns.invoke('save')).then(function () {
                        console.log("PageCollectionColumns added to database.");
                        resolve();
                    }).catch(function (error) {
                        console.log("Error while saving PageCollectionColumns: " + error);
                        reject(error);
                    });
                });
            },
            function () {
                // TERMINE
                return new Promise(function (resolve, reject) {
                    var allEvents = _.map(ffwEvents, function (value, key, list) {
                        var publishDateStart = value.publishDateStart == null ? new Date() : value.publishDateStart;
                        var publishDateEnd = value.publishDateEnd == null ? value.eventDateEnd : value.publishDateEnd;
                        var evObj = {
                            Page_id: "termine",
                            Title: value.title,
                            Location: value.locationdescription,
                            Description: value.description,
                            event_start: value.eventDateStart,
                            event_end: value.eventDateEnd,
                            publish_start: publishDateStart,
                            publish_end: publishDateEnd,
                            valid_start: new Date()
                        };
                        return evObj;
                    });

                    var events = Events.forge(allEvents);
                    console.log("Adding Events.");
                    Promise.all(events.invoke('save')).then(function () {
                        console.log("Events added to database.");
                        resolve();
                    }).catch(function (error) {
                        console.log("Error while saving events: " + error);
                        reject(error);
                    });
                });
            },
            function () {
                // VORSTANDSCHAFT
                return new Promise(function (resolve, reject) {
                    var memberships = _.where(ffwMitglieder, {'Vorstandsmitglied': true});
                    var membershipIds = _.map(memberships, function (membershipObj) {
                        return membershipObj.ID;
                    });
                    var allContacts = [];
                    model.bookshelf.knex('Memberships')
                        .whereIn('MembershipNumber', membershipIds)
                        .select('Person_id')
                        .then(function (results) {
                            var now = new Date();
                            results.forEach(function (m) {
                                allContacts.push({
                                    Page_id: "vorstand",
                                    Person_id: m.Person_id,
                                    valid_start: now
                                });
                            });
                            var contacts = Contacts.forge(allContacts);
                            console.log("Adding Contacts.");
                            Promise.all(contacts.invoke('save')).then(function () {
                                console.log("Contacts added to database.");
                                resolve();
                            }).catch(function (error) {
                                console.log("Error while saving Contacts: " + error);
                                reject(error);
                            });
                        });
                });
            },
            function () {
                return new Promise(function (resolve, reject) {
                    var now = new Date();
                    var end = new Date();
                    end.setFullYear(end.getFullYear() + 1);
                    new Article({
                        "Page_id": "wir",
                        "Date": now,
                        "Title": "Rettungseinsatz Merching",
                        "Subtitle": "Ich dachte ein Flugzeug stürzt ab",
                        "Author": "Anton Schegg",
                        "publish_start": now,
                        "publish_end": end,
                        "valid_start": now
                    }).save().then(function (newArticle) {
                            new ArticleSection({
                                "Article_id": newArticle.get('id'),
                                "Title": undefined,
                                "Text": "Bericht in der Friedberger Allgemeinen (3. Juni 2013)",
                                "ImageUrl": "images/presse/FA1.jpg",
                                "ImageDescription": "Eingestürztes Haus",
                                "valid_start": now
                            }).save().then(function (newArticleSection) {
                                    new ArticleReference({
                                        "ArticleSection_id": newArticleSection.get('id'),
                                        "Text": "",
                                        "valid_start": now
                                    }).save().then(function (newArticleReference) {
                                            console.log("Article '" + newArticle.get('Title') + "' saved.");
                                            resolve();
                                        });
                                });
                        }).catch(function (error) {
                            console.log("Error while creating Article for page 'wir': " + error);
                            reject(error);
                        });
                });
            }
        ],
        function (total, current, index, arrayLength) {
            console.log("importTestDataFFW step " + (index + 1) + " von " + arrayLength);
            return current().then(function () {
            }).return(total + 1);
        }, 0);
};

exports.createSchema = function () {
    return Promise.reduce([
            function () {
                return  knex.schema.dropTableIfExists('LinkItems');
            },
            function () {
                return  knex.schema.dropTableIfExists('Links');
            },
            function () {
                return  knex.schema.dropTableIfExists('ContactItems');
            },
            function () {
                return  knex.schema.dropTableIfExists('Contacts');
            },
            function () {
                return  knex.schema.dropTableIfExists('EventItems');
            },
            function () {
                return  knex.schema.dropTableIfExists('Events');
            },
            function () {
                return  knex.schema.dropTableIfExists('ArticleReferenceItems');
            },
            function () {
                return  knex.schema.dropTableIfExists('ArticleReferences');
            },
            function () {
                return  knex.schema.dropTableIfExists('ArticleSectionItems');
            },
            function () {
                return  knex.schema.dropTableIfExists('ArticleSections');
            },
            function () {
                return  knex.schema.dropTableIfExists('ArticleItems');
            },
            function () {
                return  knex.schema.dropTableIfExists('Articles');
            },
            function () {
                return  knex.schema.dropTableIfExists('PageCollectionColumns');
            },
            function () {
                return  knex.schema.dropTableIfExists('PageContents');
            },
            function () {
                return  knex.schema.dropTableIfExists('Pages');
            },
            function () {
                return  knex.schema.dropTableIfExists('MembershipItems');
            },
            function () {
                return  knex.schema.dropTableIfExists('Memberships');
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
                return  knex.schema.dropTableIfExists('PersonContactDatas');
            },
            function () {
                return  knex.schema.dropTableIfExists('PersonContactTypes');
            },
            function () {
                return  knex.schema.dropTableIfExists('PersonItems');
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
                });
            },
            function () {
                return  knex.schema.createTable('PersonItems', function (t) {
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
                return  knex.schema.createTable('PersonContactTypes', function (t) {
                    t.increments('id').primary();
                    t.string('Name', 10).unique();
                    t.boolean('Deleted').notNullable().defaultTo(false);
                });
            },
            function () {
                return new Promise(function (resolve, reject) {
                    var allContactTypes = [
                        {Name: "address"},
                        {Name: "email"},
                        {Name: "phone"},
                        {Name: "twitter"},
                        {Name: "facebook"},
                        {Name: "applepush"},
                        {Name: "googlepush"},
                        {Name: "mspush"}
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
                return  knex.schema.createTable('PersonContactDatas', function (t) {
                    t.increments('id').primary();
                    t.integer('Person_id').notNullable().references('id').inTable('Persons').index();
                    t.integer('PersonContactType_id').notNullable().references('id').inTable('PersonContactTypes').index();
                    t.string('Usage', 15).notNullable();
                    t.unique(['Person_id', 'PersonContactType_id', 'Usage']);
                });
            },
            function () {
                return  knex.schema.createTable('PersonContactDataAddresses', function (t) {
                    t.increments('id').primary();
                    t.integer('PersonContactData_id').notNullable().references('id').inTable('PersonContactDatas').index();
                    t.string('Street', 30).index();
                    t.string('StreetNumber', 5);
                    t.integer('Postalcode').index();
                    t.string('City').index();
                    t.timestamp('valid_start').index();
                    t.timestamp('valid_end').index();
                });
            },
            function () {
                return  knex.schema.createTable('PersonContactDataPhonenumbers', function (t) {
                    t.increments('id').primary();
                    t.integer('PersonContactData_id').notNullable().references('id').inTable('PersonContactDatas').index();
                    t.string('Number', 30).notNullable();
                    t.timestamp('valid_start').index();
                    t.timestamp('valid_end').index();
                });
            },
            function () {
                return  knex.schema.createTable('PersonContactDataAccounts', function (t) {
                    t.increments('id').primary();
                    t.integer('PersonContactData_id').notNullable().references('id').inTable('PersonContactDatas');
                    t.string('Account', 50).notNullable();
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
                    t.unique(['Name', 'Amount']);
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
                    t.integer('MembershipNumber').notNullable().unique();
                    t.integer('Person_id').notNullable().references('id').inTable('Persons');
                });
            },
            function () {
                return  knex.schema.createTable('MembershipItems', function (t) {
                    t.increments('id').primary();
                    t.integer('Membership_id').notNullable().references('id').inTable('Memberships');
                    t.dateTime('EntryDate').notNullable().index();
                    t.dateTime('LeavingDate').index();
                    t.integer('LeavingReason_id').references('id').inTable('LeavingReasons');
                    t.dateTime('PassiveSince').index();
                    t.dateTime('LivingElsewhereSince').index();
                    t.integer('MembershipFee_id').references('id').inTable('MembershipFees');
                    t.timestamp('valid_start').index();
                    t.timestamp('valid_end').index();
                });
            },
            function () {
                return  knex.schema.createTable('Pages', function (t) {
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
                return  knex.schema.createTable('PageContents', function (t) {
                    t.increments('id').primary();
                    t.string('Page_id').references('Name').inTable('Pages').notNullable();
                    t.string('Text', 50000);
                    t.timestamp('valid_start').index();
                    t.timestamp('valid_end').index();
                    t.unique(['Page_id']);
                });
            },
            function () {
                return  knex.schema.createTable('PageCollectionColumns', function (t) {
                    t.increments('id').primary();
                    t.string('Page_id').references('Name').inTable('Pages').notNullable();
                    t.integer('Order').notNullable().unique();
                    t.string('Name').notNullable();
                    t.string('Caption');
                    t.string('Type').notNullable();
                    t.boolean('Mandatory').notNullable();
                    t.unique(['Page_id', 'Order']);
                    t.unique(['Page_id', 'Name']);
                });
            },
            function () {
                return  knex.schema.createTable('Articles', function (t) {
                    t.increments('id').primary();
                    t.string('Page_id').references('Name').inTable('Pages');
                });
            },
            function () {
                return  knex.schema.createTable('ArticleItems', function (t) {
                    t.increments('id').primary();
                    t.integer('Article_id').references('id').inTable('Articles');
                    t.datetime('Date').notNullable().index();
                    t.string('Title').notNullable();
                    t.string('Subtitle');
                    t.string('Author');
                    t.timestamp('publish_start').notNullable().index();
                    t.timestamp('publish_end').index();
                    t.timestamp('valid_start').index();
                    t.timestamp('valid_end').index();
                });
            },
            function () {
                return  knex.schema.createTable('ArticleSections', function (t) {
                    t.increments('id').primary();
                    t.integer('Article_id').references('id').inTable('Articles').notNullable();
                });
            },
            function () {
                return  knex.schema.createTable('ArticleSectionItems', function (t) {
                    t.increments('id').primary();
                    t.integer('ArticleSection_id').references('id').inTable('ArticleSections').notNullable();
                    t.string('Title');
                    t.string('Text', 50000).notNullable();
                    t.string('ImageUrl');
                    t.string('ImageDescription');
                    t.timestamp('valid_start').index();
                    t.timestamp('valid_end').index();
                });
            },
            function () {
                return  knex.schema.createTable('ArticleReferences', function (t) {
                    t.increments('id').primary();
                    t.integer('ArticleSection_id').references('id').inTable('ArticleSections').notNullable();
                });
            },
            function () {
                return  knex.schema.createTable('ArticleReferenceItems', function (t) {
                    t.increments('id').primary();
                    t.integer('ArticleReference_id').references('id').inTable('ArticleReferences').notNullable();
                    t.string('Text').notNullable();
                    t.timestamp('valid_start').index();
                    t.timestamp('valid_end').index();
                });
            },
            function () {
                return  knex.schema.createTable('Events', function (t) {
                    t.increments('id').primary();
                    t.string('Page_id').references('Name').inTable('Pages').notNullable();
                });
            },
            function () {
                return  knex.schema.createTable('EventItems', function (t) {
                    t.increments('id').primary();
                    t.integer('Event_id').references('id').inTable('Events').notNullable();
                    t.string('Title', 50).notNullable();
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
                return  knex.schema.createTable('Contacts', function (t) {
                    t.increments('id').primary();
                    t.string('Page_id').references('Name').inTable('Pages').notNullable();
                });
            },
            function () {
                return  knex.schema.createTable('ContactItems', function (t) {
                    t.increments('id').primary();
                    t.integer('Contact_id').references('id').inTable('Contacts').notNullable();
                    t.integer('Person_id').notNullable().references('id').inTable('Persons').index();
                    t.timestamp('valid_start').index();
                    t.timestamp('valid_end').index();
                });
            },
            function () {
                return  knex.schema.createTable('Links', function (t) {
                    t.increments('id').primary();
                    t.string('Page_id').references('Name').inTable('Pages').notNullable();
                });
            },
            function () {
                return  knex.schema.createTable('LinkItems', function (t) {
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
    PersonContactDataPhone: function () {
        return this.hasOne(PersonContactDataPhone);
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

var PersonContactDataPhone = bookshelf.Model.extend({
    tableName: 'PersonContactDataPhonenumbers',
    PersonContactData: function () {
        return this.belongsTo(PersonContactData);
    }
});

var PersonContactDataPhonenumbers = bookshelf.Collection.extend({
    model: PersonContactDataPhone
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
    ArticleSection: function () {
        return this.hasMany(ArticleSection);
    },
    ArticleReference: function () {
        return this.hasMany(ArticleReference).through(ArticleSection);
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

var ArticleSection = bookshelf.Model.extend({
    tableName: 'ArticleSections',
    Article: function () {
        return this.belongsTo(Article);
    },
    ArticleReference: function () {
        return this.hasMany(ArticleReference);
    },
    ArticleSectionItem: function () {
        return this.hasMany(ArticleSectionItem);
    }
});

var ArticleSectionItem = bookshelf.Model.extend({
    tableName: 'ArticleSectionItems',
    ArticleSection: function () {
        return this.belongsTo(ArticleSection);
    }
});

var ArticleSections = bookshelf.Collection.extend({
    model: ArticleSection
});

var ArticleReference = bookshelf.Model.extend({
    tableName: 'ArticleReferences',
    ArticleSection: function () {
        return this.belongsTo(ArticleSection);
    },
    Article: function () {
        return this.belongsTo(Article).through(ArticleSection);
    },
    ArticleReferenceItem: function () {
        return this.hasMany(ArticleReferenceItem);
    }
});

var ArticleReferenceItem = bookshelf.Model.extend({
    tableName: 'ArticleReferenceItems',
    ArticleReference: function () {
        return this.belongsTo(ArticleReference);
    }
});

var ArticleReferences = bookshelf.Collection.extend({
    model: ArticleReference
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
    PersonItem: PersonItem,
    Persons: Persons,
    PersonContactType: PersonContactType,
    PersonContactTypes: PersonContactTypes,
    PersonContactData: PersonContactData,
    PersonContactDatas: PersonContactDatas,
    PersonContactDataAddress: PersonContactDataAddress,
    PersonContactDataAddresses: PersonContactDataAddresses,
    PersonContactDataPhone: PersonContactDataPhone,
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

var ffwMitglieder = [
    {"ID": 1, "Anrede": "Herr", "Vorname": "Richard", "Vorstandsmitglied": false, "Nachname": "Abold", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Steinacherstr. 36", "Unterdorf": false, "verzogen": false, "Geboren": "1937-06-10T00:00:00", "Telefon": "9674", "Mobiltelefon": null, "Eingetreten": "1979-01-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": null, "verstorben": null, "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 18, "Mitgliedsjahre": 35, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 76, "Geburtstag60": "1997-06-10T00:00:00", "Beitrag": 0.0000, "verzogenDatum": null},
    {"ID": 2, "Anrede": "Herr", "Vorname": "Johann", "Vorstandsmitglied": false, "Nachname": "Ankner", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Hauptstr. 28", "Unterdorf": false, "verzogen": false, "Geboren": "1962-09-16T00:00:00", "Telefon": "1273", "Mobiltelefon": "015209826051", "Eingetreten": "1978-01-06T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "2012-12-10T00:00:00", "verstorben": null, "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 34, "Mitgliedsjahre": 36, "Ehrung_25_Jahre_aktiv": "2003-01-06T00:00:00", "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 51, "Geburtstag60": null, "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 4, "Anrede": "Herr", "Vorname": "Walter", "Vorstandsmitglied": false, "Nachname": "Arnold", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Paartalweg 27", "Unterdorf": true, "verzogen": false, "Geboren": "1948-04-15T00:00:00", "Telefon": "92994", "Mobiltelefon": null, "Eingetreten": "1967-08-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "1900-01-01T00:00:00", "verstorben": null, "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 0, "Mitgliedsjahre": 46, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 65, "Geburtstag60": "2008-04-15T00:00:00", "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 5, "Anrede": "Herr", "Vorname": "Josef", "Vorstandsmitglied": false, "Nachname": "Aumiller", "PLZ": 86415.0, "Ort": "Mering", "Straße": null, "Unterdorf": false, "verzogen": true, "Geboren": "1921-08-26T00:00:00", "Telefon": "92102", "Mobiltelefon": null, "Eingetreten": "1964-01-12T00:00:00", "Ausgetreten": null, "Übergang_Passiv": null, "verstorben": "2009-04-25T00:00:00", "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 17, "Mitgliedsjahre": 45, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 87, "Geburtstag60": "1981-08-26T00:00:00", "Beitrag": 0.0000, "verzogenDatum": null},
    {"ID": 7, "Anrede": "Herr", "Vorname": "Michael", "Vorstandsmitglied": false, "Nachname": "Aumiller", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Herbstgasse 6", "Unterdorf": true, "verzogen": false, "Geboren": "1957-09-29T00:00:00", "Telefon": "4038", "Mobiltelefon": null, "Eingetreten": "1972-01-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "2002-01-01T00:00:00", "verstorben": null, "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 30, "Mitgliedsjahre": 42, "Ehrung_25_Jahre_aktiv": "2003-01-06T00:00:00", "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 56, "Geburtstag60": null, "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 8, "Anrede": "Herr", "Vorname": "Klaus", "Vorstandsmitglied": false, "Nachname": "Aumiller", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Kolpingstr. 34", "Unterdorf": false, "verzogen": false, "Geboren": "1958-06-13T00:00:00", "Telefon": "4588", "Mobiltelefon": null, "Eingetreten": "1974-09-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "1900-01-01T00:00:00", "verstorben": null, "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 0, "Mitgliedsjahre": 39, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 55, "Geburtstag60": null, "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 9, "Anrede": "Herr", "Vorname": "Anton", "Vorstandsmitglied": false, "Nachname": "Aumiller", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Hauptstr. 8", "Unterdorf": false, "verzogen": false, "Geboren": "1974-11-10T00:00:00", "Telefon": "92101", "Mobiltelefon": "01728518417", "Eingetreten": "1989-01-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": null, "verstorben": null, "aktiv": true, "Einladung": true, "EinladungSeparat": false, "aktive_Jahre": 25, "Mitgliedsjahre": 25, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 39, "Geburtstag60": null, "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 10, "Anrede": "Herr", "Vorname": "Josef", "Vorstandsmitglied": false, "Nachname": "Bader", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Angerweg 4", "Unterdorf": true, "verzogen": false, "Geboren": "1924-02-07T00:00:00", "Telefon": "4274", "Mobiltelefon": null, "Eingetreten": "1939-01-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "1900-01-01T00:00:00", "verstorben": "2012-12-02T00:00:00", "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 0, "Mitgliedsjahre": 73, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": "1987-05-03T00:00:00", "Ehrennadel_Gold": "1996-05-18T00:00:00", "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 88, "Geburtstag60": "1984-02-07T00:00:00", "Beitrag": 0.0000, "verzogenDatum": null},
    {"ID": 11, "Anrede": "Herr", "Vorname": "Bonifaz", "Vorstandsmitglied": false, "Nachname": "Bader", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Schulweg 6", "Unterdorf": false, "verzogen": false, "Geboren": "1930-03-23T00:00:00", "Telefon": "4247", "Mobiltelefon": null, "Eingetreten": "1952-01-20T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "1900-01-01T00:00:00", "verstorben": "2006-06-25T00:00:00", "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 0, "Mitgliedsjahre": 54, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": "1996-05-18T00:00:00", "Ehrennadel_Gold": "2003-01-06T00:00:00", "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 76, "Geburtstag60": "1990-03-23T00:00:00", "Beitrag": 0.0000, "verzogenDatum": null},
    {"ID": 13, "Anrede": "Herr", "Vorname": "Wolfgang", "Vorstandsmitglied": false, "Nachname": "Bader", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Angerweg 4b", "Unterdorf": true, "verzogen": false, "Geboren": "1960-04-16T00:00:00", "Telefon": null, "Mobiltelefon": null, "Eingetreten": "1977-01-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "2010-01-01T00:00:00", "verstorben": null, "aktiv": false, "Einladung": true, "EinladungSeparat": false, "aktive_Jahre": 33, "Mitgliedsjahre": 37, "Ehrung_25_Jahre_aktiv": "2003-01-06T00:00:00", "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 53, "Geburtstag60": null, "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 14, "Anrede": "Herr", "Vorname": "Anton", "Vorstandsmitglied": false, "Nachname": "Bartl", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Landsbergerstr. 25", "Unterdorf": false, "verzogen": false, "Geboren": "1935-04-11T00:00:00", "Telefon": "9409", "Mobiltelefon": null, "Eingetreten": "1954-01-10T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "1900-01-01T00:00:00", "verstorben": null, "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 0, "Mitgliedsjahre": 59, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": "1996-05-18T00:00:00", "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 78, "Geburtstag60": "1995-04-11T00:00:00", "Beitrag": 0.0000, "verzogenDatum": null},
    {"ID": 15, "Anrede": "Herr", "Vorname": "Walter", "Vorstandsmitglied": false, "Nachname": "Bartl", "PLZ": 86511.0, "Ort": "Schmiechen", "Straße": "Eglinger Str. 4", "Unterdorf": false, "verzogen": false, "Geboren": "1956-08-30T00:00:00", "Telefon": "9733", "Mobiltelefon": "01751830949", "Eingetreten": "1974-01-06T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "2010-01-01T00:00:00", "verstorben": null, "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 35, "Mitgliedsjahre": 40, "Ehrung_25_Jahre_aktiv": "2003-01-06T00:00:00", "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 57, "Geburtstag60": null, "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 17, "Anrede": "Herr", "Vorname": "Dieter", "Vorstandsmitglied": false, "Nachname": "Berghofer", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Raiffeisenring 6", "Unterdorf": false, "verzogen": false, "Geboren": "1961-01-08T00:00:00", "Telefon": "30250", "Mobiltelefon": null, "Eingetreten": "1977-01-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "1900-01-01T00:00:00", "verstorben": null, "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 0, "Mitgliedsjahre": 37, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 52, "Geburtstag60": null, "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 18, "Anrede": "Herr", "Vorname": "Erich", "Vorstandsmitglied": false, "Nachname": "Bernhard", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Carl Theodor Str. 8", "Unterdorf": false, "verzogen": false, "Geboren": "1959-09-11T00:00:00", "Telefon": "92000", "Mobiltelefon": null, "Eingetreten": "1980-01-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "1900-01-01T00:00:00", "verstorben": null, "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 0, "Mitgliedsjahre": 34, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 54, "Geburtstag60": null, "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 19, "Anrede": "Herr", "Vorname": "Stefan", "Vorstandsmitglied": false, "Nachname": "Bernhard", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Wankstr. 3", "Unterdorf": false, "verzogen": true, "Geboren": "1974-07-14T00:00:00", "Telefon": null, "Mobiltelefon": null, "Eingetreten": "1991-01-06T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "2006-11-05T00:00:00", "verstorben": null, "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 16, "Mitgliedsjahre": 16, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 32, "Geburtstag60": null, "Beitrag": 0.0000, "verzogenDatum": null},
    {"ID": 21, "Anrede": "Herr", "Vorname": "Wolfgang", "Vorstandsmitglied": false, "Nachname": "Berschneider", "PLZ": null, "Ort": "Türkenfeld ?", "Straße": null, "Unterdorf": false, "verzogen": true, "Geboren": "1962-08-16T00:00:00", "Telefon": null, "Mobiltelefon": null, "Eingetreten": "1978-01-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": null, "verstorben": null, "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 26, "Mitgliedsjahre": 26, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": null, "Geburtstag60": null, "Beitrag": 0.0000, "verzogenDatum": null},
    {"ID": 22, "Anrede": "Herr", "Vorname": "Leonhard", "Vorstandsmitglied": false, "Nachname": "Blank", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Badackerstr. 14", "Unterdorf": true, "verzogen": false, "Geboren": "1947-01-25T00:00:00", "Telefon": "92701", "Mobiltelefon": null, "Eingetreten": "1964-01-12T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "1900-01-01T00:00:00", "verstorben": null, "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 0, "Mitgliedsjahre": 49, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 66, "Geburtstag60": "2007-01-25T00:00:00", "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 23, "Anrede": "Herr", "Vorname": "Paul", "Vorstandsmitglied": false, "Nachname": "Blank", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Nebelhornstr. 16", "Unterdorf": false, "verzogen": false, "Geboren": "1957-06-28T00:00:00", "Telefon": null, "Mobiltelefon": null, "Eingetreten": "1973-01-06T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "1900-01-01T00:00:00", "verstorben": null, "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 0, "Mitgliedsjahre": 41, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 56, "Geburtstag60": null, "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 25, "Anrede": "Herr", "Vorname": "Martin", "Vorstandsmitglied": false, "Nachname": "Brunnenmeier", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Leitschlagweg 5a", "Unterdorf": true, "verzogen": false, "Geboren": "1948-12-02T00:00:00", "Telefon": "9841", "Mobiltelefon": null, "Eingetreten": "1978-01-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "1900-01-01T00:00:00", "verstorben": "2006-04-24T00:00:00", "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 0, "Mitgliedsjahre": 28, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 57, "Geburtstag60": "2008-12-02T00:00:00", "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 26, "Anrede": "Herr", "Vorname": "Roman", "Vorstandsmitglied": false, "Nachname": "Dafertshofer", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Steinacherstr. 7", "Unterdorf": false, "verzogen": false, "Geboren": "1954-09-11T00:00:00", "Telefon": "4272", "Mobiltelefon": null, "Eingetreten": "1970-01-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "2006-11-05T00:00:00", "verstorben": null, "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 36, "Mitgliedsjahre": 44, "Ehrung_25_Jahre_aktiv": "1996-05-18T00:00:00", "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 59, "Geburtstag60": null, "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 27, "Anrede": "Herr", "Vorname": "Ludwig", "Vorstandsmitglied": false, "Nachname": "Dellinger", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Schulweg 2", "Unterdorf": false, "verzogen": false, "Geboren": "1935-10-10T00:00:00", "Telefon": "30411", "Mobiltelefon": null, "Eingetreten": "1954-01-10T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "1900-01-01T00:00:00", "verstorben": "2012-09-08T00:00:00", "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 0, "Mitgliedsjahre": 58, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": "1996-05-18T00:00:00", "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 76, "Geburtstag60": "1995-10-10T00:00:00", "Beitrag": 0.0000, "verzogenDatum": null},
    {"ID": 28, "Anrede": "Herr", "Vorname": "Walter", "Vorstandsmitglied": false, "Nachname": "Denscherz", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Grüntenstr. 10", "Unterdorf": false, "verzogen": false, "Geboren": "1941-05-16T00:00:00", "Telefon": "92591", "Mobiltelefon": null, "Eingetreten": "1992-05-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": null, "verstorben": null, "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 9, "Mitgliedsjahre": 21, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 72, "Geburtstag60": "2001-05-16T00:00:00", "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 29, "Anrede": "Herr", "Vorname": "Karl - Heinz", "Vorstandsmitglied": false, "Nachname": "Dittebrand", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Fichtenstr. 15", "Unterdorf": true, "verzogen": false, "Geboren": "1954-02-02T00:00:00", "Telefon": "9161", "Mobiltelefon": null, "Eingetreten": "1977-08-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "1900-01-01T00:00:00", "verstorben": null, "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 0, "Mitgliedsjahre": 36, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 59, "Geburtstag60": null, "Beitrag": 0.0000, "verzogenDatum": null},
    {"ID": 30, "Anrede": "Herr", "Vorname": "Michael", "Vorstandsmitglied": false, "Nachname": "Doll", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Hauptstr. 29", "Unterdorf": true, "verzogen": false, "Geboren": "1928-01-04T00:00:00", "Telefon": "32429", "Mobiltelefon": null, "Eingetreten": "1958-09-14T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "1900-01-01T00:00:00", "verstorben": null, "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 0, "Mitgliedsjahre": 55, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": "2008-05-17T00:00:00", "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 86, "Geburtstag60": "1988-01-04T00:00:00", "Beitrag": 0.0000, "verzogenDatum": null},
    {"ID": 31, "Anrede": "Herr", "Vorname": "Paul", "Vorstandsmitglied": false, "Nachname": "Dosch", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Untermühlstr. 20", "Unterdorf": true, "verzogen": false, "Geboren": "1941-05-27T00:00:00", "Telefon": "92365", "Mobiltelefon": null, "Eingetreten": "1961-04-15T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "1900-01-01T00:00:00", "verstorben": null, "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 0, "Mitgliedsjahre": 52, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": "2012-01-06T00:00:00", "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 72, "Geburtstag60": "2001-05-27T00:00:00", "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 32, "Anrede": "Herr", "Vorname": "Michael", "Vorstandsmitglied": false, "Nachname": "Eidelsburger", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Kirchstr. 1", "Unterdorf": false, "verzogen": false, "Geboren": "1943-07-18T00:00:00", "Telefon": "9628", "Mobiltelefon": null, "Eingetreten": "1970-01-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "1900-01-01T00:00:00", "verstorben": null, "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 0, "Mitgliedsjahre": 44, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 70, "Geburtstag60": "2003-07-18T00:00:00", "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 35, "Anrede": "Herr", "Vorname": "Gottfried", "Vorstandsmitglied": false, "Nachname": "Ernst", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Paartalweg 13", "Unterdorf": true, "verzogen": false, "Geboren": "1940-05-18T00:00:00", "Telefon": "30953", "Mobiltelefon": null, "Eingetreten": "1964-01-12T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "1900-01-01T00:00:00", "verstorben": null, "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 0, "Mitgliedsjahre": 49, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 73, "Geburtstag60": "2000-05-18T00:00:00", "Beitrag": 0.0000, "verzogenDatum": null},
    {"ID": 36, "Anrede": "Herr", "Vorname": "Alois", "Vorstandsmitglied": false, "Nachname": "Escher", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Bahnhofstr. 8", "Unterdorf": true, "verzogen": false, "Geboren": "1930-06-02T00:00:00", "Telefon": "3919", "Mobiltelefon": null, "Eingetreten": "1964-08-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "1900-01-01T00:00:00", "verstorben": null, "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 0, "Mitgliedsjahre": 49, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 83, "Geburtstag60": "1990-06-02T00:00:00", "Beitrag": 0.0000, "verzogenDatum": null},
    {"ID": 38, "Anrede": "Herr", "Vorname": "Johann", "Vorstandsmitglied": false, "Nachname": "Fabian", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Fichtenstr. 4", "Unterdorf": true, "verzogen": false, "Geboren": "1946-01-14T00:00:00", "Telefon": "92865", "Mobiltelefon": null, "Eingetreten": "1978-05-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "1900-01-01T00:00:00", "verstorben": null, "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 0, "Mitgliedsjahre": 35, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 67, "Geburtstag60": "2006-01-14T00:00:00", "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 41, "Anrede": "Herr", "Vorname": "Christian", "Vorstandsmitglied": false, "Nachname": "Failer", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Lederweg 1", "Unterdorf": true, "verzogen": false, "Geboren": "1984-03-11T00:00:00", "Telefon": null, "Mobiltelefon": "01728549584", "Eingetreten": "1999-01-06T00:00:00", "Ausgetreten": null, "Übergang_Passiv": null, "verstorben": null, "aktiv": true, "Einladung": true, "EinladungSeparat": false, "aktive_Jahre": 15, "Mitgliedsjahre": 15, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 29, "Geburtstag60": null, "Beitrag": 3.5000, "verzogenDatum": null},
    {"ID": 42, "Anrede": "Herr", "Vorname": "Franz", "Vorstandsmitglied": false, "Nachname": "Falkner", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Raiffeisenring 2", "Unterdorf": false, "verzogen": false, "Geboren": "1947-06-29T00:00:00", "Telefon": "92169", "Mobiltelefon": null, "Eingetreten": "1964-08-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "1900-01-01T00:00:00", "verstorben": null, "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 0, "Mitgliedsjahre": 49, "Ehrung_25_Jahre_aktiv": "1996-05-18T00:00:00", "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 66, "Geburtstag60": "2007-06-29T00:00:00", "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 43, "Anrede": "Herr", "Vorname": "Marcus", "Vorstandsmitglied": false, "Nachname": "Feigel", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Sandstr. 11", "Unterdorf": true, "verzogen": false, "Geboren": null, "Telefon": null, "Mobiltelefon": null, "Eingetreten": "1996-01-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "1900-01-01T00:00:00", "verstorben": null, "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": null, "Mitgliedsjahre": null, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": null, "Geburtstag60": null, "Beitrag": 7.0000, "verzogenDatum": "1996-01-01T00:00:00"},
    {"ID": 44, "Anrede": "Herr", "Vorname": "Josef", "Vorstandsmitglied": false, "Nachname": "Gaag, sen.", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Leitschlagweg 3", "Unterdorf": true, "verzogen": false, "Geboren": "1927-09-13T00:00:00", "Telefon": null, "Mobiltelefon": null, "Eingetreten": "1967-05-13T00:00:00", "Ausgetreten": null, "Übergang_Passiv": null, "verstorben": null, "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 20, "Mitgliedsjahre": 46, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 86, "Geburtstag60": "1987-09-13T00:00:00", "Beitrag": 0.0000, "verzogenDatum": null},
    {"ID": 45, "Anrede": "Herr", "Vorname": "Josef", "Vorstandsmitglied": false, "Nachname": "Gaag", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Leitschlagweg 3", "Unterdorf": true, "verzogen": false, "Geboren": "1952-05-15T00:00:00", "Telefon": "92731", "Mobiltelefon": null, "Eingetreten": "1970-01-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "1900-01-01T00:00:00", "verstorben": null, "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 0, "Mitgliedsjahre": 44, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 61, "Geburtstag60": "2012-05-15T00:00:00", "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 46, "Anrede": "Herr", "Vorname": "Peter", "Vorstandsmitglied": false, "Nachname": "Gahbauer", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Eichenstr. 1f", "Unterdorf": true, "verzogen": false, "Geboren": "1967-06-28T00:00:00", "Telefon": null, "Mobiltelefon": null, "Eingetreten": "1986-01-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "2006-11-05T00:00:00", "verstorben": null, "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 20, "Mitgliedsjahre": 28, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 46, "Geburtstag60": null, "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 48, "Anrede": "Herr", "Vorname": "Anton", "Vorstandsmitglied": false, "Nachname": "Gantner", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Lederweg 1", "Unterdorf": true, "verzogen": false, "Geboren": "1935-10-20T00:00:00", "Telefon": null, "Mobiltelefon": null, "Eingetreten": "1954-04-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "1900-01-01T00:00:00", "verstorben": "2005-06-14T00:00:00", "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 0, "Mitgliedsjahre": 51, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": "1996-05-18T00:00:00", "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 69, "Geburtstag60": "1995-10-20T00:00:00", "Beitrag": 0.0000, "verzogenDatum": null},
    {"ID": 49, "Anrede": "Herr", "Vorname": "Martin", "Vorstandsmitglied": false, "Nachname": "Gantner", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Kolpingstr. 5", "Unterdorf": false, "verzogen": false, "Geboren": "1958-10-19T00:00:00", "Telefon": "31635", "Mobiltelefon": null, "Eingetreten": "1976-01-06T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "1900-01-01T00:00:00", "verstorben": null, "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 0, "Mitgliedsjahre": 38, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 55, "Geburtstag60": null, "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 50, "Anrede": "Herr", "Vorname": "Bruno", "Vorstandsmitglied": false, "Nachname": "Gebauer", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Paartalweg 1", "Unterdorf": true, "verzogen": false, "Geboren": "1939-08-27T00:00:00", "Telefon": "4451", "Mobiltelefon": null, "Eingetreten": "1968-01-14T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "1900-01-01T00:00:00", "verstorben": null, "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 0, "Mitgliedsjahre": 45, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 74, "Geburtstag60": "1999-08-27T00:00:00", "Beitrag": 0.0000, "verzogenDatum": null},
    {"ID": 52, "Anrede": "Herr", "Vorname": "Johann", "Vorstandsmitglied": false, "Nachname": "Grabmann, sen.", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Sommerweg 3", "Unterdorf": true, "verzogen": false, "Geboren": "1940-04-16T00:00:00", "Telefon": "9056", "Mobiltelefon": null, "Eingetreten": "1959-06-22T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "1900-01-01T00:00:00", "verstorben": null, "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 0, "Mitgliedsjahre": 54, "Ehrung_25_Jahre_aktiv": "1987-05-03T00:00:00", "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": "2010-01-06T00:00:00", "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 73, "Geburtstag60": "2000-04-16T00:00:00", "Beitrag": 0.0000, "verzogenDatum": null},
    {"ID": 54, "Anrede": "Herr", "Vorname": "Bruno", "Vorstandsmitglied": false, "Nachname": "Grabmann", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Sommerweg 3", "Unterdorf": true, "verzogen": false, "Geboren": "1970-10-19T00:00:00", "Telefon": "9056", "Mobiltelefon": "01738048128", "Eingetreten": "1989-01-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "2012-12-10T00:00:00", "verstorben": null, "aktiv": false, "Einladung": true, "EinladungSeparat": false, "aktive_Jahre": 23, "Mitgliedsjahre": 25, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 43, "Geburtstag60": null, "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 55, "Anrede": "Herr", "Vorname": "Hermann", "Vorstandsmitglied": false, "Nachname": "Grad", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Nebelhornstr. 9", "Unterdorf": false, "verzogen": false, "Geboren": "1949-07-02T00:00:00", "Telefon": "92383", "Mobiltelefon": null, "Eingetreten": "1974-07-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "1900-01-01T00:00:00", "verstorben": null, "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 0, "Mitgliedsjahre": 39, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 64, "Geburtstag60": "2009-07-02T00:00:00", "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 56, "Anrede": "Herr Pfarrer", "Vorname": "Carl", "Vorstandsmitglied": false, "Nachname": "Graf", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Hauptstr. 17", "Unterdorf": true, "verzogen": true, "Geboren": "1941-06-18T00:00:00", "Telefon": "9370", "Mobiltelefon": null, "Eingetreten": "1980-01-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": null, "verstorben": null, "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 21, "Mitgliedsjahre": 31, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 70, "Geburtstag60": "2001-06-18T00:00:00", "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 57, "Anrede": "Herr", "Vorname": "Johann", "Vorstandsmitglied": false, "Nachname": "Grill", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Bahnhostr. 14", "Unterdorf": true, "verzogen": false, "Geboren": "1922-11-26T00:00:00", "Telefon": "4881", "Mobiltelefon": null, "Eingetreten": "1939-10-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "1900-01-01T00:00:00", "verstorben": "2008-04-03T00:00:00", "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 0, "Mitgliedsjahre": 68, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": "1987-05-03T00:00:00", "Ehrennadel_Gold": "1996-05-18T00:00:00", "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 85, "Geburtstag60": "1982-11-26T00:00:00", "Beitrag": 0.0000, "verzogenDatum": null},
    {"ID": 59, "Anrede": "Herr", "Vorname": "Paul", "Vorstandsmitglied": false, "Nachname": "Grundler", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Karwendelstr. 4", "Unterdorf": false, "verzogen": false, "Geboren": "1937-12-29T00:00:00", "Telefon": null, "Mobiltelefon": null, "Eingetreten": "1956-02-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "1900-01-01T00:00:00", "verstorben": null, "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 0, "Mitgliedsjahre": 57, "Ehrung_25_Jahre_aktiv": "1987-05-03T00:00:00", "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": "1996-05-18T00:00:00", "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 76, "Geburtstag60": "1997-12-29T00:00:00", "Beitrag": 0.0000, "verzogenDatum": null},
    {"ID": 60, "Anrede": "Herr", "Vorname": "Fritz", "Vorstandsmitglied": false, "Nachname": "Grundler", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Bachstr. 4", "Unterdorf": true, "verzogen": false, "Geboren": "1956-03-19T00:00:00", "Telefon": "92003", "Mobiltelefon": null, "Eingetreten": "1973-01-06T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "1900-01-01T00:00:00", "verstorben": null, "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 0, "Mitgliedsjahre": 41, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 57, "Geburtstag60": null, "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 61, "Anrede": "Herr", "Vorname": "Alois", "Vorstandsmitglied": false, "Nachname": "Grundler, jun.", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Landsbergerstr. 14a", "Unterdorf": true, "verzogen": false, "Geboren": "1962-11-07T00:00:00", "Telefon": "1443", "Mobiltelefon": null, "Eingetreten": "1978-01-06T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "2010-01-01T00:00:00", "verstorben": null, "aktiv": false, "Einladung": true, "EinladungSeparat": false, "aktive_Jahre": 31, "Mitgliedsjahre": 36, "Ehrung_25_Jahre_aktiv": "2003-01-06T00:00:00", "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 51, "Geburtstag60": null, "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 62, "Anrede": "Herr", "Vorname": "Thomas", "Vorstandsmitglied": false, "Nachname": "Grundler", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Wendelsteinstr. 1a", "Unterdorf": false, "verzogen": false, "Geboren": "1964-11-30T00:00:00", "Telefon": "9494", "Mobiltelefon": "015779636950", "Eingetreten": "1980-11-19T00:00:00", "Ausgetreten": null, "Übergang_Passiv": null, "verstorben": null, "aktiv": true, "Einladung": true, "EinladungSeparat": false, "aktive_Jahre": 33, "Mitgliedsjahre": 33, "Ehrung_25_Jahre_aktiv": "2006-01-06T00:00:00", "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 49, "Geburtstag60": null, "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 63, "Anrede": "Herr", "Vorname": "Michael", "Vorstandsmitglied": false, "Nachname": "Grundler", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Hohlweg 1", "Unterdorf": false, "verzogen": false, "Geboren": "1970-06-01T00:00:00", "Telefon": null, "Mobiltelefon": null, "Eingetreten": "1989-01-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": null, "verstorben": null, "aktiv": true, "Einladung": true, "EinladungSeparat": false, "aktive_Jahre": 25, "Mitgliedsjahre": 25, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 43, "Geburtstag60": null, "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 64, "Anrede": "Herr", "Vorname": "Werner", "Vorstandsmitglied": false, "Nachname": "Hausner", "PLZ": null, "Ort": null, "Straße": null, "Unterdorf": false, "verzogen": true, "Geboren": "1957-05-20T00:00:00", "Telefon": "1277", "Mobiltelefon": null, "Eingetreten": "1974-09-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "1900-01-01T00:00:00", "verstorben": null, "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 29, "Mitgliedsjahre": 29, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": null, "Geburtstag60": null, "Beitrag": 0.0000, "verzogenDatum": null},
    {"ID": 66, "Anrede": "Herr", "Vorname": "Rasso", "Vorstandsmitglied": false, "Nachname": "Heim", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Mandichostr. 7", "Unterdorf": true, "verzogen": false, "Geboren": "1936-12-10T00:00:00", "Telefon": null, "Mobiltelefon": null, "Eingetreten": "1956-09-14T00:00:00", "Ausgetreten": null, "Übergang_Passiv": null, "verstorben": "2004-12-31T00:00:00", "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 40, "Mitgliedsjahre": 48, "Ehrung_25_Jahre_aktiv": "1987-05-03T00:00:00", "Ehrung_40_Jahre_aktiv": "1996-05-18T00:00:00", "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 68, "Geburtstag60": "1996-12-10T00:00:00", "Beitrag": 0.0000, "verzogenDatum": null},
    {"ID": 67, "Anrede": "Herr", "Vorname": "Walter", "Vorstandsmitglied": false, "Nachname": "Heim", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Gartenstr. 1", "Unterdorf": false, "verzogen": false, "Geboren": "1962-07-28T00:00:00", "Telefon": null, "Mobiltelefon": null, "Eingetreten": "1978-01-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "1900-01-01T00:00:00", "verstorben": null, "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 0, "Mitgliedsjahre": 36, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 51, "Geburtstag60": null, "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 68, "Anrede": "Herr", "Vorname": "Josef", "Vorstandsmitglied": false, "Nachname": "Heiß", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Landsbergerstr. 8", "Unterdorf": true, "verzogen": false, "Geboren": "1921-02-09T00:00:00", "Telefon": "92075", "Mobiltelefon": null, "Eingetreten": "1961-01-15T00:00:00", "Ausgetreten": null, "Übergang_Passiv": null, "verstorben": "2003-01-01T00:00:00", "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 20, "Mitgliedsjahre": 41, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 81, "Geburtstag60": "1981-02-09T00:00:00", "Beitrag": 0.0000, "verzogenDatum": null},
    {"ID": 69, "Anrede": "Herr", "Vorname": "Hermann", "Vorstandsmitglied": false, "Nachname": "Hoffmann", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Sandstr. 11", "Unterdorf": true, "verzogen": false, "Geboren": "1944-12-07T00:00:00", "Telefon": "30898", "Mobiltelefon": null, "Eingetreten": "1978-01-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "1900-01-01T00:00:00", "verstorben": null, "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 0, "Mitgliedsjahre": 36, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 69, "Geburtstag60": "2004-12-07T00:00:00", "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 70, "Anrede": "Herr", "Vorname": "Werner", "Vorstandsmitglied": false, "Nachname": "Hofmuth", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Steinacherstr. 4", "Unterdorf": false, "verzogen": false, "Geboren": "1971-09-13T00:00:00", "Telefon": "4318", "Mobiltelefon": null, "Eingetreten": "1989-01-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "2006-11-05T00:00:00", "verstorben": null, "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 17, "Mitgliedsjahre": 25, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 42, "Geburtstag60": null, "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 71, "Anrede": "Herr", "Vorname": "Werner", "Vorstandsmitglied": false, "Nachname": "Jakob", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Kirchstr. 7", "Unterdorf": false, "verzogen": false, "Geboren": "1962-04-23T00:00:00", "Telefon": null, "Mobiltelefon": null, "Eingetreten": "1978-01-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": null, "verstorben": "2011-09-05T00:00:00", "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 33, "Mitgliedsjahre": 33, "Ehrung_25_Jahre_aktiv": "2003-01-06T00:00:00", "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 49, "Geburtstag60": null, "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 72, "Anrede": "Herr", "Vorname": "Martin", "Vorstandsmitglied": false, "Nachname": "Jaser", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Carolinenweg 1", "Unterdorf": false, "verzogen": false, "Geboren": "1975-03-14T00:00:00", "Telefon": "1511", "Mobiltelefon": "01733803399", "Eingetreten": "1989-01-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": null, "verstorben": null, "aktiv": true, "Einladung": true, "EinladungSeparat": false, "aktive_Jahre": 25, "Mitgliedsjahre": 25, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 38, "Geburtstag60": null, "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 73, "Anrede": "Herr", "Vorname": "Michael", "Vorstandsmitglied": false, "Nachname": "Jaser", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Nebelhornstr. 2", "Unterdorf": false, "verzogen": false, "Geboren": "1984-08-06T00:00:00", "Telefon": null, "Mobiltelefon": "01735705820", "Eingetreten": "1999-01-06T00:00:00", "Ausgetreten": null, "Übergang_Passiv": null, "verstorben": null, "aktiv": true, "Einladung": true, "EinladungSeparat": false, "aktive_Jahre": 15, "Mitgliedsjahre": 15, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 29, "Geburtstag60": null, "Beitrag": 3.5000, "verzogenDatum": null},
    {"ID": 74, "Anrede": "Herr", "Vorname": "Siegfried", "Vorstandsmitglied": false, "Nachname": "Jocher", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Nebelhornstr. 13", "Unterdorf": false, "verzogen": false, "Geboren": "1944-09-06T00:00:00", "Telefon": "1342", "Mobiltelefon": null, "Eingetreten": "1963-09-15T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "1900-01-01T00:00:00", "verstorben": null, "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 0, "Mitgliedsjahre": 50, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 69, "Geburtstag60": "2004-09-06T00:00:00", "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 76, "Anrede": "Herr", "Vorname": "Ernst", "Vorstandsmitglied": false, "Nachname": "Karl", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Grüntenstr. 4", "Unterdorf": false, "verzogen": false, "Geboren": "1937-12-12T00:00:00", "Telefon": "1626", "Mobiltelefon": null, "Eingetreten": "1973-01-06T00:00:00", "Ausgetreten": null, "Übergang_Passiv": null, "verstorben": null, "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 24, "Mitgliedsjahre": 41, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 76, "Geburtstag60": "1997-12-12T00:00:00", "Beitrag": 0.0000, "verzogenDatum": null},
    {"ID": 77, "Anrede": "Herr", "Vorname": "Peter", "Vorstandsmitglied": false, "Nachname": "Kaspar", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Bahnhofstr. 3a", "Unterdorf": true, "verzogen": false, "Geboren": "1957-05-18T00:00:00", "Telefon": null, "Mobiltelefon": null, "Eingetreten": "1972-01-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "2006-11-05T00:00:00", "verstorben": null, "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 34, "Mitgliedsjahre": 42, "Ehrung_25_Jahre_aktiv": "2003-01-06T00:00:00", "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 56, "Geburtstag60": null, "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 79, "Anrede": "Herr", "Vorname": "Matthias", "Vorstandsmitglied": false, "Nachname": "Kaspar", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Kolpingstr. 28", "Unterdorf": false, "verzogen": false, "Geboren": "1965-03-17T00:00:00", "Telefon": "31345", "Mobiltelefon": null, "Eingetreten": "1980-11-02T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "2004-12-31T00:00:00", "verstorben": null, "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 24, "Mitgliedsjahre": 33, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 48, "Geburtstag60": null, "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 81, "Anrede": "Herr", "Vorname": "Dieter", "Vorstandsmitglied": false, "Nachname": "Kauth", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Nebelhornstr. 17", "Unterdorf": false, "verzogen": false, "Geboren": "1953-05-12T00:00:00", "Telefon": "4431", "Mobiltelefon": null, "Eingetreten": "1970-01-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "1900-01-01T00:00:00", "verstorben": null, "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 0, "Mitgliedsjahre": 44, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 60, "Geburtstag60": "2013-05-12T00:00:00", "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 83, "Anrede": "Herr", "Vorname": "Lorenz", "Vorstandsmitglied": false, "Nachname": "Kerber", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Hauptstr. 36", "Unterdorf": false, "verzogen": false, "Geboren": "1953-03-19T00:00:00", "Telefon": "1222", "Mobiltelefon": null, "Eingetreten": "1970-01-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "2006-11-05T00:00:00", "verstorben": null, "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 36, "Mitgliedsjahre": 44, "Ehrung_25_Jahre_aktiv": "1996-05-18T00:00:00", "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 60, "Geburtstag60": "2013-03-19T00:00:00", "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 84, "Anrede": "Herr", "Vorname": "Stefan", "Vorstandsmitglied": false, "Nachname": "Kerber", "PLZ": 86510.0, "Ort": "Ried", "Straße": "Tannenholzweg 1", "Unterdorf": false, "verzogen": true, "Geboren": "1979-01-29T00:00:00", "Telefon": null, "Mobiltelefon": null, "Eingetreten": "1995-07-03T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "2006-11-05T00:00:00", "verstorben": null, "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 11, "Mitgliedsjahre": 14, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 30, "Geburtstag60": null, "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 85, "Anrede": "Herr", "Vorname": "Martin", "Vorstandsmitglied": false, "Nachname": "Kerber", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Hauptstr. 36", "Unterdorf": false, "verzogen": false, "Geboren": null, "Telefon": null, "Mobiltelefon": null, "Eingetreten": "1996-01-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": null, "verstorben": null, "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": null, "Mitgliedsjahre": null, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": null, "Geburtstag60": null, "Beitrag": 7.0000, "verzogenDatum": "1996-01-01T00:00:00"},
    {"ID": 87, "Anrede": "Herr", "Vorname": "Josef", "Vorstandsmitglied": false, "Nachname": "Kinader", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Bahnhofstr. 12", "Unterdorf": true, "verzogen": false, "Geboren": "1960-03-02T00:00:00", "Telefon": "30262", "Mobiltelefon": "017610053060", "Eingetreten": "1977-01-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": null, "verstorben": null, "aktiv": true, "Einladung": true, "EinladungSeparat": false, "aktive_Jahre": 37, "Mitgliedsjahre": 37, "Ehrung_25_Jahre_aktiv": "2003-01-06T00:00:00", "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 53, "Geburtstag60": null, "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 88, "Anrede": "Herr", "Vorname": "Dieter", "Vorstandsmitglied": false, "Nachname": "Klement", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Hohlweg 6", "Unterdorf": false, "verzogen": false, "Geboren": "1948-10-08T00:00:00", "Telefon": "92861", "Mobiltelefon": null, "Eingetreten": "1978-01-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "1900-01-01T00:00:00", "verstorben": null, "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 0, "Mitgliedsjahre": 36, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 65, "Geburtstag60": "2008-10-08T00:00:00", "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 89, "Anrede": "Herr", "Vorname": "Benedikt", "Vorstandsmitglied": false, "Nachname": "Kohl", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Unterbergerstr. 2", "Unterdorf": true, "verzogen": false, "Geboren": "1932-07-15T00:00:00", "Telefon": "4372", "Mobiltelefon": null, "Eingetreten": "1977-01-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": null, "verstorben": "2008-12-29T00:00:00", "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 15, "Mitgliedsjahre": 31, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 76, "Geburtstag60": "1992-07-15T00:00:00", "Beitrag": 0.0000, "verzogenDatum": null},
    {"ID": 90, "Anrede": "Herr", "Vorname": "Ludwig", "Vorstandsmitglied": false, "Nachname": "König", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Bahnhofring 5", "Unterdorf": true, "verzogen": false, "Geboren": "1935-01-23T00:00:00", "Telefon": "1256", "Mobiltelefon": null, "Eingetreten": "1977-01-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": null, "verstorben": null, "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 18, "Mitgliedsjahre": 37, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 78, "Geburtstag60": "1995-01-23T00:00:00", "Beitrag": 0.0000, "verzogenDatum": null},
    {"ID": 91, "Anrede": "Herr", "Vorname": "Paul", "Vorstandsmitglied": false, "Nachname": "Kratzer", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Kirchfeldstr. 23", "Unterdorf": false, "verzogen": false, "Geboren": "1959-01-23T00:00:00", "Telefon": null, "Mobiltelefon": null, "Eingetreten": "1977-03-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "1900-01-01T00:00:00", "verstorben": null, "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 0, "Mitgliedsjahre": 36, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 54, "Geburtstag60": null, "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 93, "Anrede": "Herr", "Vorname": "Alexander", "Vorstandsmitglied": false, "Nachname": "Krauser", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Mandichostr. 2", "Unterdorf": true, "verzogen": false, "Geboren": "1974-01-19T00:00:00", "Telefon": "4026", "Mobiltelefon": null, "Eingetreten": "1989-01-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "2006-11-05T00:00:00", "verstorben": null, "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 17, "Mitgliedsjahre": 25, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 39, "Geburtstag60": null, "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 94, "Anrede": "Herr", "Vorname": "Herbert", "Vorstandsmitglied": false, "Nachname": "Kurz", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Frühlingsstr. 5", "Unterdorf": false, "verzogen": false, "Geboren": "1947-04-08T00:00:00", "Telefon": "9941", "Mobiltelefon": null, "Eingetreten": "1964-01-12T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "1995-12-31T00:00:00", "verstorben": null, "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 31, "Mitgliedsjahre": 49, "Ehrung_25_Jahre_aktiv": "1996-05-18T00:00:00", "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 66, "Geburtstag60": "2007-04-08T00:00:00", "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 96, "Anrede": "Herr", "Vorname": "August", "Vorstandsmitglied": false, "Nachname": "Lachenmair", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Landsbergerstr. 19", "Unterdorf": false, "verzogen": false, "Geboren": "1934-03-16T00:00:00", "Telefon": "4557", "Mobiltelefon": null, "Eingetreten": "1954-04-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "1900-01-01T00:00:00", "verstorben": null, "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 0, "Mitgliedsjahre": 59, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": "1996-05-18T00:00:00", "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 79, "Geburtstag60": "1994-03-16T00:00:00", "Beitrag": 0.0000, "verzogenDatum": null},
    {"ID": 97, "Anrede": "Herr", "Vorname": "Johann", "Vorstandsmitglied": false, "Nachname": "Lachenmair", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Landsbergerstr. 22", "Unterdorf": true, "verzogen": false, "Geboren": "1950-12-03T00:00:00", "Telefon": "1200", "Mobiltelefon": null, "Eingetreten": "1974-01-06T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "2006-11-05T00:00:00", "verstorben": null, "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 32, "Mitgliedsjahre": 40, "Ehrung_25_Jahre_aktiv": "2003-01-06T00:00:00", "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 63, "Geburtstag60": "2010-12-03T00:00:00", "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 98, "Anrede": "Herr", "Vorname": "Robert", "Vorstandsmitglied": false, "Nachname": "Lachenmair", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Angerweg 3", "Unterdorf": true, "verzogen": false, "Geboren": "1965-09-28T00:00:00", "Telefon": "31454", "Mobiltelefon": null, "Eingetreten": "1980-11-02T00:00:00", "Ausgetreten": null, "Übergang_Passiv": null, "verstorben": null, "aktiv": true, "Einladung": true, "EinladungSeparat": false, "aktive_Jahre": 33, "Mitgliedsjahre": 33, "Ehrung_25_Jahre_aktiv": "2006-01-06T00:00:00", "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 48, "Geburtstag60": null, "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 99, "Anrede": "Herr", "Vorname": "Peter", "Vorstandsmitglied": false, "Nachname": "Lachenmair", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Landsbergerstr. 19", "Unterdorf": true, "verzogen": false, "Geboren": "1976-01-05T00:00:00", "Telefon": null, "Mobiltelefon": null, "Eingetreten": "1991-01-06T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "2006-11-05T00:00:00", "verstorben": null, "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 15, "Mitgliedsjahre": 23, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 38, "Geburtstag60": null, "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 100, "Anrede": "Herr", "Vorname": "Josef", "Vorstandsmitglied": false, "Nachname": "Lefin", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Bergstr. 2", "Unterdorf": true, "verzogen": false, "Geboren": "1921-10-20T00:00:00", "Telefon": null, "Mobiltelefon": null, "Eingetreten": "1938-01-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "1900-01-01T00:00:00", "verstorben": "2005-02-17T00:00:00", "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 0, "Mitgliedsjahre": 67, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": "1987-05-03T00:00:00", "Ehrennadel_Gold": "1996-05-18T00:00:00", "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 83, "Geburtstag60": "1981-10-20T00:00:00", "Beitrag": 0.0000, "verzogenDatum": null},
    {"ID": 102, "Anrede": "Herr", "Vorname": "Erich", "Vorstandsmitglied": false, "Nachname": "Luichtl", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Kirchstr. 10", "Unterdorf": false, "verzogen": false, "Geboren": "1956-11-07T00:00:00", "Telefon": "9761", "Mobiltelefon": null, "Eingetreten": "1972-01-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": null, "verstorben": null, "aktiv": true, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 42, "Mitgliedsjahre": 42, "Ehrung_25_Jahre_aktiv": "2003-01-06T00:00:00", "Ehrung_40_Jahre_aktiv": "2012-02-15T00:00:00", "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 57, "Geburtstag60": null, "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 104, "Anrede": "Herr", "Vorname": "Bernhard", "Vorstandsmitglied": false, "Nachname": "Lutz", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Schulweg 9", "Unterdorf": false, "verzogen": false, "Geboren": "1933-03-19T00:00:00", "Telefon": "9174", "Mobiltelefon": null, "Eingetreten": "1958-01-06T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "1900-01-01T00:00:00", "verstorben": "2006-09-24T00:00:00", "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 0, "Mitgliedsjahre": 48, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 73, "Geburtstag60": "1993-03-19T00:00:00", "Beitrag": 0.0000, "verzogenDatum": null},
    {"ID": 105, "Anrede": "Herr", "Vorname": "Walter", "Vorstandsmitglied": false, "Nachname": "Lutz", "PLZ": 86415.0, "Ort": "Mering", "Straße": null, "Unterdorf": false, "verzogen": true, "Geboren": "1957-04-21T00:00:00", "Telefon": null, "Mobiltelefon": null, "Eingetreten": "1976-01-06T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "1900-01-01T00:00:00", "verstorben": null, "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 0, "Mitgliedsjahre": 34, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 52, "Geburtstag60": null, "Beitrag": 0.0000, "verzogenDatum": null},
    {"ID": 106, "Anrede": "Herr", "Vorname": "Eduard", "Vorstandsmitglied": false, "Nachname": "Lutz", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Zugspitzstr. 3a", "Unterdorf": false, "verzogen": false, "Geboren": "1960-10-07T00:00:00", "Telefon": "4765", "Mobiltelefon": null, "Eingetreten": "1978-01-06T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "2006-11-05T00:00:00", "verstorben": null, "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 28, "Mitgliedsjahre": 36, "Ehrung_25_Jahre_aktiv": "2003-01-06T00:00:00", "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 53, "Geburtstag60": null, "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 107, "Anrede": "Herr", "Vorname": "Johann", "Vorstandsmitglied": false, "Nachname": "Mayer", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Paartalweg 9", "Unterdorf": true, "verzogen": false, "Geboren": "1934-07-12T00:00:00", "Telefon": "92062", "Mobiltelefon": null, "Eingetreten": "1953-01-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "1900-01-01T00:00:00", "verstorben": null, "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 0, "Mitgliedsjahre": 61, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": "1996-05-18T00:00:00", "Ehrennadel_Gold": "2003-01-06T00:00:00", "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 79, "Geburtstag60": "1994-07-12T00:00:00", "Beitrag": 0.0000, "verzogenDatum": null},
    {"ID": 109, "Anrede": "Herr", "Vorname": "Josef", "Vorstandsmitglied": false, "Nachname": "Mayr", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Hauptstr. 3a", "Unterdorf": true, "verzogen": false, "Geboren": "1946-03-08T00:00:00", "Telefon": "1824", "Mobiltelefon": null, "Eingetreten": "1977-01-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "1900-01-01T00:00:00", "verstorben": null, "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 0, "Mitgliedsjahre": 37, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 67, "Geburtstag60": "2006-03-08T00:00:00", "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 110, "Anrede": "Herr", "Vorname": "Thomas", "Vorstandsmitglied": true, "Nachname": "Mayr", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Kolpingstr. 7", "Unterdorf": false, "verzogen": false, "Geboren": "1973-01-14T00:00:00", "Telefon": "744388", "Mobiltelefon": "016096333109", "Eingetreten": "1986-01-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": null, "verstorben": null, "aktiv": true, "Einladung": true, "EinladungSeparat": false, "aktive_Jahre": 28, "Mitgliedsjahre": 28, "Ehrung_25_Jahre_aktiv": "2012-10-23T00:00:00", "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 40, "Geburtstag60": null, "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 111, "Anrede": "Herr", "Vorname": "Alexander", "Vorstandsmitglied": false, "Nachname": "Mayr", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Kolpingstr. 7", "Unterdorf": false, "verzogen": false, "Geboren": "1975-10-01T00:00:00", "Telefon": null, "Mobiltelefon": null, "Eingetreten": "1991-01-06T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "2010-01-01T00:00:00", "verstorben": null, "aktiv": false, "Einladung": true, "EinladungSeparat": false, "aktive_Jahre": 18, "Mitgliedsjahre": 23, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 38, "Geburtstag60": null, "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 112, "Anrede": "Herr", "Vorname": "Wolfgang", "Vorstandsmitglied": false, "Nachname": "Mayr", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Frühlingstr. 9", "Unterdorf": false, "verzogen": false, "Geboren": "1982-07-04T00:00:00", "Telefon": null, "Mobiltelefon": "015120928804", "Eingetreten": "1999-01-06T00:00:00", "Ausgetreten": null, "Übergang_Passiv": null, "verstorben": null, "aktiv": true, "Einladung": true, "EinladungSeparat": false, "aktive_Jahre": 15, "Mitgliedsjahre": 15, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 31, "Geburtstag60": null, "Beitrag": 3.5000, "verzogenDatum": null},
    {"ID": 113, "Anrede": "Herr", "Vorname": "Heinrich", "Vorstandsmitglied": false, "Nachname": "Meidert", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Brunnen 5", "Unterdorf": false, "verzogen": false, "Geboren": "1935-11-21T00:00:00", "Telefon": "9575", "Mobiltelefon": null, "Eingetreten": "1960-03-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": null, "verstorben": null, "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 35, "Mitgliedsjahre": 53, "Ehrung_25_Jahre_aktiv": "1996-05-18T00:00:00", "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": "1987-05-03T00:00:00", "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 78, "Geburtstag60": "1995-11-21T00:00:00", "Beitrag": 0.0000, "verzogenDatum": null},
    {"ID": 114, "Anrede": "Herr", "Vorname": "Ernst", "Vorstandsmitglied": true, "Nachname": "Meidert", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Brunnen 5a", "Unterdorf": false, "verzogen": false, "Geboren": "1973-08-08T00:00:00", "Telefon": "9575", "Mobiltelefon": "015208591155", "Eingetreten": "1989-01-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": null, "verstorben": null, "aktiv": true, "Einladung": true, "EinladungSeparat": false, "aktive_Jahre": 25, "Mitgliedsjahre": 25, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 40, "Geburtstag60": null, "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 115, "Anrede": "Frau", "Vorname": "Brigitte", "Vorstandsmitglied": false, "Nachname": "Meyer", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Steindorfer Str. 19", "Unterdorf": false, "verzogen": false, "Geboren": "1947-12-24T00:00:00", "Telefon": "30240", "Mobiltelefon": null, "Eingetreten": "1996-01-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "1996-01-01T00:00:00", "verstorben": null, "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 0, "Mitgliedsjahre": 18, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 66, "Geburtstag60": "2007-12-24T00:00:00", "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 117, "Anrede": "Herr", "Vorname": "Alois", "Vorstandsmitglied": false, "Nachname": "Müller", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Frühlingsstr. 1", "Unterdorf": false, "verzogen": false, "Geboren": "1934-06-04T00:00:00", "Telefon": "92573", "Mobiltelefon": null, "Eingetreten": "1952-09-20T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "1900-01-01T00:00:00", "verstorben": null, "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 0, "Mitgliedsjahre": 61, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": "1996-05-18T00:00:00", "Ehrennadel_Gold": "2003-01-06T00:00:00", "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 79, "Geburtstag60": "1994-06-04T00:00:00", "Beitrag": 0.0000, "verzogenDatum": null},
    {"ID": 118, "Anrede": "Herr", "Vorname": "Pius", "Vorstandsmitglied": false, "Nachname": "Müller, sen.", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Landsbergerstr. 16", "Unterdorf": true, "verzogen": false, "Geboren": "1938-11-06T00:00:00", "Telefon": "1258", "Mobiltelefon": null, "Eingetreten": "1956-02-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "1900-01-01T00:00:00", "verstorben": null, "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 0, "Mitgliedsjahre": 57, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": "1996-05-18T00:00:00", "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 75, "Geburtstag60": "1998-11-06T00:00:00", "Beitrag": 0.0000, "verzogenDatum": null},
    {"ID": 119, "Anrede": "Herr", "Vorname": "Berthold", "Vorstandsmitglied": false, "Nachname": "Müller", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Frühlingsstr.1", "Unterdorf": false, "verzogen": false, "Geboren": "1962-02-23T00:00:00", "Telefon": null, "Mobiltelefon": null, "Eingetreten": "1978-01-06T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "1900-01-01T00:00:00", "verstorben": null, "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 0, "Mitgliedsjahre": 36, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 51, "Geburtstag60": null, "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 121, "Anrede": "Herr", "Vorname": "Siegfried", "Vorstandsmitglied": false, "Nachname": "Müller", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Landsbergerstr. 16", "Unterdorf": true, "verzogen": false, "Geboren": "1972-08-21T00:00:00", "Telefon": "1258", "Mobiltelefon": "01626850225", "Eingetreten": "1990-01-06T00:00:00", "Ausgetreten": null, "Übergang_Passiv": null, "verstorben": null, "aktiv": true, "Einladung": true, "EinladungSeparat": false, "aktive_Jahre": 24, "Mitgliedsjahre": 24, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 41, "Geburtstag60": null, "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 122, "Anrede": "Herr", "Vorname": "Armin", "Vorstandsmitglied": false, "Nachname": "Nebel", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Zugspitzstr. 3", "Unterdorf": false, "verzogen": false, "Geboren": "1960-12-27T00:00:00", "Telefon": "31175", "Mobiltelefon": null, "Eingetreten": "1977-01-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "2006-11-05T00:00:00", "verstorben": null, "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 29, "Mitgliedsjahre": 37, "Ehrung_25_Jahre_aktiv": "2003-01-06T00:00:00", "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 53, "Geburtstag60": null, "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 123, "Anrede": "Herr", "Vorname": "Ulrich", "Vorstandsmitglied": false, "Nachname": "Nertinger", "PLZ": null, "Ort": null, "Straße": null, "Unterdorf": true, "verzogen": true, "Geboren": "1936-07-04T00:00:00", "Telefon": null, "Mobiltelefon": null, "Eingetreten": "1967-08-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "1900-01-01T00:00:00", "verstorben": null, "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 0, "Mitgliedsjahre": 41, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 72, "Geburtstag60": "1996-07-04T00:00:00", "Beitrag": 0.0000, "verzogenDatum": null},
    {"ID": 124, "Anrede": "Herr", "Vorname": "Alexander", "Vorstandsmitglied": false, "Nachname": "Niedermair", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Untermühlstr. 21", "Unterdorf": true, "verzogen": false, "Geboren": "1982-08-24T00:00:00", "Telefon": null, "Mobiltelefon": "01742348000", "Eingetreten": "1999-01-06T00:00:00", "Ausgetreten": null, "Übergang_Passiv": null, "verstorben": null, "aktiv": true, "Einladung": true, "EinladungSeparat": false, "aktive_Jahre": 15, "Mitgliedsjahre": 15, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 31, "Geburtstag60": null, "Beitrag": 3.5000, "verzogenDatum": null},
    {"ID": 125, "Anrede": "Herr", "Vorname": "Martin", "Vorstandsmitglied": false, "Nachname": "Niedermair", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Untermühlstr. 19", "Unterdorf": true, "verzogen": false, "Geboren": "1940-11-10T00:00:00", "Telefon": null, "Mobiltelefon": null, "Eingetreten": "1959-06-22T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "1900-01-01T00:00:00", "verstorben": null, "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 0, "Mitgliedsjahre": 54, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": "2010-01-06T00:00:00", "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 73, "Geburtstag60": "2000-11-10T00:00:00", "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 126, "Anrede": "Herr", "Vorname": "Josef", "Vorstandsmitglied": false, "Nachname": "Oberhuber", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Hauptstr. 40a", "Unterdorf": false, "verzogen": false, "Geboren": null, "Telefon": null, "Mobiltelefon": null, "Eingetreten": "2001-01-06T00:00:00", "Ausgetreten": null, "Übergang_Passiv": null, "verstorben": null, "aktiv": true, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": null, "Mitgliedsjahre": null, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": null, "Geburtstag60": null, "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 127, "Anrede": "Herr", "Vorname": "Arthur", "Vorstandsmitglied": false, "Nachname": "Ostermeir", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Kirchstr. 4", "Unterdorf": false, "verzogen": false, "Geboren": "1953-03-31T00:00:00", "Telefon": "1574", "Mobiltelefon": null, "Eingetreten": "1970-01-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "1900-01-01T00:00:00", "verstorben": null, "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 0, "Mitgliedsjahre": 44, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 60, "Geburtstag60": "2013-03-31T00:00:00", "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 128, "Anrede": "Herr", "Vorname": "Thomas", "Vorstandsmitglied": false, "Nachname": "Ostermeir", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Raiffeisenring 1", "Unterdorf": false, "verzogen": false, "Geboren": "1955-01-14T00:00:00", "Telefon": "9629", "Mobiltelefon": null, "Eingetreten": "1972-01-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "1900-01-01T00:00:00", "verstorben": null, "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 0, "Mitgliedsjahre": 42, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 58, "Geburtstag60": null, "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 129, "Anrede": "Herr", "Vorname": "Pascal", "Vorstandsmitglied": false, "Nachname": "Perz", "PLZ": null, "Ort": null, "Straße": null, "Unterdorf": true, "verzogen": true, "Geboren": "1983-09-14T00:00:00", "Telefon": null, "Mobiltelefon": null, "Eingetreten": "1999-01-06T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "2006-11-05T00:00:00", "verstorben": null, "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 7, "Mitgliedsjahre": 11, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 27, "Geburtstag60": null, "Beitrag": 7.0000, "verzogenDatum": "2010-12-31T00:00:00"},
    {"ID": 130, "Anrede": "Herr", "Vorname": "Thomas", "Vorstandsmitglied": false, "Nachname": "Pribil", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Paartalweg 5", "Unterdorf": true, "verzogen": false, "Geboren": "1984-11-11T00:00:00", "Telefon": null, "Mobiltelefon": "01729846659", "Eingetreten": "1999-01-06T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "2010-01-01T00:00:00", "verstorben": null, "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 10, "Mitgliedsjahre": 15, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 29, "Geburtstag60": null, "Beitrag": 3.5000, "verzogenDatum": null},
    {"ID": 131, "Anrede": "Herr", "Vorname": "Simon", "Vorstandsmitglied": false, "Nachname": "Pschorr", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Hauptstr. 14", "Unterdorf": false, "verzogen": false, "Geboren": "1961-04-12T00:00:00", "Telefon": "9352", "Mobiltelefon": null, "Eingetreten": "1977-01-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "1900-01-01T00:00:00", "verstorben": null, "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 0, "Mitgliedsjahre": 37, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 52, "Geburtstag60": null, "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 132, "Anrede": "Herr", "Vorname": "Christoph", "Vorstandsmitglied": false, "Nachname": "Pschorr", "PLZ": 82297.0, "Ort": "Steindorf", "Straße": null, "Unterdorf": false, "verzogen": false, "Geboren": "1964-08-12T00:00:00", "Telefon": null, "Mobiltelefon": null, "Eingetreten": "1980-04-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "2004-12-31T00:00:00", "verstorben": null, "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 24, "Mitgliedsjahre": 33, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 49, "Geburtstag60": null, "Beitrag": 0.0000, "verzogenDatum": null},
    {"ID": 133, "Anrede": "Herr", "Vorname": "Bernhard", "Vorstandsmitglied": false, "Nachname": "Resele, sen.", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Mandichostr. 12", "Unterdorf": true, "verzogen": false, "Geboren": "1928-03-20T00:00:00", "Telefon": "30832", "Mobiltelefon": null, "Eingetreten": "1963-01-13T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "1900-01-01T00:00:00", "verstorben": null, "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 0, "Mitgliedsjahre": 50, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 85, "Geburtstag60": "1988-03-20T00:00:00", "Beitrag": 0.0000, "verzogenDatum": null},
    {"ID": 134, "Anrede": "Herr", "Vorname": "Bernhard", "Vorstandsmitglied": false, "Nachname": "Resele", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Hangstr. 12", "Unterdorf": true, "verzogen": false, "Geboren": "1957-10-30T00:00:00", "Telefon": null, "Mobiltelefon": null, "Eingetreten": "1974-09-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "1900-01-01T00:00:00", "verstorben": null, "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 0, "Mitgliedsjahre": 39, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 56, "Geburtstag60": null, "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 136, "Anrede": "Herr", "Vorname": "Otto", "Vorstandsmitglied": false, "Nachname": "Reyinger, sen.", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Ostendstr. 1", "Unterdorf": false, "verzogen": false, "Geboren": "1935-04-18T00:00:00", "Telefon": "9815", "Mobiltelefon": null, "Eingetreten": "1975-07-11T00:00:00", "Ausgetreten": null, "Übergang_Passiv": null, "verstorben": "2012-12-31T00:00:00", "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 19, "Mitgliedsjahre": 37, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 77, "Geburtstag60": "1995-04-18T00:00:00", "Beitrag": 0.0000, "verzogenDatum": null},
    {"ID": 137, "Anrede": "Herr", "Vorname": "Otto", "Vorstandsmitglied": false, "Nachname": "Reyinger, jun.", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Wendelsteinstr. 5", "Unterdorf": false, "verzogen": false, "Geboren": "1956-07-07T00:00:00", "Telefon": "4602", "Mobiltelefon": null, "Eingetreten": "1975-01-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "1900-01-01T00:00:00", "verstorben": null, "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 0, "Mitgliedsjahre": 39, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 57, "Geburtstag60": null, "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 138, "Anrede": "Herr", "Vorname": "Max", "Vorstandsmitglied": false, "Nachname": "Rohrmair", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Raiffeisenring 18", "Unterdorf": false, "verzogen": false, "Geboren": "1953-12-16T00:00:00", "Telefon": "4238", "Mobiltelefon": null, "Eingetreten": "1970-01-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "1900-01-01T00:00:00", "verstorben": null, "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 0, "Mitgliedsjahre": 44, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 60, "Geburtstag60": "2013-12-16T00:00:00", "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 139, "Anrede": "Herr", "Vorname": "Erwin", "Vorstandsmitglied": false, "Nachname": "Rohrmair", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Kirchfeldstr. 18", "Unterdorf": false, "verzogen": false, "Geboren": null, "Telefon": null, "Mobiltelefon": null, "Eingetreten": "1998-01-06T00:00:00", "Ausgetreten": null, "Übergang_Passiv": null, "verstorben": null, "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": null, "Mitgliedsjahre": null, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": null, "Geburtstag60": null, "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 140, "Anrede": "Herr", "Vorname": "Fritz", "Vorstandsmitglied": false, "Nachname": "Schamberger", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Brunnen 4", "Unterdorf": false, "verzogen": false, "Geboren": "1930-02-24T00:00:00", "Telefon": "9646", "Mobiltelefon": null, "Eingetreten": "1973-01-06T00:00:00", "Ausgetreten": null, "Übergang_Passiv": null, "verstorben": "2009-11-03T00:00:00", "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 17, "Mitgliedsjahre": 36, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 79, "Geburtstag60": "1990-02-24T00:00:00", "Beitrag": 0.0000, "verzogenDatum": null},
    {"ID": 141, "Anrede": "Herr", "Vorname": "Benedikt", "Vorstandsmitglied": false, "Nachname": "Schamberger", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Unterbergerstr. 10", "Unterdorf": true, "verzogen": false, "Geboren": "1937-09-15T00:00:00", "Telefon": null, "Mobiltelefon": null, "Eingetreten": "1958-01-06T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "1900-01-01T00:00:00", "verstorben": "2013-04-15T00:00:00", "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 0, "Mitgliedsjahre": 55, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": "2008-01-06T00:00:00", "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 75, "Geburtstag60": "1997-09-15T00:00:00", "Beitrag": 0.0000, "verzogenDatum": null},
    {"ID": 143, "Anrede": "Herr", "Vorname": "Siegfried", "Vorstandsmitglied": false, "Nachname": "Schamberger", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Steindorfer Str. 19b", "Unterdorf": false, "verzogen": false, "Geboren": "1976-11-14T00:00:00", "Telefon": null, "Mobiltelefon": null, "Eingetreten": "2000-04-20T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "2006-11-05T00:00:00", "verstorben": null, "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 6, "Mitgliedsjahre": 13, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 37, "Geburtstag60": null, "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 145, "Anrede": "Herr", "Vorname": "Anton", "Vorstandsmitglied": false, "Nachname": "Schegg, sen.", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Bahnhofstr. 10", "Unterdorf": true, "verzogen": false, "Geboren": "1941-11-02T00:00:00", "Telefon": "1601", "Mobiltelefon": null, "Eingetreten": "1961-01-15T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "1900-01-01T00:00:00", "verstorben": null, "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 0, "Mitgliedsjahre": 52, "Ehrung_25_Jahre_aktiv": "1987-05-03T00:00:00", "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": "2012-01-06T00:00:00", "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 72, "Geburtstag60": "2001-11-02T00:00:00", "Beitrag": 0.0000, "verzogenDatum": null},
    {"ID": 147, "Anrede": "Herr", "Vorname": "Manfred", "Vorstandsmitglied": false, "Nachname": "Schiffmann", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Hauptstr. 34", "Unterdorf": false, "verzogen": false, "Geboren": "1957-11-18T00:00:00", "Telefon": "30896", "Mobiltelefon": null, "Eingetreten": "1996-05-31T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "2006-11-05T00:00:00", "verstorben": null, "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 10, "Mitgliedsjahre": 17, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 56, "Geburtstag60": null, "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 148, "Anrede": "Herr", "Vorname": "Andreas", "Vorstandsmitglied": false, "Nachname": "Schimpfle", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Steinacherstr. 5", "Unterdorf": false, "verzogen": false, "Geboren": "1949-03-06T00:00:00", "Telefon": "9823", "Mobiltelefon": null, "Eingetreten": "1974-09-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "1900-01-01T00:00:00", "verstorben": null, "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 0, "Mitgliedsjahre": 39, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 64, "Geburtstag60": "2009-03-06T00:00:00", "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 149, "Anrede": "Herr", "Vorname": "Thomas", "Vorstandsmitglied": false, "Nachname": "Schimpfle", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Wasserturmweg 5", "Unterdorf": false, "verzogen": false, "Geboren": "1974-04-17T00:00:00", "Telefon": "92879", "Mobiltelefon": null, "Eingetreten": "1989-01-01T00:00:00", "Ausgetreten": "2003-12-31T00:00:00", "Übergang_Passiv": null, "verstorben": null, "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 25, "Mitgliedsjahre": 25, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 39, "Geburtstag60": null, "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 150, "Anrede": "Herr", "Vorname": "Markus", "Vorstandsmitglied": false, "Nachname": "Schneemayer", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Grüntenstr. 12", "Unterdorf": false, "verzogen": false, "Geboren": "1980-11-19T00:00:00", "Telefon": "92804", "Mobiltelefon": "017680038872", "Eingetreten": "1997-04-28T00:00:00", "Ausgetreten": null, "Übergang_Passiv": null, "verstorben": null, "aktiv": true, "Einladung": true, "EinladungSeparat": false, "aktive_Jahre": 16, "Mitgliedsjahre": 16, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 33, "Geburtstag60": null, "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 151, "Anrede": "Herr", "Vorname": "Gerhard", "Vorstandsmitglied": false, "Nachname": "Schneemayer", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Grüntenstr. 12", "Unterdorf": false, "verzogen": false, "Geboren": "1983-07-14T00:00:00", "Telefon": null, "Mobiltelefon": "01736648820", "Eingetreten": "1999-01-06T00:00:00", "Ausgetreten": null, "Übergang_Passiv": null, "verstorben": null, "aktiv": true, "Einladung": true, "EinladungSeparat": false, "aktive_Jahre": 15, "Mitgliedsjahre": 15, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 30, "Geburtstag60": null, "Beitrag": 3.5000, "verzogenDatum": null},
    {"ID": 152, "Anrede": "Herr", "Vorname": "Paul", "Vorstandsmitglied": false, "Nachname": "Schramm", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Untermühlstr. 19", "Unterdorf": true, "verzogen": false, "Geboren": "1935-05-30T00:00:00", "Telefon": "92720", "Mobiltelefon": null, "Eingetreten": "1954-04-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "1900-01-01T00:00:00", "verstorben": null, "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 0, "Mitgliedsjahre": 59, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": "1996-05-18T00:00:00", "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 78, "Geburtstag60": "1995-05-30T00:00:00", "Beitrag": 0.0000, "verzogenDatum": null},
    {"ID": 153, "Anrede": "Herr", "Vorname": "Martin", "Vorstandsmitglied": false, "Nachname": "Schramm", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Raiffeisenring 5", "Unterdorf": false, "verzogen": false, "Geboren": "1964-11-26T00:00:00", "Telefon": "9438", "Mobiltelefon": null, "Eingetreten": "1980-11-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "2004-12-31T00:00:00", "verstorben": null, "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 24, "Mitgliedsjahre": 33, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 49, "Geburtstag60": null, "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 154, "Anrede": "Herr", "Vorname": "Richard", "Vorstandsmitglied": false, "Nachname": "Schreiegg", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Kirchstr. 1", "Unterdorf": false, "verzogen": false, "Geboren": "1960-03-23T00:00:00", "Telefon": null, "Mobiltelefon": null, "Eingetreten": "1977-01-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "1900-01-01T00:00:00", "verstorben": null, "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 0, "Mitgliedsjahre": 37, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 53, "Geburtstag60": null, "Beitrag": 0.0000, "verzogenDatum": null},
    {"ID": 155, "Anrede": "Dr.", "Vorname": "Werner", "Vorstandsmitglied": false, "Nachname": "Schrom", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Jahnstr. 11", "Unterdorf": false, "verzogen": false, "Geboren": "1943-05-09T00:00:00", "Telefon": null, "Mobiltelefon": null, "Eingetreten": "1999-01-06T00:00:00", "Ausgetreten": null, "Übergang_Passiv": null, "verstorben": null, "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 4, "Mitgliedsjahre": 15, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 70, "Geburtstag60": "2003-05-09T00:00:00", "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 157, "Anrede": "Herr", "Vorname": "Wilhelm", "Vorstandsmitglied": false, "Nachname": "Schuh", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Raiffeisenring 8", "Unterdorf": false, "verzogen": false, "Geboren": "1957-04-08T00:00:00", "Telefon": "4186", "Mobiltelefon": null, "Eingetreten": "1972-01-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "2006-11-05T00:00:00", "verstorben": null, "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 34, "Mitgliedsjahre": 42, "Ehrung_25_Jahre_aktiv": "2003-01-06T00:00:00", "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 56, "Geburtstag60": null, "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 158, "Anrede": "Herr", "Vorname": "Josef", "Vorstandsmitglied": false, "Nachname": "Schuster", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Steinacherstr. 9", "Unterdorf": false, "verzogen": false, "Geboren": "1944-01-05T00:00:00", "Telefon": "31436", "Mobiltelefon": null, "Eingetreten": "1964-01-12T00:00:00", "Ausgetreten": null, "Übergang_Passiv": null, "verstorben": null, "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 39, "Mitgliedsjahre": 49, "Ehrung_25_Jahre_aktiv": "1996-05-18T00:00:00", "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 70, "Geburtstag60": "2004-01-05T00:00:00", "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 159, "Anrede": "Herr", "Vorname": "Bernhard", "Vorstandsmitglied": false, "Nachname": "Schwab, sen.", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Steinacherstr. 14", "Unterdorf": false, "verzogen": false, "Geboren": "1911-08-21T00:00:00", "Telefon": null, "Mobiltelefon": null, "Eingetreten": "1936-01-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "1900-01-01T00:00:00", "verstorben": "2005-07-16T00:00:00", "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 0, "Mitgliedsjahre": 69, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": "1996-05-18T00:00:00", "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 93, "Geburtstag60": "1971-08-21T00:00:00", "Beitrag": 0.0000, "verzogenDatum": null},
    {"ID": 160, "Anrede": "Herr", "Vorname": "Bernhard", "Vorstandsmitglied": false, "Nachname": "Schwab, jun.", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Steinacherstr. 16a", "Unterdorf": false, "verzogen": false, "Geboren": "1946-12-20T00:00:00", "Telefon": null, "Mobiltelefon": null, "Eingetreten": "1964-05-13T00:00:00", "Ausgetreten": null, "Übergang_Passiv": null, "verstorben": "2003-10-24T00:00:00", "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 39, "Mitgliedsjahre": 39, "Ehrung_25_Jahre_aktiv": "1996-05-18T00:00:00", "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 56, "Geburtstag60": "2006-12-20T00:00:00", "Beitrag": 0.0000, "verzogenDatum": null},
    {"ID": 163, "Anrede": "Herr", "Vorname": "Hubert", "Vorstandsmitglied": false, "Nachname": "Schwarz", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Zugspitzstr. 9", "Unterdorf": false, "verzogen": false, "Geboren": "1939-02-16T00:00:00", "Telefon": "9860", "Mobiltelefon": null, "Eingetreten": "1966-01-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "1900-01-01T00:00:00", "verstorben": null, "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 0, "Mitgliedsjahre": 48, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 74, "Geburtstag60": "1999-02-16T00:00:00", "Beitrag": 0.0000, "verzogenDatum": null},
    {"ID": 164, "Anrede": "Herr", "Vorname": "Jakob", "Vorstandsmitglied": false, "Nachname": "Sedlmeier, sen.", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Feldweg 10", "Unterdorf": false, "verzogen": false, "Geboren": "1919-08-19T00:00:00", "Telefon": null, "Mobiltelefon": null, "Eingetreten": "1948-01-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "1900-01-01T00:00:00", "verstorben": "2005-02-12T00:00:00", "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 0, "Mitgliedsjahre": 57, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": "1996-05-18T00:00:00", "Ehrennadel_Gold": "2003-01-06T00:00:00", "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 85, "Geburtstag60": "1979-08-19T00:00:00", "Beitrag": 0.0000, "verzogenDatum": null},
    {"ID": 165, "Anrede": "Herr", "Vorname": "Jakob", "Vorstandsmitglied": false, "Nachname": "Sedlmeier, jun.", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Feldweg 8", "Unterdorf": false, "verzogen": true, "Geboren": "1951-07-11T00:00:00", "Telefon": null, "Mobiltelefon": null, "Eingetreten": "1969-01-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "1900-01-01T00:00:00", "verstorben": null, "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 0, "Mitgliedsjahre": 44, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 62, "Geburtstag60": "2011-07-11T00:00:00", "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 166, "Anrede": "Herr", "Vorname": "Michael", "Vorstandsmitglied": false, "Nachname": "Sedlmeier", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Kirchfeldstr. 2", "Unterdorf": false, "verzogen": false, "Geboren": "1969-05-06T00:00:00", "Telefon": null, "Mobiltelefon": null, "Eingetreten": "1985-01-06T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "2006-11-05T00:00:00", "verstorben": null, "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 21, "Mitgliedsjahre": 29, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 44, "Geburtstag60": null, "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 168, "Anrede": "Herr", "Vorname": "Klaus", "Vorstandsmitglied": false, "Nachname": "Spicker", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Hauptstr. 1", "Unterdorf": true, "verzogen": false, "Geboren": "1939-11-18T00:00:00", "Telefon": "9018", "Mobiltelefon": null, "Eingetreten": "1959-06-22T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "1900-01-01T00:00:00", "verstorben": null, "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 0, "Mitgliedsjahre": 54, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": "1996-05-18T00:00:00", "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 74, "Geburtstag60": "1999-11-18T00:00:00", "Beitrag": 0.0000, "verzogenDatum": null},
    {"ID": 170, "Anrede": "Herr", "Vorname": "Klaus", "Vorstandsmitglied": false, "Nachname": "Spicker, jun.", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Ostendstr. 5", "Unterdorf": false, "verzogen": false, "Geboren": "1971-10-25T00:00:00", "Telefon": "9018", "Mobiltelefon": null, "Eingetreten": "1989-01-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "2006-11-05T00:00:00", "verstorben": null, "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 17, "Mitgliedsjahre": 25, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 42, "Geburtstag60": null, "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 171, "Anrede": "Herr", "Vorname": "Bernhard", "Vorstandsmitglied": false, "Nachname": "Spicker", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Feldweg 10a", "Unterdorf": false, "verzogen": false, "Geboren": "1973-12-13T00:00:00", "Telefon": "9018", "Mobiltelefon": null, "Eingetreten": "1989-01-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "2010-01-01T00:00:00", "verstorben": null, "aktiv": false, "Einladung": true, "EinladungSeparat": false, "aktive_Jahre": 21, "Mitgliedsjahre": 25, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 40, "Geburtstag60": null, "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 179, "Anrede": "Herr", "Vorname": "Max", "Vorstandsmitglied": false, "Nachname": "Stuis", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Kolpingstr. 34a", "Unterdorf": false, "verzogen": false, "Geboren": "1952-12-18T00:00:00", "Telefon": "9863", "Mobiltelefon": null, "Eingetreten": "1970-01-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "1900-01-01T00:00:00", "verstorben": null, "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 0, "Mitgliedsjahre": 44, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 61, "Geburtstag60": "2012-12-18T00:00:00", "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 180, "Anrede": "Herr", "Vorname": "Korbinian", "Vorstandsmitglied": false, "Nachname": "Sumper", "PLZ": 86415.0, "Ort": "Mering", "Straße": "Münchnerstr. 150", "Unterdorf": false, "verzogen": true, "Geboren": "1948-01-24T00:00:00", "Telefon": null, "Mobiltelefon": null, "Eingetreten": "1967-05-06T00:00:00", "Ausgetreten": "2003-12-23T00:00:00", "Übergang_Passiv": "1900-01-01T00:00:00", "verstorben": null, "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 0, "Mitgliedsjahre": 44, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 63, "Geburtstag60": "2008-01-24T00:00:00", "Beitrag": 0.0000, "verzogenDatum": null},
    {"ID": 182, "Anrede": "Herr", "Vorname": "Ludwig", "Vorstandsmitglied": false, "Nachname": "Süßmair", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Kirchstr. 6", "Unterdorf": false, "verzogen": false, "Geboren": "1936-11-03T00:00:00", "Telefon": "30842", "Mobiltelefon": null, "Eingetreten": "1956-02-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": null, "verstorben": "2013-01-05T00:00:00", "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 40, "Mitgliedsjahre": 56, "Ehrung_25_Jahre_aktiv": "1987-05-03T00:00:00", "Ehrung_40_Jahre_aktiv": "1996-05-18T00:00:00", "Ehrennadel_Silber": "2007-01-06T00:00:00", "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 76, "Geburtstag60": "1996-11-03T00:00:00", "Beitrag": 0.0000, "verzogenDatum": null},
    {"ID": 185, "Anrede": "Herr", "Vorname": "Hermann", "Vorstandsmitglied": false, "Nachname": "Teifelhard", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Hauptstr. 31", "Unterdorf": true, "verzogen": false, "Geboren": "1940-09-12T00:00:00", "Telefon": "92348", "Mobiltelefon": null, "Eingetreten": "1959-06-22T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "1900-01-01T00:00:00", "verstorben": null, "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 0, "Mitgliedsjahre": 54, "Ehrung_25_Jahre_aktiv": "1987-05-03T00:00:00", "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": "2010-01-06T00:00:00", "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 73, "Geburtstag60": "2000-09-12T00:00:00", "Beitrag": 0.0000, "verzogenDatum": null},
    {"ID": 186, "Anrede": "Herr", "Vorname": "Wolfgang", "Vorstandsmitglied": false, "Nachname": "Teifelhart", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Brunnen 1", "Unterdorf": false, "verzogen": false, "Geboren": "1965-02-02T00:00:00", "Telefon": "4419", "Mobiltelefon": "017670698413", "Eingetreten": "1980-11-02T00:00:00", "Ausgetreten": null, "Übergang_Passiv": null, "verstorben": null, "aktiv": true, "Einladung": true, "EinladungSeparat": false, "aktive_Jahre": 33, "Mitgliedsjahre": 33, "Ehrung_25_Jahre_aktiv": "2006-01-06T00:00:00", "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 48, "Geburtstag60": null, "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 187, "Anrede": "Herr", "Vorname": "Peter", "Vorstandsmitglied": false, "Nachname": "Thumbach", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Eichenstr. 8", "Unterdorf": true, "verzogen": false, "Geboren": "1960-09-03T00:00:00", "Telefon": "9389", "Mobiltelefon": "01728265793", "Eingetreten": "1976-09-04T00:00:00", "Ausgetreten": null, "Übergang_Passiv": null, "verstorben": null, "aktiv": true, "Einladung": true, "EinladungSeparat": false, "aktive_Jahre": 37, "Mitgliedsjahre": 37, "Ehrung_25_Jahre_aktiv": "2003-01-06T00:00:00", "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 53, "Geburtstag60": null, "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 188, "Anrede": "Herr", "Vorname": "Johann", "Vorstandsmitglied": false, "Nachname": "Thurner", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Bahnhofring 8", "Unterdorf": true, "verzogen": false, "Geboren": "1932-07-09T00:00:00", "Telefon": "9795", "Mobiltelefon": null, "Eingetreten": "1975-01-06T00:00:00", "Ausgetreten": null, "Übergang_Passiv": null, "verstorben": "2011-11-12T00:00:00", "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 17, "Mitgliedsjahre": 36, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 79, "Geburtstag60": "1992-07-09T00:00:00", "Beitrag": 0.0000, "verzogenDatum": null},
    {"ID": 189, "Anrede": "Herr", "Vorname": "Peter", "Vorstandsmitglied": false, "Nachname": "Tomaschko", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Herzog-Ludwig-Straße 8", "Unterdorf": false, "verzogen": false, "Geboren": "1973-09-22T00:00:00", "Telefon": "9496", "Mobiltelefon": "01728609516", "Eingetreten": "1989-01-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "2012-12-10T00:00:00", "verstorben": null, "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 23, "Mitgliedsjahre": 25, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 40, "Geburtstag60": null, "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 190, "Anrede": "Herr", "Vorname": "Klaus", "Vorstandsmitglied": false, "Nachname": "Urbanek", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Bachstr. 2", "Unterdorf": true, "verzogen": false, "Geboren": "1961-11-21T00:00:00", "Telefon": "30928", "Mobiltelefon": "015784404284", "Eingetreten": "1976-01-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": null, "verstorben": null, "aktiv": true, "Einladung": true, "EinladungSeparat": false, "aktive_Jahre": 38, "Mitgliedsjahre": 38, "Ehrung_25_Jahre_aktiv": "2003-01-06T00:00:00", "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 52, "Geburtstag60": null, "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 191, "Anrede": "Herr", "Vorname": "Wilhelm", "Vorstandsmitglied": false, "Nachname": "Vogl", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Leitschlagweg 5", "Unterdorf": true, "verzogen": false, "Geboren": "1952-11-03T00:00:00", "Telefon": "3945", "Mobiltelefon": null, "Eingetreten": "1976-01-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "1900-01-01T00:00:00", "verstorben": null, "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 0, "Mitgliedsjahre": 38, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 61, "Geburtstag60": "2012-11-03T00:00:00", "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 192, "Anrede": "Herr", "Vorname": "Helmut", "Vorstandsmitglied": false, "Nachname": "Vogl", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Steinacherstr. 26", "Unterdorf": false, "verzogen": false, "Geboren": "1954-05-23T00:00:00", "Telefon": "92830", "Mobiltelefon": null, "Eingetreten": "1984-01-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "2006-11-05T00:00:00", "verstorben": null, "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 22, "Mitgliedsjahre": 30, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 59, "Geburtstag60": null, "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 193, "Anrede": "Herr", "Vorname": "Gerhard", "Vorstandsmitglied": false, "Nachname": "Vogl", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Paartalweg 15", "Unterdorf": true, "verzogen": false, "Geboren": "1955-09-12T00:00:00", "Telefon": "4480", "Mobiltelefon": null, "Eingetreten": "1973-01-06T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "1900-01-01T00:00:00", "verstorben": null, "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 0, "Mitgliedsjahre": 41, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 58, "Geburtstag60": null, "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 194, "Anrede": "Herr", "Vorname": "Bernhard", "Vorstandsmitglied": false, "Nachname": "Vogl, jun.", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Wittelsbacher Str. 24", "Unterdorf": false, "verzogen": false, "Geboren": "1970-07-07T00:00:00", "Telefon": "1666", "Mobiltelefon": null, "Eingetreten": "1989-01-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "2006-11-05T00:00:00", "verstorben": null, "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 17, "Mitgliedsjahre": 25, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 43, "Geburtstag60": null, "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 195, "Anrede": "Herr", "Vorname": "Anton", "Vorstandsmitglied": false, "Nachname": "Waitzmann", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Untermühlstr. 1", "Unterdorf": true, "verzogen": false, "Geboren": "1928-03-25T00:00:00", "Telefon": "92533", "Mobiltelefon": null, "Eingetreten": "1958-01-06T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "1900-01-01T00:00:00", "verstorben": "2005-08-20T00:00:00", "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 0, "Mitgliedsjahre": 47, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 77, "Geburtstag60": "1988-03-25T00:00:00", "Beitrag": 0.0000, "verzogenDatum": null},
    {"ID": 196, "Anrede": "Herr", "Vorname": "Martin", "Vorstandsmitglied": false, "Nachname": "Walch", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Schulweg 7", "Unterdorf": false, "verzogen": false, "Geboren": "1949-02-19T00:00:00", "Telefon": "1526", "Mobiltelefon": null, "Eingetreten": "1967-08-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "1900-01-01T00:00:00", "verstorben": null, "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 0, "Mitgliedsjahre": 46, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 64, "Geburtstag60": "2009-02-19T00:00:00", "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 197, "Anrede": "Herr", "Vorname": "Christian", "Vorstandsmitglied": false, "Nachname": "Walch", "PLZ": null, "Ort": "Krumbach", "Straße": null, "Unterdorf": false, "verzogen": true, "Geboren": "1974-04-18T00:00:00", "Telefon": "1526", "Mobiltelefon": null, "Eingetreten": "1997-01-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "2006-11-05T00:00:00", "verstorben": null, "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 9, "Mitgliedsjahre": 10, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 32, "Geburtstag60": null, "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 198, "Anrede": "Herr", "Vorname": "Gottfried", "Vorstandsmitglied": false, "Nachname": "Wecker, sen.", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Obermühlstr. 1a", "Unterdorf": true, "verzogen": false, "Geboren": "1929-01-01T00:00:00", "Telefon": "9624", "Mobiltelefon": null, "Eingetreten": "1963-01-13T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "1900-01-01T00:00:00", "verstorben": "2013-10-28T00:00:00", "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 0, "Mitgliedsjahre": 50, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 84, "Geburtstag60": "1989-01-01T00:00:00", "Beitrag": 0.0000, "verzogenDatum": null},
    {"ID": 199, "Anrede": "Herr", "Vorname": "Gottfried", "Vorstandsmitglied": false, "Nachname": "Wecker", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Obermühlstr. 1", "Unterdorf": true, "verzogen": false, "Geboren": "1957-12-03T00:00:00", "Telefon": "4707", "Mobiltelefon": "01741317457", "Eingetreten": "1975-01-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": null, "verstorben": null, "aktiv": true, "Einladung": true, "EinladungSeparat": false, "aktive_Jahre": 39, "Mitgliedsjahre": 39, "Ehrung_25_Jahre_aktiv": "2003-01-06T00:00:00", "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 56, "Geburtstag60": null, "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 200, "Anrede": "Herr", "Vorname": "Thomas", "Vorstandsmitglied": false, "Nachname": "Wecker", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Obermühlstr. 1", "Unterdorf": true, "verzogen": false, "Geboren": "1984-09-20T00:00:00", "Telefon": null, "Mobiltelefon": "01729550179", "Eingetreten": "1999-01-06T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "2010-01-01T00:00:00", "verstorben": null, "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 10, "Mitgliedsjahre": 15, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 29, "Geburtstag60": null, "Beitrag": 3.5000, "verzogenDatum": null},
    {"ID": 201, "Anrede": "Herr", "Vorname": "Franz", "Vorstandsmitglied": false, "Nachname": "Weigl", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Ostendstr.4", "Unterdorf": false, "verzogen": false, "Geboren": "1948-02-22T00:00:00", "Telefon": "92455", "Mobiltelefon": null, "Eingetreten": "1973-01-06T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "1900-01-01T00:00:00", "verstorben": null, "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 0, "Mitgliedsjahre": 41, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 65, "Geburtstag60": "2008-02-22T00:00:00", "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 202, "Anrede": "Herr", "Vorname": "Lorenz", "Vorstandsmitglied": false, "Nachname": "Weigl, jun.", "PLZ": 86504.0, "Ort": "Merching", "Straße": "St. Martin Str. 6", "Unterdorf": false, "verzogen": false, "Geboren": "1954-04-11T00:00:00", "Telefon": "92444", "Mobiltelefon": null, "Eingetreten": "1974-01-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "1900-01-01T00:00:00", "verstorben": null, "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 0, "Mitgliedsjahre": 40, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 59, "Geburtstag60": null, "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 203, "Anrede": "Herr", "Vorname": "Johann", "Vorstandsmitglied": false, "Nachname": "Weiß", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Brunnen 2", "Unterdorf": false, "verzogen": false, "Geboren": "1927-08-05T00:00:00", "Telefon": "92240", "Mobiltelefon": null, "Eingetreten": "1978-01-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": null, "verstorben": "2004-12-31T00:00:00", "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 9, "Mitgliedsjahre": 26, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 77, "Geburtstag60": "1987-08-05T00:00:00", "Beitrag": 0.0000, "verzogenDatum": null},
    {"ID": 205, "Anrede": "Herr", "Vorname": "Josef", "Vorstandsmitglied": false, "Nachname": "Weiß", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Grüntenstr. 8", "Unterdorf": false, "verzogen": false, "Geboren": "1935-02-18T00:00:00", "Telefon": "30336", "Mobiltelefon": null, "Eingetreten": "1954-01-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "1900-01-01T00:00:00", "verstorben": null, "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 0, "Mitgliedsjahre": 60, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": "1996-05-18T00:00:00", "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 78, "Geburtstag60": "1995-02-18T00:00:00", "Beitrag": 0.0000, "verzogenDatum": null},
    {"ID": 206, "Anrede": "Herr", "Vorname": "Josef", "Vorstandsmitglied": false, "Nachname": "Weiß", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Klostergasse 1", "Unterdorf": true, "verzogen": false, "Geboren": "1950-03-16T00:00:00", "Telefon": "4469", "Mobiltelefon": null, "Eingetreten": "1969-01-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "2006-11-05T00:00:00", "verstorben": null, "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 37, "Mitgliedsjahre": 45, "Ehrung_25_Jahre_aktiv": "1996-05-18T00:00:00", "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 63, "Geburtstag60": "2010-03-16T00:00:00", "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 208, "Anrede": "Herr", "Vorname": "Bernhard", "Vorstandsmitglied": false, "Nachname": "Weiß", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Schulweg 3", "Unterdorf": false, "verzogen": false, "Geboren": "1955-10-16T00:00:00", "Telefon": "4020", "Mobiltelefon": null, "Eingetreten": "1972-01-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "1900-01-01T00:00:00", "verstorben": null, "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 0, "Mitgliedsjahre": 42, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 58, "Geburtstag60": null, "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 210, "Anrede": "Herr", "Vorname": "Bernd", "Vorstandsmitglied": false, "Nachname": "Weiß", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Wittelsbacher Str. 10", "Unterdorf": false, "verzogen": false, "Geboren": "1978-01-31T00:00:00", "Telefon": "4895", "Mobiltelefon": "01743008727", "Eingetreten": "1994-01-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "2012-12-10T00:00:00", "verstorben": null, "aktiv": false, "Einladung": true, "EinladungSeparat": false, "aktive_Jahre": 18, "Mitgliedsjahre": 20, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 35, "Geburtstag60": null, "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 211, "Anrede": "Herr", "Vorname": "Thomas", "Vorstandsmitglied": false, "Nachname": "Weiß", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Schulweg 3", "Unterdorf": false, "verzogen": false, "Geboren": "1982-09-20T00:00:00", "Telefon": null, "Mobiltelefon": "01728459398", "Eingetreten": "1999-01-06T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "2012-12-10T00:00:00", "verstorben": null, "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 13, "Mitgliedsjahre": 15, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 31, "Geburtstag60": null, "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 212, "Anrede": "Herr", "Vorname": "Josef", "Vorstandsmitglied": false, "Nachname": "Weißhaupt", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Kolpingstr. 36", "Unterdorf": false, "verzogen": false, "Geboren": "1953-04-14T00:00:00", "Telefon": "92022", "Mobiltelefon": null, "Eingetreten": "1996-12-05T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "2006-11-05T00:00:00", "verstorben": null, "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 9, "Mitgliedsjahre": 17, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 60, "Geburtstag60": "2013-04-14T00:00:00", "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 215, "Anrede": "Herr", "Vorname": "Wasyl", "Vorstandsmitglied": false, "Nachname": "Wolowsczuk", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Mandichostr. 14 a", "Unterdorf": true, "verzogen": false, "Geboren": null, "Telefon": null, "Mobiltelefon": null, "Eingetreten": "1998-01-06T00:00:00", "Ausgetreten": null, "Übergang_Passiv": null, "verstorben": "2004-12-31T00:00:00", "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": null, "Mitgliedsjahre": null, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": null, "Geburtstag60": null, "Beitrag": 0.0000, "verzogenDatum": null},
    {"ID": 216, "Anrede": "Herr", "Vorname": "Andreas", "Vorstandsmitglied": false, "Nachname": "Wunder", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Wiesenstr. 16", "Unterdorf": true, "verzogen": true, "Geboren": "1982-05-05T00:00:00", "Telefon": null, "Mobiltelefon": null, "Eingetreten": "1999-01-06T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "2006-11-05T00:00:00", "verstorben": null, "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 7, "Mitgliedsjahre": 11, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 28, "Geburtstag60": null, "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 217, "Anrede": "Herr", "Vorname": "Markus", "Vorstandsmitglied": false, "Nachname": "Zimmer", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Kolpingstr. 16", "Unterdorf": false, "verzogen": false, "Geboren": "1982-11-27T00:00:00", "Telefon": null, "Mobiltelefon": "01728403213", "Eingetreten": "1999-01-06T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "2012-12-10T00:00:00", "verstorben": null, "aktiv": false, "Einladung": true, "EinladungSeparat": false, "aktive_Jahre": 13, "Mitgliedsjahre": 15, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 31, "Geburtstag60": null, "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 218, "Anrede": "Herr", "Vorname": "Stefan", "Vorstandsmitglied": false, "Nachname": "Sumper", "PLZ": 86415.0, "Ort": "Mering", "Straße": "Münchnerstr. 150", "Unterdorf": false, "verzogen": true, "Geboren": null, "Telefon": null, "Mobiltelefon": null, "Eingetreten": "1996-01-01T00:00:00", "Ausgetreten": "2003-12-23T00:00:00", "Übergang_Passiv": "1900-01-01T00:00:00", "verstorben": null, "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": null, "Mitgliedsjahre": null, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": null, "Geburtstag60": null, "Beitrag": 0.0000, "verzogenDatum": "1996-01-01T00:00:00"},
    {"ID": 219, "Anrede": "Herr", "Vorname": "Matthias", "Vorstandsmitglied": false, "Nachname": "Aumiller", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Herbstgasse 6", "Unterdorf": true, "verzogen": false, "Geboren": "1984-02-15T00:00:00", "Telefon": null, "Mobiltelefon": null, "Eingetreten": "1999-01-06T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "2006-11-05T00:00:00", "verstorben": null, "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 7, "Mitgliedsjahre": 15, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 29, "Geburtstag60": null, "Beitrag": null, "verzogenDatum": null},
    {"ID": 221, "Anrede": "Herr", "Vorname": "Sixtus", "Vorstandsmitglied": false, "Nachname": "Schegg", "PLZ": null, "Ort": null, "Straße": null, "Unterdorf": true, "verzogen": false, "Geboren": "1915-01-11T00:00:00", "Telefon": null, "Mobiltelefon": null, "Eingetreten": "1935-01-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": null, "verstorben": "2001-11-08T00:00:00", "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 40, "Mitgliedsjahre": 66, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": "1996-05-18T00:00:00", "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 86, "Geburtstag60": "1975-01-11T00:00:00", "Beitrag": 0.0000, "verzogenDatum": null},
    {"ID": 222, "Anrede": "Herr", "Vorname": "Josef", "Vorstandsmitglied": false, "Nachname": "Waigl", "PLZ": null, "Ort": null, "Straße": null, "Unterdorf": false, "verzogen": false, "Geboren": "1908-12-13T00:00:00", "Telefon": null, "Mobiltelefon": null, "Eingetreten": "1932-06-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": null, "verstorben": "2000-12-31T00:00:00", "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 36, "Mitgliedsjahre": 68, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": "1996-05-18T00:00:00", "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 92, "Geburtstag60": "1968-12-13T00:00:00", "Beitrag": 0.0000, "verzogenDatum": null},
    {"ID": 225, "Anrede": "Herr", "Vorname": "Wilhelm", "Vorstandsmitglied": false, "Nachname": "Wagner", "PLZ": null, "Ort": null, "Straße": null, "Unterdorf": false, "verzogen": false, "Geboren": "1911-06-25T00:00:00", "Telefon": null, "Mobiltelefon": null, "Eingetreten": "1964-01-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": null, "verstorben": "2000-12-31T00:00:00", "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 7, "Mitgliedsjahre": 36, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": "1996-05-18T00:00:00", "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 89, "Geburtstag60": "1971-06-25T00:00:00", "Beitrag": 0.0000, "verzogenDatum": null},
    {"ID": 226, "Anrede": "Herr", "Vorname": "Peter", "Vorstandsmitglied": false, "Nachname": "Oberhuber", "PLZ": null, "Ort": null, "Straße": null, "Unterdorf": false, "verzogen": false, "Geboren": "1912-02-11T00:00:00", "Telefon": null, "Mobiltelefon": null, "Eingetreten": "1954-03-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": null, "verstorben": "2000-12-31T00:00:00", "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 17, "Mitgliedsjahre": 46, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": "1996-05-18T00:00:00", "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 88, "Geburtstag60": "1972-02-11T00:00:00", "Beitrag": 0.0000, "verzogenDatum": null},
    {"ID": 227, "Anrede": "Herr", "Vorname": "Josef", "Vorstandsmitglied": false, "Nachname": "Schäffler", "PLZ": null, "Ort": null, "Straße": null, "Unterdorf": false, "verzogen": false, "Geboren": "1917-03-04T00:00:00", "Telefon": null, "Mobiltelefon": null, "Eingetreten": "1954-01-10T00:00:00", "Ausgetreten": null, "Übergang_Passiv": null, "verstorben": "2000-12-31T00:00:00", "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 23, "Mitgliedsjahre": 46, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": "1996-05-18T00:00:00", "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 83, "Geburtstag60": "1977-03-04T00:00:00", "Beitrag": 0.0000, "verzogenDatum": null},
    {"ID": 228, "Anrede": "Herr", "Vorname": "Johann", "Vorstandsmitglied": false, "Nachname": "Teifelhart", "PLZ": null, "Ort": null, "Straße": null, "Unterdorf": false, "verzogen": false, "Geboren": "1934-07-31T00:00:00", "Telefon": null, "Mobiltelefon": null, "Eingetreten": "1952-09-20T00:00:00", "Ausgetreten": null, "Übergang_Passiv": null, "verstorben": "2000-12-31T00:00:00", "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 41, "Mitgliedsjahre": 48, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": "1996-05-18T00:00:00", "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 66, "Geburtstag60": "1994-07-31T00:00:00", "Beitrag": 0.0000, "verzogenDatum": null},
    {"ID": 230, "Anrede": "Herr", "Vorname": "Lorenz", "Vorstandsmitglied": false, "Nachname": "Weigl", "PLZ": null, "Ort": null, "Straße": null, "Unterdorf": false, "verzogen": false, "Geboren": "1917-04-16T00:00:00", "Telefon": null, "Mobiltelefon": null, "Eingetreten": "1949-01-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": null, "verstorben": "2000-12-31T00:00:00", "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 28, "Mitgliedsjahre": 51, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": "1996-05-18T00:00:00", "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 83, "Geburtstag60": "1977-04-16T00:00:00", "Beitrag": 0.0000, "verzogenDatum": null},
    {"ID": 232, "Anrede": "Herr", "Vorname": "Josef", "Vorstandsmitglied": false, "Nachname": "Kinader", "PLZ": 86504.0, "Ort": "Merching", "Straße": null, "Unterdorf": false, "verzogen": false, "Geboren": null, "Telefon": null, "Mobiltelefon": null, "Eingetreten": "1918-01-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": null, "verstorben": "2000-12-31T00:00:00", "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": null, "Mitgliedsjahre": null, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": "1987-05-03T00:00:00", "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": null, "Geburtstag60": null, "Beitrag": 0.0000, "verzogenDatum": null},
    {"ID": 235, "Anrede": "Herr", "Vorname": "Karl", "Vorstandsmitglied": false, "Nachname": "Emmert", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Lederweg 1", "Unterdorf": true, "verzogen": false, "Geboren": "1922-05-04T00:00:00", "Telefon": null, "Mobiltelefon": null, "Eingetreten": "1958-01-06T00:00:00", "Ausgetreten": null, "Übergang_Passiv": null, "verstorben": "2002-12-31T00:00:00", "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 24, "Mitgliedsjahre": 44, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 80, "Geburtstag60": "1982-05-04T00:00:00", "Beitrag": 0.0000, "verzogenDatum": null},
    {"ID": 244, "Anrede": "Herr", "Vorname": "Alfons", "Vorstandsmitglied": false, "Nachname": "Storch, sen.", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Karwendelstr. 1a", "Unterdorf": false, "verzogen": false, "Geboren": "1914-03-20T00:00:00", "Telefon": null, "Mobiltelefon": null, "Eingetreten": "1937-01-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "1900-01-01T00:00:00", "verstorben": "2003-10-13T00:00:00", "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 0, "Mitgliedsjahre": 66, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": "1987-05-03T00:00:00", "Ehrennadel_Gold": "1996-05-18T00:00:00", "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 89, "Geburtstag60": "1974-03-20T00:00:00", "Beitrag": 0.0000, "verzogenDatum": null},
    {"ID": 255, "Anrede": "Herr", "Vorname": "Hermann", "Vorstandsmitglied": false, "Nachname": "Straucher", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Hauptstr. 12", "Unterdorf": false, "verzogen": false, "Geboren": "1921-04-29T00:00:00", "Telefon": null, "Mobiltelefon": null, "Eingetreten": "1938-01-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "1900-01-01T00:00:00", "verstorben": "2003-04-26T00:00:00", "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 0, "Mitgliedsjahre": 65, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": "1987-05-03T00:00:00", "Ehrennadel_Gold": "1996-05-18T00:00:00", "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": "2003-01-06T00:00:00", "Alter": 81, "Geburtstag60": "1981-04-29T00:00:00", "Beitrag": 0.0000, "verzogenDatum": null},
    {"ID": 259, "Anrede": "Herr", "Vorname": "Martin", "Vorstandsmitglied": false, "Nachname": "Süßmeier", "PLZ": null, "Ort": null, "Straße": null, "Unterdorf": false, "verzogen": false, "Geboren": "1917-07-17T00:00:00", "Telefon": null, "Mobiltelefon": null, "Eingetreten": "1941-01-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": null, "verstorben": "2000-12-31T00:00:00", "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 36, "Mitgliedsjahre": 59, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": "1996-05-18T00:00:00", "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 83, "Geburtstag60": "1977-07-17T00:00:00", "Beitrag": 0.0000, "verzogenDatum": null},
    {"ID": 260, "Anrede": "Herr", "Vorname": "Alfons", "Vorstandsmitglied": false, "Nachname": "Grad", "PLZ": null, "Ort": null, "Straße": null, "Unterdorf": false, "verzogen": false, "Geboren": "1925-03-05T00:00:00", "Telefon": null, "Mobiltelefon": null, "Eingetreten": "1941-01-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": null, "verstorben": "1960-12-25T00:00:00", "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 19, "Mitgliedsjahre": 19, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 35, "Geburtstag60": "1985-03-05T00:00:00", "Beitrag": 0.0000, "verzogenDatum": null},
    {"ID": 261, "Anrede": "Herr", "Vorname": "Michael", "Vorstandsmitglied": false, "Nachname": "Aumiller", "PLZ": null, "Ort": null, "Straße": null, "Unterdorf": false, "verzogen": false, "Geboren": "1918-01-29T00:00:00", "Telefon": null, "Mobiltelefon": null, "Eingetreten": "1941-01-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": null, "verstorben": "1994-11-16T00:00:00", "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 37, "Mitgliedsjahre": 53, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 76, "Geburtstag60": "1978-01-29T00:00:00", "Beitrag": 0.0000, "verzogenDatum": null},
    {"ID": 262, "Anrede": "Herr", "Vorname": "Matthias", "Vorstandsmitglied": false, "Nachname": "Kaspar", "PLZ": null, "Ort": null, "Straße": null, "Unterdorf": false, "verzogen": false, "Geboren": "1922-08-02T00:00:00", "Telefon": null, "Mobiltelefon": null, "Eingetreten": "1941-01-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": null, "verstorben": "1964-08-15T00:00:00", "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 23, "Mitgliedsjahre": 23, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 42, "Geburtstag60": "1982-08-02T00:00:00", "Beitrag": 0.0000, "verzogenDatum": null},
    {"ID": 263, "Anrede": "Herr", "Vorname": "Josef", "Vorstandsmitglied": false, "Nachname": "Sedlmeier", "PLZ": null, "Ort": null, "Straße": null, "Unterdorf": false, "verzogen": true, "Geboren": "1924-01-11T00:00:00", "Telefon": null, "Mobiltelefon": null, "Eingetreten": "1941-01-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": null, "verstorben": null, "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 0, "Mitgliedsjahre": 0, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 0, "Geburtstag60": null, "Beitrag": 0.0000, "verzogenDatum": "1959-12-31T00:00:00"},
    {"ID": 264, "Anrede": "Herr", "Vorname": "Josef", "Vorstandsmitglied": false, "Nachname": "Heim", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Schulweg 8", "Unterdorf": false, "verzogen": false, "Geboren": "1928-09-12T00:00:00", "Telefon": "9342", "Mobiltelefon": null, "Eingetreten": "1943-01-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "1900-01-01T00:00:00", "verstorben": "2007-07-02T00:00:00", "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 0, "Mitgliedsjahre": 64, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": "1987-05-03T00:00:00", "Ehrennadel_Gold": "1996-05-18T00:00:00", "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 78, "Geburtstag60": "1988-09-12T00:00:00", "Beitrag": 0.0000, "verzogenDatum": null},
    {"ID": 265, "Anrede": "Herr", "Vorname": "Franz", "Vorstandsmitglied": false, "Nachname": "Aumiller", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Hohlweg 3", "Unterdorf": false, "verzogen": false, "Geboren": "1927-12-02T00:00:00", "Telefon": "9309", "Mobiltelefon": null, "Eingetreten": "1943-01-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "1900-01-01T00:00:00", "verstorben": "2006-06-17T00:00:00", "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 0, "Mitgliedsjahre": 63, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": "1996-05-18T00:00:00", "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 78, "Geburtstag60": "1987-12-02T00:00:00", "Beitrag": 0.0000, "verzogenDatum": null},
    {"ID": 266, "Anrede": "Herr", "Vorname": "Wilhelm", "Vorstandsmitglied": false, "Nachname": "Schwarz", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Mandichostr. 28", "Unterdorf": true, "verzogen": false, "Geboren": "1927-11-18T00:00:00", "Telefon": "9637", "Mobiltelefon": null, "Eingetreten": "1946-01-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "1900-01-01T00:00:00", "verstorben": null, "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 0, "Mitgliedsjahre": 68, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": "1987-05-03T00:00:00", "Ehrennadel_Gold": "1996-05-18T00:00:00", "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 86, "Geburtstag60": "1987-11-18T00:00:00", "Beitrag": 0.0000, "verzogenDatum": null},
    {"ID": 267, "Anrede": "Herr", "Vorname": "Roman", "Vorstandsmitglied": false, "Nachname": "Ernst", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Hauptstr. 4a", "Unterdorf": false, "verzogen": false, "Geboren": "1928-06-27T00:00:00", "Telefon": "1372", "Mobiltelefon": null, "Eingetreten": "1944-01-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "1900-01-01T00:00:00", "verstorben": null, "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 0, "Mitgliedsjahre": 70, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": "1987-05-03T00:00:00", "Ehrennadel_Gold": "1996-05-18T00:00:00", "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 85, "Geburtstag60": "1988-06-27T00:00:00", "Beitrag": 0.0000, "verzogenDatum": null},
    {"ID": 268, "Anrede": "Herr", "Vorname": "Peter", "Vorstandsmitglied": false, "Nachname": "Lachenmair", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Mandichostr. 10", "Unterdorf": true, "verzogen": false, "Geboren": "1930-03-16T00:00:00", "Telefon": "4652", "Mobiltelefon": null, "Eingetreten": "1944-01-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "1900-01-01T00:00:00", "verstorben": null, "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 0, "Mitgliedsjahre": 70, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": "1987-05-03T00:00:00", "Ehrennadel_Gold": "1996-05-18T00:00:00", "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 83, "Geburtstag60": "1990-03-16T00:00:00", "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 269, "Anrede": "Herr", "Vorname": "Georg", "Vorstandsmitglied": false, "Nachname": "Schreiegg", "PLZ": null, "Ort": null, "Straße": null, "Unterdorf": false, "verzogen": false, "Geboren": "1928-07-21T00:00:00", "Telefon": null, "Mobiltelefon": null, "Eingetreten": "1944-01-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": null, "verstorben": "1991-04-03T00:00:00", "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 44, "Mitgliedsjahre": 47, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 62, "Geburtstag60": "1988-07-21T00:00:00", "Beitrag": 0.0000, "verzogenDatum": null},
    {"ID": 270, "Anrede": "Herr", "Vorname": "Raimund", "Vorstandsmitglied": false, "Nachname": "Teifelhard", "PLZ": null, "Ort": null, "Straße": null, "Unterdorf": false, "verzogen": false, "Geboren": "1928-05-17T00:00:00", "Telefon": null, "Mobiltelefon": null, "Eingetreten": "1944-01-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": null, "verstorben": "1986-10-06T00:00:00", "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 42, "Mitgliedsjahre": 42, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 58, "Geburtstag60": "1988-05-17T00:00:00", "Beitrag": 0.0000, "verzogenDatum": null},
    {"ID": 271, "Anrede": "Herr", "Vorname": "Bernhard", "Vorstandsmitglied": false, "Nachname": "Weiß", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Steindorfer Str. 2", "Unterdorf": false, "verzogen": false, "Geboren": "1930-04-09T00:00:00", "Telefon": "31838", "Mobiltelefon": null, "Eingetreten": "1944-01-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "1900-01-01T00:00:00", "verstorben": "2013-10-04T00:00:00", "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 0, "Mitgliedsjahre": 69, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": "1987-05-03T00:00:00", "Ehrennadel_Gold": "1996-05-18T00:00:00", "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 83, "Geburtstag60": "1990-04-09T00:00:00", "Beitrag": 0.0000, "verzogenDatum": null},
    {"ID": 272, "Anrede": "Herr", "Vorname": "Alois", "Vorstandsmitglied": false, "Nachname": "Kinader", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Bahnhofstr. 12", "Unterdorf": true, "verzogen": false, "Geboren": "1929-07-31T00:00:00", "Telefon": "9428", "Mobiltelefon": null, "Eingetreten": "1945-01-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "1900-01-01T00:00:00", "verstorben": null, "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 0, "Mitgliedsjahre": 69, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": "1987-05-03T00:00:00", "Ehrennadel_Gold": "1996-05-18T00:00:00", "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 84, "Geburtstag60": "1989-07-31T00:00:00", "Beitrag": 0.0000, "verzogenDatum": null},
    {"ID": 273, "Anrede": "Herr", "Vorname": "Konrad", "Vorstandsmitglied": false, "Nachname": "Süßmeier", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Hauptstr. 25", "Unterdorf": true, "verzogen": false, "Geboren": "1930-04-21T00:00:00", "Telefon": "1769", "Mobiltelefon": null, "Eingetreten": "1945-01-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "1900-01-01T00:00:00", "verstorben": null, "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 0, "Mitgliedsjahre": 69, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": "1987-05-03T00:00:00", "Ehrennadel_Gold": "1996-05-18T00:00:00", "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 83, "Geburtstag60": "1990-04-21T00:00:00", "Beitrag": 0.0000, "verzogenDatum": null},
    {"ID": 274, "Anrede": "Herr", "Vorname": "Johann", "Vorstandsmitglied": false, "Nachname": "Schmid, jun.", "PLZ": null, "Ort": null, "Straße": null, "Unterdorf": false, "verzogen": false, "Geboren": "1918-12-31T00:00:00", "Telefon": null, "Mobiltelefon": null, "Eingetreten": "1946-01-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": null, "verstorben": "1994-04-07T00:00:00", "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 32, "Mitgliedsjahre": 48, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 75, "Geburtstag60": "1978-12-31T00:00:00", "Beitrag": 0.0000, "verzogenDatum": null},
    {"ID": 275, "Anrede": "Herr", "Vorname": "Ulrich", "Vorstandsmitglied": false, "Nachname": "Dafertshofer", "PLZ": null, "Ort": null, "Straße": null, "Unterdorf": false, "verzogen": false, "Geboren": "1923-07-02T00:00:00", "Telefon": null, "Mobiltelefon": null, "Eingetreten": "1946-01-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": null, "verstorben": "1984-08-29T00:00:00", "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 37, "Mitgliedsjahre": 38, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 61, "Geburtstag60": "1983-07-02T00:00:00", "Beitrag": 0.0000, "verzogenDatum": null},
    {"ID": 276, "Anrede": "Herr", "Vorname": "Erwin Franz", "Vorstandsmitglied": false, "Nachname": "Lachenmair", "PLZ": null, "Ort": null, "Straße": null, "Unterdorf": false, "verzogen": false, "Geboren": "1931-01-05T00:00:00", "Telefon": null, "Mobiltelefon": null, "Eingetreten": "1946-01-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": null, "verstorben": "1977-06-09T00:00:00", "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 31, "Mitgliedsjahre": 31, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 46, "Geburtstag60": "1991-01-05T00:00:00", "Beitrag": 0.0000, "verzogenDatum": null},
    {"ID": 277, "Anrede": "Herr", "Vorname": "August", "Vorstandsmitglied": false, "Nachname": "Süßmair, sen.", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Hauptstr. 5", "Unterdorf": true, "verzogen": false, "Geboren": "1932-04-01T00:00:00", "Telefon": "1600", "Mobiltelefon": null, "Eingetreten": "1946-01-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": null, "verstorben": "2014-07-28T00:00:00", "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 46, "Mitgliedsjahre": 68, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": "1987-05-03T00:00:00", "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": "1996-05-18T00:00:00", "Ehrenmitgliedschaft": null, "Alter": 81, "Geburtstag60": "1992-04-01T00:00:00", "Beitrag": 0.0000, "verzogenDatum": null},
    {"ID": 278, "Anrede": "Herr", "Vorname": "Max", "Vorstandsmitglied": false, "Nachname": "Sedlmeier", "PLZ": null, "Ort": null, "Straße": null, "Unterdorf": false, "verzogen": false, "Geboren": "1929-08-10T00:00:00", "Telefon": null, "Mobiltelefon": null, "Eingetreten": "1946-01-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": null, "verstorben": "1977-01-04T00:00:00", "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 31, "Mitgliedsjahre": 31, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 47, "Geburtstag60": "1989-08-10T00:00:00", "Beitrag": 0.0000, "verzogenDatum": null},
    {"ID": 279, "Anrede": "Herr", "Vorname": "Josef", "Vorstandsmitglied": false, "Nachname": "Siebenhütter", "PLZ": null, "Ort": null, "Straße": null, "Unterdorf": false, "verzogen": false, "Geboren": "1919-10-26T00:00:00", "Telefon": null, "Mobiltelefon": null, "Eingetreten": "1946-01-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": null, "verstorben": "2000-12-31T00:00:00", "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 33, "Mitgliedsjahre": 54, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": "1996-05-18T00:00:00", "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 81, "Geburtstag60": "1979-10-26T00:00:00", "Beitrag": 0.0000, "verzogenDatum": null},
    {"ID": 280, "Anrede": "Herr", "Vorname": "Xaver", "Vorstandsmitglied": false, "Nachname": "Dafertshofer", "PLZ": null, "Ort": null, "Straße": null, "Unterdorf": false, "verzogen": true, "Geboren": "1928-08-18T00:00:00", "Telefon": null, "Mobiltelefon": null, "Eingetreten": "1946-01-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": null, "verstorben": null, "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 0, "Mitgliedsjahre": 0, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 0, "Geburtstag60": null, "Beitrag": 0.0000, "verzogenDatum": "1958-12-31T00:00:00"},
    {"ID": 281, "Anrede": "Herr", "Vorname": "August", "Vorstandsmitglied": false, "Nachname": "Schamberger", "PLZ": null, "Ort": "Brunnen", "Straße": null, "Unterdorf": false, "verzogen": true, "Geboren": null, "Telefon": null, "Mobiltelefon": null, "Eingetreten": "1946-01-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": null, "verstorben": null, "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 0, "Mitgliedsjahre": 0, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 0, "Geburtstag60": null, "Beitrag": 0.0000, "verzogenDatum": null},
    {"ID": 282, "Anrede": "Herr", "Vorname": "Alois", "Vorstandsmitglied": false, "Nachname": "Grundler, sen.", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Landsbergerstr. 14", "Unterdorf": true, "verzogen": false, "Geboren": "1931-11-13T00:00:00", "Telefon": "1442", "Mobiltelefon": null, "Eingetreten": "1946-01-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "1900-01-01T00:00:00", "verstorben": null, "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 0, "Mitgliedsjahre": 68, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": "1987-05-03T00:00:00", "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": "1996-05-18T00:00:00", "Ehrenmitgliedschaft": "2003-01-06T00:00:00", "Alter": 82, "Geburtstag60": "1991-11-13T00:00:00", "Beitrag": 0.0000, "verzogenDatum": null},
    {"ID": 283, "Anrede": "Herr", "Vorname": "Michael", "Vorstandsmitglied": false, "Nachname": "Bauer", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Mandichostr. 2a", "Unterdorf": true, "verzogen": false, "Geboren": "1929-11-07T00:00:00", "Telefon": null, "Mobiltelefon": null, "Eingetreten": "1947-01-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "1900-01-01T00:00:00", "verstorben": "2013-03-15T00:00:00", "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 0, "Mitgliedsjahre": 66, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": "1996-05-18T00:00:00", "Ehrennadel_Gold": "2003-01-06T00:00:00", "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 83, "Geburtstag60": "1989-11-07T00:00:00", "Beitrag": 0.0000, "verzogenDatum": null},
    {"ID": 284, "Anrede": "Herr", "Vorname": "Martin", "Vorstandsmitglied": false, "Nachname": "Schwab", "PLZ": null, "Ort": null, "Straße": null, "Unterdorf": false, "verzogen": true, "Geboren": "1917-12-08T00:00:00", "Telefon": null, "Mobiltelefon": null, "Eingetreten": "1947-01-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": null, "verstorben": null, "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 0, "Mitgliedsjahre": 0, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 0, "Geburtstag60": null, "Beitrag": 0.0000, "verzogenDatum": null},
    {"ID": 285, "Anrede": "Herr", "Vorname": "Martin", "Vorstandsmitglied": false, "Nachname": "Kauth", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Alpenblickstr. 5", "Unterdorf": false, "verzogen": false, "Geboren": "1922-05-07T00:00:00", "Telefon": null, "Mobiltelefon": null, "Eingetreten": "1948-01-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "1900-01-01T00:00:00", "verstorben": "2007-12-17T00:00:00", "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 0, "Mitgliedsjahre": 59, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": "1996-05-18T00:00:00", "Ehrennadel_Gold": "2003-01-06T00:00:00", "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 85, "Geburtstag60": "1982-05-07T00:00:00", "Beitrag": 0.0000, "verzogenDatum": null},
    {"ID": 286, "Anrede": "Herr", "Vorname": "Franz", "Vorstandsmitglied": false, "Nachname": "Kauth", "PLZ": null, "Ort": null, "Straße": null, "Unterdorf": false, "verzogen": false, "Geboren": "1924-03-05T00:00:00", "Telefon": null, "Mobiltelefon": null, "Eingetreten": "1948-01-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": null, "verstorben": "1990-02-09T00:00:00", "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 36, "Mitgliedsjahre": 42, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 65, "Geburtstag60": "1984-03-05T00:00:00", "Beitrag": 0.0000, "verzogenDatum": null},
    {"ID": 287, "Anrede": "Herr", "Vorname": "Ludwig", "Vorstandsmitglied": false, "Nachname": "Kerber", "PLZ": null, "Ort": null, "Straße": null, "Unterdorf": false, "verzogen": false, "Geboren": "1911-06-28T00:00:00", "Telefon": null, "Mobiltelefon": null, "Eingetreten": "1948-01-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": null, "verstorben": "2000-12-31T00:00:00", "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 23, "Mitgliedsjahre": 52, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": "1996-05-18T00:00:00", "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 89, "Geburtstag60": "1971-06-28T00:00:00", "Beitrag": 0.0000, "verzogenDatum": null},
    {"ID": 288, "Anrede": "Herr", "Vorname": "Max", "Vorstandsmitglied": false, "Nachname": "Gantner", "PLZ": null, "Ort": null, "Straße": null, "Unterdorf": false, "verzogen": true, "Geboren": "1927-01-10T00:00:00", "Telefon": null, "Mobiltelefon": null, "Eingetreten": "1948-01-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": null, "verstorben": null, "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 0, "Mitgliedsjahre": 0, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 0, "Geburtstag60": null, "Beitrag": 0.0000, "verzogenDatum": "1958-12-31T00:00:00"},
    {"ID": 289, "Anrede": "Herr", "Vorname": "Paul", "Vorstandsmitglied": false, "Nachname": "Lindschinger", "PLZ": null, "Ort": null, "Straße": null, "Unterdorf": false, "verzogen": true, "Geboren": "1922-05-09T00:00:00", "Telefon": null, "Mobiltelefon": null, "Eingetreten": "1948-01-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": null, "verstorben": null, "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 0, "Mitgliedsjahre": 0, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 0, "Geburtstag60": null, "Beitrag": 0.0000, "verzogenDatum": "1960-12-31T00:00:00"},
    {"ID": 290, "Anrede": "Herr", "Vorname": "Josef", "Vorstandsmitglied": false, "Nachname": "Luichtl", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Kirchstr. 8", "Unterdorf": false, "verzogen": false, "Geboren": "1930-06-27T00:00:00", "Telefon": "30390", "Mobiltelefon": null, "Eingetreten": "1948-01-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "1900-01-01T00:00:00", "verstorben": null, "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 0, "Mitgliedsjahre": 66, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": "1996-05-18T00:00:00", "Ehrennadel_Gold": "2003-01-06T00:00:00", "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 83, "Geburtstag60": "1990-06-27T00:00:00", "Beitrag": 0.0000, "verzogenDatum": null},
    {"ID": 291, "Anrede": "Herr", "Vorname": "Ulrich", "Vorstandsmitglied": false, "Nachname": "Müller", "PLZ": null, "Ort": null, "Straße": null, "Unterdorf": false, "verzogen": false, "Geboren": "1920-01-29T00:00:00", "Telefon": null, "Mobiltelefon": null, "Eingetreten": "1948-01-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": null, "verstorben": "1993-07-29T00:00:00", "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 32, "Mitgliedsjahre": 45, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 73, "Geburtstag60": "1980-01-29T00:00:00", "Beitrag": 0.0000, "verzogenDatum": null},
    {"ID": 298, "Anrede": "Herr", "Vorname": "Josef", "Vorstandsmitglied": false, "Nachname": "Gantner", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Landsbergerstr. 4", "Unterdorf": true, "verzogen": false, "Geboren": "1931-09-04T00:00:00", "Telefon": "3944", "Mobiltelefon": null, "Eingetreten": "1949-01-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "1900-01-01T00:00:00", "verstorben": "2000-01-01T00:00:00", "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 0, "Mitgliedsjahre": 51, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": "1996-05-18T00:00:00", "Ehrenkreuz_Gold": "2003-01-06T00:00:00", "Ehrenmitgliedschaft": null, "Alter": 68, "Geburtstag60": "1991-09-04T00:00:00", "Beitrag": 0.0000, "verzogenDatum": null},
    {"ID": 300, "Anrede": "Herr", "Vorname": "Ludwig", "Vorstandsmitglied": false, "Nachname": "Köchel", "PLZ": null, "Ort": null, "Straße": null, "Unterdorf": false, "verzogen": false, "Geboren": "1931-06-16T00:00:00", "Telefon": null, "Mobiltelefon": null, "Eingetreten": "1950-01-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": null, "verstorben": "2000-12-31T00:00:00", "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 41, "Mitgliedsjahre": 50, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": "1996-05-18T00:00:00", "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 69, "Geburtstag60": "1991-06-16T00:00:00", "Beitrag": 0.0000, "verzogenDatum": null},
    {"ID": 304, "Anrede": "Herr", "Vorname": "Wilhelm", "Vorstandsmitglied": false, "Nachname": "Schuh, sen.", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Steindorfer Str. 11", "Unterdorf": false, "verzogen": false, "Geboren": "1933-05-06T00:00:00", "Telefon": "9593", "Mobiltelefon": null, "Eingetreten": "1952-01-20T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "1900-01-01T00:00:00", "verstorben": null, "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 0, "Mitgliedsjahre": 61, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": "1996-05-18T00:00:00", "Ehrennadel_Gold": "2003-01-06T00:00:00", "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 80, "Geburtstag60": "1993-05-06T00:00:00", "Beitrag": 0.0000, "verzogenDatum": null},
    {"ID": 308, "Anrede": "Herr", "Vorname": "Johann", "Vorstandsmitglied": false, "Nachname": "Schwarz", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Hauptstr. 10", "Unterdorf": false, "verzogen": false, "Geboren": "1934-08-13T00:00:00", "Telefon": null, "Mobiltelefon": null, "Eingetreten": "1952-09-20T00:00:00", "Ausgetreten": null, "Übergang_Passiv": null, "verstorben": "2007-11-30T00:00:00", "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 41, "Mitgliedsjahre": 55, "Ehrung_25_Jahre_aktiv": "1987-05-03T00:00:00", "Ehrung_40_Jahre_aktiv": "1997-01-06T00:00:00", "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": "1996-05-18T00:00:00", "Ehrenkreuz_Gold": "2003-01-06T00:00:00", "Ehrenmitgliedschaft": null, "Alter": 73, "Geburtstag60": "1994-08-13T00:00:00", "Beitrag": 0.0000, "verzogenDatum": null},
    {"ID": 414, "Anrede": "Herr", "Vorname": "Johann", "Vorstandsmitglied": false, "Nachname": "Weiß", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Steindorfer Str. 2", "Unterdorf": false, "verzogen": false, "Geboren": "1954-01-12T00:00:00", "Telefon": "4895", "Mobiltelefon": "01728657375", "Eingetreten": "1970-01-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": null, "verstorben": null, "aktiv": true, "Einladung": true, "EinladungSeparat": false, "aktive_Jahre": 44, "Mitgliedsjahre": 44, "Ehrung_25_Jahre_aktiv": "1996-05-18T00:00:00", "Ehrung_40_Jahre_aktiv": "2010-01-06T00:00:00", "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 59, "Geburtstag60": null, "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 515, "Anrede": "Herr", "Vorname": "Helmut", "Vorstandsmitglied": true, "Nachname": "Luichtl", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Wendelsteinstr. 9", "Unterdorf": false, "verzogen": false, "Geboren": "1964-04-17T00:00:00", "Telefon": "4882", "Mobiltelefon": "015112758069", "Eingetreten": "1980-11-02T00:00:00", "Ausgetreten": null, "Übergang_Passiv": null, "verstorben": null, "aktiv": true, "Einladung": true, "EinladungSeparat": false, "aktive_Jahre": 33, "Mitgliedsjahre": 33, "Ehrung_25_Jahre_aktiv": "2006-01-06T00:00:00", "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 49, "Geburtstag60": null, "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 523, "Anrede": "Herr", "Vorname": "Armin", "Vorstandsmitglied": false, "Nachname": "Heim", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Mandichostr. 7", "Unterdorf": true, "verzogen": false, "Geboren": "1964-03-11T00:00:00", "Telefon": null, "Mobiltelefon": null, "Eingetreten": "1980-11-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "1900-01-01T00:00:00", "verstorben": null, "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 0, "Mitgliedsjahre": 33, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 49, "Geburtstag60": null, "Beitrag": 0.0000, "verzogenDatum": null},
    {"ID": 524, "Anrede": "Herr", "Vorname": "Gerhard", "Vorstandsmitglied": false, "Nachname": "Gießer", "PLZ": null, "Ort": null, "Straße": null, "Unterdorf": false, "verzogen": false, "Geboren": "1964-08-28T00:00:00", "Telefon": null, "Mobiltelefon": null, "Eingetreten": "1980-11-01T00:00:00", "Ausgetreten": "1987-12-31T00:00:00", "Übergang_Passiv": null, "verstorben": null, "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 33, "Mitgliedsjahre": 33, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 49, "Geburtstag60": null, "Beitrag": 0.0000, "verzogenDatum": null},
    {"ID": 525, "Anrede": "Herr", "Vorname": "Alfred", "Vorstandsmitglied": false, "Nachname": "Resele", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Mandichostr. 13", "Unterdorf": true, "verzogen": false, "Geboren": "1963-06-25T00:00:00", "Telefon": "4317", "Mobiltelefon": "016092066641", "Eingetreten": "1980-11-02T00:00:00", "Ausgetreten": null, "Übergang_Passiv": null, "verstorben": null, "aktiv": true, "Einladung": true, "EinladungSeparat": false, "aktive_Jahre": 33, "Mitgliedsjahre": 33, "Ehrung_25_Jahre_aktiv": "2006-01-06T00:00:00", "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 50, "Geburtstag60": null, "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 526, "Anrede": "Herr", "Vorname": "Franz", "Vorstandsmitglied": false, "Nachname": "Kainz", "PLZ": null, "Ort": null, "Straße": null, "Unterdorf": true, "verzogen": true, "Geboren": "1964-10-10T00:00:00", "Telefon": "9369", "Mobiltelefon": null, "Eingetreten": "1980-11-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "2004-12-31T00:00:00", "verstorben": null, "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 24, "Mitgliedsjahre": 28, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 44, "Geburtstag60": null, "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 527, "Anrede": "Herr", "Vorname": "Norbert", "Vorstandsmitglied": false, "Nachname": "Wolferstetter", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Zugspitzstr. 2a", "Unterdorf": false, "verzogen": false, "Geboren": "1965-04-30T00:00:00", "Telefon": null, "Mobiltelefon": null, "Eingetreten": "1980-11-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "2004-12-31T00:00:00", "verstorben": null, "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 24, "Mitgliedsjahre": 33, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 48, "Geburtstag60": null, "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 528, "Anrede": "Herr", "Vorname": "Alfons", "Vorstandsmitglied": false, "Nachname": "Storch", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Steinacherstr. 2", "Unterdorf": false, "verzogen": false, "Geboren": "1949-05-02T00:00:00", "Telefon": "9632", "Mobiltelefon": "01601612609", "Eingetreten": "1980-06-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": null, "verstorben": null, "aktiv": true, "Einladung": true, "EinladungSeparat": false, "aktive_Jahre": 31, "Mitgliedsjahre": 33, "Ehrung_25_Jahre_aktiv": "2006-01-06T00:00:00", "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 64, "Geburtstag60": "2009-05-02T00:00:00", "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 529, "Anrede": "Herr", "Vorname": "Stefan", "Vorstandsmitglied": false, "Nachname": "Tomaschko", "PLZ": null, "Ort": null, "Straße": null, "Unterdorf": false, "verzogen": false, "Geboren": "1937-12-11T00:00:00", "Telefon": null, "Mobiltelefon": null, "Eingetreten": "1981-01-06T00:00:00", "Ausgetreten": null, "Übergang_Passiv": null, "verstorben": "1995-01-03T00:00:00", "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 13, "Mitgliedsjahre": 13, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 57, "Geburtstag60": "1997-12-11T00:00:00", "Beitrag": 0.0000, "verzogenDatum": null},
    {"ID": 530, "Anrede": "Herr", "Vorname": "Karl-Heinz", "Vorstandsmitglied": false, "Nachname": "Laber", "PLZ": null, "Ort": null, "Straße": null, "Unterdorf": false, "verzogen": false, "Geboren": "1953-08-02T00:00:00", "Telefon": null, "Mobiltelefon": null, "Eingetreten": "1981-01-06T00:00:00", "Ausgetreten": null, "Übergang_Passiv": null, "verstorben": "1999-01-01T00:00:00", "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 17, "Mitgliedsjahre": 17, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 45, "Geburtstag60": "2013-08-02T00:00:00", "Beitrag": 0.0000, "verzogenDatum": null},
    {"ID": 531, "Anrede": "Herr", "Vorname": "Werner", "Vorstandsmitglied": false, "Nachname": "Böck", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Wankstr. 1", "Unterdorf": false, "verzogen": false, "Geboren": "1940-05-12T00:00:00", "Telefon": "3965", "Mobiltelefon": null, "Eingetreten": "1968-09-06T00:00:00", "Ausgetreten": null, "Übergang_Passiv": null, "verstorben": null, "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 31, "Mitgliedsjahre": 45, "Ehrung_25_Jahre_aktiv": "1996-05-18T00:00:00", "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 73, "Geburtstag60": "2000-05-12T00:00:00", "Beitrag": 0.0000, "verzogenDatum": null},
    {"ID": 532, "Anrede": "Herr", "Vorname": "Adolf", "Vorstandsmitglied": false, "Nachname": "Krause", "PLZ": null, "Ort": null, "Straße": null, "Unterdorf": false, "verzogen": true, "Geboren": "1940-05-09T00:00:00", "Telefon": null, "Mobiltelefon": null, "Eingetreten": "1981-01-06T00:00:00", "Ausgetreten": null, "Übergang_Passiv": null, "verstorben": null, "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 0, "Mitgliedsjahre": 0, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 0, "Geburtstag60": null, "Beitrag": 0.0000, "verzogenDatum": "1990-09-15T00:00:00"},
    {"ID": 534, "Anrede": "Herr", "Vorname": "Johann", "Vorstandsmitglied": false, "Nachname": "Stadtherr", "PLZ": 86504.0, "Ort": "Merching", "Straße": "St. Martin Str. 14", "Unterdorf": false, "verzogen": false, "Geboren": "1961-10-06T00:00:00", "Telefon": "31883", "Mobiltelefon": "01758889398", "Eingetreten": "1980-04-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": null, "verstorben": null, "aktiv": true, "Einladung": true, "EinladungSeparat": false, "aktive_Jahre": 33, "Mitgliedsjahre": 33, "Ehrung_25_Jahre_aktiv": "2006-01-06T00:00:00", "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 52, "Geburtstag60": null, "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 535, "Anrede": "Herr", "Vorname": "Anton", "Vorstandsmitglied": false, "Nachname": "Sonntag", "PLZ": null, "Ort": null, "Straße": null, "Unterdorf": false, "verzogen": true, "Geboren": "1940-01-06T00:00:00", "Telefon": null, "Mobiltelefon": null, "Eingetreten": "1980-04-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": null, "verstorben": null, "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 0, "Mitgliedsjahre": 0, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 0, "Geburtstag60": null, "Beitrag": 0.0000, "verzogenDatum": null},
    {"ID": 536, "Anrede": "Herr", "Vorname": "Herbert", "Vorstandsmitglied": false, "Nachname": "Füßl", "PLZ": null, "Ort": null, "Straße": null, "Unterdorf": false, "verzogen": true, "Geboren": "1964-02-26T00:00:00", "Telefon": null, "Mobiltelefon": null, "Eingetreten": "1980-04-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": null, "verstorben": null, "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 0, "Mitgliedsjahre": 0, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 0, "Geburtstag60": null, "Beitrag": 0.0000, "verzogenDatum": null},
    {"ID": 537, "Anrede": "Herr", "Vorname": "Manfred", "Vorstandsmitglied": false, "Nachname": "Bader", "PLZ": null, "Ort": null, "Straße": null, "Unterdorf": false, "verzogen": false, "Geboren": "1963-10-22T00:00:00", "Telefon": null, "Mobiltelefon": null, "Eingetreten": "1980-04-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": null, "verstorben": "1997-12-31T00:00:00", "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 17, "Mitgliedsjahre": 17, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 34, "Geburtstag60": null, "Beitrag": 0.0000, "verzogenDatum": null},
    {"ID": 538, "Anrede": "Herr", "Vorname": "Michael", "Vorstandsmitglied": false, "Nachname": "Eidelsburger", "PLZ": null, "Ort": "Prittriching", "Straße": null, "Unterdorf": false, "verzogen": true, "Geboren": "1966-03-24T00:00:00", "Telefon": null, "Mobiltelefon": null, "Eingetreten": "1982-01-06T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "2006-11-05T00:00:00", "verstorben": null, "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 25, "Mitgliedsjahre": 25, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 40, "Geburtstag60": null, "Beitrag": 0.0000, "verzogenDatum": null},
    {"ID": 539, "Anrede": "Herr", "Vorname": "Stefan", "Vorstandsmitglied": false, "Nachname": "Weiß", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Sonnenweg 1", "Unterdorf": false, "verzogen": false, "Geboren": "1963-11-05T00:00:00", "Telefon": "9734", "Mobiltelefon": "01728865920", "Eingetreten": "1982-01-06T00:00:00", "Ausgetreten": null, "Übergang_Passiv": null, "verstorben": null, "aktiv": true, "Einladung": true, "EinladungSeparat": false, "aktive_Jahre": 32, "Mitgliedsjahre": 32, "Ehrung_25_Jahre_aktiv": "2007-01-06T00:00:00", "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 50, "Geburtstag60": null, "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 540, "Anrede": "Herr", "Vorname": "Gerhard", "Vorstandsmitglied": false, "Nachname": "Bartl", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Steinacher Str. 34", "Unterdorf": false, "verzogen": true, "Geboren": "1966-01-08T00:00:00", "Telefon": null, "Mobiltelefon": null, "Eingetreten": "1982-01-06T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "2006-11-05T00:00:00", "verstorben": null, "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 24, "Mitgliedsjahre": 28, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 44, "Geburtstag60": null, "Beitrag": 0.0000, "verzogenDatum": null},
    {"ID": 541, "Anrede": "Herr", "Vorname": "Martin", "Vorstandsmitglied": false, "Nachname": "Steinhard", "PLZ": null, "Ort": "Mering", "Straße": null, "Unterdorf": false, "verzogen": true, "Geboren": "1966-01-26T00:00:00", "Telefon": null, "Mobiltelefon": null, "Eingetreten": "1982-01-06T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "2006-11-05T00:00:00", "verstorben": null, "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 25, "Mitgliedsjahre": 25, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 40, "Geburtstag60": null, "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 542, "Anrede": "Herr", "Vorname": "Stefan", "Vorstandsmitglied": false, "Nachname": "Ernst", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Kirchfeldstr. 8", "Unterdorf": false, "verzogen": false, "Geboren": "1966-02-07T00:00:00", "Telefon": null, "Mobiltelefon": null, "Eingetreten": "1982-01-06T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "2006-11-05T00:00:00", "verstorben": null, "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 24, "Mitgliedsjahre": 32, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 47, "Geburtstag60": null, "Beitrag": 0.0000, "verzogenDatum": null},
    {"ID": 543, "Anrede": "Herr", "Vorname": "Josef", "Vorstandsmitglied": false, "Nachname": "Siefer", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Fichtenstr. 15", "Unterdorf": true, "verzogen": false, "Geboren": "1929-04-21T00:00:00", "Telefon": null, "Mobiltelefon": null, "Eingetreten": "1982-01-06T00:00:00", "Ausgetreten": null, "Übergang_Passiv": null, "verstorben": null, "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 7, "Mitgliedsjahre": 32, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 84, "Geburtstag60": "1989-04-21T00:00:00", "Beitrag": 0.0000, "verzogenDatum": null},
    {"ID": 544, "Anrede": "Herr", "Vorname": "Andreas", "Vorstandsmitglied": false, "Nachname": "Reyinger", "PLZ": null, "Ort": null, "Straße": null, "Unterdorf": false, "verzogen": true, "Geboren": "1966-03-26T00:00:00", "Telefon": null, "Mobiltelefon": null, "Eingetreten": "1983-01-06T00:00:00", "Ausgetreten": null, "Übergang_Passiv": null, "verstorben": null, "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 0, "Mitgliedsjahre": 0, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 0, "Geburtstag60": null, "Beitrag": 0.0000, "verzogenDatum": null},
    {"ID": 545, "Anrede": "Herr", "Vorname": "August", "Vorstandsmitglied": false, "Nachname": "Süßmair, jun.", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Hauptstr. 5", "Unterdorf": true, "verzogen": false, "Geboren": "1967-12-08T00:00:00", "Telefon": null, "Mobiltelefon": null, "Eingetreten": "1983-01-06T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "2006-11-05T00:00:00", "verstorben": null, "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 23, "Mitgliedsjahre": 31, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 46, "Geburtstag60": null, "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 546, "Anrede": "Herr", "Vorname": "Udo", "Vorstandsmitglied": false, "Nachname": "George", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Wendelsteinstr. 8", "Unterdorf": false, "verzogen": false, "Geboren": "1942-12-24T00:00:00", "Telefon": "1326", "Mobiltelefon": null, "Eingetreten": "1983-11-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": null, "verstorben": null, "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 19, "Mitgliedsjahre": 30, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 71, "Geburtstag60": "2002-12-24T00:00:00", "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 547, "Anrede": "Herr", "Vorname": "Egon", "Vorstandsmitglied": false, "Nachname": "Richter", "PLZ": null, "Ort": null, "Straße": null, "Unterdorf": false, "verzogen": true, "Geboren": null, "Telefon": null, "Mobiltelefon": null, "Eingetreten": "1982-01-06T00:00:00", "Ausgetreten": null, "Übergang_Passiv": null, "verstorben": null, "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 0, "Mitgliedsjahre": 0, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 0, "Geburtstag60": null, "Beitrag": 0.0000, "verzogenDatum": null},
    {"ID": 548, "Anrede": "Herr", "Vorname": "Josef", "Vorstandsmitglied": false, "Nachname": "Failer", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Lederweg 1", "Unterdorf": true, "verzogen": false, "Geboren": "1954-03-10T00:00:00", "Telefon": "9927", "Mobiltelefon": "01728565764", "Eingetreten": "1968-01-06T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "2012-12-10T00:00:00", "verstorben": null, "aktiv": false, "Einladung": true, "EinladungSeparat": false, "aktive_Jahre": 44, "Mitgliedsjahre": 46, "Ehrung_25_Jahre_aktiv": "1996-05-18T00:00:00", "Ehrung_40_Jahre_aktiv": "2008-01-06T00:00:00", "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 59, "Geburtstag60": null, "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 549, "Anrede": "Herr", "Vorname": "Andreas", "Vorstandsmitglied": false, "Nachname": "Meyer - Schalkhammer", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Kolpingstr. 14", "Unterdorf": false, "verzogen": false, "Geboren": "1953-11-16T00:00:00", "Telefon": "1557", "Mobiltelefon": "01631468426", "Eingetreten": "1971-11-16T00:00:00", "Ausgetreten": null, "Übergang_Passiv": null, "verstorben": null, "aktiv": true, "Einladung": true, "EinladungSeparat": false, "aktive_Jahre": 42, "Mitgliedsjahre": 42, "Ehrung_25_Jahre_aktiv": "2004-01-06T00:00:00", "Ehrung_40_Jahre_aktiv": "2012-02-15T00:00:00", "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 60, "Geburtstag60": "2013-11-16T00:00:00", "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 550, "Anrede": "Herr", "Vorname": "Werner", "Vorstandsmitglied": false, "Nachname": "Steinhart", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Raiffeisenring 3", "Unterdorf": false, "verzogen": false, "Geboren": "1964-03-22T00:00:00", "Telefon": "08233 30665", "Mobiltelefon": null, "Eingetreten": "1983-04-26T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "2006-11-05T00:00:00", "verstorben": null, "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 23, "Mitgliedsjahre": 30, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 49, "Geburtstag60": null, "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 551, "Anrede": "Herr", "Vorname": "Jürgen", "Vorstandsmitglied": false, "Nachname": "Krauser", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Mandichostr. 14", "Unterdorf": true, "verzogen": false, "Geboren": "1951-06-24T00:00:00", "Telefon": "92814", "Mobiltelefon": null, "Eingetreten": "1984-01-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "2006-11-05T00:00:00", "verstorben": null, "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 22, "Mitgliedsjahre": 30, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 62, "Geburtstag60": "2011-06-24T00:00:00", "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 553, "Anrede": "Herr", "Vorname": "Manfred", "Vorstandsmitglied": false, "Nachname": "Spicker", "PLZ": null, "Ort": null, "Straße": null, "Unterdorf": false, "verzogen": true, "Geboren": "1968-08-20T00:00:00", "Telefon": null, "Mobiltelefon": null, "Eingetreten": "1985-07-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "1987-01-01T00:00:00", "verstorben": null, "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 0, "Mitgliedsjahre": 0, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 0, "Geburtstag60": null, "Beitrag": 0.0000, "verzogenDatum": null},
    {"ID": 554, "Anrede": "Herr", "Vorname": "Johann", "Vorstandsmitglied": false, "Nachname": "Kaspar", "PLZ": null, "Ort": null, "Straße": null, "Unterdorf": false, "verzogen": true, "Geboren": "1959-08-06T00:00:00", "Telefon": null, "Mobiltelefon": null, "Eingetreten": "1985-01-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": null, "verstorben": null, "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 0, "Mitgliedsjahre": 0, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 0, "Geburtstag60": null, "Beitrag": 0.0000, "verzogenDatum": null},
    {"ID": 555, "Anrede": "Herr", "Vorname": "Konrad", "Vorstandsmitglied": false, "Nachname": "Kaspar", "PLZ": null, "Ort": "Mering", "Straße": "Am alten Sportplatz 28", "Unterdorf": false, "verzogen": true, "Geboren": "1964-04-20T00:00:00", "Telefon": "30276", "Mobiltelefon": null, "Eingetreten": "1985-01-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "2006-11-05T00:00:00", "verstorben": null, "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 22, "Mitgliedsjahre": 22, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 42, "Geburtstag60": null, "Beitrag": 0.0000, "verzogenDatum": null},
    {"ID": 556, "Anrede": "Herr", "Vorname": "Norbert", "Vorstandsmitglied": false, "Nachname": "Spicker", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Untermühlstr. 5", "Unterdorf": true, "verzogen": false, "Geboren": "1967-02-02T00:00:00", "Telefon": "30030", "Mobiltelefon": null, "Eingetreten": "1985-01-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "1994-12-31T00:00:00", "verstorben": null, "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 9, "Mitgliedsjahre": 29, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 46, "Geburtstag60": null, "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 557, "Anrede": "Herr", "Vorname": "Andreas", "Vorstandsmitglied": false, "Nachname": "Escher", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Untermühlstr. 2", "Unterdorf": true, "verzogen": false, "Geboren": "1968-10-06T00:00:00", "Telefon": "31773", "Mobiltelefon": "01728542869", "Eingetreten": "1985-01-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": null, "verstorben": null, "aktiv": true, "Einladung": true, "EinladungSeparat": false, "aktive_Jahre": 29, "Mitgliedsjahre": 29, "Ehrung_25_Jahre_aktiv": "2010-01-06T00:00:00", "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 45, "Geburtstag60": null, "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 558, "Anrede": "Herr", "Vorname": "Johann", "Vorstandsmitglied": false, "Nachname": "Grabmann, jun.", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Paartalweg 29", "Unterdorf": false, "verzogen": false, "Geboren": "1968-11-25T00:00:00", "Telefon": "31587", "Mobiltelefon": null, "Eingetreten": "1985-01-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "2009-01-01T00:00:00", "verstorben": null, "aktiv": true, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 24, "Mitgliedsjahre": 29, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 45, "Geburtstag60": null, "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 559, "Anrede": "Herr", "Vorname": "Anton", "Vorstandsmitglied": true, "Nachname": "Schegg, jun.", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Bahnhofstr. 10a", "Unterdorf": true, "verzogen": false, "Geboren": "1967-09-01T00:00:00", "Telefon": null, "Mobiltelefon": "01638146810", "Eingetreten": "1985-01-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": null, "verstorben": null, "aktiv": true, "Einladung": true, "EinladungSeparat": false, "aktive_Jahre": 29, "Mitgliedsjahre": 29, "Ehrung_25_Jahre_aktiv": "2010-01-06T00:00:00", "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 46, "Geburtstag60": null, "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 560, "Anrede": "Herr", "Vorname": "Pius", "Vorstandsmitglied": false, "Nachname": "Müller, jun.", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Landsbergerstr. 18", "Unterdorf": true, "verzogen": false, "Geboren": "1969-03-20T00:00:00", "Telefon": "32049", "Mobiltelefon": "01626842822", "Eingetreten": "1985-01-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": null, "verstorben": null, "aktiv": true, "Einladung": true, "EinladungSeparat": false, "aktive_Jahre": 29, "Mitgliedsjahre": 29, "Ehrung_25_Jahre_aktiv": "2010-01-06T00:00:00", "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 44, "Geburtstag60": null, "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 561, "Anrede": "Herr", "Vorname": "Albert", "Vorstandsmitglied": false, "Nachname": "Müller", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Grüntenstr. 14", "Unterdorf": false, "verzogen": false, "Geboren": "1969-01-17T00:00:00", "Telefon": "30021", "Mobiltelefon": null, "Eingetreten": "1985-01-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "2009-01-01T00:00:00", "verstorben": null, "aktiv": true, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 24, "Mitgliedsjahre": 29, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 44, "Geburtstag60": null, "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 563, "Anrede": "Herr", "Vorname": "Hermann", "Vorstandsmitglied": false, "Nachname": "Schamberger", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Unterbergerstr. 10", "Unterdorf": true, "verzogen": false, "Geboren": "1970-08-16T00:00:00", "Telefon": null, "Mobiltelefon": null, "Eingetreten": "1987-04-23T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "2010-01-01T00:00:00", "verstorben": null, "aktiv": false, "Einladung": true, "EinladungSeparat": false, "aktive_Jahre": 22, "Mitgliedsjahre": 26, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 43, "Geburtstag60": null, "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 564, "Anrede": "Herr", "Vorname": "Andreas", "Vorstandsmitglied": false, "Nachname": "Mayer", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Steindorfer Str. 3", "Unterdorf": false, "verzogen": false, "Geboren": "1970-05-02T00:00:00", "Telefon": null, "Mobiltelefon": "015111336764", "Eingetreten": "1987-04-23T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "2012-01-01T00:00:00", "verstorben": null, "aktiv": false, "Einladung": true, "EinladungSeparat": false, "aktive_Jahre": 24, "Mitgliedsjahre": 26, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 43, "Geburtstag60": null, "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 565, "Anrede": "Herr", "Vorname": "Reinhard", "Vorstandsmitglied": false, "Nachname": "Bader", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Jahnstr. 4", "Unterdorf": false, "verzogen": false, "Geboren": "1958-03-14T00:00:00", "Telefon": "4434", "Mobiltelefon": "0176 53496786", "Eingetreten": "1973-10-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": null, "verstorben": null, "aktiv": true, "Einladung": true, "EinladungSeparat": false, "aktive_Jahre": 40, "Mitgliedsjahre": 40, "Ehrung_25_Jahre_aktiv": "2004-01-06T00:00:00", "Ehrung_40_Jahre_aktiv": "2013-09-13T00:00:00", "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 55, "Geburtstag60": null, "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 566, "Anrede": "Herr", "Vorname": "Ulrich", "Vorstandsmitglied": false, "Nachname": "Kistler", "PLZ": null, "Ort": null, "Straße": null, "Unterdorf": false, "verzogen": false, "Geboren": "1938-03-17T00:00:00", "Telefon": null, "Mobiltelefon": null, "Eingetreten": "1988-11-09T00:00:00", "Ausgetreten": null, "Übergang_Passiv": null, "verstorben": "1988-11-09T00:00:00", "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 0, "Mitgliedsjahre": 0, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 50, "Geburtstag60": "1998-03-17T00:00:00", "Beitrag": 0.0000, "verzogenDatum": "1996-01-01T00:00:00"},
    {"ID": 567, "Anrede": "Herr", "Vorname": "Josef", "Vorstandsmitglied": false, "Nachname": "Arnold", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Westendstr. 1", "Unterdorf": true, "verzogen": false, "Geboren": "1914-06-01T00:00:00", "Telefon": "92461", "Mobiltelefon": null, "Eingetreten": "1991-01-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": null, "verstorben": "2003-01-01T00:00:00", "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 12, "Mitgliedsjahre": 12, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 88, "Geburtstag60": "1974-06-01T00:00:00", "Beitrag": 0.0000, "verzogenDatum": null},
    {"ID": 568, "Anrede": "Herr", "Vorname": "Markus", "Vorstandsmitglied": true, "Nachname": "Storch", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Wittelsbacher Str. 9", "Unterdorf": false, "verzogen": false, "Geboren": "1970-11-05T00:00:00", "Telefon": "9632", "Mobiltelefon": "01601722778", "Eingetreten": "1988-01-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": null, "verstorben": null, "aktiv": true, "Einladung": true, "EinladungSeparat": false, "aktive_Jahre": 26, "Mitgliedsjahre": 26, "Ehrung_25_Jahre_aktiv": "2013-09-13T00:00:00", "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 43, "Geburtstag60": null, "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 569, "Anrede": "Herr", "Vorname": "Bernd", "Vorstandsmitglied": false, "Nachname": "Fabian", "PLZ": null, "Ort": "Kissing", "Straße": "Petersberg 24", "Unterdorf": false, "verzogen": true, "Geboren": "1969-04-26T00:00:00", "Telefon": "31112", "Mobiltelefon": null, "Eingetreten": "1990-11-07T00:00:00", "Ausgetreten": null, "Übergang_Passiv": null, "verstorben": null, "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 13, "Mitgliedsjahre": 13, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": null, "Geburtstag60": null, "Beitrag": 0.0000, "verzogenDatum": null},
    {"ID": 1233, "Anrede": "Herr", "Vorname": "Martin", "Vorstandsmitglied": false, "Nachname": "Rieger", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Hauptstr. 31", "Unterdorf": true, "verzogen": false, "Geboren": "1965-12-26T00:00:00", "Telefon": "31566", "Mobiltelefon": "01628290824", "Eingetreten": "2002-08-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": null, "verstorben": null, "aktiv": true, "Einladung": true, "EinladungSeparat": false, "aktive_Jahre": 11, "Mitgliedsjahre": 11, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 48, "Geburtstag60": null, "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 1234, "Anrede": "Herr", "Vorname": "Günter", "Vorstandsmitglied": false, "Nachname": "Wiedemann", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Untermühlstr. 27", "Unterdorf": true, "verzogen": false, "Geboren": "1962-07-31T00:00:00", "Telefon": null, "Mobiltelefon": null, "Eingetreten": "2002-07-31T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "2002-07-31T00:00:00", "verstorben": null, "aktiv": false, "Einladung": true, "EinladungSeparat": false, "aktive_Jahre": 0, "Mitgliedsjahre": 11, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 51, "Geburtstag60": null, "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 1235, "Anrede": "Herr", "Vorname": "Florian", "Vorstandsmitglied": false, "Nachname": "Alt", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Wendelsteinstr. 12a", "Unterdorf": false, "verzogen": false, "Geboren": "1988-01-14T00:00:00", "Telefon": "08233 30608", "Mobiltelefon": "017672355570", "Eingetreten": "2003-04-08T00:00:00", "Ausgetreten": null, "Übergang_Passiv": null, "verstorben": null, "aktiv": true, "Einladung": true, "EinladungSeparat": false, "aktive_Jahre": 10, "Mitgliedsjahre": 10, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 25, "Geburtstag60": null, "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 1236, "Anrede": "Herr", "Vorname": "André", "Vorstandsmitglied": false, "Nachname": "Kumar", "PLZ": 82297.0, "Ort": "Hofhegnenberg", "Straße": null, "Unterdorf": false, "verzogen": false, "Geboren": "1988-05-03T00:00:00", "Telefon": "08202/2194", "Mobiltelefon": null, "Eingetreten": "2003-04-08T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "2010-01-01T00:00:00", "verstorben": null, "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 6, "Mitgliedsjahre": 10, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 25, "Geburtstag60": null, "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 1237, "Anrede": "Herr", "Vorname": "Michael", "Vorstandsmitglied": false, "Nachname": "Pribil", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Paartalweg 5", "Unterdorf": true, "verzogen": false, "Geboren": "1989-03-31T00:00:00", "Telefon": "08233 4762", "Mobiltelefon": "01735963380", "Eingetreten": "2003-04-08T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "2010-01-01T00:00:00", "verstorben": null, "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 6, "Mitgliedsjahre": 10, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 24, "Geburtstag60": null, "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 1238, "Anrede": "Herr", "Vorname": "Tim", "Vorstandsmitglied": false, "Nachname": "Mühlberger", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Kirchfeldstr. 31", "Unterdorf": false, "verzogen": false, "Geboren": "1987-08-09T00:00:00", "Telefon": "08233/4410", "Mobiltelefon": null, "Eingetreten": "2003-04-08T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "2010-01-01T00:00:00", "verstorben": null, "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 6, "Mitgliedsjahre": 10, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 26, "Geburtstag60": null, "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 1239, "Anrede": "Herr", "Vorname": "Christian", "Vorstandsmitglied": false, "Nachname": "Jaser", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Wendelsteinstr. 3a", "Unterdorf": false, "verzogen": false, "Geboren": "1988-09-04T00:00:00", "Telefon": "08233 9566", "Mobiltelefon": "01777158522", "Eingetreten": "2003-04-08T00:00:00", "Ausgetreten": null, "Übergang_Passiv": null, "verstorben": null, "aktiv": true, "Einladung": true, "EinladungSeparat": false, "aktive_Jahre": 10, "Mitgliedsjahre": 10, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 25, "Geburtstag60": null, "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 1240, "Anrede": "Herr", "Vorname": "Daniel", "Vorstandsmitglied": false, "Nachname": "Kauth", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Nebelhornstr. 17", "Unterdorf": false, "verzogen": false, "Geboren": "1987-09-09T00:00:00", "Telefon": "08233 4431", "Mobiltelefon": "01718864255", "Eingetreten": "2003-04-08T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "2010-01-01T00:00:00", "verstorben": null, "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 6, "Mitgliedsjahre": 10, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 26, "Geburtstag60": null, "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 1241, "Anrede": "Herr", "Vorname": "Raphael", "Vorstandsmitglied": false, "Nachname": "Straub", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Landsbergerstr. 20", "Unterdorf": true, "verzogen": false, "Geboren": "1987-08-21T00:00:00", "Telefon": "08233/31071", "Mobiltelefon": "016091225504", "Eingetreten": "2003-04-08T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "2010-01-01T00:00:00", "verstorben": null, "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 6, "Mitgliedsjahre": 10, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 26, "Geburtstag60": null, "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 1242, "Anrede": "Herr", "Vorname": "Alexander", "Vorstandsmitglied": false, "Nachname": "Presky", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Lindenweg 1", "Unterdorf": true, "verzogen": false, "Geboren": "1988-12-10T00:00:00", "Telefon": "08233/30124", "Mobiltelefon": null, "Eingetreten": "2003-05-07T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "2010-01-01T00:00:00", "verstorben": null, "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 6, "Mitgliedsjahre": 10, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 25, "Geburtstag60": null, "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 1243, "Anrede": "Herr", "Vorname": "Dominik", "Vorstandsmitglied": true, "Nachname": "Semlinger", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Kolpingstr. 12", "Unterdorf": false, "verzogen": false, "Geboren": "1988-04-21T00:00:00", "Telefon": "08233 32010", "Mobiltelefon": "01626305155", "Eingetreten": "2003-05-20T00:00:00", "Ausgetreten": null, "Übergang_Passiv": null, "verstorben": null, "aktiv": true, "Einladung": true, "EinladungSeparat": false, "aktive_Jahre": 10, "Mitgliedsjahre": 10, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 25, "Geburtstag60": null, "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 1244, "Anrede": "Herr", "Vorname": "Martin", "Vorstandsmitglied": false, "Nachname": "Wecker", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Obermühlstr. 1", "Unterdorf": true, "verzogen": false, "Geboren": "1987-02-05T00:00:00", "Telefon": "08233 4707", "Mobiltelefon": "016090217447", "Eingetreten": "2003-08-23T00:00:00", "Ausgetreten": null, "Übergang_Passiv": null, "verstorben": null, "aktiv": true, "Einladung": true, "EinladungSeparat": false, "aktive_Jahre": 10, "Mitgliedsjahre": 10, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 26, "Geburtstag60": null, "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 1245, "Anrede": "Herr", "Vorname": "Michael", "Vorstandsmitglied": false, "Nachname": "Casper", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Eichenstr. 28", "Unterdorf": true, "verzogen": false, "Geboren": "1965-07-30T00:00:00", "Telefon": "738867", "Mobiltelefon": null, "Eingetreten": "2000-01-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "2012-12-10T00:00:00", "verstorben": "2014-08-11T00:00:00", "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 12, "Mitgliedsjahre": 14, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 48, "Geburtstag60": null, "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 1246, "Anrede": "Herr", "Vorname": "Andreas", "Vorstandsmitglied": false, "Nachname": "Jocher", "PLZ": 86931.0, "Ort": "Prittriching", "Straße": "Angerstr. 26", "Unterdorf": false, "verzogen": false, "Geboren": "1970-10-30T00:00:00", "Telefon": "08206 903253", "Mobiltelefon": null, "Eingetreten": "2003-09-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "2003-09-01T00:00:00", "verstorben": null, "aktiv": false, "Einladung": true, "EinladungSeparat": false, "aktive_Jahre": 0, "Mitgliedsjahre": 10, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 43, "Geburtstag60": null, "Beitrag": 0.0000, "verzogenDatum": null},
    {"ID": 1247, "Anrede": "Herr", "Vorname": "Harald", "Vorstandsmitglied": false, "Nachname": "Leyh", "PLZ": null, "Ort": "Königsbrunn", "Straße": null, "Unterdorf": false, "verzogen": true, "Geboren": "1968-07-06T00:00:00", "Telefon": null, "Mobiltelefon": null, "Eingetreten": "2004-04-26T00:00:00", "Ausgetreten": null, "Übergang_Passiv": null, "verstorben": null, "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 1, "Mitgliedsjahre": 1, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 37, "Geburtstag60": null, "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 1248, "Anrede": "Herr", "Vorname": "Andreas", "Vorstandsmitglied": false, "Nachname": "Pribil", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Paartalweg 5", "Unterdorf": true, "verzogen": false, "Geboren": "1986-12-01T00:00:00", "Telefon": "08233 4762", "Mobiltelefon": "01733884993", "Eingetreten": "1999-01-06T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "2010-01-01T00:00:00", "verstorben": null, "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 10, "Mitgliedsjahre": 15, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 27, "Geburtstag60": null, "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 1249, "Anrede": "Herr", "Vorname": "Christian", "Vorstandsmitglied": false, "Nachname": "Rinkes", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Wiesenstr. 4a", "Unterdorf": true, "verzogen": false, "Geboren": "1987-06-18T00:00:00", "Telefon": "08233 4655", "Mobiltelefon": "01716254787", "Eingetreten": "2005-06-30T00:00:00", "Ausgetreten": null, "Übergang_Passiv": null, "verstorben": null, "aktiv": true, "Einladung": true, "EinladungSeparat": false, "aktive_Jahre": 8, "Mitgliedsjahre": 8, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 26, "Geburtstag60": null, "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 1250, "Anrede": "Herr", "Vorname": "Andreas", "Vorstandsmitglied": false, "Nachname": "Beistle", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Lindenweg 4", "Unterdorf": true, "verzogen": false, "Geboren": "1989-05-19T00:00:00", "Telefon": "08233 31810", "Mobiltelefon": "01726390122", "Eingetreten": "2005-04-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "2012-12-10T00:00:00", "verstorben": null, "aktiv": false, "Einladung": true, "EinladungSeparat": false, "aktive_Jahre": 7, "Mitgliedsjahre": 8, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 24, "Geburtstag60": null, "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 1251, "Anrede": "Herr", "Vorname": "Michael", "Vorstandsmitglied": true, "Nachname": "Alt", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Steindorfer Str. 13", "Unterdorf": false, "verzogen": false, "Geboren": "1986-03-08T00:00:00", "Telefon": null, "Mobiltelefon": "01754183275", "Eingetreten": "2005-07-11T00:00:00", "Ausgetreten": null, "Übergang_Passiv": null, "verstorben": null, "aktiv": true, "Einladung": true, "EinladungSeparat": false, "aktive_Jahre": 8, "Mitgliedsjahre": 8, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 27, "Geburtstag60": null, "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 1252, "Anrede": "Herr", "Vorname": "Michael", "Vorstandsmitglied": false, "Nachname": "Wecker", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Obermühlstr. 1", "Unterdorf": true, "verzogen": false, "Geboren": "1991-10-30T00:00:00", "Telefon": "08233 4707", "Mobiltelefon": "015203250664", "Eingetreten": "2005-04-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "2010-01-01T00:00:00", "verstorben": null, "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 4, "Mitgliedsjahre": 8, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 22, "Geburtstag60": null, "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 1253, "Anrede": "Herr", "Vorname": "Sebastian", "Vorstandsmitglied": true, "Nachname": "Steinhart", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Raiffeisenring 3", "Unterdorf": false, "verzogen": false, "Geboren": "1989-10-18T00:00:00", "Telefon": "08233 30665", "Mobiltelefon": "01743786712", "Eingetreten": "2005-07-07T00:00:00", "Ausgetreten": null, "Übergang_Passiv": null, "verstorben": null, "aktiv": true, "Einladung": true, "EinladungSeparat": true, "aktive_Jahre": 8, "Mitgliedsjahre": 8, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 24, "Geburtstag60": null, "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 1254, "Anrede": "Herr", "Vorname": "Johannes", "Vorstandsmitglied": false, "Nachname": "Kauth", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Zugspitzstr. 7", "Unterdorf": false, "verzogen": false, "Geboren": "1989-06-30T00:00:00", "Telefon": "08233 4821", "Mobiltelefon": "015141229928", "Eingetreten": "2005-03-15T00:00:00", "Ausgetreten": null, "Übergang_Passiv": null, "verstorben": null, "aktiv": true, "Einladung": true, "EinladungSeparat": false, "aktive_Jahre": 8, "Mitgliedsjahre": 8, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 24, "Geburtstag60": null, "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 1255, "Anrede": "Herr", "Vorname": "Stefan", "Vorstandsmitglied": false, "Nachname": "Danner", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Lindenweg 5", "Unterdorf": true, "verzogen": false, "Geboren": "1990-09-20T00:00:00", "Telefon": "08233 20963", "Mobiltelefon": "015206417019", "Eingetreten": "2005-04-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "2010-01-01T00:00:00", "verstorben": null, "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 4, "Mitgliedsjahre": 8, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 23, "Geburtstag60": null, "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 1256, "Anrede": "Herr", "Vorname": "Andreas", "Vorstandsmitglied": false, "Nachname": "Steinhart", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Karwendelstr. 9", "Unterdorf": false, "verzogen": false, "Geboren": "1974-05-13T00:00:00", "Telefon": null, "Mobiltelefon": null, "Eingetreten": "2005-07-24T00:00:00", "Ausgetreten": null, "Übergang_Passiv": null, "verstorben": null, "aktiv": true, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 8, "Mitgliedsjahre": 8, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 39, "Geburtstag60": null, "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 1257, "Anrede": "Herr", "Vorname": "Fatih", "Vorstandsmitglied": false, "Nachname": "Aydin", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Kirchstr. 16", "Unterdorf": false, "verzogen": false, "Geboren": "1985-12-19T00:00:00", "Telefon": "08233 30875", "Mobiltelefon": "017683002062", "Eingetreten": "2006-01-25T00:00:00", "Ausgetreten": null, "Übergang_Passiv": null, "verstorben": null, "aktiv": true, "Einladung": true, "EinladungSeparat": false, "aktive_Jahre": 7, "Mitgliedsjahre": 7, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 28, "Geburtstag60": null, "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 1258, "Anrede": "Herr", "Vorname": "Herbert", "Vorstandsmitglied": false, "Nachname": "Sappl", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Herbstgasse 7", "Unterdorf": true, "verzogen": false, "Geboren": "1962-07-26T00:00:00", "Telefon": "08233 4916", "Mobiltelefon": null, "Eingetreten": "2007-01-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "2007-01-01T00:00:00", "verstorben": null, "aktiv": false, "Einladung": true, "EinladungSeparat": false, "aktive_Jahre": 0, "Mitgliedsjahre": 7, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 51, "Geburtstag60": null, "Beitrag": 0.0000, "verzogenDatum": null},
    {"ID": 1259, "Anrede": "Herr", "Vorname": "Thomas", "Vorstandsmitglied": false, "Nachname": "Müller", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Schulweg 1b", "Unterdorf": true, "verzogen": false, "Geboren": "1964-08-31T00:00:00", "Telefon": "1369", "Mobiltelefon": "01775340145", "Eingetreten": "1981-04-03T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "2010-01-01T00:00:00", "verstorben": null, "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 28, "Mitgliedsjahre": 32, "Ehrung_25_Jahre_aktiv": "2009-01-06T00:00:00", "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 49, "Geburtstag60": null, "Beitrag": 0.0000, "verzogenDatum": null},
    {"ID": 1260, "Anrede": "Herr", "Vorname": "Dominik", "Vorstandsmitglied": false, "Nachname": "Jakob", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Kirchstr. 7", "Unterdorf": false, "verzogen": false, "Geboren": "1992-07-11T00:00:00", "Telefon": null, "Mobiltelefon": "01624259237", "Eingetreten": "2008-06-05T00:00:00", "Ausgetreten": null, "Übergang_Passiv": null, "verstorben": null, "aktiv": true, "Einladung": true, "EinladungSeparat": false, "aktive_Jahre": 5, "Mitgliedsjahre": 5, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 21, "Geburtstag60": null, "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 1261, "Anrede": "Frau", "Vorname": "Sarah", "Vorstandsmitglied": false, "Nachname": "Steinhart", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Raiffeisenring 3", "Unterdorf": false, "verzogen": false, "Geboren": "1992-03-09T00:00:00", "Telefon": "08233 30665", "Mobiltelefon": "015786066882", "Eingetreten": "2008-04-10T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "2012-12-10T00:00:00", "verstorben": null, "aktiv": false, "Einladung": true, "EinladungSeparat": true, "aktive_Jahre": 4, "Mitgliedsjahre": 5, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 21, "Geburtstag60": null, "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 1262, "Anrede": "Frau", "Vorname": "Christina", "Vorstandsmitglied": false, "Nachname": "Müller", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Grüntenstr. 14", "Unterdorf": false, "verzogen": false, "Geboren": "1993-05-14T00:00:00", "Telefon": "08233 30021", "Mobiltelefon": "015205869053", "Eingetreten": "2008-05-26T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "2012-12-10T00:00:00", "verstorben": null, "aktiv": false, "Einladung": true, "EinladungSeparat": false, "aktive_Jahre": 4, "Mitgliedsjahre": 5, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 20, "Geburtstag60": null, "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 1263, "Anrede": "Herr", "Vorname": "Felix", "Vorstandsmitglied": false, "Nachname": "Teike", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Landsbergerstr. 27", "Unterdorf": false, "verzogen": false, "Geboren": "1993-03-14T00:00:00", "Telefon": "08233 31744", "Mobiltelefon": null, "Eingetreten": "2008-06-18T00:00:00", "Ausgetreten": null, "Übergang_Passiv": null, "verstorben": null, "aktiv": true, "Einladung": true, "EinladungSeparat": false, "aktive_Jahre": 5, "Mitgliedsjahre": 5, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 20, "Geburtstag60": null, "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 1264, "Anrede": "Herr", "Vorname": "Andreas", "Vorstandsmitglied": false, "Nachname": "Kerber", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Hauptstr. 36", "Unterdorf": false, "verzogen": false, "Geboren": "1992-03-13T00:00:00", "Telefon": "08233 1222", "Mobiltelefon": null, "Eingetreten": "2008-06-18T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "2012-12-10T00:00:00", "verstorben": null, "aktiv": false, "Einladung": true, "EinladungSeparat": false, "aktive_Jahre": 4, "Mitgliedsjahre": 5, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 21, "Geburtstag60": null, "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 1265, "Anrede": "Herr", "Vorname": "Alexander", "Vorstandsmitglied": false, "Nachname": "Fernandes-Köhler", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Eichenstr. 6", "Unterdorf": true, "verzogen": false, "Geboren": "1993-06-27T00:00:00", "Telefon": "08233 795882", "Mobiltelefon": "015227678393", "Eingetreten": "2008-05-26T00:00:00", "Ausgetreten": null, "Übergang_Passiv": null, "verstorben": null, "aktiv": true, "Einladung": true, "EinladungSeparat": false, "aktive_Jahre": 5, "Mitgliedsjahre": 5, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 20, "Geburtstag60": null, "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 1266, "Anrede": "Frau", "Vorname": "Franziska", "Vorstandsmitglied": false, "Nachname": "Benja", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Angerweg 1a", "Unterdorf": true, "verzogen": false, "Geboren": "1992-05-14T00:00:00", "Telefon": "08233 1814", "Mobiltelefon": "01626188773", "Eingetreten": "2008-04-10T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "2012-12-10T00:00:00", "verstorben": null, "aktiv": false, "Einladung": true, "EinladungSeparat": false, "aktive_Jahre": 4, "Mitgliedsjahre": 5, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 21, "Geburtstag60": null, "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 1267, "Anrede": "Herr", "Vorname": "Maurus", "Vorstandsmitglied": false, "Nachname": "Metzger", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Hauptstr. 27", "Unterdorf": true, "verzogen": false, "Geboren": "1993-04-22T00:00:00", "Telefon": "08233 30323", "Mobiltelefon": "01758517382", "Eingetreten": "2008-05-08T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "2012-12-10T00:00:00", "verstorben": null, "aktiv": false, "Einladung": true, "EinladungSeparat": false, "aktive_Jahre": 4, "Mitgliedsjahre": 5, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 20, "Geburtstag60": null, "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 1268, "Anrede": "Herr", "Vorname": "Tobias", "Vorstandsmitglied": false, "Nachname": "Luichtl", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Wendelsteinstr. 9", "Unterdorf": false, "verzogen": false, "Geboren": "1995-11-09T00:00:00", "Telefon": "08233 4882", "Mobiltelefon": "017621950566", "Eingetreten": "2009-05-13T00:00:00", "Ausgetreten": null, "Übergang_Passiv": null, "verstorben": null, "aktiv": true, "Einladung": true, "EinladungSeparat": false, "aktive_Jahre": 4, "Mitgliedsjahre": 4, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 18, "Geburtstag60": null, "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 1269, "Anrede": "Herr", "Vorname": "Sebastian", "Vorstandsmitglied": false, "Nachname": "Grad", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Nebelhornstr. 9", "Unterdorf": false, "verzogen": false, "Geboren": "1984-09-14T00:00:00", "Telefon": null, "Mobiltelefon": null, "Eingetreten": "2009-12-23T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "2009-12-23T00:00:00", "verstorben": null, "aktiv": true, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 0, "Mitgliedsjahre": 4, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 29, "Geburtstag60": null, "Beitrag": 0.0000, "verzogenDatum": null},
    {"ID": 1270, "Anrede": "Herr", "Vorname": "Thomas", "Vorstandsmitglied": false, "Nachname": "Wagner", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Wittelsbacherstr. 20", "Unterdorf": false, "verzogen": false, "Geboren": "1974-09-06T00:00:00", "Telefon": "08233 735810", "Mobiltelefon": "0163 8207073", "Eingetreten": "2010-03-03T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "2010-03-03T00:00:00", "verstorben": null, "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 0, "Mitgliedsjahre": 3, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 39, "Geburtstag60": null, "Beitrag": 0.0000, "verzogenDatum": null},
    {"ID": 1271, "Anrede": "Herr", "Vorname": "Tobias", "Vorstandsmitglied": false, "Nachname": "Paa", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Nebelhornstr. 6", "Unterdorf": false, "verzogen": false, "Geboren": "1984-02-04T00:00:00", "Telefon": "08233 9868", "Mobiltelefon": "0163 7477127", "Eingetreten": "2010-03-08T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "2010-03-08T00:00:00", "verstorben": null, "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 0, "Mitgliedsjahre": 3, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 29, "Geburtstag60": null, "Beitrag": 0.0000, "verzogenDatum": null},
    {"ID": 1272, "Anrede": "Herr", "Vorname": "Johannes", "Vorstandsmitglied": false, "Nachname": "Sappl", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Herbstgasse 7", "Unterdorf": true, "verzogen": false, "Geboren": "1996-01-27T00:00:00", "Telefon": "08233 4916", "Mobiltelefon": "01632183084", "Eingetreten": "2010-06-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": null, "verstorben": null, "aktiv": true, "Einladung": true, "EinladungSeparat": false, "aktive_Jahre": 3, "Mitgliedsjahre": 3, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 17, "Geburtstag60": null, "Beitrag": 0.0000, "verzogenDatum": null},
    {"ID": 1273, "Anrede": "Herr", "Vorname": "Matthias", "Vorstandsmitglied": false, "Nachname": "Sappl", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Herbstgasse 7", "Unterdorf": true, "verzogen": false, "Geboren": "1992-08-27T00:00:00", "Telefon": null, "Mobiltelefon": null, "Eingetreten": "2010-11-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": "2010-11-01T00:00:00", "verstorben": null, "aktiv": false, "Einladung": true, "EinladungSeparat": false, "aktive_Jahre": 0, "Mitgliedsjahre": 3, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 21, "Geburtstag60": null, "Beitrag": 0.0000, "verzogenDatum": null},
    {"ID": 1274, "Anrede": "Herr", "Vorname": "Michael", "Vorstandsmitglied": false, "Nachname": "Weiß", "PLZ": 86511.0, "Ort": "Unterbergen", "Straße": "Hauptstr. 22", "Unterdorf": false, "verzogen": false, "Geboren": "1992-07-17T00:00:00", "Telefon": "08233 4996", "Mobiltelefon": "015125318772", "Eingetreten": "2011-08-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": null, "verstorben": null, "aktiv": true, "Einladung": true, "EinladungSeparat": false, "aktive_Jahre": 2, "Mitgliedsjahre": 2, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 21, "Geburtstag60": null, "Beitrag": 0.0000, "verzogenDatum": null},
    {"ID": 1275, "Anrede": "Herr", "Vorname": "Georg", "Vorstandsmitglied": false, "Nachname": "Eidelsburger", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Kirchstr. 1", "Unterdorf": false, "verzogen": false, "Geboren": "1994-06-23T00:00:00", "Telefon": null, "Mobiltelefon": "017666856341", "Eingetreten": "2011-06-30T00:00:00", "Ausgetreten": null, "Übergang_Passiv": null, "verstorben": null, "aktiv": true, "Einladung": true, "EinladungSeparat": false, "aktive_Jahre": 2, "Mitgliedsjahre": 2, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 19, "Geburtstag60": null, "Beitrag": 0.0000, "verzogenDatum": null},
    {"ID": 1276, "Anrede": "Frau", "Vorname": "Laura", "Vorstandsmitglied": false, "Nachname": "Rebitzer", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Carl-Theodor-Str. 13", "Unterdorf": false, "verzogen": false, "Geboren": "1995-09-16T00:00:00", "Telefon": "08233 31719", "Mobiltelefon": "0170 6201488", "Eingetreten": "2011-06-30T00:00:00", "Ausgetreten": "2012-04-01T00:00:00", "Übergang_Passiv": null, "verstorben": null, "aktiv": true, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 2, "Mitgliedsjahre": 2, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 18, "Geburtstag60": null, "Beitrag": 0.0000, "verzogenDatum": null},
    {"ID": 1277, "Anrede": "Herr", "Vorname": "Nicolai", "Vorstandsmitglied": false, "Nachname": "Buchanzow", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Eichenstr. 2c", "Unterdorf": true, "verzogen": false, "Geboren": "1996-04-29T00:00:00", "Telefon": "08233 795335", "Mobiltelefon": "015229540155", "Eingetreten": "2011-06-09T00:00:00", "Ausgetreten": null, "Übergang_Passiv": null, "verstorben": null, "aktiv": true, "Einladung": true, "EinladungSeparat": false, "aktive_Jahre": 2, "Mitgliedsjahre": 2, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 17, "Geburtstag60": null, "Beitrag": 0.0000, "verzogenDatum": null},
    {"ID": 1278, "Anrede": "Frau", "Vorname": "Katharina", "Vorstandsmitglied": false, "Nachname": "Buchanzow", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Eichenstr. 2c", "Unterdorf": true, "verzogen": false, "Geboren": "1994-06-25T00:00:00", "Telefon": "08233 795335", "Mobiltelefon": "015228686927", "Eingetreten": "2011-04-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": null, "verstorben": null, "aktiv": true, "Einladung": true, "EinladungSeparat": false, "aktive_Jahre": 2, "Mitgliedsjahre": 2, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 19, "Geburtstag60": null, "Beitrag": 0.0000, "verzogenDatum": null},
    {"ID": 1279, "Anrede": "Herr", "Vorname": "Leonard", "Vorstandsmitglied": false, "Nachname": "Bähr", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Nebelhornstr. 3", "Unterdorf": false, "verzogen": false, "Geboren": "1994-08-04T00:00:00", "Telefon": "08233 795115", "Mobiltelefon": "017682906225", "Eingetreten": "2011-04-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": null, "verstorben": null, "aktiv": true, "Einladung": true, "EinladungSeparat": false, "aktive_Jahre": 2, "Mitgliedsjahre": 2, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 19, "Geburtstag60": null, "Beitrag": 0.0000, "verzogenDatum": null},
    {"ID": 1280, "Anrede": "Herr", "Vorname": "Kevin", "Vorstandsmitglied": false, "Nachname": "Bernhard", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Bahnhofstr. 9", "Unterdorf": true, "verzogen": false, "Geboren": "1996-02-29T00:00:00", "Telefon": "08233 4445", "Mobiltelefon": "017684104890", "Eingetreten": "2011-02-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": null, "verstorben": null, "aktiv": true, "Einladung": true, "EinladungSeparat": false, "aktive_Jahre": 2, "Mitgliedsjahre": 2, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 17, "Geburtstag60": null, "Beitrag": 0.0000, "verzogenDatum": null},
    {"ID": 1281, "Anrede": "Herr", "Vorname": "Wolfgang, jun.", "Vorstandsmitglied": false, "Nachname": "Teifelhart", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Brunnen 1", "Unterdorf": false, "verzogen": false, "Geboren": "1995-04-29T00:00:00", "Telefon": "08233 9308", "Mobiltelefon": "0163 1340855", "Eingetreten": "2011-07-07T00:00:00", "Ausgetreten": null, "Übergang_Passiv": null, "verstorben": null, "aktiv": true, "Einladung": true, "EinladungSeparat": false, "aktive_Jahre": 2, "Mitgliedsjahre": 2, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 18, "Geburtstag60": null, "Beitrag": 0.0000, "verzogenDatum": null},
    {"ID": 1282, "Anrede": "Herr", "Vorname": "Andreas", "Vorstandsmitglied": false, "Nachname": "Bitterer", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Karwendelstr. 6", "Unterdorf": false, "verzogen": false, "Geboren": "1983-05-01T00:00:00", "Telefon": null, "Mobiltelefon": "015229601418", "Eingetreten": "2011-10-14T00:00:00", "Ausgetreten": null, "Übergang_Passiv": null, "verstorben": null, "aktiv": true, "Einladung": true, "EinladungSeparat": false, "aktive_Jahre": 2, "Mitgliedsjahre": 2, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 30, "Geburtstag60": null, "Beitrag": 0.0000, "verzogenDatum": null},
    {"ID": 1283, "Anrede": "Herr", "Vorname": "Johannes", "Vorstandsmitglied": false, "Nachname": "Stadtherr", "PLZ": 86504.0, "Ort": "Merching", "Straße": "St. Martin Str. 14", "Unterdorf": false, "verzogen": false, "Geboren": "1995-09-08T00:00:00", "Telefon": "31883", "Mobiltelefon": "015774686504", "Eingetreten": "2012-04-16T00:00:00", "Ausgetreten": null, "Übergang_Passiv": null, "verstorben": null, "aktiv": true, "Einladung": true, "EinladungSeparat": false, "aktive_Jahre": 1, "Mitgliedsjahre": 1, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 18, "Geburtstag60": null, "Beitrag": 0.0000, "verzogenDatum": null},
    {"ID": 1284, "Anrede": "Herr", "Vorname": "Christopher", "Vorstandsmitglied": false, "Nachname": "Lindermeir", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Hauptstr. 2", "Unterdorf": false, "verzogen": true, "Geboren": "1983-04-12T00:00:00", "Telefon": null, "Mobiltelefon": "017610112887", "Eingetreten": "2013-03-22T00:00:00", "Ausgetreten": "2013-12-31T00:00:00", "Übergang_Passiv": null, "verstorben": null, "aktiv": true, "Einladung": true, "EinladungSeparat": false, "aktive_Jahre": 0, "Mitgliedsjahre": 0, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 30, "Geburtstag60": null, "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 1285, "Anrede": "Herr", "Vorname": "Thomas", "Vorstandsmitglied": false, "Nachname": "Zinke", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Kirchstr. 1", "Unterdorf": false, "verzogen": false, "Geboren": "1997-11-12T00:00:00", "Telefon": "7970808", "Mobiltelefon": "017636293816", "Eingetreten": "2013-08-27T00:00:00", "Ausgetreten": null, "Übergang_Passiv": null, "verstorben": null, "aktiv": true, "Einladung": true, "EinladungSeparat": false, "aktive_Jahre": 0, "Mitgliedsjahre": 0, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 16, "Geburtstag60": null, "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 1286, "Anrede": "Herr", "Vorname": "Andreas", "Vorstandsmitglied": false, "Nachname": "Steinhart", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Raiffeisenring 3", "Unterdorf": false, "verzogen": false, "Geboren": "1999-07-13T00:00:00", "Telefon": "30665", "Mobiltelefon": "015735326177", "Eingetreten": "2013-10-24T00:00:00", "Ausgetreten": null, "Übergang_Passiv": null, "verstorben": null, "aktiv": true, "Einladung": true, "EinladungSeparat": false, "aktive_Jahre": 0, "Mitgliedsjahre": 0, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 14, "Geburtstag60": null, "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 1287, "Anrede": "Herr", "Vorname": "Maximilian", "Vorstandsmitglied": false, "Nachname": "Mayer", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Kreuzeckstr. 9", "Unterdorf": false, "verzogen": false, "Geboren": "1999-01-28T00:00:00", "Telefon": "92342", "Mobiltelefon": null, "Eingetreten": "2013-10-02T00:00:00", "Ausgetreten": null, "Übergang_Passiv": null, "verstorben": null, "aktiv": true, "Einladung": true, "EinladungSeparat": false, "aktive_Jahre": 0, "Mitgliedsjahre": 0, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 14, "Geburtstag60": null, "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 1288, "Anrede": "Herr", "Vorname": "Julian", "Vorstandsmitglied": false, "Nachname": "Rebitzer", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Carl-Theodor-Str. 13", "Unterdorf": false, "verzogen": false, "Geboren": "1999-05-15T00:00:00", "Telefon": "31719", "Mobiltelefon": "01706201487", "Eingetreten": "2013-10-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": null, "verstorben": null, "aktiv": true, "Einladung": true, "EinladungSeparat": false, "aktive_Jahre": 0, "Mitgliedsjahre": 0, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 14, "Geburtstag60": null, "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 1289, "Anrede": "Herr", "Vorname": "Martin", "Vorstandsmitglied": false, "Nachname": "Wiedemann", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Untermühlstr. 27", "Unterdorf": true, "verzogen": false, "Geboren": "1997-05-03T00:00:00", "Telefon": "1789", "Mobiltelefon": "015784614590", "Eingetreten": "2013-10-17T00:00:00", "Ausgetreten": null, "Übergang_Passiv": null, "verstorben": null, "aktiv": true, "Einladung": true, "EinladungSeparat": false, "aktive_Jahre": 0, "Mitgliedsjahre": 0, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 16, "Geburtstag60": null, "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 1290, "Anrede": "Herr", "Vorname": "Lukas", "Vorstandsmitglied": false, "Nachname": "Storch", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Wittelsbacherstr. 9", "Unterdorf": false, "verzogen": false, "Geboren": "1997-09-29T00:00:00", "Telefon": "7796942", "Mobiltelefon": "015734228937", "Eingetreten": "2013-10-16T00:00:00", "Ausgetreten": null, "Übergang_Passiv": null, "verstorben": null, "aktiv": true, "Einladung": true, "EinladungSeparat": false, "aktive_Jahre": 0, "Mitgliedsjahre": 0, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 16, "Geburtstag60": null, "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 1291, "Anrede": "Herr", "Vorname": "Jakob", "Vorstandsmitglied": false, "Nachname": "Storch", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Wittelsbacherstr. 9", "Unterdorf": false, "verzogen": false, "Geboren": "1999-03-19T00:00:00", "Telefon": "7796942", "Mobiltelefon": "015788759297", "Eingetreten": "2013-10-16T00:00:00", "Ausgetreten": null, "Übergang_Passiv": null, "verstorben": null, "aktiv": true, "Einladung": true, "EinladungSeparat": false, "aktive_Jahre": 0, "Mitgliedsjahre": 0, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 14, "Geburtstag60": null, "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 1292, "Anrede": "Herr", "Vorname": "Florian", "Vorstandsmitglied": false, "Nachname": "Kandziora", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Nebelhornstr. 12", "Unterdorf": false, "verzogen": false, "Geboren": "2001-01-02T00:00:00", "Telefon": "736680", "Mobiltelefon": "01731313663", "Eingetreten": "2013-10-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": null, "verstorben": null, "aktiv": true, "Einladung": true, "EinladungSeparat": false, "aktive_Jahre": 0, "Mitgliedsjahre": 0, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 13, "Geburtstag60": null, "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 1293, "Anrede": "Herr", "Vorname": "Tobias", "Vorstandsmitglied": false, "Nachname": "Koch", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Kolpingstr. 17a", "Unterdorf": false, "verzogen": false, "Geboren": "2000-08-09T00:00:00", "Telefon": "31610", "Mobiltelefon": null, "Eingetreten": "2013-10-12T00:00:00", "Ausgetreten": null, "Übergang_Passiv": null, "verstorben": null, "aktiv": true, "Einladung": true, "EinladungSeparat": false, "aktive_Jahre": 0, "Mitgliedsjahre": 0, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 13, "Geburtstag60": null, "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 1294, "Anrede": "Herr", "Vorname": "Matthäus", "Vorstandsmitglied": false, "Nachname": "Schiffmann", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Hauptstr. 34", "Unterdorf": false, "verzogen": false, "Geboren": "1998-12-07T00:00:00", "Telefon": "30896", "Mobiltelefon": "015784071003", "Eingetreten": "2013-10-13T00:00:00", "Ausgetreten": null, "Übergang_Passiv": null, "verstorben": null, "aktiv": true, "Einladung": true, "EinladungSeparat": false, "aktive_Jahre": 0, "Mitgliedsjahre": 0, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 15, "Geburtstag60": null, "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 1295, "Anrede": "Herr", "Vorname": "Louis", "Vorstandsmitglied": false, "Nachname": "Falk", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Untermühlstr. 2", "Unterdorf": true, "verzogen": false, "Geboren": "2001-07-18T00:00:00", "Telefon": "31773", "Mobiltelefon": "015787878848", "Eingetreten": "2013-10-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": null, "verstorben": null, "aktiv": true, "Einladung": true, "EinladungSeparat": false, "aktive_Jahre": 0, "Mitgliedsjahre": 0, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 12, "Geburtstag60": null, "Beitrag": 0.0000, "verzogenDatum": null},
    {"ID": 1296, "Anrede": "Herr", "Vorname": "Cedric", "Vorstandsmitglied": false, "Nachname": "Falk", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Untermühlstr. 2", "Unterdorf": true, "verzogen": false, "Geboren": "2001-07-18T00:00:00", "Telefon": "31773", "Mobiltelefon": "015786827417", "Eingetreten": "2013-10-01T00:00:00", "Ausgetreten": null, "Übergang_Passiv": null, "verstorben": null, "aktiv": true, "Einladung": true, "EinladungSeparat": false, "aktive_Jahre": 0, "Mitgliedsjahre": 0, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 12, "Geburtstag60": null, "Beitrag": 0.0000, "verzogenDatum": null},
    {"ID": 1297, "Anrede": "Herr", "Vorname": "Stefan", "Vorstandsmitglied": false, "Nachname": "Sanktjohanser", "PLZ": 86504.0, "Ort": "Merching", "Straße": null, "Unterdorf": false, "verzogen": false, "Geboren": null, "Telefon": null, "Mobiltelefon": "016099196307", "Eingetreten": "2014-01-06T00:00:00", "Ausgetreten": null, "Übergang_Passiv": null, "verstorben": null, "aktiv": true, "Einladung": true, "EinladungSeparat": false, "aktive_Jahre": 0, "Mitgliedsjahre": 0, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 0, "Geburtstag60": null, "Beitrag": 7.0000, "verzogenDatum": null},
    {"ID": 1298, "Anrede": "Herr", "Vorname": "Arno", "Vorstandsmitglied": false, "Nachname": "Schwenninger", "PLZ": 86504.0, "Ort": "Merching", "Straße": "Kolpingstr.", "Unterdorf": false, "verzogen": false, "Geboren": null, "Telefon": null, "Mobiltelefon": null, "Eingetreten": "2014-01-06T00:00:00", "Ausgetreten": null, "Übergang_Passiv": null, "verstorben": null, "aktiv": false, "Einladung": false, "EinladungSeparat": false, "aktive_Jahre": 0, "Mitgliedsjahre": 0, "Ehrung_25_Jahre_aktiv": null, "Ehrung_40_Jahre_aktiv": null, "Ehrennadel_Silber": null, "Ehrennadel_Gold": null, "Ehrung_60_Jahre": null, "Ehrenkreuz_Silber": null, "Ehrenkreuz_Gold": null, "Ehrenmitgliedschaft": null, "Alter": 0, "Geburtstag60": null, "Beitrag": 7.0000, "verzogenDatum": null}
];

var ffwFunktionen = [
    {"IdFunktion": 1, "Name": "Schriftführer"},
    {"IdFunktion": 2, "Name": "Beisitzer"},
    {"IdFunktion": 3, "Name": "Kassenrevisor"},
    {"IdFunktion": 4, "Name": "Kassier"},
    {"IdFunktion": 5, "Name": "1. Kommandant"},
    {"IdFunktion": 6, "Name": "2. Kommandant"},
    {"IdFunktion": 7, "Name": "1. Vorsitzender"},
    {"IdFunktion": 8, "Name": "Fahnenträger"},
    {"IdFunktion": 9, "Name": "Fahnenbegleitung"},
    {"IdFunktion": 10, "Name": "Zeugwart"},
    {"IdFunktion": 11, "Name": "Kreisbrandmeister"},
    {"IdFunktion": 13, "Name": "Atemschutz"},
    {"IdFunktion": 14, "Name": "Jugendwart"},
    {"IdFunktion": 15, "Name": "Ehren-KBM"},
    {"IdFunktion": 16, "Name": "Ehrenmitglied"}
];

var ffwMitgliederFunktionen = [
    {"IdMitglied": 1243, "IdFunktion": 2, "Beginn": "2013-01-06T00:00:00", "Ende": null},
    {"IdMitglied": 1253, "IdFunktion": 3, "Beginn": "2013-01-06T00:00:00", "Ende": null},
    {"IdMitglied": 72, "IdFunktion": 8, "Beginn": "1996-05-17T00:00:00", "Ende": null},
    {"IdMitglied": 110, "IdFunktion": 9, "Beginn": "1996-05-17T00:00:00", "Ende": null},
    {"IdMitglied": 244, "IdFunktion": 3, "Beginn": "1949-01-06T00:00:00", "Ende": null},
    {"IdMitglied": 255, "IdFunktion": 1, "Beginn": "1959-01-06T00:00:00", "Ende": "1995-01-06T00:00:00"},
    {"IdMitglied": 259, "IdFunktion": 2, "Beginn": "1959-01-06T00:00:00", "Ende": "1964-01-06T00:00:00"},
    {"IdMitglied": 259, "IdFunktion": 5, "Beginn": "1949-03-06T00:00:00", "Ende": "1958-01-06T00:00:00"},
    {"IdMitglied": 260, "IdFunktion": 4, "Beginn": "1949-03-06T00:00:00", "Ende": "1960-12-25T00:00:00"},
    {"IdMitglied": 271, "IdFunktion": 3, "Beginn": "1967-01-01T00:00:00", "Ende": "1995-01-06T00:00:00"},
    {"IdMitglied": 274, "IdFunktion": 4, "Beginn": "1948-01-11T00:00:00", "Ende": "1949-03-06T00:00:00"},
    {"IdMitglied": 274, "IdFunktion": 6, "Beginn": "1949-03-06T00:00:00", "Ende": "1994-04-07T00:00:00"},
    {"IdMitglied": 277, "IdFunktion": 5, "Beginn": "1970-01-10T00:00:00", "Ende": "1983-01-06T00:00:00"},
    {"IdMitglied": 282, "IdFunktion": 4, "Beginn": "1960-12-26T00:00:00", "Ende": "1995-01-06T00:00:00"},
    {"IdMitglied": 298, "IdFunktion": 9, "Beginn": "1952-01-01T00:00:00", "Ende": "2000-01-01T00:00:00"},
    {"IdMitglied": 300, "IdFunktion": 9, "Beginn": "1952-01-01T00:00:00", "Ende": "2000-12-31T00:00:00"},
    {"IdMitglied": 304, "IdFunktion": 6, "Beginn": "1958-01-06T00:00:00", "Ende": "1983-01-06T00:00:00"},
    {"IdMitglied": 414, "IdFunktion": 5, "Beginn": "1989-01-06T00:00:00", "Ende": "2001-01-06T00:00:00"},
    {"IdMitglied": 515, "IdFunktion": 4, "Beginn": "2001-01-06T00:00:00", "Ende": null},
    {"IdMitglied": 515, "IdFunktion": 9, "Beginn": "1996-05-17T00:00:00", "Ende": null},
    {"IdMitglied": 531, "IdFunktion": 5, "Beginn": "1983-01-06T00:00:00", "Ende": "1989-01-06T00:00:00"},
    {"IdMitglied": 531, "IdFunktion": 7, "Beginn": "1989-01-06T00:00:00", "Ende": "2001-01-06T00:00:00"},
    {"IdMitglied": 557, "IdFunktion": 5, "Beginn": "2001-01-06T00:00:00", "Ende": "2013-01-06T00:00:00"},
    {"IdMitglied": 559, "IdFunktion": 1, "Beginn": "2001-01-06T00:00:00", "Ende": null},
    {"IdMitglied": 568, "IdFunktion": 4, "Beginn": "1995-01-06T00:00:00", "Ende": "2001-01-06T00:00:00"},
    {"IdMitglied": 568, "IdFunktion": 7, "Beginn": "2001-01-06T00:00:00", "Ende": null},
    {"IdMitglied": 569, "IdFunktion": 1, "Beginn": "1995-01-06T00:00:00", "Ende": "2001-01-06T00:00:00"},
    {"IdMitglied": 1257, "IdFunktion": 14, "Beginn": "2007-01-06T00:00:00", "Ende": "2008-01-06T00:00:00"},
    {"IdMitglied": 1239, "IdFunktion": 14, "Beginn": "2007-01-06T00:00:00", "Ende": "2013-01-06T00:00:00"},
    {"IdMitglied": 565, "IdFunktion": 3, "Beginn": "2001-01-06T00:00:00", "Ende": "2013-01-06T00:00:00"},
    {"IdMitglied": 62, "IdFunktion": 3, "Beginn": "2001-01-06T00:00:00", "Ende": "2013-01-06T00:00:00"},
    {"IdMitglied": 548, "IdFunktion": 2, "Beginn": "2001-01-06T00:00:00", "Ende": "2013-01-06T00:00:00"},
    {"IdMitglied": 114, "IdFunktion": 2, "Beginn": "2001-01-06T00:00:00", "Ende": null},
    {"IdMitglied": 110, "IdFunktion": 6, "Beginn": "2001-01-06T00:00:00", "Ende": "2013-01-06T00:00:00"},
    {"IdMitglied": 1243, "IdFunktion": 10, "Beginn": "2007-01-06T00:00:00", "Ende": null},
    {"IdMitglied": 277, "IdFunktion": 15, "Beginn": "1946-01-01T00:00:00", "Ende": null},
    {"IdMitglied": 255, "IdFunktion": 16, "Beginn": "2003-01-06T00:00:00", "Ende": "2003-04-26T00:00:00"},
    {"IdMitglied": 282, "IdFunktion": 16, "Beginn": "2003-01-06T00:00:00", "Ende": null},
    {"IdMitglied": 1251, "IdFunktion": 5, "Beginn": "2013-01-06T00:00:00", "Ende": null},
    {"IdMitglied": 110, "IdFunktion": 3, "Beginn": "2013-01-06T00:00:00", "Ende": null},
    {"IdMitglied": 1239, "IdFunktion": 6, "Beginn": "2013-01-06T00:00:00", "Ende": null}
];

var gesternStart = moment().subtract('days', 1).subtract('hours', 3).utc().toDate();
var gesternEnd = moment().subtract('days', 1).utc().toDate();

var ffwEvents = [
    { title: "Floriansmesse", description: "Treffpunkt um 9 Uhr am Feuerwehrhaus, wenn möglich in Uniform. Anschließend Frühschoppen.", eventDateStart: new Date("2014-05-11 09:15:00"), eventDateEnd: new Date("2014-05-11 11:30:00"), street: "Schulweg", streetnumber: "8", postalcode: "86504", city: "Merching", locationdescription: "Feuerwehrhaus" },
    { title: "Fahrzeugweihe", description: "Einweihung MZF bei der FF Prittriching", eventDateStart: new Date("2014-06-28 15:30:00"), eventDateEnd: new Date("2014-06-28 21:00:00"), street: "Schulweg", streetnumber: "8", postalcode: "86504", city: "Merching", locationdescription: "Feuerwehrhaus" },
    { title: "Pfarrfest", description: "Bestuhlung für den Gottesdienst beim Pfarrfest aufbauen", eventDateStart: new Date("2014-06-29 07:00:00"), eventDateEnd: new Date("2014-06-29 09:00:00"), street: "Klostergasse", streetnumber: "", postalcode: "86504", city: "Merching", locationdescription: "Kindergarten" },
    { title: "Grillfest", description: "Grillfest für alle Mitglieder der FF Merching", eventDateStart: new Date("2014-07-19 18:00:00"), eventDateEnd: new Date("2014-07-19 22:00:00"), street: "Schulweg", streetnumber: "8", postalcode: "86504", city: "Merching", locationdescription: "Feuerwehrhaus" },
    { title: "Feuerwehrfest", description: "100 jähriges Gründungsfest in Haunswies", eventDateStart: new Date("2014-05-25 8:00:00"), eventDateEnd: new Date("2014-05-25 17:00:00"), street: "Schulweg", streetnumber: "8", postalcode: "86504", city: "Merching", locationdescription: "Feuerwehrhaus" },
    { title: "Feuerwehrfest", description: "150 jähriges Gründungsfest der FF Friedberg", eventDateStart: new Date("2014-06-15 8:30:00"), eventDateEnd: new Date("2014-06-15 17:00:00"), street: "Schulweg", streetnumber: "8", postalcode: "86504", city: "Merching", locationdescription: "Feuerwehrhaus" },
    { title: "Test 1", description: "Test Gestern", eventDateStart: gesternStart, eventDateEnd: gesternEnd, street: "Schulweg", streetnumber: "8", postalcode: "86504", city: "Merching", locationdescription: "Feuerwehrhaus" },
    { title: "Test 2", description: "Test Heute", eventDateStart: moment().subtract('hours',
        5).utc().toDate(), eventDateEnd: moment().add('hours',
        1).utc().toDate(), street: "Schulweg", streetnumber: "8", postalcode: "86504", city: "Merching", locationdescription: "Feuerwehrhaus" },
    { title: "Kartenvorverkauf Faschingsball", description: "Ab Montag, 4.2 startet der Kartenvorverkauf für den Faschingsball in der Raiffeisenbank in Merching", eventDateStart: new Date("2014-02-03 09:00:00"), eventDateEnd: new Date("2014-02-14 14:00:00"), street: "", streetnumber: "", postalcode: "", city: "Merching", locationdescription: "Raiffeisenbank" },
    { title: "Herrichten Faschingsball", description: "Zum Aufbauen und Herrichten für den Faschingsball treffen sich alle Helfer um 18 Uhr in der Mehrzweckhalle", eventDateStart: new Date("2014-02-14 18:00:00"), eventDateEnd: new Date("2014-02-14 21:00:00"), street: "Kirchstraße", streetnumber: "", postalcode: "86504", city: "Merching", locationdescription: "Mehrzweckhalle" },
    { title: "Faschingsball vom Schützenverein und der Feuerwehr",
        description: "Der Faschingsball, der traditionell vom Schützenverein und der Feuerwehr veranstaltet wird, beginnt um 20.00 Uhr und findet in der Mehrzweckhalle statt. Für Stimmung sorgt die Diamonds Revival Band und es wird wieder eine Einlage des Feuerwehrballets geben.", eventDateStart: new Date("2014-02-15 20:00:00"), eventDateEnd: new Date("2014-02-16 02:00:00"), street: "Kirchstraße", streetnumber: "", postalcode: "86504", city: "Merching", locationdescription: "Mehrzweckhalle" },
    { title: "Aufräumen Faschingsball", description: "Zum Aufräumen nach dem Faschingsball treffen sich alle Helfer in der Mehrzweckhalle um 10 Uhr", eventDateStart: new Date("2014-02-16 10:00:00"), eventDateEnd: new Date("2014-02-16 13:00:00"), street: "Kirchstraße", streetnumber: "", postalcode: "86504", city: "Merching", locationdescription: "Mehrzweckhalle" },
    { title: "Monatsübung", description: "Wärmebildkamera", eventDateStart: new Date("2014-02-21 19:30:00"), eventDateEnd: new Date("2014-02-21 21:30:00"), street: "Schulweg", streetnumber: "8", postalcode: "86504", city: "Merching", locationdescription: "Feuerwehrhaus" },
    { title: "Monatsübung", description: "Erste Hilfe / First Responder", eventDateStart: new Date("2014-03-28 19:30:00"), eventDateEnd: new Date("2014-03-28 21:30:00"), street: "Schulweg", streetnumber: "8", postalcode: "86504", city: "Merching", locationdescription: "Feuerwehrhaus" },
    { title: "Monatsübung", description: "Erste Hilfe / First Responder", eventDateStart: new Date("2014-03-31 19:30:00"), eventDateEnd: new Date("2014-03-31 21:30:00"), street: "Schulweg", streetnumber: "8", postalcode: "86504", city: "Merching", locationdescription: "Feuerwehrhaus" },
    { title: "Monatsübung", description: "Objektlöschübung Wohnhaus", eventDateStart: new Date("2014-04-25 19:30:00"), eventDateEnd: new Date("2014-04-25 21:30:00"), street: "Schulweg", streetnumber: "8", postalcode: "86504", city: "Merching", locationdescription: "Feuerwehrhaus" },
    { title: "Monatsübung", description: "Objektlöschübung Wohnhaus", eventDateStart: new Date("2014-04-28 19:30:00"), eventDateEnd: new Date("2014-04-28 21:30:00"), street: "Schulweg", streetnumber: "8", postalcode: "86504", city: "Merching", locationdescription: "Feuerwehrhaus" },
    { title: "Monatsübung", description: "THL / LKw-PKw / GGV + UVV", eventDateStart: new Date("2014-05-23 19:30:00"), eventDateEnd: new Date("2014-05-23 21:30:00"), street: "Schulweg", streetnumber: "8", postalcode: "86504", city: "Merching", locationdescription: "Feuerwehrhaus" },
    { title: "Monatsübung", description: "THL / LKw-PKw / GGV + UVV", eventDateStart: new Date("2014-05-26 19:30:00"), eventDateEnd: new Date("2014-05-26 21:30:00"), street: "Schulweg", streetnumber: "8", postalcode: "86504", city: "Merching", locationdescription: "Feuerwehrhaus" },
    { title: "Monatsübung", description: "Löschübung Landwirtschaft", eventDateStart: new Date("2014-06-27 19:30:00"), eventDateEnd: new Date("2014-06-27 21:30:00"), street: "Schulweg", streetnumber: "8", postalcode: "86504", city: "Merching", locationdescription: "Feuerwehrhaus" },
    { title: "Monatsübung", description: "Löschübung Landwirtschaft", eventDateStart: new Date("2014-06-30 19:30:00"), eventDateEnd: new Date("2014-06-30 21:30:00"), street: "Schulweg", streetnumber: "8", postalcode: "86504", city: "Merching", locationdescription: "Feuerwehrhaus" },
    { title: "Monatsübung", description: "Interne Ölwehrübung", eventDateStart: new Date("2014-07-25 19:30:00"), eventDateEnd: new Date("2014-07-25 21:30:00"), street: "Schulweg", streetnumber: "8", postalcode: "86504", city: "Merching", locationdescription: "Feuerwehrhaus" },
    { title: "Monatsübung", description: "Interne Ölwehrübung", eventDateStart: new Date("2014-07-28 19:30:00"), eventDateEnd: new Date("2014-07-28 21:30:00"), street: "Schulweg", streetnumber: "8", postalcode: "86504", city: "Merching", locationdescription: "Feuerwehrhaus" },
    { title: "Monatsübung", description: "Löschübung mit Schaum", eventDateStart: new Date("2014-08-29 19:30:00"), eventDateEnd: new Date("2014-08-29 21:30:00"), street: "Schulweg", streetnumber: "8", postalcode: "86504", city: "Merching", locationdescription: "Feuerwehrhaus" },
    { title: "Monatsübung", description: "Löschübung mit Schaum", eventDateStart: new Date("2014-09-01 19:30:00"), eventDateEnd: new Date("2014-09-01 21:30:00"), street: "Schulweg", streetnumber: "8", postalcode: "86504", city: "Merching", locationdescription: "Feuerwehrhaus" },
    { title: "Monatsübung", description: "Fahrzeugkunde HLF 20/16 + LF 8/6", eventDateStart: new Date("2014-09-26 19:30:00"), eventDateEnd: new Date("2014-09-26 21:30:00"), street: "Schulweg", streetnumber: "8", postalcode: "86504", city: "Merching", locationdescription: "Feuerwehrhaus" },
    { title: "Monatsübung", description: "Fahrzeugkunde HLF 20/16 + LF 8/6", eventDateStart: new Date("2014-09-29 19:30:00"), eventDateEnd: new Date("2014-09-29 21:30:00"), street: "Schulweg", streetnumber: "8", postalcode: "86504", city: "Merching", locationdescription: "Feuerwehrhaus" },
    { title: "Monatsübung", description: "THL / Greifzug / Abs. der Einsatzstelle", eventDateStart: new Date("2014-10-24 19:30:00"), eventDateEnd: new Date("2014-10-24 21:30:00"), street: "Schulweg", streetnumber: "8", postalcode: "86504", city: "Merching", locationdescription: "Feuerwehrhaus" },
    { title: "Monatsübung", description: "THL / Greifzug / Abs. der Einsatzstelle", eventDateStart: new Date("2014-10-27 19:30:00"), eventDateEnd: new Date("2014-10-27 21:30:00"), street: "Schulweg", streetnumber: "8", postalcode: "86504", city: "Merching", locationdescription: "Feuerwehrhaus" },
    { title: "Monatsübung", description: "Lima  /Notstromaggregat / Motorsäge", eventDateStart: new Date("2014-11-21 19:30:00"), eventDateEnd: new Date("2014-11-21 21:30:00"), street: "Schulweg", streetnumber: "8", postalcode: "86504", city: "Merching", locationdescription: "Feuerwehrhaus" },
    { title: "Monatsübung", description: "Lima  /Notstromaggregat / Motorsäge", eventDateStart: new Date("2014-11-24 19:30:00"), eventDateEnd: new Date("2014-11-24 21:30:00"), street: "Schulweg", streetnumber: "8", postalcode: "86504", city: "Merching", locationdescription: "Feuerwehrhaus" }
];

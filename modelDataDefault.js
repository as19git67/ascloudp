var _ = require('underscore');
var moment = require('moment');
var Promise = require('bluebird/js/main/promise')();

var model = require('./model');
var knex = model.bookshelf.knex;

exports.importTestData = function () {

    var createSteps = [
        function () {
            // SEITEN
            return new Promise(function (resolve, reject) {
                var allPages = [
                    {
                        Order: 1,
                        Name: "overview",
                        AnonymousAccess: true,
                        EntityNameSingular: "Overview",
                        EntityNamePlural: "Overview Infos",
                        Model: "PageContent",
                        View: "genericHTML"
                    },
                    {
                        Order: 2,
                        Name: "events",
                        AnonymousAccess: true,
                        EntityNameSingular: "Event",
                        EntityNamePlural: "Events",
                        Collection: "Events",
                        View: "Calendar"
                    },
                    {
                        Order: 6,
                        Name: "links",
                        AnonymousAccess: true,
                        EntityNameSingular: "Link",
                        EntityNamePlural: "Links",
                        Collection: "Links",
                        View: "Links"
                    },
                    {
                        Order: 3,
                        Name: "blog",
                        AnonymousAccess: true,
                        EntityNameSingular: "Article",
                        EntityNamePlural: "Articles",
                        Collection: "Articles",
                        View: "Articles"
                    },
                    {
                        Order: 9,
                        Name: "contacts",
                        AnonymousAccess: true,
                        EntityNameSingular: "Contact",
                        EntityNamePlural: "Contacts",
                        Collection: "Contacts", // not used by view Contacts
                        View: "Contacts"
                    },
                    {
                        Order: 10,
                        Name: "members",
                        AnonymousAccess: false,
                        EntityNameSingular: "Member",
                        EntityNamePlural: "Members",
                        Collection: "Persons",
                        View: "Members"
                    }
                ];
                var pages = model.models.Pages.forge(allPages);
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
                    {
                        Page_id: "overview",
                        Text: "### The Authentic Source for\r\n\r# NYC.com's Exclusive New York City Event Calendar\r\n\rWe proudly offer the most comprehensive event calendar of New York City events. Here you'll find hundreds of special events as well as everything from which DJ is spinning at the hottest club to which team the Knicks are playing. Search by event type, date and/or location below."
                    }
                ];
                var pageContents = model.models.PageContents.forge(allPageContents);
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
            // TERMINE
            return new Promise(function (resolve, reject) {
                Promise.map(eventList, function (value) {
                    return new Promise(function (resolveEvent, rejectEvent) {
                        new model.models.Event({Page_id: "events"}).save().then(function (newEvent) {
                            var publishDateStart = value.publishDateStart == null ? new Date() : value.publishDateStart;
                            var publishDateEnd = value.publishDateEnd == null ? value.eventDateEnd : value.publishDateEnd;
                            var evObj = {
                                Event_id: newEvent.get('id'),
                                Title: value.title,
                                Location: value.locationdescription,
                                Description: value.description,
                                event_start: value.eventDateStart,
                                event_end: value.eventDateEnd,
                                publish_start: publishDateStart,
                                publish_end: publishDateEnd,
                                valid_start: new Date()
                            };
                            new model.models.EventItem(evObj).save().then(function (newEventItem) {
                                resolveEvent();
                            }).catch(function (error) {
                                console.log("Error while saving EventItem: " + error);
                                rejectEvent(error);
                            });
                        }).catch(function (error) {
                            console.log("Error while saving Event: " + error);
                            rejectEvent(error);
                        });
                    });
                }).then(function (savedEvents) {
                    console.log(savedEvents.length + " events added to database");
                    resolve();
                }).catch(function (error) {
                    console.log("Error while saving events: " + error);
                });
            });
        },
        function () {
            // LINKS
            return new Promise(function (resolve, reject) {
                Promise.map(linkList, function (value) {
                    return new Promise(function (resolveLink, rejectLink) {
                        new model.models.Link({Page_id: "links", Url: value.href}).save().then(function (newLink) {
                            var linkObj = {
                                Link_id: newLink.get('id'),
                                Url: value.href,
                                Description: value.d,
                                valid_start: new Date()
                            };
                            new model.models.LinkItem(linkObj).save().then(function (newLinkItem) {
                                resolveLink();
                            }).catch(function (error) {
                                console.log("Error while saving LinkItem: " + error);
                                rejectLink(error);
                            });
                        }).catch(function (error) {
                            console.log("Error while saving Link: " + error);
                            rejectLink(error);
                        });
                    });
                }).then(function (savedLinks) {
                    console.log(savedLinks.length + " links added to database");
                    resolve();
                }).catch(function (error) {
                    console.log("Error while saving links: " + error);
                });
            });
        },
        function () {
            // MITGLIEDER
            return new Promise(function (resolve, reject) {

                Promise.map(memberList, function (value) {
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
                        new model.models.Person().save().then(function (newPerson) {

                            pObj.Person_id = newPerson.get('id');
                            new model.models.PersonItem(pObj).save().then(function (newPersonItem) {
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

                                new model.models.Membership({
                                    Person_id: newPerson.get('id'),
                                    MembershipNumber: value.ID
                                }).save()
                                    .then(function (newMember) {
                                        new model.models.MembershipItem({
                                            Membership_id: newMember.get('id'),
                                            MembershipNumber: value.ID,
                                            EntryDate: ed,
                                            LeavingDate: ld,
                                            //t.integer('LeavingReason_id').references('id').inTable('LeavingReasons');
                                            PassiveSince: value.Übergang_Passiv,
                                            //LivingElsewhereSince: value.verzogenDatum,
                                            // todo: if value.verzogenDatum { set PersonContactDataAddress.valid_end with value.verzogenDatum }
                                            valid_start: now
                                        }).save()
                                            .then(function (newMemberItem) {
                                                //console.log("Member added: " + newMember.get('MembershipNumber'));
                                                new model.models.PersonContactType().fetchAll().then(function (personContactTypes) {

                                                    function addMorePart1() {
                                                        if (value.Email && value.Email != '') {
                                                            new model.models.PersonContactData({
                                                                Person_id: newPerson.get('id'),
                                                                PersonContactType_id: personContactTypeEmail,
                                                                Usage: 'Privat'
                                                            }).save()
                                                                .then(function (newPersonContactDataForEmail) {
                                                                    new model.models.PersonContactDataAccount({
                                                                        PersonContactData_id: newPersonContactDataForEmail.get('id'),
                                                                        Account: value.Email,
                                                                        valid_start: now
                                                                    }).save()
                                                                        .then(function (newPersonContactDataEmail) {
                                                                            console.log('newPersonContactDataEmail added: ' + newPersonContactDataEmail.get('Account'));
                                                                            resolvePerson({
                                                                                person: newPerson,
                                                                                membership: newMember
                                                                            });
                                                                        }
                                                                    );
                                                                }
                                                            );
                                                        } else {
                                                            resolvePerson({person: newPerson, membership: newMember});
                                                        }
                                                    }

                                                    var personContactTypesByName = {};
                                                    personContactTypes.forEach(function (personContactType) {
                                                        personContactTypesByName[personContactType.get('Name')] = personContactType.get('id');
                                                    });
                                                    var personContactTypeAddress = personContactTypesByName['address'];
                                                    var personContactTypePhone = personContactTypesByName['phone'];
                                                    var personContactTypeEmail = personContactTypesByName['email'];

                                                    function addOtherCommData() {
                                                        if (value.Mobiltelefon && value.Mobiltelefon != '') {
                                                            new model.models.PersonContactData({
                                                                Person_id: newPerson.get('id'),
                                                                PersonContactType_id: personContactTypePhone,
                                                                Usage: 'Mobil'
                                                            }).save().then(function (newPersonContactDataPhonenumber) {
                                                                    var number = value.Mobiltelefon;
                                                                    if (number.length > 1 && number.charAt(0) == '0') {
                                                                        number = '+49' + number.substr(1);
                                                                    } else {
                                                                        console.log('WARNING: wrong phone number format: ' + number);
                                                                    }
                                                                    new model.models.PersonContactDataPhonenumber({
                                                                        PersonContactData_id: newPersonContactDataPhonenumber.get('id'),
                                                                        Number: number,
                                                                        valid_start: now
                                                                    }).save().then(function (newPersonContactDataPhonenumber) {
                                                                            if (value.Telefon && value.Telefon != '') {
                                                                                new model.models.PersonContactData({
                                                                                    Person_id: newPerson.get('id'),
                                                                                    PersonContactType_id: personContactTypePhone,
                                                                                    Usage: 'Privat'
                                                                                }).save().then(function (newPersonContactDataPhonenumber) {
                                                                                        var number = value.Telefon;
                                                                                        if (number.charAt(0) != '0') {
                                                                                            number = '08233' + number;
                                                                                        }
                                                                                        if (number.length > 1 && number.charAt(0) == '0') {
                                                                                            number = '+49' + number.substr(1);
                                                                                        } else {
                                                                                            console.log('WARNING: wrong phone number format: ' + number);
                                                                                        }
                                                                                        new model.models.PersonContactDataPhonenumber({
                                                                                            PersonContactData_id: newPersonContactDataPhonenumber.get('id'),
                                                                                            Number: number,
                                                                                            valid_start: now
                                                                                        }).save().then(function (newPersonContactDataPhonenumber) {
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
                                                    }

                                                    if (personContactTypeAddress && personContactTypePhone && personContactTypeEmail) {

                                                        if (value.PLZ && value.Ort) {
                                                            new model.models.PersonContactData({
                                                                Person_id: newPerson.get('id'),
                                                                PersonContactType_id: personContactTypeAddress,
                                                                Usage: 'Privat'
                                                            }).save().then(function (newPersonContactDataAddress) {
                                                                    new model.models.PersonContactDataAddress({
                                                                        PersonContactData_id: newPersonContactDataAddress.get('id'),
                                                                        Street: street,
                                                                        StreetNumber: streetNumber,
                                                                        Postalcode: value.PLZ,
                                                                        City: value.Ort,
                                                                        valid_start: now
                                                                    }).save().then(function (newPersonContactDataAddress) {
                                                                            addOtherCommData();
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
                                                        } else {
                                                            // no address added - try to add the rest
                                                            addOtherCommData();
                                                        }
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
            // VORSTANDSCHAFT (Contacts)
            return new Promise(function (resolve, reject) {
                var pageName = "contacts";
                var memberships = _.where(memberList, {'Vorstandsmitglied': true});
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
                                Person_id: m.Person_id,
                                valid_start: now
                            });
                        });
                        Promise.map(allContacts, function (contactItem) {
                            return new Promise(function (resolveContact, rejectContact) {
                                new model.models.Contact({Page_id: pageName}).save().then(function (newContact) {
                                    contactItem.Contact_id = newContact.get('id');
                                    new model.models.ContactItem(contactItem).save().then(function (newContactItem) {
                                        resolveContact(newContact);
                                    }).catch(function (error) {
                                        console.log("Error while adding contact item for page " + pageName + ": " + error);
                                        rejectContact(error);
                                    });
                                }).catch(function (error) {
                                    console.log("Error while adding contact for page " + pageName + ": " + error);
                                    rejectContact(error);
                                });
                            });
                        }).then(function (allSavedContacts) {
                            console.log(" contacts for page " + pageName + " saved in database.");
                            resolve();
                        }).catch(function (error) {
                            console.log("Error while saving contacts for page " + pageName + ": " + error);
                            reject(error);
                        });
                    }).catch(function (error) {
                        console.log("Error while reading Memberships: " + error);
                        reject(error);
                    });
            });
        },
        function () {
            return new Promise(function (resolve, reject) {
                var now = new Date();
                var end = new Date();
                end.setFullYear(end.getFullYear() + 1);
                new model.models.Article({"Page_id": "blog"}).save().then(function (newArticle) {
                    new model.models.ArticleItem({
                        "Article_id": newArticle.get('id'),
                        "Date": new Date(2014, 11, 13),
                        "Title": "Comet Landing Bumpier Than Initially Thought",
                        "Subtitle": "",
                        "Author": "KENNETH CHANG",
                        "publish_start": now,
                        "publish_end": end,
                        "valid_start": now
                    }).save().then(function (newArticle) {
                            new model.models.ArticleSection({Article_id: newArticle.get('id')}).save().then(function (newArticleSection) {
                                new model.models.ArticleSectionItem({
                                    "ArticleSection_id": newArticleSection.get('id'),
                                    "Order": 1,
                                    "Title": undefined,
                                    "Text": "",
                                    "ImageUrl": "http://static01.nyt.com/images/2014/11/13/science/13philae-on-comet/13philae-on-comet-master675.jpg",
                                    "ImageDescription": "A two-image panorama taken by the Philae lander from the surface of Comet 67P/Churyumov-Gerasimenko.",
                                    "valid_start": now
                                }).save().then(function (newArticleSectionItem) {
                                        new model.models.ArticleReference({ArticleSection_id: newArticleSection.get('id')}).save().then(function (newArticleReference) {
                                            new model.models.ArticleReferenceItem({
                                                "ArticleReference_id": newArticleReference.get('id'),
                                                "Text": "European Space Agency",
                                                "valid_start": now
                                            }).save().then(function (newArticleReferenceItem) {
                                                    new model.models.ArticleSection({Article_id: newArticle.get('id')}).save().then(function (newArticleSection2) {
                                                        new model.models.ArticleSectionItem({
                                                            "ArticleSection_id": newArticleSection2.get('id'),
                                                            "Order": 2,
                                                            "Title": null,
                                                            "Text": "This historic landing of a spacecraft on a comet on Wednesday turned out to be not one but three landings as the craft hopped across the surface. " +
                                                            "Because of the failure of a thruster that was to press it against the comet’s surface after touching down, the European Space Agency’s Philae lander, part of the $1.75 billion Rosetta mission, bounded up more than half a mile before falling to the surface of Comet 67P/Churyumov-Gerasimenko again nearly two hours later, more than half a mile away. That is a considerable distance across a comet that is only 2.5 miles wide. " +
                                                            "Philae then bounced again, less high, and ended up with only two of its three legs on the surface, tipped against a boulder, a wall of rock or perhaps the side of a hole. " +
                                                            "“We are almost vertical, one foot probably in the open air — open space. I’m sorry, there is no air around,” Jean-Pierre Bibring, the lead lander scientist, said at a news conference on Thursday. " +
                                                            "In the skewed position, Philae’s solar panels are generating much less power than had been planned, and when its batteries drain in a couple of days, it may not be able to recharge. As the comet rotates once every 12 hours, the lander is receiving only about 1.5 hours of sunlight instead of the expected six to seven hours. ",
                                                            "ImageDescription": "CHASING A COMET  Rosetta launched in 2004, made several loops through the inner solar system gathering speed and then spent years chasing down Comet 67P/C-G. The spacecraft arrived in August.",
                                                            "ImageUrl": "http://graphics8.nytimes.com/newsgraphics/2014/11/08/rosetta-philae/5e378c5e4212594c134fc802fc7a3d82b7d6b5e5/rosetta_white-945.png",
                                                            "valid_start": now
                                                        }).save().then(function (newArticleSectionItem2) {
                                                                new model.models.ArticleReference({ArticleSection_id: newArticleSection2.get('id')}).save().then(function (newArticleReference2) {
                                                                    new model.models.ArticleReferenceItem({
                                                                        "ArticleReference_id": newArticleReference2.get('id'),
                                                                        "Text": "The New York Times",
                                                                        "valid_start": now
                                                                    }).save().then(function (newArticleReferenceItem2) {
                                                                            console.log("Article '" + newArticle.get('Title') + "' saved.");
                                                                            resolve();
                                                                        }).catch(function (error) {
                                                                            console.log("Error while creating ArticleReferenceItem for page 'blog': " +
                                                                            error);
                                                                            reject(error);
                                                                        });
                                                                }).catch(function (error) {
                                                                    console.log("Error while creating ArticleReference for page 'blog': " + error);
                                                                    reject(error);
                                                                });
                                                            }).catch(function (error) {
                                                                console.log("Error while creating ArticleSectionItem for page 'blog': " + error);
                                                                reject(error);
                                                            });
                                                    }).catch(function (error) {
                                                        console.log("Error while creating ArticleSection for page 'blog': " + error);
                                                        reject(error);
                                                    });
                                                }).catch(function (error) {
                                                    console.log("Error while creating ArticleReferenceItem for page 'blog': " + error);
                                                    reject(error);
                                                });
                                        }).catch(function (error) {
                                            console.log("Error while creating ArticleReference for page 'blog': " + error);
                                            reject(error);
                                        });
                                    }).catch(function (error) {
                                        console.log("Error while creating ArticleSectionItem for page 'blog': " + error);
                                        reject(error);
                                    });
                            }).catch(function (error) {
                                console.log("Error while creating ArticleSection for page 'blog': " + error);
                                reject(error);
                            });
                        }).catch(function (error) {
                            console.log("Error while creating Article for page 'blog': " + error);
                            reject(error);
                        });
                }).catch(function (error) {
                    console.log("Error while creating Article for page 'blog': " + error);
                    reject(error);
                });
            });
        }
    ];

    var steps = exports.clearTablesFunctions.concat(createSteps);

    return Promise.reduce(
        steps,
        function (total, current, index, arrayLength) {
            console.log("importTestData step " + (index + 1) + " von " + arrayLength);
            return current().then(function () {
            }).return(total + 1);
        }, 0);
};

exports.clearTablesFunctions = [
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
    }
];

var gesternStart = moment().subtract(1, 'days').subtract(3, 'hours').utc().toDate();
var gesternEnd = moment().subtract(1, 'days').utc().toDate();

var eventList = [
    {
        title: "Christopher Williams: The Production Line of Hapiness",
        description: "The first retrospective ever mounted of Christopher Williams (American, b. 1956)—spans his 35-year career of one of the most influential cinephilic artists working in photography. Williams studied under West Coast Conceptual artists such as Michael Asher, John Baldessaria and Douglas Huebler, and become one of his generations leading Conceptualists. Williams’ body of work reflects his deep interest in the histories of film and photography and furthers the critique of late capitalisms use of images as agents of spectacle. The Production Line of Hapiness features rarely seen Super-8 shorts, major projects from the 80s and 90s, as well as photographs from his magnum series.",
        eventDateStart: new Date("2015-11-13 10:30:00"),
        eventDateEnd: new Date("2015-11-13 12:00:00"),
        street: "West 53rd Street",
        streetnumber: "11",
        postalcode: "10019",
        city: "New York",
        locationdescription: "Museum of Modern Art (MoMA)"
    },
    {
        title: "Siro's Restaurant Launches New Joy Bauer Healthy Menu",
        description: "Siro's Restaurant, the American eatery located at 885 Second Avenue, has recently launched a new healthy dining program. Top nutritionist Joy Bauer has lent her healthy diet expertise to a special JOY BAUER HEALTHY MENU, which features well-balanced, low-calorie interpretations of some of Siro's classic dishes. Now guests can enjoy tasty options such as Grilled Chicken Parmesan (580 calories) and Pat LaFrieda Turkey Burger Sliders (530 calories). For more information please visit www. Sirosny.com",
        eventDateStart: new Date("2015-11-13 11:30:00"),
        eventDateEnd: new Date("2015-11-13 14:00:00"),
        street: "885 Second Avenue",
        streetnumber: "885",
        postalcode: "10017",
        city: "New York",
        locationdescription: "Siro's"
    }
];


var linkList = [
    {href: "http://www.opentext.com", d: "OpenText"},
    {href: "http://www.microsoft.com", d: "Microsoft"},
    {href: "http://www.stackoverflow.com", d: "Stackoverflow"},
    {href: "http://nodejs.org", d: "node.js"},
    {href: "http://emberjs.com", d: "Ember - a framework for creating ambitious web applications"},
    {href: "http://angularjs.org", d: "Angularjs by Google - HTML enhanced web apps"},
    {href: "http://backbonejs.org", d: "backbone.js"},
    {href: "http://underscorejs.org", d: "underscore.js"},
    {href: "http://marionettejs.com", d: "Marionette.js"},
    {href: "http://handlebarsjs.com", d: "handlebars"}
];

var memberList = [
    {
        "ID": 1,
        "Anrede": "Frau",
        "Vorname": "Angela",
        "Vorstandsmitglied": true,
        "Nachname": "Merkel",
        "PLZ": 10557,
        "Ort": "Berlin",
        "Straße": "Willy-Brandt-Straße 1",
        "verzogen": false,
        "Geboren": "1954-07-17T00:00:00",
        "Telefon": null,
        "Mobiltelefon": null,
        "Eingetreten": "1990-01-01T00:00:00",
        "Ausgetreten": null,
        "Übergang_Passiv": null,
        "verstorben": null,
        "aktiv": true,
        "verzogenDatum": null
    },
    {
        "ID": 2,
        "Anrede": "Herr",
        "Vorname": "Sigmar",
        "Vorstandsmitglied": true,
        "Nachname": "Gabriel",
        "PLZ": 10115,
        "Ort": "Berlin",
        "Straße": "Scharnhorststraße 34-37",
        "verzogen": false,
        "Geboren": "1959-09-12T00:00:00",
        "Telefon": "03018 615-0",
        "Mobiltelefon": null,
        "Eingetreten": "2005-01-01T00:00:00",
        "Ausgetreten": null,
        "Übergang_Passiv": null,
        "verstorben": null,
        "aktiv": true,
        "verzogenDatum": null
    },
    {
        "ID": 3,
        "Anrede": "Herr",
        "Vorname": "Frank-Walter",
        "Vorstandsmitglied": true,
        "Nachname": "Steinmeier",
        "PLZ": 10117,
        "Ort": "Berlin",
        "Straße": "Werderscher Markt 1",
        "verzogen": false,
        "Geboren": "1956-01-05T00:00:00",
        "Telefon": "03018 17-0",
        "Mobiltelefon": null,
        "Eingetreten": "1999-01-01T00:00:00",
        "Ausgetreten": null,
        "Übergang_Passiv": null,
        "verstorben": null,
        "aktiv": true,
        "verzogenDatum": null
    },
    {
        "ID": 4,
        "Anrede": "Herr",
        "Vorname": "Thomas",
        "Vorstandsmitglied": true,
        "Nachname": "de Maizière",
        "PLZ": 10559,
        "Ort": "Berlin",
        "Straße": "Alt-Moabit 101D",
        "verzogen": false,
        "Geboren": "1954-01-21T00:00:00",
        "Telefon": "03018 681-0",
        "Mobiltelefon": null,
        "Eingetreten": "2005-01-01T00:00:00",
        "Ausgetreten": null,
        "Übergang_Passiv": null,
        "verstorben": null,
        "aktiv": true,
        "verzogenDatum": null
    },
    {
        "ID": 5,
        "Anrede": "Herr",
        "Vorname": "Heiko",
        "Vorstandsmitglied": true,
        "Nachname": "Maas",
        "PLZ": 10117,
        "Ort": "Berlin",
        "Straße": "Mohrenstraße 37",
        "verzogen": false,
        "Geboren": "1966-09-19T00:00:00",
        "Telefon": "03018 580-0",
        "Mobiltelefon": null,
        "Eingetreten": "2012-01-01T00:00:00",
        "Ausgetreten": null,
        "Übergang_Passiv": null,
        "verstorben": null,
        "aktiv": true,
        "verzogenDatum": null
    },
    {
        "ID": 6,
        "Anrede": "Herr",
        "Vorname": "Wolfgang",
        "Vorstandsmitglied": true,
        "Nachname": "Schäuble",
        "PLZ": 10117,
        "Ort": "Berlin",
        "Straße": "Wilhelmstraße 97",
        "verzogen": false,
        "Geboren": "1942-09-18T00:00:00",
        "Telefon": "03018 682-0",
        "Mobiltelefon": null,
        "Eingetreten": "1984-01-01T00:00:00",
        "Ausgetreten": null,
        "Übergang_Passiv": null,
        "verstorben": null,
        "aktiv": true,
        "verzogenDatum": null
    },
    {
        "ID": 7,
        "Anrede": "Frau",
        "Vorname": "Andrea",
        "Vorstandsmitglied": true,
        "Nachname": "Nahles",
        "PLZ": 10117,
        "Ort": "Berlin",
        "Straße": "Wilhelmstraße 49",
        "verzogen": false,
        "Geboren": "1970-06-20T00:00:00",
        "Telefon": "03018 527-0",
        "Mobiltelefon": null,
        "Eingetreten": "1998-01-01T00:00:00",
        "Ausgetreten": null,
        "Übergang_Passiv": null,
        "verstorben": null,
        "aktiv": true,
        "verzogenDatum": null
    },
    {
        "ID": 8,
        "Anrede": "Herr",
        "Vorname": "Christian",
        "Vorstandsmitglied": true,
        "Nachname": "Schmidt",
        "PLZ": 10117,
        "Ort": "Berlin",
        "Straße": "Wilhelmstraße 54",
        "verzogen": false,
        "Geboren": "1957-08-26T00:00:00",
        "Telefon": "03018 529-0",
        "Mobiltelefon": null,
        "Eingetreten": "1990-01-01T00:00:00",
        "Ausgetreten": null,
        "Übergang_Passiv": null,
        "verstorben": null,
        "aktiv": true,
        "verzogenDatum": null
    },
    {
        "ID": 9,
        "Anrede": "Frau",
        "Vorname": "Ursula",
        "Vorstandsmitglied": true,
        "Nachname": "von der Leyen",
        "PLZ": 10117,
        "Ort": "Berlin",
        "Straße": "Wilhelmstraße 49",
        "verzogen": false,
        "Geboren": "1958-10-08T00:00:00",
        "Telefon": "03018 527-0",
        "Mobiltelefon": null,
        "Eingetreten": "2005-01-01T00:00:00",
        "Ausgetreten": null,
        "Übergang_Passiv": null,
        "verstorben": null,
        "aktiv": true,
        "verzogenDatum": null
    },
    {
        "ID": 10,
        "Anrede": "Herr",
        "Vorname": "Helmut",
        "Vorstandsmitglied": false,
        "Nachname": "Kohl",
        "PLZ": 10117,
        "Ort": "Berlin",
        "Straße": "Unter den Linden 71",
        "Unterdorf": false,
        "verzogen": false,
        "Geboren": "1930-04-03T00:00:00",
        "Telefon": "030 227 - 73002",
        "Mobiltelefon": null,
        "Eingetreten": "1976-01-01T00:00:00",
        "Ausgetreten": "1998-10-26T00:00:00",
        "Übergang_Passiv": null,
        "verstorben": null,
        "aktiv": false,
        "verzogenDatum": null
    },
    {
        "ID": 11,
        "Anrede": "Herr",
        "Vorname": "Gerhard",
        "Vorstandsmitglied": false,
        "Nachname": "Schröder",
        "PLZ": 30159,
        "Ort": "Hannover",
        "Straße": "Plathnerstraße",
        "Unterdorf": false,
        "verzogen": false,
        "Geboren": "1944-04-07T00:00:00",
        "Telefon": null,
        "Mobiltelefon": null,
        "Eingetreten": "1998-01-01T00:00:00",
        "Ausgetreten": "2005-11-11T00:00:00",
        "Übergang_Passiv": null,
        "verstorben": null,
        "aktiv": false,
        "verzogenDatum": null
    },
    {
        "ID": 12,
        "Anrede": "Herr",
        "Vorname": "Helmut",
        "Vorstandsmitglied": false,
        "Nachname": "Schmidt",
        "PLZ": null,
        "Ort": "Hamburg-Langenhorn",
        "Straße": null,
        "Unterdorf": false,
        "verzogen": false,
        "Geboren": "1918-12-23T00:00:00",
        "Telefon": null,
        "Mobiltelefon": null,
        "Eingetreten": "1969-01-01T00:00:00",
        "Ausgetreten": "1986-09-10T00:00:00",
        "Übergang_Passiv": null,
        "verstorben": null,
        "aktiv": false,
        "verzogenDatum": null
    }

];
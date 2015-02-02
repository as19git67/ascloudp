var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var cookieSession = require('cookie-session');
var bodyParser = require('body-parser');
var csrf = require('csurf');
var http = require('http');
var https = require('https');
var fs = require('fs');
var config = require('./config');
var _ = require('underscore');
var moment = require('moment');
var rho = require('rho');
var passport = require('passport');
var passportStrategies = require('./passportStrategies');

var routes = require('./routes/index');
var databaseManagement = require('./routes/databasemanagement');
var userManagementUserList = require('./routes/usermanagementuserlist');
var userManagementUserEdit = require('./routes/usermanagementuseredit');
var userManagementRoles = require('./routes/usermanagementroles');
var userManagementRoleEdit = require('./routes/usermanagementroleedit');
var pageManagementPageList = require('./routes/pagemanagementpagelist');
var login = require('./routes/login');
var logoff = require('./routes/logoff');
var loginRegister = require('./routes/loginRegister');
var loginRegisterNew = require('./routes/loginRegisterNew');
var loginManageAccount = require('./routes/loginManageAccount');
var images = require('./routes/images');
var settings = require('./routes/settings');

var rolePermissions = require('./Roles');
var model = require('./model');
var PageContent = model.models.PageContent;
var apiMembers = require('./routes/api/v1/members');
var apiEvents = require('./routes/api/v1/events');
var apiArticles = require('./routes/api/v1/articles');
var apiCommunicationData = require('./routes/api/v1/communicationData');

moment.locale("de"); // todo: use language from configuration or browser setting
var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.use(favicon(__dirname + '/public/favicon.ico'));
app.use(logger('dev'));
app.use(bodyParser.json({defer: true}));
app.use(bodyParser.urlencoded({defer: true}));
var cookieSecret = config.get('cookieSecret');
var sessionTimeout = config.get('cookieSessionTimeoutInMinutes') * 60 * 1000;
app.use(cookieParser(cookieSecret));

app.use(cookieSession({
    name: config.get('appName'),
    secret: cookieSecret,
    maxage: sessionTimeout
}));

app.use(express.static(path.join(__dirname, 'public')));

app.use(bodyParser({defer: true})); // enables multipart form

app.use(passport.initialize());
app.use(passport.session()); // persistent login sessions
app.use(csrf());

app.use('/', routes);

app.use('/admin/databaseManagement', databaseManagement);
app.use('/admin/userManagementUserList', userManagementUserList);
app.use('/admin/userManagementUserEdit', userManagementUserEdit);
app.use('/admin/userManagementRoles', userManagementRoles);
app.use('/admin/userManagementRoleEdit', userManagementRoleEdit);
app.use('/admin/pageManagementPageList', pageManagementPageList);
app.use('/admin/settings', settings);
app.use('/login', login);
app.use('/logoff', logoff);
app.use('/loginRegister', loginRegister);
app.use('/loginRegisterNew', loginRegisterNew);
app.use('/loginManageAccount', loginManageAccount);
app.use('/images', images);

var rp = new rolePermissions(model.models);

app.get('/api/v1/articles', passportStrategies.ensureAuthenticatedForApi, rp.middleware(3), apiArticles.get);
app.get('/api/v1/articles/:id', passportStrategies.ensureAuthenticatedForApi, rp.middleware(3), apiArticles.get);
app.put('/api/v1/articles/:id', passportStrategies.ensureAuthenticatedForApi, rp.middleware(3), apiArticles.put);
app.delete('/api/v1/articles/:id', passportStrategies.ensureAuthenticatedForApi, rp.middleware(3), apiArticles.delete);
app.post('/api/v1/articles', passportStrategies.ensureAuthenticatedForApi, rp.middleware(3), apiArticles.post);
app.get('/api/v1/articles/:id/images', passportStrategies.ensureAuthenticatedForApi, rp.middleware(3), apiArticles.getImageChunk);
app.post('/api/v1/articles/:id/images', passportStrategies.ensureAuthenticatedForApi, rp.middleware(3), apiArticles.postImage);
app.get('/api/v1/events/:id', passportStrategies.ensureAuthenticatedForApi, rp.middleware(3), apiEvents.get);
app.put('/api/v1/events/:id', passportStrategies.ensureAuthenticatedForApi, rp.middleware(3), apiEvents.put);
app.get('/api/v1/members', passportStrategies.ensureAuthenticatedForApi, rp.middleware(), apiMembers.list);
app.get('/api/v1/members/:id', passportStrategies.ensureAuthenticatedForApi, rp.middleware(3), apiMembers.get);
app.put('/api/v1/members/:id', passportStrategies.ensureAuthenticatedForApi, rp.middleware(3), apiMembers.put);
app.post('/api/v1/addresses', passportStrategies.ensureAuthenticatedForApi, rp.middleware(), apiCommunicationData.postAddress);
app.put('/api/v1/addresses/:id', passportStrategies.ensureAuthenticatedForApi, rp.middleware(3), apiCommunicationData.putAddress);
app.delete('/api/v1/addresses/:id', passportStrategies.ensureAuthenticatedForApi, rp.middleware(3), apiCommunicationData.deleteAddress);
app.post('/api/v1/phoneNumbers', passportStrategies.ensureAuthenticatedForApi, rp.middleware(), apiCommunicationData.postPhoneNumber);
app.put('/api/v1/phoneNumbers/:id', passportStrategies.ensureAuthenticatedForApi, rp.middleware(3), apiCommunicationData.putPhoneNumber);
app.delete('/api/v1/phoneNumbers/:id', passportStrategies.ensureAuthenticatedForApi, rp.middleware(3), apiCommunicationData.deletePhoneNumber);
app.post('/api/v1/accounts', passportStrategies.ensureAuthenticatedForApi, rp.middleware(), apiCommunicationData.postAccount);
app.put('/api/v1/accounts/:id', passportStrategies.ensureAuthenticatedForApi, rp.middleware(3), apiCommunicationData.putAccount);
app.delete('/api/v1/accounts/:id', passportStrategies.ensureAuthenticatedForApi, rp.middleware(3), apiCommunicationData.deleteAccount);

app.use(function (req, res, next) {

    var url = req.originalUrl.toLowerCase();
    // remove / from start
    if (url.substr(0, 1) == "/") {
        url = url.substr(1);
    }
    var idx = url.indexOf('?');
    if (idx >= 1) {
        url = url.substring(0, idx);
    }

    if (url.indexOf('api/') != 0) {
        rp.canPost(req).then(function (canPost) {

            model.getPagesForUser(req.user).then(function (pages) {
                var page = _.findWhere(pages, {Name: url});
                if (page) {
                    var viewName = page.View;
                    var m = page.isSingleEntity ? page.Model : page.Collection;
                    if (viewName) {
                        var httpMethod = req.method.toLowerCase();
                        var isPost = httpMethod == "post";
                        if ((isPost && canPost) || httpMethod == "get") {
                            console.log("Loading view " + viewName + " for model " + m);
                            if (page.isSingleEntity) {
                                new PageContent({Page_id: page.Name}).fetch().then(function (pageContent) {

                                    if (isPost && req.body.save) {
                                        if (!pageContent) {
                                            pageContent = new PageContent({Page_id: page.Name});
                                        }
                                        rawRho = req.body.rawRho;
                                        rawHtml = rho.toHtml(rawRho);
                                        pageContent.set('Text', rawRho);
                                        pageContent.save().then(function (savedPageContent) {
                                            res.render(viewName, {
                                                csrfToken: req.csrfToken(),
                                                bootstrapTheme: config.get('bootstrapStyle'),
                                                Page_id: page.Name,
                                                appName: config.get('appName'),
                                                title: page.isSingleEntity ? page.EntityNameSingular : page.EntityNamePlural,
                                                user: req.user,
                                                pages: pages,
                                                canEdit: canPost,
                                                RawHTML: rawHtml,
                                                RawRHO: rawRho
                                            });
                                        }).catch(function (error) {
                                            console.log("Error while saving page content: " + error);
                                            res.render(viewName, {
                                                csrfToken: req.csrfToken(),
                                                bootstrapTheme: config.get('bootstrapStyle'),
                                                Page_id: page.Name,
                                                appName: config.get('appName'),
                                                title: page.isSingleEntity ? page.EntityNameSingular : page.EntityNamePlural,
                                                user: req.user,
                                                pages: pages,
                                                canEdit: canPost,
                                                RawHTML: rawHtml,
                                                RawRHO: rawRho,
                                                error: "Der Seiteninhalt konnte nicht gespeichert werden"
                                            });
                                        });
                                    } else {
                                        var rawRho = "";
                                        var rawHtml = undefined;
                                        if (pageContent) {
                                            rawRho = pageContent.get('Text');
                                            rawHtml = rho.toHtml(rawRho);
                                        } else {
                                            console.log("Warning: rendering page " + page.Name + " without content");
                                        }
                                        res.render(viewName, {
                                            csrfToken: req.csrfToken(),
                                            bootstrapTheme: config.get('bootstrapStyle'),
                                            Page_id: page.Name,
                                            appName: config.get('appName'),
                                            title: page.isSingleEntity ? page.EntityNameSingular : page.EntityNamePlural,
                                            user: req.user,
                                            pages: pages,
                                            canEdit: canPost,
                                            RawHTML: rawHtml,
                                            RawRHO: rawRho
                                        });
                                    }
                                }).catch(function (error) {
                                    var errMsg = "Error while getting content from database for page " + page.Name;
                                    console.log(errMsg + ": " + error);
                                    var err = new Error(errMsg);
                                    err.status = 500;
                                    next(err);
                                });
                            } else {
                                var collectionClass = model.models[m];
                                if (collectionClass) {
                                    var collection = new collectionClass();
                                    var collectionModelClass = collection.model;
                                    var view = require('./views/' + viewName);
                                    if (view) {
                                        if (view.getical && req.query && req.query.type && req.query.type == "ical") {
                                            view.getical(req, res, next, page, pages, canPost, collectionModelClass);
                                        } else {
                                            view.render(req, res, next, page, pages, canPost, collectionModelClass);
                                        }
                                    } else {
                                        console.log("Error displaying view " + viewName + ". require('views/'" + viewName + ") failed.");
                                        res.render('genericList', {
                                            appName: config.get('appName'),
                                            bootstrapTheme: config.get('bootstrapStyle'),
                                            title: page.EntityNamePlural,
                                            user: req.user,
                                            pages: pages,
                                            canEdit: false,
                                            error: "Die Anzeige (" + viewName + ") ist wegen eines internen Fehlers nicht möglich."
                                        });
                                    }
                                }
                                else {
                                    // Klasse für Collection existiert nicht
                                    res.render("genericList", {
                                        appName: config.get('appName'),
                                        bootstrapTheme: config.get('bootstrapStyle'),
                                        title: page.EntityNamePlural,
                                        user: req.user,
                                        pages: pages,
                                        canEdit: false,
                                        error: "Keine Implementierung für Tabelle " + m + " vorhanden"
                                    });
                                }
                            }
                        } else {
                            // http method is not allowed
                            var err = new Error('Forbidden');
                            err.status = 403;
                            next(err);
                        }
                    } else {
                        // no view -> 404
                        var err = new Error('Not Found');
                        err.status = 404;
                        next(err);
                    }
                } else {
                    if (req.user) {
                        /// catch 404 and forward to error handler
                        var err = new Error('Not Found');
                        err.status = 404;
                        next(err);
                    } else {
                        // not authenticated
                        if (req.originalUrl != '/') {
                            console.log("User is not authenticated. Redirecting to /");
                            res.redirect('/');
                        }
                    }
                }
            });
        }).catch(function (error) {
            var errMsg = "Error while checking role permissions for url " + url;
            console.log(errMsg + ": " + error);
            var err = new Error(errMsg);
            err.status = 500;
            next(err);
        });
    } else {
        next();
    }
});

/// error handlers

app.use(function (err, req, res, next) {
    if (err.code !== 'EBADCSRFTOKEN') {
        return next(err);
    }

    console.log(req.method + " request to " + req.url + " forbidden because CSRF token is missing or expired");

    // handle CSRF token errors here
    res.status(403);
    res.send('CSRF token missing or expired');
});

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
    app.use(function (err, req, res, next) {
        res.status(err.status || 500);
        res.render('error', {
            bootstrapTheme: config.get('bootstrapStyle'),
            message: err.message,
            error: err
        });
    });
}

// production error handler
// no stacktraces leaked to user
app.use(function (err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
        bootstrapTheme: config.get('bootstrapStyle'),
        message: err.message,
        error: {}
    });
});

var httpPort = config.get('httpPort');
var httpsPort = config.get('httpsPort');

var model = require('./model');

/*
 var knex = model.bookshelf.knex;
 var k = knex.initialize( {
 client : 'mysql',
 connection : {
 host : '127.0.0.1',
 user : 'root',
 password : 'root',
 database : 'testdb',
 charset : 'utf8'
 }
 } );
 */

model.createSchemaIfNotExists().then(function () {

    passportStrategies.init(passport, model.bookshelf, function (error) {
        if (error) {
            console.log("Initializing passport strategy " + error.strategy + " failed: " + error.error);
        }
        else {

            if (httpPort > 0) {
                // create http server
                http.createServer(app).listen(httpPort, function () {
                    console.log('Express server listening on port ' + httpPort);
                    if (httpsPort > 0) {
                        // create https server
                        startHttpsServer(app, httpsPort);
                    }
                });
            } else {
                if (httpsPort > 0) {
                    // create https server
                    startHttpsServer(app, httpsPort);
                } else {
                    console.log('httpPort and httpsPort are not specified in config.json. Not starting a http server.');
                }
            }
        }
    });

}).catch(function (err) {
    if (err.syscall == "connect") {
        console.log("Error: can't connect to database.");
    } else {
        console.log("ERROR when creating the database schema: ");
        console.log(err);
    }
});

function startHttpsServer(app, httpsPort) {
    try {
        var secureOptions = {
            key: fs.readFileSync('key.pem'),
            cert: fs.readFileSync('cert.pem')
        };
        https.createServer(secureOptions, app).listen(httpsPort);
        console.log('Express server listening for HTTPS on port ' + httpsPort);
    }
    catch (ex) {
        console.log('Express server NOT listening for HTTPS on port ' + httpsPort + " because key.pem or cert.pem can't be read.");
        if (ex.message) {
            console.log(ex.message);
        }
        else {
            console.log(ex);
        }
    }
}

module.exports = app;

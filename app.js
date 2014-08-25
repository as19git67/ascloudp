var express = require('express');
var path = require('path');
var favicon = require('static-favicon');
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
var rolePermissions = require('./Roles');
var model = require('./model');
var PageContent = model.models.PageContent;

moment.lang("de"); // todo: use language from configuration or browser setting
var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.use(favicon());
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded());
var cookieKey = config.get('cookieKey');
var cookieSecret = config.get('cookieSecret');
var sessionTimeout = config.get('cookieSessionTimeoutInMinutes') * 60 * 1000;
app.use(cookieParser(cookieSecret));
app.use(cookieSession({
    key: cookieKey,
    secret: cookieSecret,
    cookie: {
        maxAge: sessionTimeout
    }
}));

// required for passport
/*
 app.use(expressSession({
 secret: config.get('sessionSecret'),
 saveUninitialized: true,
 resave: true
 }));
 */
app.use(passport.initialize());
app.use(passport.session()); // persistent login sessions
app.use(express.static(path.join(__dirname, 'public')));
app.use(csrf());

app.use('/', routes);

app.use('/admin/databaseManagement', databaseManagement);
app.use('/admin/userManagementUserList', userManagementUserList);
app.use('/admin/userManagementUserEdit', userManagementUserEdit);
app.use('/admin/userManagementRoles', userManagementRoles);
app.use('/admin/userManagementRoleEdit', userManagementRoleEdit);
app.use('/admin/pageManagementPageList', pageManagementPageList);
app.use('/login', login);
app.use('/logoff', logoff);
app.use('/loginRegister', loginRegister);
app.use('/loginRegisterNew', loginRegisterNew);
app.use('/loginManageAccount', loginManageAccount);

app.use(function (req, res, next) {
    var url = req.originalUrl.toLowerCase();
    // remove / from start
    if (url.substr(0, 1) == "/") {
        url = url.substr(1);
    }

    var rp = new rolePermissions(model.models);
    rp.canPost(req).then(function (canPost) {

        model.getPagesForUser(req.user).then(function (pages) {
            var page = _.findWhere(pages, {Name: url});
            if (page) {
                var view = page.View;
                var m = page.isSingleEntity ? page.Model : page.Collection;
                if (view) {
                    var httpMethod = req.method.toLowerCase();
                    var isPost = httpMethod == "post";
                    if ((isPost && canPost) || httpMethod == "get") {
                        var rawHTML;
                        console.log("Loading view " + view + " for model " + m);
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
                                        res.render(view, {
                                            csrfToken: req.csrfToken(),
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
                                        res.render(view, {
                                            csrfToken: req.csrfToken(),
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
                                    res.render(view, {
                                        csrfToken: req.csrfToken(),
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
                                var collectionModel = new collectionModelClass();
                                new model.models.PageCollectionColumn().query(function (qb) {
                                    qb.where({Page_id: page.Name});
                                    qb.orderBy('Order', 'ASC');
                                }).fetchAll().then(function (columnInfos) {
                                    var recordFields = [];
                                    columnInfos.forEach(function(columnInfo){
                                        var fieldInfo = {
                                            Caption: columnInfo.get('Caption')
                                        };
                                        recordFields.push(fieldInfo);
                                    });

                                    new collectionModelClass().query(function (qb) {
                                        // todo: use order columns from page config
                                        qb.orderBy('id', 'ASC');
                                    }).fetchAll().then(function (dataCollection) {
                                        var records = [];
                                        if (dataCollection && dataCollection.length > 0) {
                                            records = dataCollection.map(function (dataModel) {
                                                var dataObj = {};
                                                for (var k in dataModel.attributes) {
                                                    var value = dataModel.attributes[k];
                                                    var value_formatted;
                                                    var value_type = typeof value;

                                                    switch (value_type) {
                                                        case "boolean":
                                                            value_formatted = value ? "Ja" : "Nein";
                                                            break;
                                                        default:
                                                            if (value) {
                                                                if (value instanceof Date) {
                                                                    value_formatted = moment(value).format('LLLL');
                                                                } else {
                                                                    value_formatted = value.toString();
                                                                }
                                                            } else {
                                                                value_formatted = "";
                                                            }
                                                            break;

                                                    }
                                                    dataObj[k] = {
                                                        name: k,
                                                        type: typeof (value),
                                                        value: value,
                                                        value_formatted: value_formatted
                                                    };
                                                }
                                                return dataObj;
                                            });
                                        }
                                        canPost = false; // todo
                                        res.render(view, {
                                            csrfToken: req.csrfToken(),
                                            appName: config.get('appName'),
                                            title: page.isSingleEntity ? page.EntityNameSingular : page.EntityNamePlural,
                                            user: req.user,
                                            pages: pages,
                                            canEdit: canPost,
                                            RecordFields: recordFields,
                                            Records: records
                                        });

                                    });
                                });
                            }
                            else {
                                // Klasse für Collection existiert nicht
                                res.render(view, {
                                    csrfToken: req.csrfToken(),
                                    appName: config.get('appName'),
                                    title: page.isSingleEntity ? page.EntityNameSingular : page.EntityNamePlural,
                                    user: req.user,
                                    pages: pages,
                                    canEdit: false,
                                    RecordFields: [],
                                    Records: [],
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
                /// catch 404 and forward to error handler
                var err = new Error('Not Found');
                err.status = 404;
                next(err);
            }
        });

    }).catch(function (error) {
        var errMsg = "Error while checking role permissions for url " + url;
        console.log(errMsg + ": " + error);
        var err = new Error(errMsg);
        err.status = 500;
        next(err);
    });

});

/// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
    app.use(function (err, req, res, next) {
        res.status(err.status || 500);
        res.render('error', {
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
        message: err.message,
        error: {}
    });
});

var httpPort = config.get('httpPort');
var httpsPort = config.get('httpsPort');

var model = require('./model');
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
    console.log("ERROR when creating the database schema: " + err);
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

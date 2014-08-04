var express = require('express');
var path = require('path');
var favicon = require('static-favicon');
var logger = require('morgan');
var expressSession = require('express-session');
var bodyParser = require('body-parser');
var csrf = require('csurf');
var http = require('http');
var https = require('https');
var fs = require('fs');
var config = require('./config');
var _ = require('underscore');

var passport = require('passport');
var passportStrategies = require('./passportStrategies');
var acl = require('acl');

var routes = require('./routes/index');
var databaseManagement = require('./routes/databasemanagement');
var userManagementUserList = require('./routes/usermanagementuserlist');
var userManagementUserEdit = require('./routes/usermanagementuseredit');
var userManagementRoles = require('./routes/usermanagementroles');
var userManagementRoleEdit = require('./routes/usermanagementroleedit');
var login = require('./routes/login');
var logoff = require('./routes/logoff');
var loginRegister = require('./routes/loginRegister');
var loginRegisterNew = require('./routes/loginRegisterNew');
var loginManageAccount = require('./routes/loginManageAccount');

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.use(favicon());
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded());
// required for passport
app.use(expressSession({
    secret: config.get('sessionSecret'),
    saveUninitialized: true,
    resave: true
}));
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
app.use('/login', login);
app.use('/logoff', logoff);
app.use('/loginRegister', loginRegister);
app.use('/loginRegisterNew', loginRegisterNew);
app.use('/loginManageAccount', loginManageAccount);


/// catch 404 and forward to error handler
app.use(function (req, res, next) {
    var err = new Error('Not Found');
    err.status = 404;
    next(err);
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

var express = require('express');
var path = require('path');
var favicon = require('static-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var http = require('http');
var https = require('https');
var fs = require('fs');
var config = require('./config');
var Promise = require('bluebird/js/main/promise')();
var _ = require('underscore');
var moment = require('moment');
var acl = require('acl');

var passport = require('passport');
var passportStrategies = require('./passportStrategies');

var routes = require('./routes/index');
var users = require('./routes/users');

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.use(favicon());
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use(passport.initialize());
app.use(passport.session());

app.use('/', routes);
app.use('/users', users);

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
model.createSchema().then(function () {
    console.log("Database schema created");

    passportStrategies.init(passport, model.bookshelf);


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

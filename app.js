var express = require('express');
var path = require('path');
var favicon = require('static-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var expressSession = require('express-session');
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
var login = require('./routes/login');
var loginRegister = require('./routes/loginRegister');
var users = require('./routes/users');

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

app.use('/', routes);

app.use('/login', login);
app.use('/loginRegister', loginRegister);

app.get('/auth/twitter', passport.authenticate('twitter'));
app.get('/auth/twitter/callback', passport.authenticate('twitter', { failureRedirect: '/login' }), function (req, res) {
    res.redirect('/loginRegister');
//
//    if (req.body.nexturl) {
//        res.redirect(req.body.nexturl);
//    } else {
//        res.redirect('/');
//    }
});

// GET /auth/google
//   Use passport.authenticate() as route middleware to authenticate the
//   request.  The first step in Google authentication will involve redirecting
//   the user to google.com.  After authenticating, Google will redirect the
//   user back to this application at /auth/google/return
app.get('/auth/google', passport.authenticate('google', {
  failureRedirect: '/login',
  scope: 'https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile'}));

// GET /auth/google/return
//   Use passport.authenticate() as route middleware to authenticate the
//   request.  If authentication fails, the user will be redirected back to the
//   login page.  Otherwise, the primary route function function will be called,
//   which, in this example, will redirect the user to the home page.
app.get('/auth/google/return', passport.authenticate('google', { failureRedirect: '/login' }), function (req, res) {
    res.redirect('/loginRegister');
//  if (req.body.nexturl) {
//    res.redirect(req.body.nexturl);
//  } else {
//    res.redirect('/');
//  }
});

// GET /auth/facebook
//   Use passport.authenticate() as route middleware to authenticate the
//   request.  The first step in Facebook authentication will involve
//   redirecting the user to facebook.com.  After authorization, Facebook will
//   redirect the user back to this application at /auth/facebook/callback
app.get('/auth/facebook', passport.authenticate('facebook'), function (req, res) {
    // The request will be redirected to Facebook for authentication, so this
    // function will not be called.
});

// GET /auth/facebook/callback
//   Use passport.authenticate() as route middleware to authenticate the
//   request.  If authentication fails, the user will be redirected back to the
//   login page.  Otherwise, the primary route function function will be called,
//   which, in this example, will redirect the user to the home page.
app.get('/auth/facebook/callback', passport.authenticate('facebook', { failureRedirect: '/login' }), function (req, res) {
    if (req.body.nexturl) {
        res.redirect(req.body.nexturl);
    } else {
        res.redirect('/');
    }
});


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

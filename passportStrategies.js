var config = require('config');
var LocalStrategy = require('passport-local').Strategy;
var TwitterStrategy = require('passport-twitter').Strategy;
var FacebookStrategy = require('passport-facebook').Strategy;
var GoogleStrategy = require('passport-google').Strategy;


exports.init = function (passport, bookshelf) {

// Passport session setup.
//   To support persistent login sessions, Passport needs to be able to
//   serialize users into and deserialize users out of the session.  Typically,
//   this will be as simple as storing the user ID when serializing, and finding
//   the user by ID when deserializing.
    passport.serializeUser(function (user, done) {
        console.log('serialize user with id ' + user.id);
        console.log(user);
        done(null, user.id);
    });

    passport.deserializeUser(function (id, done) {
        findById(id, function (err, user) {
            console.log('deserialize user with id ' + id);
            console.log(user);
            done(err, user);
        });
    });

// Use the LocalStrategy within Passport.
//   Strategies in passport require a `verify` function, which accept
//   credentials (in this case, a username and password), and invoke a callback
//   with a user object.  In the real world, this would query a database;
//   however, in this example we are using a baked-in set of users.
    passport.use(new LocalStrategy(function (username, password, done) {
        // asynchronous verification, for effect...
        process.nextTick(function () {

            // Find the user by username.  If there is no user with the given
            // username, or the password is not correct, set the user to `false` to
            // indicate failure and set a flash message.  Otherwise, return the
            // authenticated `user`.
            findByUsername(username, function (err, user) {
                if (err) {
                    return done(err);
                }
                if (!user) {
                    return done(null, false, { message: 'Unknown user ' + username });
                }
                if (user.password != password) {
                    return done(null, false, { message: 'Invalid password' });
                }
                return done(null, user);
            })
        });
    }));

    passport.use(new TwitterStrategy({
        consumerKey: 'RWnmAsr1dUbamtTlUtAQ',
        consumerSecret: 'Yso9rPksWJuSQHbCaciyujwvwoIZKj5Yp3yaeSuItxE',
        callbackURL: "https://localhost:3002/auth/twitter/callback"
    }, function (token, tokenSecret, profile, done) {
        // todo: use real user database to store and get user information
        findById(profile.id, function (err, user) {
            if (err) {
                console.log('TwitterStrategy: added user: ' + profile.username + ' with id ' + profile.id);
                users[profile.id] =
                { id: profile.id, username: profile.username, password: '', email: profile.email, token: token, tokenSecret: tokenSecret, profile: profile };
                console.log(users[profile.id]);
                done(null, users[profile.id]);
            } else {
                done(null, user);
            }
        });
    }));

    passport.use(new FacebookStrategy({
        clientID: '352113358207935',
        clientSecret: '61401eb81f2c04fbaa1098ae86710651',
        callbackURL: "https://localhost:3002/auth/facebook/callback"
    }, function (accessToken, refreshToken, profile, done) {
        // asynchronous verification, for effect...
        process.nextTick(function () {
            // todo: use real user database to store and get user information
            findById(profile.id, function (err, user) {
                if (err) {
                    console.log('FacebookStrategy: added user: ' + profile.username + ' with id ' + profile.id);
                    users[profile.id] =
                    { id: profile.id, username: profile.username, password: '', email: profile.email, token: accessToken, refreshToken: refreshToken, profile: profile };
                    console.log(users[profile.id]);
                    return done(null, users[profile.id]);
                } else {
                    return done(null, user);
                }
            });
        });
    }));

// Use the GoogleStrategy within Passport.
//   Strategies in passport require a `validate` function, which accept
//   credentials (in this case, an OpenID identifier and profile), and invoke a
//   callback with a user object.
    passport.use(new GoogleStrategy({
        returnURL: 'https://localhost:3002/auth/google/return',
        realm: 'https://localhost:3002/'
    }, function (identifier, profile, done) {
        // asynchronous verification, for effect...
        process.nextTick(function () {

            // To keep the example simple, the user's Google profile is returned to
            // represent the logged-in user.  In a typical application, you would want
            // to associate the Google account with a user record in your database,
            // and return that user instead.
            // todo: use real user database to store and get user information
            findById(profile.identifier, function (err, user) {
                if (err) {
                    console.log('GoogleStrategy: added user: ' + profile.username + ' with id ' + identifier);
                    users[identifier] =
                    { id: identifier, username: profile.emails[0].value, password: '', email: profile.emails[0].value, profile: profile };
                    console.log(users[identifier]);
                    return done(null, users[identifier]);
                } else {
                    return done(null, user);
                }
            });
        });
    }));

    function findById(id, fn) {
        var idx;
        idx = id;
        // todo: select from database
        if (users[idx]) {
            fn(null, users[idx]);
        } else {
            fn(new Error('User ' + id + ' does not exist'));
        }
    }

    function findByUsername(username, fn) {
        for (var i = 0, len = users.length; i < len; i++) {
            //todo: select from database
            var user = users[i];
            if (user.username === username) {
                return fn(null, user);
            }
        }
        return fn(null, null);
    }


};

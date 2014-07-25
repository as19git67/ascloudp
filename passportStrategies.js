var config = require('./config');
var LocalStrategy = require('passport-local').Strategy;
var TwitterStrategy = require('passport-twitter').Strategy;
var FacebookStrategy = require('passport-facebook').Strategy;
var GoogleStrategy = require('passport-google-oauth').OAuth2Strategy;
var model = require('./model');
var User = model.models.User;
var UserLogin = model.models.UserLogin;

var notRegisteredUsers = {};


module.exports.init = function (passport, bookshelf, callback) {

  var enabledStrategies = {};

    // Passport session setup.
    //   To support persistent login sessions, Passport needs to be able to
    //   serialize users into and deserialize users out of the session.  Typically,
    //   this will be as simple as storing the user ID when serializing, and finding
    //   the user by ID when deserializing.
    passport.serializeUser(function (user, done) {
        if (user.isNotLocalUser) {
            console.log('serialize notRegisteredUser with id ' + user.id);
            notRegisteredUsers[user.id] = user;
            done(null, {isNotLocalUser: true, providerAndKey: user.id, provider: user.profile.provider, providerKey: user.profile.id });
        } else {
            // nothing to do registered user - remembering the id is enough
            console.log('serialize user with id ' + user.id);
            done(null, {isNotLocalUser: false, userId: user.id});
        }
    });

    passport.deserializeUser(function (userSpec, done) {
        findUser(userSpec, done);
    });

    if (config.get('authGoogleClientId') && config.get('authGoogleClientSecret') && config.get('authGoogleCallbackURL')) {
        // Use the GoogleStrategy within Passport.
        try {
            passport.use(new GoogleStrategy({
                    clientID: config.get('authGoogleClientId'),
                    clientSecret: config.get('authGoogleClientSecret'),
                    callbackURL: config.get('authGoogleCallbackURL')
                },
                function (accessToken, refreshToken, profile, done) {
                    if (!profile) {
                        return done(null, null);
                    }
                    console.log("Suche Google user mit profile.id " + profile.id);
                    findByProviderKey(profile.provider, profile.id, function (err, user) {
                        if (err) {
                            console.log('Fehler bei der Suche nach Google user mit provider key ' + profile.id + ' Error: ' + err);
                            return done(err);
                        } else {
                            // it could be that findByProviderKey did not return a user and then it is null
                            if (user) {
                                console.log('Google user mit provider key ' + profile.id + ' ist als ' + user.UserName + ' in der DB vorhanden');
                            } else {
                                console.log('Kein Google user mit provider key ' + profile.id + ' bekannt');
                                // user from given provider is not registered in DB -> create temp user object to pass forward
                                // to the registration page
                                user = {
                                    id: profile.provider + '_' + profile.id,
                                    isNotLocalUser: true,
                                    profile: profile
                                };
                            }
                            return done(null, user);
                        }
                    });
                }
            ));
          enabledStrategies['google'] = true;
        }
        catch (error) {
            callback({ strategy: "google", error: error});
            return;
        }
    }


    if (config.get('authTwitterConsumerKey') && config.get('authTwitterConsumerSecret') && config.get('authTwitterCallbackURL')) {
        try {
            passport.use(new TwitterStrategy({
                    consumerKey: config.get('authTwitterConsumerKey'),
                    consumerSecret: config.get('authTwitterConsumerSecret'),
                    callbackURL: config.get('authTwitterCallbackURL')
                },
                function (token, tokenSecret, profile, done) {
                    if (!profile) {
                        return done(null, null);
                    }
                    console.log("Suche Twitter user mit profile.id " + profile.id);
                    findByProviderKey(profile.provider, profile.id, function (err, user) {
                        if (err) {
                            console.log('Fehler bei der Suche nach Twitter user mit provider key ' + profile.id + ' Error: ' + err);
                            return done(err);
                        } else {
                            // it could be that findByProviderKey did not return a user and then it is null
                            if (user) {
                                console.log('Twitter user mit provider key ' + profile.id + ' ist als ' + user.UserName + ' in der DB vorhanden');
                            } else {
                                console.log('Kein Twitter user mit provider key ' + profile.id + ' bekannt');
                                // user from given provider is not registered in DB -> create temp user object to pass forward
                                // to the registration page
                                user = {
                                    id: profile.provider + '_' + profile.id,
                                    isNotLocalUser: true,
                                    profile: profile
                                };
                            }
                            return done(null, user);
                        }
                    });
                }
            ));
          enabledStrategies['twitter'] = true;
        }
        catch (error) {
            callback({ strategy: "twitter", error: error});
            return;
        }
    }

    if (config.get('authFacebookAppId') && config.get('authFacebookAppSecret') && config.get('authFacebookCallbackURL')) {
        try {
            passport.use(new FacebookStrategy({
                    clientID: config.get('authFacebookAppId'),
                    clientSecret: config.get('authFacebookAppSecret'),
                    callbackURL: config.get('authFacebookCallbackURL')
                },
                function (token, tokenSecret, profile, done) {
                    if (!profile) {
                        return done(null, null);
                    }
                    console.log("Suche Facebook user mit profile.id " + profile.id);
                    findByProviderKey(profile.provider, profile.id, function (err, user) {
                        if (err) {
                            console.log('Fehler bei der Suche nach Facebook user mit provider key ' + profile.id + ' Error: ' + err);
                            return done(err);
                        } else {
                            // it could be that findByProviderKey did not return a user and then it is null
                            if (user) {
                                console.log('Facebook user mit provider key ' + profile.id + ' ist als ' + user.UserName + ' in der DB vorhanden');
                            } else {
                                console.log('Kein Facebook user mit provider key ' + profile.id + ' bekannt');
                                // user from given provider is not registered in DB -> create temp user object to pass forward
                                // to the registration page
                                user = {
                                    id: profile.provider + '_' + profile.id,
                                    isNotLocalUser: true,
                                    profile: profile
                                };
                            }
                            return done(null, user);
                        }
                    });
                }
            ));
          enabledStrategies['facebook'] = true;
        }
        catch (error) {
            callback({ strategy: "facebook", error: error});
            return;
        }
    }

    // Use the LocalStrategy within Passport.
    //   Strategies in passport require a `verify` function, which accept
    //   credentials (in this case, a username and password), and invoke a callback
    //   with a user object.  In the real world, this would query a database;
    //   however, in this example we are using a baked-in set of users.
    try {
        passport.use(new LocalStrategy({
                usernameField: 'email',
                passwordField: 'password'},
            function (username, password, done) {
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
                        var salt = user.PasswordSalt;
                        var hashedPassword = model.encryptPassword(password, salt);
                        if (user.PasswordHash != hashedPassword) {
                            return done(null, false, { message: 'Invalid password' });
                        }
                        return done(null, user);
                    })
                });
            }));
      enabledStrategies['local'] = true;
    }
    catch (error) {
        callback({ strategy: "local", error: error});
        return;
    }

    var findByUsername = function (username, fn) {
        new User({'UserName': username})
            .fetch({withRelated: ['UserLogin']})
            .then(function (model) {
                if (model) {
                    console.log('found user by username ' + username + ': ' + model.get('id'));
                    fn(null, model.attributes);
                } else {
                    console.log('username ' + username + ' not found in DB');
                    fn(null, null);
                }
            })
            .catch(function (error) {
                if (error) {
                    console.log('User ' + username + ' does not exist. ' + error);
                }
                fn(null, null);
                //          fn(new Error('User ' + id + ' does not exist. ' + error));
            });
    };

    var findUser = function (userSpec, done) {
        if (userSpec.isNotLocalUser) {
            var provider = userSpec.provider;
            var providerKey = userSpec.providerKey;
            findByProviderKey(provider, providerKey, function (err, user) {
                if (err) {
                    console.log('Error in findUser. Error returned from findByProviderKey: ' + err);
                    done(err);
                }
                else {
                    if (user) {
                        done(null, user);
                    }
                    else {
                        var id = userSpec.providerAndKey;
                        if (id && notRegisteredUsers[id]) {
                            console.log('findUser: found not registered user with provider key ' + id);
                            done(null, notRegisteredUsers[id]);
                        } else {
                            console.log('findUser: found unknown user with provider key ' + id);
                            done(null, false);
                        }
                    }
                }
            });
        } else {
            findById(userSpec.userId, function (err, user) {
                done(err, user);
            });
        }
    };

  var getEnabledStrategies = function()
  {
    return enabledStrategies;
  }

  module.exports.getEnabledStrategies = getEnabledStrategies;
    module.exports.findByUsername = findByUsername;
    module.exports.findUser = findUser;

    callback(null);
};

function findByProviderKey(providerName, providerKey, fn) {
    new UserLogin({
        'LoginProvider': providerName,
        'ProviderKey': providerKey
    }).fetch({withRelated: ['User']})
        .then(function (userLogin) {
            if (userLogin) {
                var user = userLogin.related('User');
                if (user) {
                    console.log('found user by providerName ' + providerName + '. userId: ' + userLogin.get('User_id') + ', username: ' + user.get('UserName'));
                    fn(null, user.attributes);
                }
                else {
                    console.log('NO user found for UserLogin with providerName ' + providerName + '. userId: ' + userLogin.get('User_id'));
                    fn(null, null);
                }
            } else {
                // provider-key noch nicht als registrierter User bekannt
                fn(null, null);
            }
        })
        .catch(function (error) {
            fn(new Error('Error while looking up ' + providerName + ' User with id ' + providerKey + '. ' + error));
        });

}

function findById(userId, fn) {
    new User({'id': userId})
        .fetch({withRelated: ['UserLogin']})
        .then(function (model) {
            if (model) {
                console.log('found user by id ' + userId + ': ' + model.get('UserName'));
                fn(null, model.attributes);
            } else {
                fn(null, null); // user not found
            }
        })
        .catch(function (error) {
            fn(new Error('User ' + userId + ' does not exist. ' + error));
        });
}

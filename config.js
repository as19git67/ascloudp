var nconf = require('nconf');

nconf.argv().env().file({ file: 'config.json' });

nconf.defaults({
    "appName": "ASCloud",
    "bootstrapStyle": undefined,
    "adminUser": undefined,
    "initialAdminPassword": undefined,
    "cookieSecret": "super duper",
    "cookieSessionTimeoutInMinutes": 30,
    "authGoogleClientId": undefined,
    "authGoogleClientSecret": undefined,
    "authGoogleCallbackURL": undefined,
    "authTwitterConsumerKey": undefined,
    "authTwitterConsumerSecret": undefined,
    "authTwitterCallbackURL": undefined,
    "authFacebookAppId": undefined,
    "authFacebookAppSecret": undefined,
    "authFacebookCallbackURL": undefined,
    "tokenLifetime": '120',
    "httpPort": 0,
    "httpsPort": 0,
    "databaseClient": "postgres",
    "connectionString": "postgres://*USERNAME*:*PASSWORD*@*HOST*:*PORT*/*DATABASE*"
    /*
     "databaseConnection": {
     "host"     : '127.0.0.1',
     "user"     : 'your_database_user',
     "password" : 'your_database_password',
     "database" : 'myapp_test',
     "charset"  : 'utf8'
     }
     */
});

module.exports = nconf;

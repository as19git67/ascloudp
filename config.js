var nconf = require('nconf');

nconf.argv().env().file({ file: 'config.json' });

nconf.defaults({
    "appName": "ASCloud",
    "sessionSecret": "top secret",
    "tokenLifetime": '120',
    "httpPort": 0,
    "httpsPort": 0,
    "databaseClient": "postgress",
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

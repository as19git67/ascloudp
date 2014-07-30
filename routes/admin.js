var express = require('express');
var router = express.Router();
var config = require('../config');
var passportStrategies = require('../passportStrategies');

/* GET Admin page. */
router.get('/', passportStrategies.ensureAuthenticated, function (req, res) {
    var appName = config.get('appName');
    res.render('admin', {
      csrfToken: req.csrfToken(),
        appName: appName,
        title: 'Administration',
        user: req.user
    });
});

router.post('/', passportStrategies.ensureAuthenticated, function (req, res) {
    var appName = config.get('appName');

    if (req.body.dbinit) {
        var model = require('../model');
        model.createSchema()
            .then(function () {
                console.log("Database schema created");
                var statusText = "Datenbanktabellen neu erzeugt";
                res.render('admin', {
                    appName: appName,
                    title: 'Administration',
                    user: req.user,
                    status: statusText
                });
            })
            .catch(function (err) {
                console.log("ERROR when creating the database schema: " + err);
                var errorText = "Fehler beim erzeugen der Datenbanktabellen. " + err;
                res.render('admin', {
                    appName: appName,
                    title: 'Administration',
                    user: req.user,
                    error: errorText
                });
            });
    }
    else if (req.body.usermanagement) {
        res.redirect('/admin/usermanagementuserlist');
    }
    else if (req.body.rolemanagement) {
            res.redirect('/admin/usermanagementroles');
    } else {
        res.redirect('/admin');
    }
});

module.exports = router;

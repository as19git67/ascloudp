var express = require('express');
var router = express.Router();
var config = require('../config');
var model = require('../model');
var User = model.models.User;
var UserLogin = model.models.UserLogin;

router.post('/', function (req, res, next) {
    if (req.user) {
        new User({'id': req.user.id}).fetch({
            withRelated: ['UserLogin']
        }).then(function (userModel) {
            if (userModel) {

                var provider = req.body.provider;


                if (req.body.nexturl) {
                    res.redirect(req.body.nexturl);
                } else {
                    res.redirect('/');
                }
            }
            else {
                if (req.body.nexturl) {
                    res.redirect(req.body.nexturl);
                } else {
                    res.redirect('/');
                }

            }
        }).catch(function (error) {
            console.log("Error while accessing users in the database: " + error);
            var err = new Error(error);
            err.status = 500;
            next(err);
        });
    } else {
        console.log("No user object in request. Redirecting to /");
        res.redirect('/');
    }
});

module.exports = router;

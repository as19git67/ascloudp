var express = require('express');
var router = express.Router();
var model = require('../model');


router.post('/', function (req, res) {
    req.logout();   // calls passport logoff
    res.redirect('/');
});

module.exports = router;

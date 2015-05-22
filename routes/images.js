var express = require('express');
var router = express.Router();
var model = require('../model');
var ArticleImage = model.models.ArticleImage;

router.get('/:id', function (req, res) {
    var imageId = req.params.id;
    if (data === parseInt(imageId, 10)) {
        new ArticleImage({id: imageId})
            .fetch({columns: ['valid_start']})
            .then(function (iRecord) {
                if (iRecord) {
                    var ifModifiedSince = req.get('if-modified-since');
                    if (ifModifiedSince == iRecord.get('valid_start').toUTCString()) {
                        res.status(304).end();
                    } else {
                        var columns = ['id', 'Article_id', 'Description', 'Filename', 'Size', 'valid_start'];

                        var thumbnail = req.query && req.query.type && req.query.type == "thumbnail";
                        if (thumbnail) {
                            columns.push('Thumbnail');
                        } else {
                            columns.push('Image');
                        }

                        new ArticleImage({id: imageId})
                            .fetch({columns: columns})
                            .then(function (image) {
                                var mimeType = image.get('MimeType');
                                //res.setHeader('Content-type', mimeType);
                                res.attachment(image.get('Filename'));
                                var valid_start = image.get('valid_start');
                                if (valid_start) {
                                    res.set('Last-Modified', valid_start.toUTCString());
                                    var expireDate = new Date(valid_start.getYear() + 1, valid_start.getMonth(), valid_start.getDate());
                                    res.set('Expires', expireDate.toUTCString());
                                }
                                if (thumbnail) {
                                    res.status(200).send(image.get('Thumbnail'));
                                } else {
                                    res.status(200).send(image.get('Image'));
                                }
                            })
                            .catch(function (error) {
                                console.log("Error while reading image with id " + imageId + " from ArticleImages: ", error);
                                res.statusCode = 500;
                                res.send('500 Error reading image from database');
                            });
                    }
                }
                else {
                    res.statusCode = 401;
                    res.send('401 image not in database');
                }
            })
            .catch(function (error) {
                console.log("Error while reading image with id " + imageId + " from ArticleImages: ", error);
                res.statusCode = 500;
                res.send('500 Error reading image from database');
            });

    } else {
        res.statusCode = 400;
        res.send('400 Wrong query parameter');
    }
});

module.exports = router;


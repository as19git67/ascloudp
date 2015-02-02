var express = require('express');
var router = express.Router();
var model = require('../model');
var ArticleImage = model.models.ArticleImage;

router.get('/:id', function (req, res) {
    var imageId = req.params.id;
    var columns = ['id', 'Article_id', 'Description', 'Filename', 'Size'];
    var thumbnail = req.query && req.query.type && req.query.type == "thumbnail";
    if (thumbnail) {
        columns.push('Thumbnail');
    } else {
        columns.push('Image');
    }

    if (imageId) {
        new ArticleImage({id: imageId})
            .fetch({columns: columns})
            .then(function (image) {
                var mimeType = image.get('MimeType');
                //res.setHeader('Content-type', mimeType);
                res.attachment(image.get('Filename'));
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
    } else {
        res.statusCode = 400;
        res.send('400 Wrong query parameter');
    }
});

module.exports = router;


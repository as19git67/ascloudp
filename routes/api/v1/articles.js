var _ = require('underscore');
var Promise = require('bluebird/js/main/promise')();
var model = require('../../../model');
var moment = require('moment');
var formidable = require('formidable');
var tmp = require('tmp');
var path = require('path');
var fs = require('fs');
var Jimp = require('jimp');
var Article = model.models.Article;
var ArticleItem = model.models.ArticleItem;
var ArticleImage = model.models.ArticleImage;
var ArticleImages = model.models.ArticleImages;
var Upload = model.models.Upload;
var Uploads = model.models.Uploads;
var Audit = model.models.Audit;

var knex = model.bookshelf.knex;

function respondWithArticleItemData(req, res, articleItem, articleImages) {
    getArticleItemSchema().then(function (article_schema) {

        var csrfToken = req.csrfToken();
        res.cookie('X-CSRF-Token', csrfToken); // for angularjs use a cookie instead a header parameter
        res.json(
            {
                article: {
                    article_id: articleItem.get('Article_id'),
                    date: articleItem.get('Date'),
                    title: articleItem.get('Title'),
                    leadText: articleItem.get('LeadText'),
                    text: articleItem.get('Text'),
                    author: articleItem.get('Author'),
                    publish_start: articleItem.get('publish_start'),
                    publish_end: articleItem.get('publish_end')
                },
                article_images: articleImages,
                article_schema: article_schema
            }
        );
    }).catch(function (error) {
        console.log("Error while reading columnInfo for ArticleItem from database: " + error);
        res.statusCode = 500;
        return res.send('Error 500: reading schema info for articles from database failed');
    });
}

module.exports.get = function (req, res) {
    if (req.query && req.query.type && req.query.type == "schema") {
        getArticleItemSchema().then(function (article_schema) {
            var csrfToken = req.csrfToken();
            res.cookie('X-CSRF-Token', csrfToken); // for angularjs use a cookie instead a header parameter
            res.json(
                {
                    article_schema: article_schema
                }
            );
        }).catch(function (error) {
            console.log("Error while reading columnInfo for ArticleItem from database: " + error);
            res.statusCode = 500;
            return res.send('Error 500: reading schema info for articles from database failed');
        });
    } else {
        var articleId = req.params.id;
        var whereClause = {Article_id: articleId};
        var includeDeleted = false;
        if (req.query && req.query.include && req.query.include.indexOf("deleted") >= -1) {
            includeDeleted = true;
        }
        if (includeDeleted == false) {
            whereClause.valid_end = null;
        }

        new ArticleItem(whereClause).fetch().then(function (articleItem) {
            if (articleItem) {
                var articleImages = [];
                new ArticleImages()
                    .query(function (qb) {
                        qb.where({'Article_id': articleId}).andWhere({'valid_end': null});
                        qb.orderBy('Filename', 'ASC');
                        qb.orderBy('Description', 'ASC');
                    })
                    .fetch({columns: ['id', 'Article_id', 'Description', 'Filename', 'Size', 'MimeType']})
                    .then(function (images) {
                        if (images) {
                            images.each(function (image) {
                                articleImages.push({
                                    Article_id: image.get('Article_id'),
                                    Description: image.get('Description'),
                                    Filename: image.get('Filename'),
                                    Size: image.get('Size'),
                                    MimeType: image.get('MimeType'),
                                    id: image.get('id')
                                });
                            });
                        }
                        respondWithArticleItemData(req, res, articleItem, articleImages);
                    })
                    .catch(function (error) {
                        console.log("Error while reading article images from database: " + error);
                        res.statusCode = 500;
                        return res.send('Error 500: reading of article images from database failed');
                    });
            } else {
                res.statusCode = 404;
                res.send('Error 404: ArticleItem with Article_id ' + articleId + ' not found');
            }

        }).catch(function (error) {
            console.log("Error while reading articles from database: " + error);
            res.statusCode = 500;
            return res.send('Error 500: reading of articles from database failed');
        });
    }
};

module.exports.getImages = function (req, res) {
    var articleId = req.params.id;
    if (articleId) {
        var articleImages = [];
        new ArticleImages()
            .query(function (qb) {
                qb.where({'Article_id': articleId}).andWhere({'valid_end': null});
                qb.orderBy('Filename', 'ASC');
                qb.orderBy('Description', 'ASC');
            })
            .fetch({columns: ['id', 'Article_id', 'Description', 'Filename', 'Size', 'MimeType']})
            .then(function (images) {
                if (images) {
                    images.each(function (image) {
                        articleImages.push({
                            Article_id: image.get('Article_id'),
                            Description: image.get('Description'),
                            Filename: image.get('Filename'),
                            Size: image.get('Size'),
                            MimeType: image.get('MimeType'),
                            id: image.get('id')
                        });
                    });
                }
                var csrfToken = req.csrfToken();
                res.cookie('X-CSRF-Token', csrfToken); // for angularjs use a cookie instead a header parameter
                res.json({article_images: articleImages}
                );
            })
            .catch(function (error) {
                console.log("Error while reading article images from database: " + error);
                res.statusCode = 500;
                return res.send('Error 500: reading of article images from database failed');
            });
    } else {
        res.statusCode = 400;
        res.send('400 Wrong query parameter');
    }
};

module.exports.getImageChunk = function (req, res) {
    var articleId = req.params.id;

    if (req.query && req.query.flowChunkNumber) {
        // get requests from flow.js (if testChunks is true)
        var flowChunkNumber = req.query.flowChunkNumber;
        var flowIdentifier = req.query.flowIdentifier;
        var flowFilename = req.query.flowFilename;
        console.log("Flow asks for chunk id " + flowChunkNumber + " of file id " + flowIdentifier + " for article with id " + articleId);

        new ArticleImage(
            {
                Article_id: articleId,
                Filename: flowFilename
            })
            .fetch({columns: ['id']})
            .then(function (image) {
                if (image) {
                    // image already exists
                    res.status(409).send();// conflict
                } else {
                    new Upload({flowIdentifier: flowIdentifier, flowChunkNumber: flowChunkNumber})
                        .fetch()
                        .then(function (chunk) {
                            if (chunk) {
                                console.log("chunk is already uploaded");
                                res.status(200).send();
                            } else {
                                console.log("chunk is unkown");
                                res.status(404).send();
                            }
                        })
                        .catch(function (error) {
                            console.log("Error while reading chunk from Upload table:", error);
                            res.statusCode = 500;
                            res.send('500 Error reading upload chunk from database');
                        });

                }

            })
            .catch(function (error) {
                console.log("Error while reading ArticleImage table:", error);
                res.statusCode = 500;
                res.send('500 Error looking for existing ArticleImage in database');
            });
    } else {
        res.statusCode = 400;
        res.send('400 Wrong query parameter');
    }
};

module.exports.postImageChunk = function (req, res) {

    var form = new formidable.IncomingForm();

    form.parse(req, function (err, fields, files) {

        console.log("Storing new flowChunk. flowChunkNumber: " + fields.flowChunkNumber + " flowFilename: " + fields.flowFilename);
        new Upload({
            flowChunkNumber: fields.flowChunkNumber,
            flowChunkSize: fields.flowChunkSize,
            flowCurrentChunkSize: fields.flowCurrentChunkSize,
            flowFilename: fields.flowFilename,
            flowIdentifier: fields.flowIdentifier,
            flowRelativePath: fields.flowRelativePath,
            flowTotalChunks: fields.flowTotalChunks,
            flowTotalSize: fields.flowTotalSize,
            mimeType: files.file.type,
            tempFile: files.file.path
        }).save().then(function (savedUpload) {
                res.statusCode = 200; // OK
                res.send('200 OK');
            })
            .catch(function (error) {
                console.log("Error while inserting table Upload: ", error);
                deleteFlowChunksAndSendRespond(fields.flowIdentifier, res, 500, "Insert into upload table of database failed");
            });
    });

};

function deleteFlowChunksAndSendRespond(flowIdentifier, res, statusCode, statusText) {
    model.bookshelf.knex('Uploads')
        .where({flowIdentifier: flowIdentifier})
        .del()
        .then(function () {
            res.statusCode = statusCode;
            res.send(statusCode.toString() + " " + statusText);
        })
        .catch(function () {
            res.statusCode = statusCode;
            res.send(statusCode.toString() + " " + statusText);
        })
}

module.exports.postImage = function (req, res) {

    var articleId = req.params.id;
    var flowIdentifier = req.body.flowIdentifier;
    var flowTotalChunks = req.body.flowTotalChunks;
    console.log("postImage: flowIdentifier=" + flowIdentifier + ", flowTotalChunks=" + flowTotalChunks + ", Article_id=" + articleId);
    new Uploads()
        .query(function (qb) {
            qb.where('flowIdentifier', flowIdentifier);
            qb.orderBy('flowChunkNumber', 'ASC');
        })
        .fetch()
        .then(function (chunks) {
            if (chunks.models.length == flowTotalChunks) {
                console.log("All chunks retrieved. Number of chunks: " + chunks.models.length);
                var imageFileBuffer = undefined;
                var chunkBuffers = new Array(chunks.models.length);
                var flowFilename;
                var flowTotalSize;
                var mimeType = "";
                var idx = 0;
                chunks.each(function (chunk) {
                    console.log("Using chunk " + chunk.attributes.flowChunkNumber + " to make image buffer for file " + chunk.attributes.flowFilename);
                    var tempFile = chunk.attributes.tempFile;
                    flowFilename = chunk.attributes.flowFilename;
                    flowTotalSize = chunk.attributes.flowTotalSize;
                    mimeType = chunk.attributes.mimeType;
                    var tf = chunk.attributes.tempFile;
                    chunkBuffers[idx] = fs.readFileSync(tf);
                    idx = idx + 1;
                });
                console.log("Concatenate all chunks");
                var imageFileBuffer = Buffer.concat(chunkBuffers);

                // todo: DB cleanup auch bei Fehler

                function removeChunkFiles() {
                    chunks.each(function (chunk) {
                        var tf = chunk.attributes.tempFile;
                        if (fs.existsSync(tf)) {
                            fs.unlinkSync(tf);
                        }
                    });
                }

                if (imageFileBuffer) {
                    console.log("deleting all chunks from Uploads table");
                    model.bookshelf.knex('Uploads')
                        .where({flowIdentifier: flowIdentifier})
                        .del()
                        .then(function () {
                            try {
                                console.log("Generating thumbnail...");
                                var jimpImage = new Jimp(imageFileBuffer, mimeType, function () {
                                    var width = this.bitmap.width;
                                    var factor = 400 / width;   // scale to specific pixel width
                                    this.scale(factor) // scale
                                        .quality(60); // set JPEG quality
                                    this.getBuffer(mimeType, function (thumbnailBuffer) {
                                        console.log("Thumbnail generated. Size: " + thumbnailBuffer.length);
                                        console.log("Image file: " + flowFilename);

                                        new ArticleImage(
                                            {
                                                Article_id: articleId,
                                                Image: imageFileBuffer,
                                                Thumbnail: thumbnailBuffer,
                                                MimeType: mimeType,
                                                Filename: flowFilename,
                                                Size: flowTotalSize,
                                                valid_start: new Date()
                                            }
                                        ).save().then(function (savedImage) {
                                                console.log("Image with id " + savedImage.get('id') + " saved");
                                                removeChunkFiles();
                                                res.statusCode = 200; // OK
                                                res.send('200 OK');
                                            }).catch(function (error) {
                                                console.log("Error while saving image in table ArticleImages: ", error);
                                                removeChunkFiles();
                                                res.statusCode = 500;
                                                res.send('500 Saving image in database failed');
                                            });

                                    });
                                });
                            }
                            catch (e) {
                                removeChunkFiles();
                                console.log("Error: Jimp failed. ", e);
                                res.statusCode = 500;
                                res.send('500 generating image thumbnail failed');
                            }
                        })
                        .catch(function (error) {
                            removeChunkFiles();
                            console.log("Error while deleting flowChunks from table Upload: ", error);
                            res.statusCode = 500;
                            res.send('500 Deleting chunks from upload table of database failed');
                        });

                } else {
                    console.log("Error: imageFileBuffer is undefined");
                    removeChunkFiles();
                    deleteFlowChunksAndSendRespond(flowIdentifier, res, 500, "Failed concatenating image chunks");
                }
            } else {
                console.log("Error: " + flowTotalChunks + " are expected, but only " + chunks.models.length + " were stored so far.");
                removeChunkFiles();
                deleteFlowChunksAndSendRespond(flowIdentifier, res, 412, "Can't finish image upload because not all data chunks were received on the server");
            }

        })
        .catch(function (error) {
            console.log("Error while retrieving flowChunks from table Upload: ", error);
            res.statusCode = 500;
            res.send('500 Reading chunks from upload table of database failed');
        });
};

function getArticleItemSchema() {
    return new Promise(function (resolve, reject) {
        var tableName = new ArticleItem().tableName;
        knex(tableName).columnInfo()
            .then(function (articleItemSchema) {
                var article_schema = {
                    date: _.extend(articleItemSchema['Date'], {
                        name: "date",
                        label: "Datum",
                        description: "Artikeldatum"
                    }),
                    text: _.extend(articleItemSchema['Text'], {
                        label: "Artikeltext",
                        description: "Text des Artikels"
                    }),
                    title: _.extend(articleItemSchema['Title'], {
                        label: "Titel",
                        description: "Titel des Artikels"
                    }),
                    leadText: _.extend(articleItemSchema['LeadText'], {
                        label: "Zusammenfassung",
                        description: "Zusammenfassung des Artikels"
                    }),
                    author: _.extend(articleItemSchema['Author'], {
                        label: "Verfasser",
                        description: "Autor des Artikels"
                    }),
                    publish_start: _.extend(articleItemSchema['publish_start'], {
                        label: "Start Veröffentlichung",
                        description: "Beginn der Veröffentlichung des Artikels"
                    }),
                    publish_end: _.extend(articleItemSchema['publish_end'], {
                        label: "Ende Veröffentlichung",
                        description: "Ende der Veröffentlichung des Artikels"
                    })
                };
                resolve(article_schema);
            })
            .catch(function (error) {
                reject(error);
            });

    });
}

function isDateDifferent(articleItem, dbTableColumn, reqBody, sentDateName) {
    var pModelDate;
    var mSentDate;

    if (articleItem.get(dbTableColumn)) {
        pModelDate = moment(articleItem.get(dbTableColumn));
        if (pModelDate.isValid() == false) {
            pModelDate = undefined;
        }
    }
    if (reqBody[sentDateName]) {
        mSentDate = moment(reqBody[sentDateName]);
        if (mSentDate.isValid() == false) {
            mSentDate = undefined;
        }
    }
    if (pModelDate && mSentDate) {
        return pModelDate.isSame(mSentDate) == false;
    }
    return !(pModelDate == undefined && mSentDate == undefined);
}


// edit article
module.exports.put = function (req, res) {
    var articleId = req.params.id;


    new ArticleItem({Article_id: articleId, valid_end: null})
        .fetch()
        .then(function (articleItem) {
            if (articleItem) {
                var articleDateIsDifferent = isDateDifferent(articleItem, "Date", req.body, "date");
                if (!articleDateIsDifferent) {
                    var publishStartIsDifferent = isDateDifferent(articleItem, "publish_start", req.body, "publish_start");
                    if (!publishStartIsDifferent) {
                        var publishEndIsDifferent = isDateDifferent(articleItem, "publish_end", req.body, "publish_end");
                        if (!publishEndIsDifferent) {
                            var authorIsDifferent = articleItem.get('Author') != req.body.author;
                            if (!authorIsDifferent) {
                                var textIsDifferent = articleItem.get('Text') != req.body.text;
                                if (!textIsDifferent) {
                                    var titleIsDifferent = articleItem.get('Title') != req.body.title;
                                    if (!titleIsDifferent) {
                                        var leadTextIsDifferent = articleItem.get('LeadText') != req.body.leadText;
                                        if (!leadTextIsDifferent) {
                                            // until here, nothing has changed
                                            console.log("Not saving ArticleItem because nothing changed.");
                                            res.statusCode = 304;   // not changed
                                            res.send("304: Article not changed");
                                            return;
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

                // start a transaction because articleItem and audit are updated
                model.bookshelf.transaction(function (t) {
                    var now = new Date();

                    // invalidate current articleItem record
                    articleItem.set('valid_end', now);
                    articleItem.save(null, {transacting: t}).then(function () {

                        // create new ArticleItem
                        new ArticleItem({
                            Article_id: articleId,
                            Date: req.body.date,
                            Author: req.body.author,
                            Text: req.body.text,
                            Title: req.body.title,
                            LeadText: req.body.leadText,
                            publish_start: req.body.publish_start,
                            publish_end: req.body.publish_end,
                            valid_start: now
                        }).save(null, {transacting: t}).then(function (savedArticleItem) {
                                var userName = req.user.UserName ? req.user.UserName : req.user.id;
                                new Audit({
                                        ChangedAt: new Date(),
                                        Table: savedArticleItem.tableName,
                                        ChangedBy: userName,
                                        Description: "ArticleItem changed by user " + userName + ". Id of new item in ArticleItem is " + savedArticleItem.id
                                    }
                                ).save().then(function () {
                                        t.commit(savedArticleItem);
                                        // goes to then of transaction

                                    }).catch(function (error) {
                                        console.log("Error while saving Audit for new ArticleItem to database:", error);
                                        console.log("Roll back transaction");
                                        t.rollback({
                                            statusCode: 500,
                                            message: 'Error 500: saving of article to database failed'
                                        });
                                    });
                            }).catch(function (error) {
                                console.log("Error while saving new ArticleItem to database:", error);
                                console.log("Roll back transaction");
                                t.rollback({statusCode: 500, message: 'Error 500: saving of article to database failed'});
                            });
                    }).catch(function (error) {
                        console.log("Error while updating ArticleItem in database:", error);
                        console.log("Roll back transaction");
                        t.rollback({statusCode: 500, message: 'Error 500: saving of article to database failed'});
                    });
                }).then(function (savedItem) {

                    // come here after committing the tansaction

                    console.log("Transaction (saving ArticleItem) committed");
                    if (savedItem) {
                        // return put data again back to caller
                        var articleImages = [];
                        new ArticleImages({Article_id: articleId, valid_end: undefined})
                            .fetch({columns: ['id', 'Article_id', 'Description', 'Filename', 'Size', 'MimeType']})
                            .then(function (images) {
                                if (images) {
                                    images.each(function (image) {
                                        articleImages.push({
                                            Article_id: image.get('Article_id'),
                                            Description: image.get('Description'),
                                            Filename: image.get('Filename'),
                                            Size: image.get('Size'),
                                            MimeType: image.get('MimeType'),
                                            id: image.get('id')
                                        });
                                    });
                                }
                                respondWithArticleItemData(req, res, savedItem, articleImages);
                            })
                            .catch(function (error) {
                                console.log("Error while reading article images from database: " + error);
                                res.statusCode = 500;
                                return res.send('Error 500: reading of article images from database failed');
                            });
                    } else {
                        res.statusCode = 304;   // not changed
                        res.send("304: Article information not changed");
                    }
                }).catch(function (error) {
                    console.log("Transaction (saving ArticleItem) rolled back");
                    res.statusCode = error.statusCode;
                    res.send(error.message);
                });

            } else {
                console.log('ArticleItem with id ' + articleId + ' not found');
                res.statusCode = 404;
                res.send('Error 404: ArticleItem not found');
            }
        })
        .catch(function (error) {
            console.log("Error while reading ArticleItem from database:", error);
            res.statusCode = 500;
            res.send('500: reading of article from database failed');
        });
};

// create new article
module.exports.post = function (req, res) {
    model.bookshelf.transaction(function (t) {

        var now = new Date();

        new Article({
            Page_id: req.body.pageid
        })
            .save(null, {transacting: t})
            .then(function (newArticle) {
                // create new ArticleItem
                new ArticleItem({
                    Article_id: newArticle.get('id'),
                    Date: req.body.date,
                    Author: req.body.author,
                    Text: req.body.text,
                    Title: req.body.title,
                    LeadText: req.body.leadText,
                    publish_start: req.body.publish_start,
                    publish_end: req.body.publish_end,
                    valid_start: now
                })
                    .save(null, {transacting: t})
                    .then(function (savedArticleItem) {
                        var userName = req.user.UserName ? req.user.UserName : req.user.id;
                        new Audit({
                            ChangedAt: new Date(),
                            Table: savedArticleItem.tableName,
                            ChangedBy: userName,
                            Description: "New Article created for page " + req.body.pageid + " by user " + userName + ". Id of new item in ArticleItem is " + savedArticleItem.id
                        })
                            .save()
                            .then(function () {
                                t.commit(savedArticleItem);
                            })
                            .catch(function (error) {
                                console.log("Error while saving Audit for new ArticleItem to database:", error);
                                console.log("Roll back transaction");
                                t.rollback({
                                    statusCode: 500,
                                    message: 'Error 500: saving of article to database failed'
                                });
                            });
                    })
                    .catch(function (error) {
                        console.log("Error while saving new ArticleItem to database:", error);
                        console.log("Roll back transaction");
                        t.rollback({statusCode: 500, message: 'Error 500: saving of article to database failed'});
                    });
            })
            .catch(function (error) {
                console.log("Error while saving new Article to database:", error);
                console.log("Roll back transaction");
                t.rollback({statusCode: 500, message: 'Error 500: saving of article to database failed'});
            });

    }).then(function (savedItem) {
        console.log("Transaction (saving ArticleItem) committed");
        if (savedItem) {
            // return put data again back to caller
            var articleImages = [];
            new ArticleImages({Article_id: savedItem.get('Article_id'), valid_end: undefined})
                .fetch({columns: ['id', 'Article_id', 'Description', 'Filename', 'Size', 'MimeType']})
                .then(function (images) {
                    if (images) {
                        images.each(function (image) {
                            articleImages.push({
                                Article_id: image.get('Article_id'),
                                Description: image.get('Description'),
                                Filename: image.get('Filename'),
                                Size: image.get('Size'),
                                MimeType: image.get('MimeType'),
                                id: image.get('id')
                            });
                        });
                    }
                    respondWithArticleItemData(req, res, savedItem, articleImages);
                })
                .catch(function (error) {
                    console.log("Error while reading article images from database: " + error);
                    res.statusCode = 500;
                    return res.send('Error 500: reading of article images from database failed');
                });
        } else {
            res.statusCode = 304;   // not changed
            res.send("304: Article information not changed");
        }
    }).catch(function (error) {
        console.log("Transaction (saving ArticleItem) rolled back");
        res.statusCode = error.statusCode;
        res.send(error.message);
    });

};

// delete article -> set valid_end to now
module.exports.delete = function (req, res) {
    var articleId = req.params.id;

    new ArticleItem({Article_id: articleId, valid_end: null}).fetch().then(function (articleItem) {
        if (articleItem) {

            // start a transaction because articleItem and audit are updated
            model.bookshelf.transaction(function (t) {
                var now = new Date();

                // invalidate current ArticleItem record
                articleItem.set('valid_end', now);
                articleItem.save(null, {transacting: t}).then(function (savedArticleItem) {

                    var userName = req.user.UserName ? req.user.UserName : req.user.id;
                    new Audit({
                        ChangedAt: new Date(),
                        Table: new ArticleItem().tableName,
                        ChangedBy: userName,
                        Description: "ArticleItem deleted by user " + userName + ". Id of deleted item in ArticleItem is " + savedArticleItem.id
                    }).save(null, {transacting: t}).then(function () {
                            new ArticleImage()
                                .where({'Article_id': articleId, 'valid_end': null})
                                .fetchAll({columns: ['id', 'Article_id', 'valid_end']}).then(function (images) {
                                    if (images) {
                                        new Audit({
                                            ChangedAt: new Date(),
                                            Table: new ArticleImage().tableName,
                                            ChangedBy: userName,
                                            Description: "All ArticleImages for article " + articleId + " deleted by user " + userName
                                        }).save(null, {transacting: t}).then(function () {
                                                var now = new Date();
                                                images.each(function (image) {
                                                    image.set('valid_end', now);
                                                });
                                                images.invokeThen('save', null, {transacting: t}).then(function () {
                                                    t.commit(savedArticleItem);
                                                }).catch(function (error) {
                                                    console.log("Error while updating ArticleImages for article with id " + articleId + " from database:", error);
                                                    t.rollback({statusCode: 500, message: 'Error 500: deleting of article in database failed'});
                                                });
                                            }).catch(function (error) {
                                                console.log("Error while updating Audit for ArticleImages in database:", error);
                                                t.rollback({statusCode: 500, message: 'Error 500: deleting of article in database failed'});
                                            });
                                    } else {
                                        t.commit(savedArticleItem);
                                    }
                                }).catch(function (error) {
                                    console.log("Error while reading ArticleImages from database:", error);
                                    t.rollback({statusCode: 500, message: 'Error 500: deleting of article in database failed'});
                                });
                        }).catch(function (error) {
                            console.log("Error while saving Audit for updated ArticleItem in database:", error);
                            t.rollback({statusCode: 500, message: 'Error 500: deleting of article in database failed'});
                        });
                }).catch(function (error) {
                    console.log("Error while updating ArticleItem in database:", error);
                    t.rollback({statusCode: 500, message: 'Error 500: deleting of article in database failed'});
                });
            }).then(function (savedItem) {
                console.log("Transaction (saving ArticleItem) committed");
                res.statusCode = 204;   // HTTP 204 No Content: The server successfully processed the request, but is not returning any content
                res.send("204: Article deleted");
            }).catch(function (error) {
                console.log("Transaction (deleting (update) ArticleItem) rolled back");
                res.status(error.statusCode).send(error.message);
            });
        } else {
            console.log("Article with id " + articleId + " not found. Rolling back transaction");
            res.status(404).send('ArticleItem with id ' + articleId + ' not found');
        }
    }).catch(function (error) {
        console.log("Error while reading article from database:", error);
        res.status(500).send('Reading of article from database failed');
    });
};

module.exports.deleteImage = function (req, res) {
    var articleId = req.params.id;
    var imageid = req.params.imageid;

    // start a transaction because articleImage and audit are updated
    model.bookshelf.transaction(function (t) {
        var now = new Date();

        var userName = req.user.UserName ? req.user.UserName : req.user.id;
        new ArticleImage()
            .where({'Article_id': articleId, 'id': imageid, 'valid_end': null})
            .fetch({columns: ['id', 'Article_id', 'Filename', 'valid_end']})
            .then(function (image) {
                if (image) {
                    new Audit({
                        ChangedAt: new Date(),
                        Table: new ArticleImage().tableName,
                        ChangedBy: userName,
                        Description: "ArticleImages with id " + imageid + " (" + image.get('Filename') + ") of article " + articleId + " deleted by user " + userName
                    }).save(null, {transacting: t}).then(function () {
                            var now = new Date();
                            image.set('valid_end', now);
                            image.save(null, {transacting: t}).then(function () {
                                t.commit();
                            }).catch(function (error) {
                                console.log("Error while updating ArticleImages for article with id " + articleId + " from database:", error);
                                t.rollback({statusCode: 500, message: 'Error 500: deleting of article in database failed'});
                            });
                        })
                        .catch(function (error) {
                            console.log("Error while updating Audit for ArticleImages in database:", error);
                            t.rollback({statusCode: 500, message: 'Error 500: deleting of article in database failed'});
                        });
                } else {
                    t.commit();
                }
            })
            .catch(function (error) {
                console.log("Error while reading ArticleImages from database:", error);
                t.rollback({statusCode: 500, message: 'Error 500: deleting of article in database failed'});
            });
    }).then(function () {
        console.log("Transaction (saving ArticleItem) committed");
        res.statusCode = 204;   // HTTP 204 No Content: The server successfully processed the request, but is not returning any content
        res.send("204: Article deleted");
    }).catch(function (error) {
        console.log("Transaction (deleting (update) ArticleItem) rolled back");
        if (error) {
            res.status(error.statusCode).send(error.message);
        } else {
            res.status(500).send();
        }
    });
};

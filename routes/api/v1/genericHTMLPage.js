var _ = require('underscore');
var Promise = require('bluebird/js/release/promise')();
var model = require('../../../model');
var moment = require('moment');
var formidable = require('formidable');
var tmp = require('tmp');
var path = require('path');
var fs = require('fs');
var Jimp = require('jimp');
var PageContent = model.models.PageContent;
var Asset = model.models.Asset;
var Assets = model.models.Assets;
var Upload = model.models.Upload;
var Uploads = model.models.Uploads;
var Audit = model.models.Audit;

var knex = model.bookshelf.knex;

function respondWithGenericHTMLPageData(req, res, genericHTMLPage) {
  getGenericHTMLPageSchema().then(function (genericHTMLPage_schema) {

    var csrfToken;
    if (req.csrfToken && req.session) {
      csrfToken = req.csrfToken();
      res.cookie('X-CSRF-Token', csrfToken); // for angularjs use a cookie instead a header parameter
    }
    res.json(
        {
          genericHTMLPage: {
            page_id: genericHTMLPage.get('Page_id'),
            text: genericHTMLPage.get('Text')
          },
          genericHTMLPage_schema: genericHTMLPage_schema
        }
    );
  }).catch(function (error) {
    console.log("Error while reading columnInfo for PageContent from database: " + error);
    res.statusCode = 500;
    return res.send('Error 500: reading schema info for generic html page from database failed');
  });
}

module.exports.get = function (req, res) {
  if (req.query && req.query.type && req.query.type == "schema") {
    getGenericHTMLPageSchema().then(function (genericHTMLPage_schema) {
      var csrfToken;
      if (req.csrfToken && req.session) {
        csrfToken = req.csrfToken();
        res.cookie('X-CSRF-Token', csrfToken); // for angularjs use a cookie instead a header parameter
      }
      res.json(
          {
            genericHTMLPage_schema: genericHTMLPage_schema
          }
      );
    }).catch(function (error) {
      console.log("Error while reading columnInfo for PageContent from database: " + error);
      res.statusCode = 500;
      return res.send('Error 500: reading schema info for generic html page from database failed');
    });
  } else {
    var pageId = req.params.id;
    new PageContent({'Page_id': pageId, 'valid_end': null}).fetch().then(function (genericHTMLPageData) {
      if (genericHTMLPageData) {
        respondWithGenericHTMLPageData(req, res, genericHTMLPageData);
      } else {
        respondWithGenericHTMLPageData(req, res, {Page_id: pageId, Text: ""});
      }

    }).catch(function (error) {
      console.log("Error while reading generic html page from database: " + error);
      res.statusCode = 500;
      return res.send('Error 500: reading of generic html page from database failed');
    });
  }
};

function getGenericHTMLPageSchema() {
  return new Promise(function (resolve, reject) {
    var tableName = new PageContent().tableName;
    knex(tableName).columnInfo()
        .then(function (genericHTMLPageSchema) {
          var schema = {
            date: _.extend(genericHTMLPageSchema['Text'], {
              name: "html",
              label: "HTML",
              description: "Seiteninhalt als HTML"
            })
          };
          resolve(schema);
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

// edit page
module.exports.put = function (req, res) {
  var pageId = req.params.id;

  new PageContent({Page_id: pageId, valid_end: null})
      .fetch()
      .then(function (lastPage) {
        if (lastPage) {
          var articleDateIsDifferent = isDateDifferent(lastPage, "Date", req.body, "date");
          if (!articleDateIsDifferent) {
            var publishStartIsDifferent = isDateDifferent(lastPage, "publish_start", req.body, "publish_start");
            if (!publishStartIsDifferent) {
              var publishEndIsDifferent = isDateDifferent(lastPage, "publish_end", req.body, "publish_end");
              if (!publishEndIsDifferent) {
                var textIsDifferent = lastPage.get('Text') != req.body.text;
                if (!textIsDifferent) {
                  // until here, nothing has changed
                  console.log("Not saving page because nothing changed.");
                  res.statusCode = 304;   // not changed
                  res.send("304: page not changed");
                  return;
                }
              }
            }
          }

          // start a transaction because articleItem and audit are updated
          model.bookshelf.transaction(function (t) {
            var now = new Date();

            // invalidate current articleItem record
            lastPage.set('valid_end', now);
            lastPage.save(null, {transacting: t}).then(function () {

              // create new PageContent
              new PageContent({
                Page_id: pageId,
                Text: req.body.text,
                valid_start: now
              }).save(null, {transacting: t}).then(function (savedPageItem) {
                var userName = req.user.UserName ? req.user.UserName : req.user.id;
                new Audit({
                      ChangedAt: new Date(),
                      Table: savedPageItem.tableName,
                      ChangedBy: userName,
                      Description: "genericHTML page changed by user " + userName + ". Id of new item in PageContent is " + savedPageItem.id
                    }
                ).save(null, {transacting: t}).then(function () {
                  t.commit(savedPageItem);
                  // goes to then of transaction

                }).catch(function (error) {
                  console.log("Error while saving Audit for new PageContent to database:", error);
                  console.log("Roll back transaction");
                  t.rollback({
                    statusCode: 500,
                    message: 'Error 500: saving of genericHTML page to database failed'
                  });
                });
              }).catch(function (error) {
                console.log("Error while saving new PageContent to database:", error);
                console.log("Roll back transaction");
                t.rollback({statusCode: 500, message: 'Error 500: saving of genericHTML page to database failed'});
              });
            }).catch(function (error) {
              console.log("Error while updating PageContent in database:", error);
              console.log("Roll back transaction");
              t.rollback({statusCode: 500, message: 'Error 500: saving of genericHTML page to database failed'});
            });
          }).then(function (savedItem) {

            // come here after committing the tansaction

            console.log("Transaction (saving PageContent) committed");
            if (savedItem) {
              // return put data again back to caller
              respondWithGenericHTMLPageData(req, res, savedItem);
            } else {
              res.statusCode = 304;   // not changed
              res.send("304: PageContent information not changed");
            }
          }).catch(function (error) {
            if (error.message) {
              console.log("Exception while saving PageContent: " + error.message);
            } else {
              console.log("Exception while saving PageContent: ", error);
            }
            res.statusCode = 500;
            res.send(error.message);
          });

        } else {
          console.log('PageContent with page_id ' + pageId + ' not found');
          res.statusCode = 404;
          res.send('Error 404: PageContent not found');
        }
      })
      .catch(function (error) {
        console.log("Error while reading PageContent from database:", error);
        res.statusCode = 500;
        res.send('500: reading of genericHTML page from database failed');
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
          new PageContent({
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
                  Description: "New Article created for page " + req.body.pageid + " by user " + userName +
                               ". Id of new item in ArticleItem is " + savedArticleItem.id
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

  new PageContent({Article_id: articleId, valid_end: null}).fetch().then(function (articleItem) {
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

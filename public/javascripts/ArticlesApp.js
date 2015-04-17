// extend jquery with :data pseudo (alternatively include jquery ui)
$.extend($.expr[":"], {
    data: $.expr.createPseudo ?
        $.expr.createPseudo(function (dataName) {
            return function (elem) {
                return !!$.data(elem, dataName);
            };
        }) :
        // support: jQuery <1.8
        function (elem, i, match) {
            return !!$.data(elem, match[3]);
        }
});

// create the application module - dependencies to other modules are bootstrap modules for angularjs
var articleEditApp = angular.module('articleEditApp', ['ngCookies', 'ui.bootstrap', 'flow']);

articleEditApp.config(['$httpProvider',
        function (provider) {
            provider.defaults.xsrfHeaderName = 'X-CSRF-Token';
            provider.defaults.xsrfCookieName = 'X-CSRF-Token';
        }]
);
articleEditApp.config(['flowFactoryProvider', function (flowFactoryProvider) {
        flowFactoryProvider.defaults = {
            //target: function (file, chunk, isTest) {
            //    var article_id = $scope.article.article_id;
            //    return '/api/v1/article/' + article_id + '/images'
            //},
            permanentErrors: [401, 409, 500, 501],
            maxChunkRetries: 2,
            chunkRetryInterval: 5000,
            simultaneousUploads: 4
            //headers: function (file, chunk, isTest) {
            //    return {
            //        'X-CSRF-Token': cookie.get("X-CSRF-Token") // call func for getting a cookie
            //    }
            //}
        };
        //flowFactoryProvider.on('catchAll', function (event) {
        //    console.log('catchAll', arguments);
        //});
    }]
);

// add the article edit controller
articleEditApp.controller('articleEditCtrl', ['$sce', '$log', '$scope', '$cookies', 'articleService',
    function ($sce, $log, $scope, $cookies, articleService) {
        $scope.flowObj = {};
        $scope.current_images_page = 0;
        $scope.images_pages = [];   // all pages
        $scope.relaoding_images = false;

        function putImagesIntoPages(article_images) {
            $scope.images_pages = [];
            $scope.current_images_page = 0;
            var pageSize = 4;
            var cnt = 0;
            var pageCnt = 0;
            var currPageOfImages;
            _.each(article_images, function (image) {
                if (cnt == 0) {
                    currPageOfImages = [];
                    pageCnt++;
                    $scope.images_pages.push({pageNumber: pageCnt, images: currPageOfImages});
                }
                currPageOfImages.push(image);
                cnt++;
                if (cnt == pageSize) {
                    cnt = 0;
                }
            });
        }

        $scope.imagePageClicked = function ($event, pageNumber) {
            var pageIdx = pageNumber - 1;

            $scope.current_images_page = pageIdx;
        };

        $scope.isNotEmpty = function (item) {
            if (!item) {
                return false;
            }
            return !_.isEmpty(item);
        };
        $scope.loadArticle = function (id) {
            var promise = articleService.getArticle(id);
            promise.then(function (payload) {
                    $scope.waitingImages = {};
                    $scope.article = payload.article;
                    $scope.article_schema = payload.article_schema;
                    $scope.article_images = payload.article_images;

                    putImagesIntoPages(payload.article_images);

                    if ($scope.article.text) {
                        $scope.renderRhoText();
                    }

                    var flow = $scope.flowObj.flow;
                    flow.off('fileAdded');
                    flow.off('fileSuccess');
                    flow.off('fileError');
                    flow.off('filesSubmitted');
                    flow.on('filesSubmitted', function (event) {
                        flow.opts.target = '/api/v1/articles/' + $scope.article.article_id + '/imagechunks';
                        var csrfToken = $cookies['X-CSRF-Token'];
                        flow.opts.headers = {
                            'X-CSRF-Token': csrfToken
                        };
                        flow.upload();
                    });
                    flow.on('fileAdded', function (file, event) {
                        // TODO: throw away old completed or error files
                        var filesToProcess = flow.files.length;
                        if (filesToProcess > 5) {
                            console.log("Too many files. Rejecting more for upload");
                            return false; // reject file
                        }
                    });
                    flow.on('fileSuccess', function (file, message) {
                        console.log("fileSuccess");
                        $scope.waitingImages[file.uniqueIdentifier] = {name: file.name, status: 'wait'};
                        articleService.commitImageUpload($scope.article, file.uniqueIdentifier, file.chunks.length)
                            .then(function () {
                                delete $scope.waitingImages[file.uniqueIdentifier];
                                flow.removeFile(file);
                                console.log("Reloading images");
                                articleService.getArticleImages($scope.article.article_id)
                                    .success(function (data, resp, jqXHR) {
                                        $scope.article_images = data.article_images;
                                        putImagesIntoPages($scope.article_images);
                                    })
                                    .error(function (data, status, headers, config) {
                                        $scope.article_images = [];
                                        console.log("ERROR while reloading images:", data);
                                        putImagesIntoPages($scope.article_images);
                                    });

                            })
                            .catch(function (error) {
                                console.log('Failed commitImageUpload: ', error);
                                $scope.waitingImages[file.uniqueIdentifier] = {name: file.name, status: 'error'};
                            });
                    });
                    flow.on('fileError', function (file, message) {
                        console.log('fileError: ', file, message);
                    });

                },
                function (error) {
                    $log.error("Error while loading the article", error);
                });
            return promise;
        };
        $scope.saveArticle = function ($event) {

            function makeMidnightUtc(dateIn) {
                var d;
                if (dateIn instanceof moment) {
                    d = dateIn.toDate();
                } else {
                    d = new Date(dateIn);
                }
                var y = d.getFullYear();
                var m = d.getMonth();
                var day = d.getDate();
                var dd = new Date(Date.UTC(y, m, day));
                if (dateIn instanceof moment) {
                    return moment(dd);
                } else {
                    return dd;
                }
            }

            var article = _.clone($scope.article);

            article.date = makeMidnightUtc($scope.article.date);
            article.publish_start = makeMidnightUtc($scope.article.publish_start);
            article.publish_end = makeMidnightUtc($scope.article.publish_end);

            articleService.saveArticle(article).then(function () {
                ui.editArticleEntry.modal('hide');
                location.reload();
            }, function (error) {
                if (error) {
                    $scope.errorMessage = error.toString();
                    $log.error("Error while saving the article", error);
                } else {
                    $scope.errorMessage = "Fehler beim Speichern des Artikels. Verbindungsaufbau mit dem Server nicht möglich.";
                    $log.error("Error while saving the article. Connection problem.");
                }
            });
        };
        $scope.deleteArticle = function ($event) {
            articleService.deleteArticle($scope.article).then(function () {
                ui.editArticleEntry.modal('hide');
                location.reload();
            }, function (error) {
                if (error) {
                    $scope.errorMessage = error.toString();
                }
                else {
                    $scope.errorMessage = "Unbekannter Fehler";
                }
                $log.error("Error while deleting the article", error);
            });
        };
        $scope.newArticle = function (pageid) {
            return articleService.getArticleSchema().then(function (data) {
                console.log("getArticleSchema returned schema");
                $scope.article_schema = data.article_schema;
                $scope.article_images = [];
                $scope.article = {};
                $scope.article.pageid = pageid;

                var today = new moment();
                today.set('hour', 0);
                today.set('minute', 0);
                today.set('second', 0);
                today.set('millisecond',0);
                $scope.article.date = today.toISOString();
                $scope.article.publish_start = today.add(2, 'days').toISOString();
                $scope.article.publish_end = today.add(9, 'days').toISOString();

                $scope.current_images_page = 0;
                $scope.images_pages = [];   // all pages

            });

        };
        $scope.deleteImage = function ($event, imageId) {
            articleService.deleteImage($scope.article, imageId).then(function () {
                articleService.getArticleImages($scope.article.article_id)
                    .success(function (data, resp, jqXHR) {
                        $scope.article_images = data.article_images;
                        putImagesIntoPages($scope.article_images);
                    })
                    .error(function (data, status, headers, config) {
                        $scope.article_images = [];
                        console.log("ERROR while reloading images:", data);
                        putImagesIntoPages($scope.article_images);
                    });

            }, function (error) {
                $scope.errorMessage = error.toString();
                $log.error("Error while deleting the image", error);
            });
        };

        $scope.renderRhoText = function () {

            var rawHtml = rho.toHtml($scope.article.text);
            // add class attribute to all image tags to apply bootstrap styles
            $scope.textAsHtml = rawHtml.replace(/<img\s*src=/g, "<img class=\"img-responsive\" src=");
            $scope.trustedTextAsHtml = $sce.trustAsHtml($scope.textAsHtml);

            // calculate rows for textarea
            var charsPerLine = 40;

            var lines = $scope.article.text.split(/\r\n|\r|\n/);
            $scope.textareaRows = _.reduce(lines, function (neededRows, line) {
                var additionalRows = Math.round((line.length / charsPerLine));
                return neededRows + additionalRows;
            }, lines.length);
        };

        // date picker event
        $scope.openDatePicker = function ($event, isOpenAttrName) {
            $event.preventDefault();
            $event.stopPropagation();

            // close other opened date pickers before opening a new one
            if (!$scope.openedDatePicker) {
                $scope.openedDatePicker = {};
            } else {
                _.each($scope.openedDatePicker, function (val, key) {
                    $scope.openedDatePicker[key] = false;
                    $scope[key] = false;
                });
            }
            $scope.openedDatePicker[isOpenAttrName] = true;
            $scope[isOpenAttrName] = true;
        };
        $scope.format = 'dd.MM.yyyy';


        // attach to click event (jquery)

        $(".media-heading .glyphicon.glyphicon-edit").click(function () {
            var clickedElement = $(this);
            var id = clickedElement.attr('data-id');
            if (id) {
                $scope.loadArticle(id)
                    .then(function () {
                        ui.editArticleEntry.on('shown.bs.modal', function (e) {
                            console.log("Modal dialog showed");
                        });

                        // show modal dialog
                        ui.editArticleEntry.modal({backdrop: true});

                        console.log("showing modal dialog...");
                    })
                    .catch(function (error) {
                        if (error) {
                            location.href = "/login";
                        }
                    });
            }
            else {
                console.log("Can't open article because data-id on clicked element is missing");
            }
        });
        ui.newItem.click(function () {
            var clickedElement = $(this);
            var pageid = clickedElement.attr('data-pageid');

            ui.editArticleEntry.on('shown.bs.modal', function (e) {
                console.log("Modal dialog showed");
            });

            $scope.newArticle(pageid).then(function () {
                // show modal dialog
                ui.editArticleEntry.modal({backdrop: true});

                console.log("showing modal dialog...");
            });
            console.log("newArticle called");

        });

    }
])
    .factory('articleService', function ($http, $log, $q) {
        return {
            getArticleSchema: function () {
                var deferred = $q.defer();
                $http.get('/api/v1/articles?type=schema').success(function (data, resp, jqXHR) {
                    deferred.resolve(data);
                }).error(function (msg, code) {
                    deferred.reject(msg);
                    $log.error(msg, code);
                });
                return deferred.promise;
            },
            getArticle: function (id) {
                var deferred = $q.defer();
                $http.get('/api/v1/articles/' + id).success(function (data, resp, jqXHR) {
                    deferred.resolve(data);
                }).error(function (msg, code) {
                    deferred.reject(msg);
                    $log.error(msg, code);
                });
                return deferred.promise;
            },
            getArticleImages: function (id) {
                return $http.get('/api/v1/articles/' + id + '/images');
            },

            commitImageUpload: function (article, flowIdentifier, flowTotalChunks) {
                var deferred = $q.defer();
                var promise = $http.post('/api/v1/articles/' + article.article_id + '/images', {
                    'flowIdentifier': flowIdentifier,
                    'flowTotalChunks': flowTotalChunks
                });
                promise.success(function (data) {
                    deferred.resolve();
                }).error(function (msg, code) {
                    deferred.reject(msg);
                    $log.error(msg, code);
                });
                return deferred.promise;
            },

            saveArticle: function (article) {
                var deferred = $q.defer();
                var promise;
                if (article.article_id) {
                    promise = $http.put('/api/v1/articles/' + article.article_id, article);
                } else {
                    promise = $http.post('/api/v1/articles/', article);
                }
                promise.success(function (data) {
                    deferred.resolve();
                }).error(function (msg, code) {
                    if (code == 304) {
                        deferred.resolve();
                    } else {
                        deferred.reject(msg);
                        $log.error(msg, code);
                    }
                });
                return deferred.promise;
            },
            deleteArticle: function (article) {
                var deferred = $q.defer();
                var promise = $http.delete('/api/v1/articles/' + article.article_id, article);
                promise.success(function (data) {
                    deferred.resolve();
                }).error(function (msg, code) {
                    if (code == 204 || code == 200) {
                        deferred.resolve();
                    } else {
                        deferred.reject(msg);
                        $log.error(msg, code);
                    }
                });
                return deferred.promise;
            },
            deleteImage: function (article, imageId) {
                console.log("deleteImage " + imageId);
                var deferred = $q.defer();
                var promise = $http.delete('/api/v1/articles/' + article.article_id + '/images/' + imageId);
                promise.success(function (data) {
                    deferred.resolve();
                }).error(function (msg, code) {
                    if (code == 204 || code == 200) {
                        deferred.resolve();
                    } else {
                        deferred.reject(msg);
                        $log.error(msg, code);
                    }
                });
                return deferred.promise;
            }
        }
    }
);

var ui = {
    editArticleEntry: $("#editArticleEntry"),
    errorMessage: $("#errorMessage"),
    newItem: $(".articleNew")
};

/*
 $(function () {
 $(".articleListItem").click(function () {
 var clickedElement = $(this);
 var id = clickedElement.attr('data-id');
 articleEditApp.controller('articleEditCtrl', function ($scope, Entry) {
 $scope.loadArticle(id);
 });

 ui.editArticleEntry.on('shown.bs.modal', function (e) {
 console.log("Modal dialog showed");
 });

 // show modal dialog
 ui.editArticleEntry.modal({backdrop: true});

 console.log("showing modal dialog...");

 });
 });
 */

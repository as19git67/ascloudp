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

// Build offsets for each line (lines can be wrapped)
// That's a bit dirty to process each line everytime, but ok for demo.
// Optimizations are required only for big texts.
function buildScrollMap() {
    console.log("buildScrollMap");
    var i, offset, nonEmptyList, pos, a, b, lineHeightMap, linesCount,
        acc, sourceLikeDiv, textarea = $('.markdown-source'),
        _scrollMap;

    sourceLikeDiv = $('<div />').css({
        position: 'absolute',
        visibility: 'hidden',
        height: 'auto',
        width: textarea[0].clientWidth,
        'font-size': textarea.css('font-size'),
        'font-family': textarea.css('font-family'),
        'line-height': textarea.css('line-height'),
        'white-space': textarea.css('white-space')
    }).appendTo('body');

    var resultHtmlEl = $('.result-html');
    offset = resultHtmlEl.scrollTop() - resultHtmlEl.offset().top;
    _scrollMap = [];
    nonEmptyList = [];
    lineHeightMap = [];

    acc = 0;
    var textareaVal = textarea.val();
    var allLines = textareaVal.split('\n');
    console.log("source has " + allLines.length + " rows");

    for (var idx = 0; idx < allLines.length; idx++) {
        var str = allLines[idx];
        var h, lh;

        lineHeightMap.push(acc);

        if (str.length === 0) {
            acc++;
        } else {

            sourceLikeDiv.text(str);

            h = sourceLikeDiv.height();
            lh = parseFloat(sourceLikeDiv.css('line-height'));
            acc += Math.round(h / lh);
        }
    }
    ;
    console.log("acc: " + acc);
    sourceLikeDiv.remove();
    lineHeightMap.push(acc);
    linesCount = acc;

    for (i = 0; i < linesCount; i++) {
        _scrollMap.push(-1);
    }

    nonEmptyList.push(0);
    _scrollMap[0] = 0;

    $('.line').each(function (n, el) {
        var $el = $(el), t = $el.data('line');
        if (t === '') {
            return;
        }
        t = lineHeightMap[t];
        if (t !== 0) {
            nonEmptyList.push(t);
        }
        _scrollMap[t] = Math.round($el.offset().top + offset);
    });

    nonEmptyList.push(linesCount);
    _scrollMap[linesCount] = resultHtmlEl[0].scrollHeight;

    pos = 0;
    for (i = 1; i < linesCount; i++) {
        if (_scrollMap[i] !== -1) {
            pos++;
            continue;
        }

        a = nonEmptyList[pos];
        b = nonEmptyList[pos + 1];
        _scrollMap[i] = Math.round((_scrollMap[b] * (i - a) + _scrollMap[a] * (b - i)) / (b - a));
    }

    return _scrollMap;
}


var md = window.markdownit();

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
            $scope.article = {};
            $scope.article.text = '';
            $scope.article.leadText = '';

            $scope.isNotEmpty = function (item) {
                if (!item) {
                    return false;
                }
                return !_.isEmpty(item);
            };

            function makeImageUploadingText(file) {
                return '\n![Hochladen: ' + file.uniqueIdentifier + '...]()';
            }

            $scope.editorHeight = $(window).height() - 50;

            $scope.loadArticle = function (id) {
                $scope.errorMessage = undefined;
                var promise = articleService.getArticle(id);
                promise.then(function (payload) {
                        $scope.waitingImages = {};
                        $scope.article = payload.article;
                        $scope.article_schema = payload.article_schema;
                        $scope.article_images = payload.article_images;

                        if ($scope.article.text) {
                            $scope.renderMarkdown();
                        }

                        var flow = $scope.flowObj.flow;
                        flow.off('fileAdded');
                        flow.off('fileSuccess');
                        flow.off('fileError');
                        flow.off('filesSubmitted');
                        flow.on('filesSubmitted', function (event) {
                            flow.opts.target = '/api/v1/articles/' + $scope.article.article_id +
                                '/imagechunks';
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
                            $scope.article.text += makeImageUploadingText(file);
                        });
                        flow.on('fileSuccess', function (file, message) {
                            console.log("flow event: fileSuccess");
                            $scope.waitingImages[file.uniqueIdentifier] = {
                                name: file.name,
                                status: 'wait'
                            };
                            articleService.commitImageUpload($scope.article, file.uniqueIdentifier,
                                file.chunks.length)
                                .then(function (imageMetadata) {
                                    delete $scope.waitingImages[imageMetadata.flowIdentifier];
                                    flow.removeFile(file);
                                    // add reference to image in textarea
                                    var placeholder = makeImageUploadingText(file);
                                    var imageTag = '\n![' + imageMetadata.Filename + '](/images/' +
                                        imageMetadata.id + ')\n';
                                    if ($scope.article.text.indexOf(placeholder) != -1) {
                                        $scope.article.text = $scope.article.text.replace(placeholder,
                                            imageTag);
                                    } else {
                                        $scope.article.text += imageTag;
                                    }
                                    $scope.renderMarkdown();
                                })
                                .catch(function (error) {
                                    console.log('Failed commitImageUpload: ', error);
                                    $scope.waitingImages[file.uniqueIdentifier] = {
                                        name: file.name,
                                        status: 'error'
                                    };
                                    var placeholder = makeImageUploadingText(file);
                                    var message = "der Server konnte das Bild nicht korrekt verarbeiten";
                                    if (typeof error == 'string') {
                                        message = error;
                                    }
                                    if ($scope.article.text.indexOf(placeholder) != -1) {
                                        $scope.article.text = $scope.article.text.replace(placeholder,
                                            '\n![Fehler beim Hochladen von ' + file.Filename + ': ' +
                                            message + ']()');
                                    }
                                });
                        });

                        flow.on('fileError', function (file, message) {
                            console.log('fileError: ', file, message);
                            var placeholder = makeImageUploadingText(file);
                            if ($scope.article.text.search(placeholder) != -1) {
                                $scope.article.text = $scope.article.text.replace(placeholder,
                                    '\n![Fehler beim Hochladen von ' + file.Filename + ': ' + message +
                                    ']()');
                            }
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

                if (!article.text) {
                    article.text = "";
                }
                if (article.leadText) {
                    article.date = makeMidnightUtc($scope.article.date);
                    article.publish_start = makeMidnightUtc($scope.article.publish_start);
                    article.publish_end = makeMidnightUtc($scope.article.publish_end);
                    var maxArticleLength = $scope.article_schema.text.maxLength;
                    article.text = article.text.substr(0, $scope.article_schema.text.maxLength);

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
                } else {
                    $scope.errorMessage = $scope.article_schema.leadText.label + " darf nicht leer sein";
                }
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
                    today.set('millisecond', 0);
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
                        })
                        .error(function (data, status, headers, config) {
                            $scope.article_images = [];
                        });

                }, function (error) {
                    $scope.errorMessage = error.toString();
                    $log.error("Error while deleting the image", error);
                });
            };

            // Synchronize scroll position from source to result
            $scope.syncResultScroll =
                _.debounce(function () {
                    var textarea = $('.markdown-source'),
                        lineHeight = parseFloat(textarea.css('line-height')),
                        lineNo, posTo;

                    lineNo = Math.floor(textarea.scrollTop() / lineHeight);
                    if (!$scope.scrollMap) {
                        $scope.scrollMap = buildScrollMap();
                    }
                    posTo = $scope.scrollMap[lineNo];
                    $('.result-html').stop(true).animate({
                        scrollTop: posTo
                    }, 100, 'linear');
                }, 50, {maxWait: 50});


            // Synchronize scroll position from result to source
            $scope.syncSrcScroll =
                _.debounce(function () {
                    var resultHtml = $('.result-html'),
                        scrollTop = resultHtml.scrollTop(),
                        textarea = $('.markdown-source'),
                        lineHeight = parseFloat(textarea.css('line-height')),
                        lines,
                        i,
                        line;

                    if (!$scope.scrollMap) {
                        $scope.scrollMap = buildScrollMap();
                    }

                    lines = Object.keys($scope.scrollMap);

                    if (lines.length < 1) {
                        return;
                    }

                    line = lines[0];

                    for (i = 1; i < lines.length; i++) {
                        if ($scope.scrollMap[lines[i]] < scrollTop) {
                            line = lines[i];
                            continue;
                        }

                        break;
                    }

                    textarea.stop(true).animate({
                        scrollTop: lineHeight * line
                    }, 100, 'linear');
                }, 50, {maxWait: 50});


            $scope.srcScrolled = function () {
                if ($scope.syncDirSrcToResult === true) {
                    $scope.syncResultScroll();
                }
            };

            $scope.resultScrolled = function () {
                if ($scope.syncDirSrcToResult === false) {
                    $scope.syncSrcScroll();
                }
            };

            $scope.startSyncResultScroll = function ($event) {
                $scope.syncDirSrcToResult = false;
            };

            $scope.startSyncSrcScroll = function ($event) {
                $scope.syncDirSrcToResult = true;
            };

            $scope.renderMarkdown = function () {

                if ($scope.article.text) {
                    if ($scope.article.text.length > $scope.article_schema.text.maxLength) {

                    }
                    var rawHtml = md.render(
                        $scope.article.text.substr(0, $scope.article_schema.text.maxLength));

                    // add class attribute to all image tags to apply bootstrap styles
                    $scope.textAsHtml = rawHtml.replace(/<img\s*src=/g,
                        "<img class=\"img-responsive\" src=");

                    var maxTextLen = $scope.article_schema.text.maxLength;
                    if ($scope.article.text.length > maxTextLen) {
                        $scope.textAsHtml += "<br><em>Achtung, der Text wurde abgeschnitten, da die maximale Länge (" +
                            maxTextLen + ") überschritten ist</em>";
                    }

                    $scope.trustedTextAsHtml = $sce.trustAsHtml($scope.textAsHtml);

                    $scope.textareaRows = $scope.article.text.split(/\r\n|\r|\n/);

                    $scope.scrollMap = null;
                }
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
                                //console.log("Modal dialog showed");
                            });

                            // show modal dialog
                            ui.editArticleEntry.modal({backdrop: true});

                            //console.log("showing modal dialog...");
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
    .directive('asscroll', function () {
        return {
            restrict: 'A',
            link: function (scope, elem, attrs) {
                elem.on('scroll', function (evt) {
                    if ($(evt.target).hasClass('markdown-source')) {
                        scope.srcScrolled();
                    } else {
                        if ($(evt.target).hasClass('result-html')) {
                            scope.resultScrolled();
                        }
                    }
                });
            }
        }
    })
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
                    var timeout = $q.defer();
                    var timedOut = false;

                    setTimeout(function () {
                        timedOut = true;
                        timeout.resolve();
                    }, 5 * 60000);

                    var promise = $http.post('/api/v1/articles/' + article.article_id + '/images', {
                        'flowIdentifier': flowIdentifier,
                        'flowTotalChunks': flowTotalChunks
                    }, {timeout: timeout.promise});
                    promise.success(function (data) {
                        console.log("Image successfully saved at server");
                        deferred.resolve(data);
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

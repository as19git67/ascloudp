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
var markdownEditApp = angular.module('markdownEditApp', ['ngCookies', 'ui.bootstrap', 'flow']);

markdownEditApp.config(['$httpProvider',
        function (provider) {
            provider.defaults.xsrfHeaderName = 'X-CSRF-Token';
            provider.defaults.xsrfCookieName = 'X-CSRF-Token';
        }]
);
markdownEditApp.config(['flowFactoryProvider', function (flowFactoryProvider) {
        flowFactoryProvider.defaults = {
            permanentErrors: [401, 409, 500, 501],
            maxChunkRetries: 2,
            chunkRetryInterval: 5000,
            simultaneousUploads: 4
        };
    }]
);

// add the markdown edit controller
markdownEditApp.controller('markdownEditCtrl', ['$sce', '$log', '$scope', '$cookies', 'markdownPageService',
    function ($sce, $log, $scope, $cookies, markdownPageService) {
        $scope.flowObj = {};

        $scope.isNotEmpty = function (item) {
            if (!item) {
                return false;
            }
            return !_.isEmpty(item);
        };

        function makeUploadingText(file) {
            return '\n![Hochladen: ' + file.uniqueIdentifier + '...]()';
        }

        $scope.loadMarkdownPage = function (id) {
            $scope.errorMessage = undefined;
            var promise = markdownPageService.getMarkdownPage(id);
            promise.then(function (payload) {
                    $scope.waitingAssets = {};
                    $scope.markdownPage = payload.markdownPage;
                    $scope.markdownPage_schema = payload.markdownPage_schema;
                    $scope.markdownPage_assets = payload.markdownPage_assets;

                    if ($scope.markdownPage.text) {
                        $scope.renderMarkdown();
                    }

                    var flow = $scope.flowObj.flow;
                    flow.off('fileAdded');
                    flow.off('fileSuccess');
                    flow.off('fileError');
                    flow.off('filesSubmitted');
                    flow.on('filesSubmitted', function (event) {
                        flow.opts.target = '/api/v1/assets/chunks';
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
                        $scope.markdownPage.text += makeUploadingText(file);
                    });
                    flow.on('fileSuccess', function (file, message) {
                        console.log("flow event: fileSuccess");
                        $scope.waitingAssets[file.uniqueIdentifier] = {name: file.name, status: 'wait'};
                        markdownPageService.commitAssetUpload($scope.article, file.uniqueIdentifier, file.chunks.length)
                            .then(function (fileMetadata) {
                                delete $scope.waitingAssets[fileMetadata.flowIdentifier];
                                flow.removeFile(file);
                                // add reference to image in textarea
                                var placeholder = makeUploadingText(file);
                                var fileTag = '\n![' + fileMetadata.Filename + '](/images/' + fileMetadata.id + ')\n';
                                if ($scope.markdownPage.text.indexOf(placeholder) != -1) {
                                    $scope.markdownPage.text = $scope.markdownPage.text.replace(placeholder, fileTag);
                                } else {
                                    $scope.markdownPage.text += fileTag;
                                }
                                $scope.renderMarkdown();
                            })
                            .catch(function (error) {
                                console.log('Failed commitAssetUpload: ', error);
                                $scope.waitingAssets[file.uniqueIdentifier] = {name: file.name, status: 'error'};
                                var placeholder = makeUploadingText(file);
                                var message = "der Server konnte die Datei nicht korrekt verarbeiten";
                                if (typeof error == 'string') {
                                    message = error;
                                }
                                if ($scope.markdownPage.text.indexOf(placeholder) != -1) {
                                    $scope.markdownPage.text = $scope.markdownPage.text.replace(placeholder, '\n![Fehler beim Hochladen von ' + file.Filename + ': ' + message + ']()');
                                }
                            });
                    });

                    flow.on('fileError', function (file, message) {
                        console.log('fileError: ', file, message);
                        var placeholder = makeUploadingText(file);
                        if ($scope.markdownPage.text.search(placeholder) != -1) {
                            $scope.markdownPage.text = $scope.markdownPage.text.replace(placeholder, '\n![Fehler beim Hochladen von ' + file.Filename + ': ' + message + ']()');
                        }
                    });

                },
                function (error) {
                    $log.error("Error while loading the generic markdown page data", error);
                });
            return promise;
        };
        $scope.saveMarkdownPage = function ($event) {

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

            var markdownPage = _.clone($scope.markdownPage);

            markdownPage.date = makeMidnightUtc($scope.markdownPage.date);
            markdownPage.publish_start = makeMidnightUtc($scope.markdownPage.publish_start);
            markdownPage.publish_end = makeMidnightUtc($scope.markdownPage.publish_end);

            markdownPageService.saveMarkdownPage(markdownPage).then(function () {
                // todo: instead closing the modal dialog, navigate to page view
                ui.editEntry.modal('hide');
                location.reload();
            }, function (error) {
                if (error) {
                    $scope.errorMessage = error.toString();
                    $log.error("Error while saving the generic markdown page", error);
                } else {
                    $scope.errorMessage = "Fehler beim Speichern des Seiteninhalts. Verbindungsaufbau mit dem Server nicht möglich.";
                    $log.error("Error while saving the generic markdown page. Connection problem.");
                }
            });
        };
        $scope.deleteMarkdownPage = function ($event) {
            markdownPageService.deleteMarkdownPage($scope.markdownPage).then(function () {
                // todo: instead closing the modal dialog, navigate to page view
                ui.editEntry.modal('hide');
                location.reload();
            }, function (error) {
                if (error) {
                    $scope.errorMessage = error.toString();
                }
                else {
                    $scope.errorMessage = "Unbekannter Fehler";
                }
                $log.error("Error while deleting the generic markdown page", error);
            });
        };
        $scope.newMarkdownPage = function (pageid) {
            return markdownPageService.getMarkdownPageSchema().then(function (data) {
                console.log("getMarkdownPageSchema returned schema");
                $scope.markdownPage_schema = data.markdownPage_schema;
                $scope.markdownPage_assets = [];
                $scope.markdownPage = {};
                $scope.markdownPage.pageid = pageid;

                var today = new moment();
                today.set('hour', 0);
                today.set('minute', 0);
                today.set('second', 0);
                today.set('millisecond', 0);
                $scope.markdownPage.date = today.toISOString();
                $scope.markdownPage.publish_start = today.add(2, 'days').toISOString();
                $scope.markdownPage.publish_end = today.add(9, 'days').toISOString();
            });

        };
        $scope.deleteMarkdownPage = function ($event, assetId) {
            markdownPageService.deleteMarkdownPage($scope.article, assetId).then(function () {
                markdownPageService.getAssets($scope.markdownPage.pageid, $scope.markdownPage.itemid)
                    .success(function (data, resp, jqXHR) {
                        $scope.markdownPage_assets = data.markdownPage_assets;
                    })
                    .error(function (data, status, headers, config) {
                        $scope.article_images = [];
                    });

            }, function (error) {
                $scope.errorMessage = error.toString();
                $log.error("Error while deleting the image", error);
            });
        };

        $scope.renderMarkdown = function () {

            var rawHtml = marked($scope.markdownPage.text);
            // add class attribute to all image tags to apply bootstrap styles
            $scope.textAsHtml = rawHtml.replace(/<img\s*src=/g, "<img class=\"img-responsive\" src=");
            $scope.trustedTextAsHtml = $sce.trustAsHtml($scope.textAsHtml);

            // calculate rows for textarea
            var charsPerLine = 40;

            var lines = $scope.markdownPage.text.split(/\r\n|\r|\n/);
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
    }
])
    .factory('markdownPageService', function ($http, $log, $q) {
        return {
            getMarkdownPageSchema: function()
            {
                var deferred = $q.defer();
                $http.get('/api/v1/articles?type=schema').success(function (data, resp, jqXHR) {
                    deferred.resolve(data);
                }).error(function (msg, code) {
                    deferred.reject(msg);
                    $log.error(msg, code);
                });
                return deferred.promise;
            },
            getMarkdownPage: function (id) {
                var deferred = $q.defer();
                $http.get('/api/v1/genericMarkdownPage/' + id).success(function (data, resp, jqXHR) {
                    deferred.resolve(data);
                }).error(function (msg, code) {
                    deferred.reject(msg);
                    $log.error(msg, code);
                });
                return deferred.promise;
            },
            commitAssetUpload: function (article, flowIdentifier, flowTotalChunks) {
                var deferred = $q.defer();
                var timeout = $q.defer();
                var timedOut = false;

                setTimeout(function () {
                    timedOut = true;
                    timeout.resolve();
                }, 5 * 60000);

                var promise = $http.post('/api/v1/assets/' + article.article_id + '/images', {
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

            saveMarkdownPage: function (article) {
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
            deleteMarkdownPage: function (article) {
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
            }
        }
    }
);

var ui = {
    editEntry: $("#editEntry"),
    errorMessage: $("#errorMessage")
};

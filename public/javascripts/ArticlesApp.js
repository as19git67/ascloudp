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
            permanentErrors: [404, 500, 501],
            maxChunkRetries: 1,
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

        $scope.loadArticle = function (id) {
            var promise = articleService.getArticle(id);
            promise.then(function (payload) {
                    $scope.article = payload.article;
                    $scope.article_schema = payload.article_schema;

                    if ($scope.article.text) {
                        $scope.renderRhoText();
                    }

                    var flow = $scope.flowObj.flow;
                    flow.off('filesSubmitted');
                    flow.on('filesSubmitted', function (event) {
                        console.log("Files in flow: " + flow.files.length);

                        flow.opts.target = '/api/v1/articles/' + $scope.article.article_id + '/images';
                        var csrfToken = $cookies['X-CSRF-Token'];
                        flow.opts.headers = {
                            'X-CSRF-Token': csrfToken
                        };
                        flow.upload();
                    });
                    flow.on('fileAdded', function (file, event) {
                        console.log("file added: ", file, event);
                        // TODO: throw away old completed or error files
                        var filesToProcess = flow.files.length;
                        if (filesToProcess > 5) {
                            console.log("Too many files. Rejecting more for upload");
                            return false; // reject file
                        }
                    });
                    flow.on('fileSuccess', function (file, message) {
                        // TODO: refresh attachment list from server
                        flow.removeFile(file);
                        //console.log('fileSuccess: ', file, message);
                    });
                    flow.on('fileError', function (file, message) {
                        console.log('fileError: ', file, message);
                    });

                },
                function (error) {
                    $log.error("Error while loading the article", error);
                });
        };
        $scope.saveArticle = function ($event) {
            articleService.saveArticle($scope.article).then(function () {
                ui.editArticleEntry.modal('hide');
                location.reload();
            }, function (error) {
                $scope.errorMessage = error.toString();
                $log.error("Error while saving the article", error);
            });
        };
        $scope.deleteArticle = function ($event) {
            articleService.deleteArticle($scope.article).then(function () {
                ui.editArticleEntry.modal('hide');
                location.reload();
            }, function (error) {
                $scope.errorMessage = error.toString();
                $log.error("Error while deleting the article", error);
            });
        };
        $scope.newArticle = function (pageid) {
            return articleService.getArticleSchema().then(function (data) {
                console.log("getArticleSchema returned schema");
                $scope.article_schema = data.article_schema;
                $scope.article = {};
                $scope.article.pageid = pageid;

                var today = new moment();
                $scope.article.date = today.toISOString();
                $scope.article.publish_start = today.add(2, 'days').toISOString();
                $scope.article.publish_end = today.add(9, 'days').toISOString();
            });

        };
        $scope.renderRhoText = function () {

            $scope.textAsHtml = rho.toHtml($scope.article.text);
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

        $(".articleListItem").click(function () {
            var clickedElement = $(this);
            var id = clickedElement.attr('data-id');
            $scope.loadArticle(id);
            ui.editArticleEntry.on('shown.bs.modal', function (e) {
                console.log("Modal dialog showed");
            });

            // show modal dialog
            ui.editArticleEntry.modal({backdrop: true});

            console.log("showing modal dialog...");
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

    }])
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

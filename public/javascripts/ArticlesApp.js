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
var articleEditApp = angular.module('articleEditApp', ['ui.bootstrap']);

articleEditApp.config(['$httpProvider',
    function(provider){
        provider.defaults.xsrfHeaderName = 'X-CSRF-Token';
        provider.defaults.xsrfCookieName = 'X-CSRF-Token';
    }]
);

// add the article edit controller
articleEditApp.controller('articleEditCtrl',
    function ($log, $scope, articleService) {
        $scope.loadArticle = function (id) {
            var promise = articleService.getArticle(id);
            promise.then(function (payload) {
                    $scope.article = payload.article;
                    $scope.article_schema = payload.article_schema;
                    $scope.article_sections = payload.article_sections;
                    $scope.article_section_schema = payload.article_section_schema;
                },
                function (error) {
                    $log.error("Error while loading the article", error);
                });
        };
        $scope.saveArticle = function ($event) {
            articleService.saveArticle($scope.article).then(function(){
                ui.editArticleEntry.modal('hide');
                location.reload();
            }, function(error){
                $log.error("Error while saving the article", error);
            });
        };

        // date picker event
        $scope.openDatePicker = function ($event, isOpenAttrName) {
            $event.preventDefault();
            $event.stopPropagation();

            // close other opened date pickers before opening a new one
            if (!$scope.openedDatePicker) {
                $scope.openedDatePicker = {};
            } else {
                _.each($scope.openedDatePicker, function(val, key){
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
    })
    .factory('articleService', function ($http, $log, $q) {
        return {
            getArticle: function (id) {
                var deferred = $q.defer();

                $http.get('/api/v1/articles/' + id).success(function (data, resp, jqXHR) {
                    //this.csrfToken = jqXHR('X-CSRF-Token');
                    deferred.resolve(data);
                }).error(function (msg, code) {
                    deferred.reject(msg);
                    $log.error(msg, code);
                });

                return deferred.promise;
            },
            saveArticle:function (article) {
                var deferred = $q.defer();

                $http.put('/api/v1/articles/' + article.article_id, article).success(function (data) {
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
            }
        }
    }
);

var ui = {
    editArticleEntry: $("#editArticleEntry"),
    errorMessage: $("#errorMessage")
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

function saveClicked() {
    ui.errorMessage.addClass("hidden");

    this.model.save().done(function () {
        ui.editArticleEntry.modal('hide');
        location.reload();
    }).fail(function (req) {
        if (req.responseText && req.responseText.substr(0, 14) != "<!DOCTYPE html") {
            console.log("Saving event failed: " + req.responseText);
        }
        ui.errorMessage.text(req.status + " " + req.statusText).removeClass("hidden");
    });
}
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

// add the article edit controller
articleEditApp.controller('articleEditCtrl',
    function ($log, $scope, articleService) {
        $scope.loadArticle = function (id) {
            var promise = articleService.getArticle(id);
            promise.then(function (payload) {
                    $scope.article = payload.article;
                    $scope.article_sections = payload.article_sections;
                },
                function (error) {
                    $log.error("Error while loading the article", error);
                });
        };
        // date picker event
        $scope.open = function ($event) {
            $event.preventDefault();
            $event.stopPropagation();

            $scope.opened = true;
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

                $http.get('/api/v1/articles/' + id).success(function (data) {
                    // todo: postprocessing of the data
                    deferred.resolve(data);
                }).error(function (msg, code) {
                    deferred.reject(msg);
                    $log.error(msg, code);
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
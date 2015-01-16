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

// create the application module
var articleEditApp = angular.module('articleEditApp', []);

// setup angularjs resource to use the rest api
/*
 angular.module('articleEditApp.services').factory('Entry', function ($resource) {
 return $resource('/api/v1/articles/:id'); // Note the full endpoint address
 });
 */

angular.module('articleEditApp.models', []).service('ArticleManager',
    [
        '$q',
        '$http',
        'Article',
        function ($q, $http, Article) {
            return {
                get: function (id) {
                    var deferred = $q.defer();

                    $http.get('/api/v1/articles/' + id).success(function (data) {
                        var articles = [];
                        for (var i = 0; i < data.objects.length; i++) {
                            articles.push(new Article(data.objects[i]));
                        }
                        deferred.resolve(articles);
                    });

                    return deferred.promise;
                }
            };
        }
    ]).factory('Article',
    function () {
        function Article(data) {
            for (var attr in data) {
                if (data.hasOwnProperty(attr)) {
                    this[attr] = data[attr];
                }
            }
        }

        return Article;
    }
);

articleEditApp.controller('articleEditController', ['$scope', 'ArticleManager', function ($scope, ArticleManager) {
        $scope.loadArticle = function (id) {
            ArticleManager.get(id).then(function (articles) {
                $scope.article = articles[0];
            });
        };

        $scope.loadArticle(id);
    }]
);

var ui = {
    editArticleEntry: $("#editArticleEntry"),
    errorMessage: $("#errorMessage")
};


$(function () {
    $(".articleListItem").click(function () {
        var clickedElement = $(this);
        var id = clickedElement.attr('data-id');
        articleEditApp.controller('articleEditController', function ($scope, Entry) {
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
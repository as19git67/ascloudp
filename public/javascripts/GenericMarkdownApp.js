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
var genericHTMLEditApp = angular.module('genericHTMLEditApp', ['ngCookies', 'ui.bootstrap']);

genericHTMLEditApp.config(['$httpProvider',
  function (provider) {
    provider.defaults.xsrfHeaderName = 'X-CSRF-Token';
    provider.defaults.xsrfCookieName = 'X-CSRF-Token';
  }]
);

// add the edit controller
genericHTMLEditApp.controller('genericHTMLEditCtrl', ['$sce', '$log', '$scope', '$cookies', '$location', 'genericHTMLPageService',
  function ($sce, $log, $scope, $cookies, $location, genericHTMLPageService) {

    $scope.isNotEmpty = function (item) {
      if (!item) {
        return false;
      }
      return !_.isEmpty(item);
    };

    $scope.loadGenericHTMLPage = function (page_id) {
      $scope.errorMessage = undefined;
      var promise = genericHTMLPageService.getGenericHTMLPage(page_id);
      promise.then(function (payload) {
            $scope.genericHTMLPage = payload.genericHTMLPage;
            $scope.markdownPage_schema = payload.genericHTMLPage_schema;

            if ($scope.genericHTMLPage.text) {
              if ($scope.genericHTMLPage.text.length === 0) {
                var placeholderText = "";
              } else {
                var placeholderText = "Text hier eingeben"
              }
              $scope.editor = new MediumEditor('.editor-source', {
                toolbar: {
                  autolink: true,
                  buttons: ['bold', 'italic', 'underline', 'strikethrough', 'anchor', 'quote', 'pre', 'orderedlist', 'unorderedlist', 'indent',
                    'outdent',
                    'justifyLeft', 'justifyCenter', 'justifyRight', 'justifyFull', 'h1', 'h2', 'h3']
                },
                placeholder: {
                  text: placeholderText
                }
              });
              $scope.editor.setContent($scope.genericHTMLPage.text);
//              $scope.renderGenericHTMLPage();
            }
          },
          function (error) {
            $log.error("Error while loading the generic html page data", error);
          });
      return promise;
    };
    $scope.saveGenericHTMLPage = function ($event) {

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

      var genericHTMLPage = _.clone($scope.genericHTMLPage);
      genericHTMLPage.text = $scope.editor.getContent();

      genericHTMLPage.date = makeMidnightUtc($scope.genericHTMLPage.date);
      genericHTMLPage.publish_start = makeMidnightUtc($scope.genericHTMLPage.publish_start);
      genericHTMLPage.publish_end = makeMidnightUtc($scope.genericHTMLPage.publish_end);

      genericHTMLPageService.saveGenericHTMLPage(genericHTMLPage).then(function () {
        location.reload();
      }, function (error) {
        if (error) {
          $scope.errorMessage = error.toString();
          $log.error("Error while saving the generic html page", error);
        } else {
          $scope.errorMessage = "Fehler beim Speichern des Seiteninhalts. Verbindungsaufbau mit dem Server nicht möglich.";
          $log.error("Error while saving the generic html page. Connection problem.");
        }
      });
    };
    $scope.deleteGenericHTMLPage = function ($event) {
      genericHTMLPageService.deleteGenericHTMLPage($scope.genericHTMLPage).then(function () {
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
        $log.error("Error while deleting the generic html page", error);
      });
    };
    $scope.newGenericHTMLPage = function (pageid) {
      return genericHTMLPage.getGenericHTMLPageSchema().then(function (data) {
        console.log("getGenericHTMLPageSchema returned schema");
        $scope.genericHTMLPage_schema = data.genericHTMLPage_schema;
        $scope.genericHTMLPage = {};
        $scope.genericHTMLPage.pageid = pageid;

        var today = new moment();
        today.set('hour', 0);
        today.set('minute', 0);
        today.set('second', 0);
        today.set('millisecond', 0);
        $scope.genericHTMLPage.date = today.toISOString();
        $scope.genericHTMLPage.publish_start = today.add(2, 'days').toISOString();
        $scope.genericHTMLPage.publish_end = today.add(9, 'days').toISOString();
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
    $scope.renderGenericHTMLPage = function () {

      $scope.textAsHtml = $scope.genericHTMLPage.text;
      // add class attribute to all image tags to apply bootstrap styles
      //$scope.textAsHtml = rawHtml.replace(/<img\s*src=/g, "<img class=\"img-responsive\" src=");
      $scope.trustedTextAsHtml = $sce.trustAsHtml($scope.textAsHtml);

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

    var absUrl = $location.absUrl();
    $scope.loadGenericHTMLPage('abc').catch(function (error) {
      if (error) {
        console.log("ERROR: ", error);
        //location.href = "/";
      }
    });
  }
]).factory('genericHTMLPageService', function ($http, $log, $q) {
  return {
    getGenericHTMLPageSchema: function () {
      var deferred = $q.defer();
      $http.get('/api/v1/genericHTMLPages?type=schema').success(function (data, resp, jqXHR) {
        deferred.resolve(data);
      }).error(function (msg, code) {
        deferred.reject(msg);
        $log.error(msg, code);
      });
      return deferred.promise;
    },
    getGenericHTMLPage: function (page_id) {
      var deferred = $q.defer();
      $http.get('/api/v1/genericHTMLPages/' + page_id).success(function (data, resp, jqXHR) {
        deferred.resolve(data);
      }).error(function (msg, code) {
        deferred.reject(msg);
        $log.error(msg, code);
      });
      return deferred.promise;
    },
    saveGenericHTMLPage: function (genericHTMLPage, html) {
      var deferred = $q.defer();
      var promise;
      if (page_id) {
        promise = $http.put('/api/v1/genericHTMLPages/' + genericHTMLPage.page_id, genericHTMLPage);
      } else {
        deferred.reject("Can't save without page id");
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
    deleteGenericHTMLPage: function (article) {
      var deferred = $q.defer();
      var promise = $http.delete('/api/v1/genericHTMLPages/' + page_id);
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
});

var ui = {
  editEntry: $("#editEntry"),
  errorMessage: $("#errorMessage")
};

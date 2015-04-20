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
var calendarEditApp = angular.module('calendarEditApp', ['ngCookies', 'ui.bootstrap']);

calendarEditApp.config(['$httpProvider',
        function (provider) {
            provider.defaults.xsrfHeaderName = 'X-CSRF-Token';
            provider.defaults.xsrfCookieName = 'X-CSRF-Token';
        }]
);

// add the calendar edit controller
calendarEditApp.controller('calendarEditCtrl', ['$sce', '$log', '$scope', '$cookies', 'calendarService',
    function ($sce, $log, $scope, $cookies, calendarService) {

        $scope.isNotEmpty = function (item) {
            if (!item) {
                return false;
            }
            return !_.isEmpty(item);
        };
        $scope.loadEvent = function (id) {
            var promise = calendarService.getEvent(id);
            promise.then(function (payload) {
                    $scope.event = payload.event;
                    $scope.event.event_start_time = payload.event.event_start;
                    $scope.event.event_end_time = payload.event.event_end;
                    $scope.event.publish_start_time = payload.event.publish_start;
                    $scope.event.publish_end_time = payload.event.publish_end;
                    $scope.event_schema = payload.event_schema;
                },
                function (error) {
                    $log.error("Error while loading the event", error);
                });
            return promise;
        };
        $scope.saveEvent = function ($event) {

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

            function combineDateAndTime(dateIn, timeIn) {
                var d;
                if (dateIn instanceof moment) {
                    d = dateIn.toDate();
                } else {
                    d = new Date(dateIn);
                }
                var t;
                if (timeIn instanceof moment) {
                    t = timeIn.toDate();
                } else {
                    t = new Date(timeIn);
                }
                var y = d.getFullYear();
                var m = d.getMonth();
                var day = d.getDate();
                var h = t.getHours();
                var min = t.getMinutes();
                var sec = t.getSeconds();
                var dd = new Date(y, m, day, h, min, sec);
                if (dateIn instanceof moment) {
                    return moment(dd);
                } else {
                    return dd;
                }
            }

            var event = _.clone($scope.event);

            event.event_start = combineDateAndTime($scope.event.event_start, $scope.event.event_start_time);
            event.event_end = combineDateAndTime($scope.event.event_end, $scope.event.event_end_time);
            event.publish_start = combineDateAndTime($scope.event.publish_start, $scope.event.publish_start_time);
            event.publish_end = combineDateAndTime($scope.event.publish_end, $scope.event.publish_end_time);

            calendarService.saveEvent(event).then(function () {
                ui.editCalendarEntry.modal('hide');
                location.reload();
            }, function (error) {
                if (error) {
                    $scope.errorMessage = error.toString();
                    $log.error("Error while saving the event", error);
                } else {
                    $scope.errorMessage = "Fehler beim Speichern des Kalendereintrags. Verbindungsaufbau mit dem Server nicht möglich.";
                    $log.error("Error while saving the event. Connection problem.");
                }
            });
        };
        $scope.deleteEvent = function ($event) {
            calendarService.deleteEvent($scope.event).then(function () {
                ui.editCalendarEntry.modal('hide');
                location.reload();
            }, function (error) {
                if (error) {
                    $scope.errorMessage = error.toString();
                }
                else {
                    $scope.errorMessage = "Unbekannter Fehler";
                }
                $log.error("Error while deleting the event", error);
            });
        };
        $scope.newEvent = function (pageid) {
            return calendarService.getEventSchema().then(function (data) {
                console.log("getEventSchema returned schema");
                $scope.event_schema = data.event_schema;
                $scope.event = {};
                $scope.event.pageid = pageid;

                $scope.event.title = "";
                $scope.event.location = "";
                $scope.event.description = "";

                var today = new moment();
                today.set('minute', 0);
                today.set('second', 0);
                today.set('millisecond', 0);
                var start = today.add(2, 'days');
                var end = start.add(1, 'hours');
                $scope.event.event_start = start.toISOString();
                $scope.event.event_end = end.toISOString();
                $scope.event.event_start_time = start;
                $scope.event.event_start_time = end;
                $scope.event.publish_start = today.add(1, 'days').toISOString();
                $scope.event.publish_end = $scope.event.event_end;
            });

        };

        $scope.timeChanged = function ($event) {

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

        $(".calendarListItem .glyphicon.glyphicon-edit").click(function () {
            var clickedElement = $(this);
            var id = clickedElement.attr('data-id');
            if (id) {
                $scope.loadEvent(id)
                    .then(function () {
                        ui.editCalendarEntry.on('shown.bs.modal', function (e) {
                            console.log("Modal dialog showed");
                        });

                        // show modal dialog
                        ui.editCalendarEntry.modal({backdrop: true});

                        console.log("showing modal dialog...");
                    })
                    .catch(function (error) {
                        if (error) {
                            location.href = "/login";
                        }
                    });
            }
            else {
                console.log("Can't open event because data-id on clicked element is missing");
            }
        });
        ui.newItem.click(function () {
            var clickedElement = $(this);
            var pageid = clickedElement.attr('data-pageid');

            ui.editCalendarEntry.on('shown.bs.modal', function (e) {
                console.log("Modal dialog showed");
            });

            $scope.newEvent(pageid).then(function () {
                // show modal dialog
                ui.editCalendarEntry.modal({backdrop: true});

                console.log("showing modal dialog...");
            });
            console.log("newEvent called");

        });

    }
])
    .factory('calendarService', function ($http, $log, $q) {
        return {
            getEventSchema: function () {
                var deferred = $q.defer();
                $http.get('/api/v1/events?type=schema').success(function (data, resp, jqXHR) {
                    deferred.resolve(data);
                }).error(function (msg, code) {
                    deferred.reject(msg);
                    $log.error(msg, code);
                });
                return deferred.promise;
            },
            getEvent: function (id) {
                var deferred = $q.defer();
                $http.get('/api/v1/events/' + id).success(function (data, resp, jqXHR) {
                    deferred.resolve(data);
                }).error(function (msg, code) {
                    deferred.reject(msg);
                    $log.error(msg, code);
                });
                return deferred.promise;
            },
            saveEvent: function (event) {
                var deferred = $q.defer();
                var promise;
                if (event.id) {
                    promise = $http.put('/api/v1/events/' + event.id, event);
                } else {
                    promise = $http.post('/api/v1/events/', event);
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
            deleteEvent: function (event) {
                var deferred = $q.defer();
                var promise = $http.delete('/api/v1/events/' + event.event_id, event);
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
    editCalendarEntry: $("#editCalendarEntry"),
    errorMessage: $("#errorMessage"),
    newItem: $(".calendarNew")
};

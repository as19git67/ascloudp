// create the application module - dependencies to other modules are bootstrap modules for angularjs
var memberEditApp = angular.module('memberEditApp', ['ngCookies', 'ui.bootstrap']);

memberEditApp.config(['$httpProvider',
        function (provider) {
            provider.defaults.xsrfHeaderName = 'X-CSRF-Token';
            provider.defaults.xsrfCookieName = 'X-CSRF-Token';
        }]
);

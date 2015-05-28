// run this before social-like runs!
// This script replaces the data-url attribute with the full url
$(function () {
    var elements = $('.social-likes');
    var s, url, href, d;
    for (var i = 0; i < elements.length; i++) {
        s = $(elements[i]);
        d = s.attr('data-url');
        url = window.location.origin + '/' + d;
        s.attr('data-url', url);
    }
});

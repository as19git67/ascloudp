$(function () {
    var elements = $('.social-likes');

    var s, url;
    for (var i = 0; i < elements.length; i++) {
        s = $(elements[i]);
        var d = s.attr('data-url');
        url = window.location.href + d;
        s.socialLikes({
            url: url
        });
    }
});

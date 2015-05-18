$(function () {
    var elements = $('.social-likes');

    var s, url, href, d;
    for (var i = 0; i < elements.length; i++) {
        s = $(elements[i]);
        d = s.attr('data-url');
        href = window.location.href.replace(window.location.hash, "");
        url = href + d;
        s.socialLikes({
            url: url
        });
    }
});

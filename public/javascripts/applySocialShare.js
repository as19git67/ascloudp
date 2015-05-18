$(function () {
    var elements = $('.social-likesXX');
    var s, url, href, d, t;
    for (var i = 0; i < elements.length; i++) {
        s = $(elements[i]);
        t = s.attr('data-title');
        d = s.attr('data-url');
        href = window.location.href.replace(window.location.hash, "");
        url = href + d;
        s.socialLikes({
            url: url,
            title: t
        });
    }
});

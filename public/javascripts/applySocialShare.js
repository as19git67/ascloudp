$(".socialshare").socialSharePrivacy({
    'language': 'de',
    'lang_path': '/lib/socialshareprivacy/lang/',
    uri: function (context) {
        var url = window.location.pathname;
        var id = $(context).parents(".articleListItem").find("a").attr("id");
        var url = url + "/" + id;
        return url;
    }
});
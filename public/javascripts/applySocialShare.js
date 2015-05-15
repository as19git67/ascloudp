$(".socialshare").socialSharePrivacy({
    services: {
        facebook: {
            perma_option: 'off',
            dummy_img: '/lib/socialshareprivacy/images/dummy_facebook.png'
        },
        twitter: {
            perma_option: 'off',
            dummy_img: '/lib/socialshareprivacy/images/dummy_twitter.png'
        },
        gplus: {
            perma_option: 'off',
            dummy_img: '/lib/socialshareprivacy/images/dummy_gplus.png'
        }
    },
    'language': 'de',
    'lang_path': '/lib/socialshareprivacy/lang/',
    uri: function (context) {
        var url = window.location.pathname;
        var id = $(context).parents(".articleListItem").find("a").attr("id");
        var url = url + "/" + id;
        return url;
    }
});
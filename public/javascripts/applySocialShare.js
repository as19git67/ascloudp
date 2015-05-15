$(".socialshare").socialSharePrivacy({
    services: {
        facebook: {
            perma_option: 'off',
            dummy_img: '/lib/socialshareprivacy/images/dummy_facebook.png',
            img: '/lib/socialshareprivacy/images/facebook_share_de.png'
        },
        twitter: {
            perma_option: 'off',
            dummy_img: '/lib/socialshareprivacy/images/dummy_twitter.png'
        },
        gplus: {
            perma_option: 'off',
            dummy_img: '/lib/socialshareprivacy/images/dummy_gplus.png',
            status: 'off'
        }
    },
    'language': 'de',
    'lang_path': '/lib/socialshareprivacy/lang/',
    'info_link': '',
    uri: function (context) {
        var u = window.location.pathname;
        var id = $(context).parents(".articleListItem").find("a").attr("id");
        var u = u + "/" + id;
        console.log("URL:" + u)
        return u;
    }
});
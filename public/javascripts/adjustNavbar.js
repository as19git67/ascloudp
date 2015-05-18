function isBreakpoint(alias) {
    return $('.device-' + alias).is(':visible');
}

function showInOtherMenuIfMenuTooLarge(itemsLeft, maxWidth, itemsOtherMenu) {
    var sumOfWidths = 0;
    var haveOtherMenuItems = false;
    for (var idx = 0; idx < itemsLeft.length; idx++) {
        var iLeft = $(itemsLeft[idx]);
        var iWidth = iLeft.width();
        sumOfWidths += iWidth;
        if (sumOfWidths > maxWidth) {
            iLeft.hide();
            $(itemsOtherMenu[idx]).show();
            haveOtherMenuItems = true;
        }
        else {
            iLeft.show();
            $(itemsOtherMenu[idx]).hide();
        }
    }
    return haveOtherMenuItems;
}

function adjustMaxWidthOfLeftNavbar() {
    var leftNavBarToAdjust = $('.adjusted-nav-left');
    var itemsLeft = leftNavBarToAdjust.children();

    //if (isBreakpoint('sm') || isBreakpoint('md') || isBreakpoint('lg')) {
    if ($(window).width() > 480) {
        var otherMenu = $('#otherMenu ul.dropdown-menu');

        var rightNavbarWidth = $('.adjusted-nav-right').width();
        var p = $('.adjusted-nav-left').parent();
        var pWidth = p.width();
        var leftHeader = $('.app-navbar .navbar-header');
        var leftHeaderWidth = leftHeader.width();
        if (leftHeaderWidth) {
            pWidth -= leftHeaderWidth;
        }
        var otherMenuWidth = 0;
        if (otherMenu) {
            otherMenuWidth = otherMenu.width();
        }
        var maxWidth = (pWidth - rightNavbarWidth - 5);

        // add the widths of the children until max-width is reached
        var itemsOtherMenu = otherMenu.children();
        var haveOtherMenuItems = showInOtherMenuIfMenuTooLarge(itemsLeft, maxWidth, itemsOtherMenu);
        if (haveOtherMenuItems) {
            $('#otherMenu').show();
            // reduce available width by width of otherMenu and adjust visibility again
            maxWidth -= otherMenuWidth;
            showInOtherMenuIfMenuTooLarge(itemsLeft, maxWidth, itemsOtherMenu);
        } else {
            $('#otherMenu').hide();
        }
    } else {
        // boostrap shows collapsed navbar (hamburger) - don't display otherMenu; show all normal
        $('#otherMenu').hide();
        for (var idx = 0; idx < itemsLeft.length; idx++) {
            var iLeft = $(itemsLeft[idx]);
            iLeft.show();
        }
    }
    //leftNavBarToAdjust.css('max-width', maxWidth + 'px');
}


var resizeTimer;

$(function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
        adjustMaxWidthOfLeftNavbar();
    }, 50);
});

$(window).resize(function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
        adjustMaxWidthOfLeftNavbar();
        adjustMaxWidthOfLeftNavbar(); // call second time to resolve some buggy behaviour where it resizes not correctly
    }, 200);
});
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
    var rightNavbarWidth = $('.adjusted-nav-right').width();
    var p = $('.adjusted-nav-left').parent();
    var pWidth = p.width();
    var otherMenu = $('#otherMenu ul.dropdown-menu');
    var otherMenuWidth = 0;
    if (otherMenu) {
        otherMenuWidth = otherMenu.width();
    }
    var maxWidth = (pWidth - rightNavbarWidth - 10);

    var leftNavBarToAdjust = $('.adjusted-nav-left');

    // add the widths of the children until max-width is reached
    var itemsOtherMenu = otherMenu.children();
    var itemsLeft = leftNavBarToAdjust.children();
    var haveOtherMenuItems = showInOtherMenuIfMenuTooLarge(itemsLeft, maxWidth, itemsOtherMenu);
    if (haveOtherMenuItems) {
        $('#otherMenu').show();
        // reduce available width by width of otherMenu and adjust visibility again
        maxWidth -= otherMenuWidth;
        showInOtherMenuIfMenuTooLarge(itemsLeft, maxWidth, itemsOtherMenu);
    } else {
        $('#otherMenu').hide();
    }

    //leftNavBarToAdjust.css('max-width', maxWidth + 'px');
}

$(function () {
    adjustMaxWidthOfLeftNavbar();
});

var resizeTimer;
$(window).resize(function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(adjustMaxWidthOfLeftNavbar, 100);
});
var query = "";
var filterChangedTimer;

function filterChanged() {
    var includeNotPublished = $('#includeNotPublished').prop('checked');
    var includeOld = $('#includeOld').prop('checked');
    var includeDeleted = $('#includeDeleted').prop('checked');
    window.clearTimeout(filterChangedTimer);
    filterChangedTimer = window.setTimeout(function(){
        window.location.href = window.location.pathname + "?" + $.param({'includeDeleted': includeDeleted, 'includeOld': includeOld, 'includeNotPublished': includeNotPublished});
    }, 3000);
}

$('#includeNotPublished').change(filterChanged);
$('#includeOld').change(filterChanged);
$('#includeDeleted').change(filterChanged);

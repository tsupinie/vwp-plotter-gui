
function set_cookie(cook, value, expire) {
    if (expire === undefined) { expire = false; }

    var expire_dt = new Date();

    if (expire) {
        var expire_year = expire_dt.getFullYear() - 1;
    }
    else {
        var expire_year = expire_dt.getFullYear() + 10
    }
    expire_dt.setFullYear(expire_year);

    var cookie_str = cook + '=' + value + '; expires=' + expire_dt.toUTCString() + '; path=/';
    document.cookie = cookie_str;
}

function get_cookie(cook) {
    var decoded_cookie = decodeURIComponent(document.cookie);
    var cookie_list = decoded_cookie.split(';');
    for (var icook in cookie_list) {
        var cookie_str = cookie_list[icook];
        var crumbs = cookie_str.split('=');
        if (crumbs[0].trim() == cook) {
            return crumbs[1];
        }
    }
    return undefined;
}

function delete_cookie(cook) {
    set_cookie(cook, "", true);
}

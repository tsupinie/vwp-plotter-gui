<?php

function is_live_copy() {
    return (strpos(__FILE__, '/dev/') === false);
}

function root_path() {
    $path = "/home/autumn35/public_html";
    if (!is_live_copy()) {
        $path .= "/dev";
    }

    return $path;
}

function root_url() {
    $url = "http://autumnsky.us";
    if (!is_live_copy()) {
        $url .= "/dev";
    }
    return $url;
}

?>

<?php

function is_live_copy() {
    return (strpos(__FILE__, '/dev/') === false);
}

?>

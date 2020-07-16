<?php

function get_args() {
    $radar_id = addslashes($_GET['radar']);
    $age_limit = intval($_GET['age']);

    $args = array(
        'radar' => $radar_id,
        'age_limit' => $age_limit,
    );

    return $args;
}

function check($radar_id, $age_limit) {
    $ftp_server = "tgftp.nws.noaa.gov";
    $remote_dir = "SL.us008001/DF.of/DC.radar/DS.48vwp/SI." . strtolower($radar_id);

    $ftp_user_name = "anonymous";
    $ftp_user_pass = "anonymous";

    $ftpc = ftp_connect($ftp_server);
    ftp_login($ftpc, $ftp_user_name, $ftp_user_pass);
    ftp_pasv($ftpc, true);
    $contents = ftp_nlist($ftpc, "-l $remote_dir");
    ftp_close($ftpc);

    $ftimes = array();

    foreach ($contents as $line) {
        if (preg_match('/([\S]+ [\S]+ [\S]+) (sn.[\d]{4})/', $line, $matches, PREG_OFFSET_CAPTURE)) {
            $ftimes[$matches[2][0]] = strtotime($matches[1][0]);
        }
    }

    asort($ftimes);

    $keys = array_keys($ftimes);
    $vals = array_values($ftimes);

    array_shift($keys);
    array_pop($vals);

    $ftimes = array_combine($keys, $vals);

    $now = time();
    $ftime_strs = array();
    foreach ($ftimes as $fname => $ftime) {
        if ($ftime >= $now - $age_limit) {
            $ftime_strs[$fname] = date("Y-m-d", $ftime) . 'T' . date("H:i:s", $ftime). 'Z';
        }
    }

    return $ftime_strs;
}

function _main() {
    date_default_timezone_set('UTC');

    $args = get_args();
    $times = check($args['radar'], $args['age_limit']);

    $json = array(
        'radar' => $args['radar'],
        'times' => $times,
    );

    print json_encode($json);
}

_main();

?>

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

    $cur_time = new DateTime();
    $cur_year = date('Y');
    $last_year = strval(intval($cur_year) - 1);

    foreach ($contents as $line) {
        if (preg_match('/([\S]+ [\S]+ [\S]+) (sn.[\d]{4})/', $line, $matches, PREG_OFFSET_CAPTURE)) {
            $dt = date_create_from_format('Y M d H:i', $cur_year . " " . $matches[1][0]);
            if ($dt > $cur_time) {
                $dt = date_create_from_format('Y M d H:i', $last_year . " " . $matches[1][0]);
            }
            $ftimes[$matches[2][0]] = intval(date_format($dt, 'U'));
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

function check_cache($cache_file_name) {
    if (!file_exists($cache_file_name)) {
        return json_decode('{}');
    }

    $cache_json = file_get_contents($cache_file_name);
    $cache = json_decode($cache_json);
    return $cache;
}

function save_cache($cache, $cache_file_name) {
    $cache_json = json_encode($cache);

    $fp = fopen($cache_file_name, 'w');
    fwrite($fp, $cache_json);
    fclose($fp);
}

function _main() {
    date_default_timezone_set('UTC');

    $args = get_args();

    $cache_file_name = "json/radar_times.json";

    $cache = check_cache($cache_file_name);
    $check_server = false;

    if(!array_key_exists($args['radar'], $cache)) {
        $check_server = true;
    }
    else {
        $cache_time = new DateTime($cache->{$args['radar']}->{'asof'});
        $cache_time_cutoff = clone $cache_time;
        $cache_time_cutoff->add(new DateInterval('PT1M'));
        if (new DateTime() > $cache_time_cutoff) {
            $check_server = true;
        }
    }

    if ($check_server) {
        $times = check($args['radar'], $args['age_limit']);
        $cache->{$args['radar']} = array('times' => $times, 'asof' => date('c'));
        save_cache($cache, $cache_file_name);
    }
    else {
        $times = $cache->{$args['radar']}->{'times'};
    }

    $json = array(
        'radar' => $args['radar'],
        'times' => $times,
    );

    print json_encode($json);
}

_main();

?>

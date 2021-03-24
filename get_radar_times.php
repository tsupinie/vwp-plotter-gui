<?php

/*
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);
*/

function get_args() {
    $radar_id = addslashes($_GET['radar']);
    $age_limit = intval($_GET['age']);

    $args = array(
        'radar' => $radar_id,
        'age_limit' => $age_limit,
    );

    return $args;
}

function check_server($radar_id, $age_limit) {
    $ftp_server = "tgftp.nws.noaa.gov";
    $remote_dir = "SL.us008001/DF.of/DC.radar/DS.48vwp/SI." . strtolower($radar_id);

    $ftp_user_name = "anonymous";
    $ftp_user_pass = "anonymous";

    $ftpc = ftp_connect($ftp_server);
    if ($ftpc === false) {
        throw new \Exception("Failed to establish connection");
    }

    ftp_set_option($ftpc, FTP_TIMEOUT_SEC, 15);

    $ret = ftp_login($ftpc, $ftp_user_name, $ftp_user_pass);
    if ($ret === false) {
        throw new \Exception("Failed to login");
    }

    $ret = ftp_pasv($ftpc, true);
    if ($ret === false) {
        throw new \Exception("Failed to set passive mode");
    }

    $contents = ftp_nlist($ftpc, "-l $remote_dir");
    if ($contents === false) {
        throw new \Exception("Failed to list directory");
    }

    $ret = ftp_close($ftpc);
    if ($ret === false) {
        throw new \Exception("Failed to close connection");
    }

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

function load_cache($cache_file_name) {
    if (!file_exists($cache_file_name)) {
        return json_decode('{}');
    }

    $cache_json = file_get_contents($cache_file_name);
    $cache = json_decode($cache_json);
    return $cache;
}

function check_cache($cache, $radar) {
    $check_server = false;

    if(!array_key_exists($radar, $cache)) {
        $check_server = true;
    }
    else {
        $cache_time = new DateTime($cache->{$radar}->{'asof'});
        $cache_time_cutoff = clone $cache_time;
        $cache_time_cutoff->add(new DateInterval('PT55S'));
        if (new DateTime() > $cache_time_cutoff) {
            $check_server = true;
        }
    }

    return $check_server;
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

    $cache_file_name = "json/radar_times.{$args['radar']}.json";
    $lock_file_name = "json/radar_times.{$args['radar']}.lock";

    $cache = load_cache($cache_file_name);
    $check_server = check_cache($cache, $args['radar']);

    if ($check_server) {
        while (file_exists($lock_file_name)) {
            sleep(1);
        }

        $cache = load_cache($cache_file_name);
        $check_server = check_cache($cache, $args['radar']);
    }

    if ($check_server) {
        $failure = false;

        touch($lock_file_name);
        try {
            $times = check_server($args['radar'], $args['age_limit']);
        }
        catch (Exception $exc) {
            echo "{\"error\": \"{$exc->getMessage()}\"}";
            $failure = true;
        }

        unlink($lock_file_name);

        if ($failure) {
            return;
        }

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

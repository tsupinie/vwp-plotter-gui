<?php

function curl_file($url) {

    $ch = curl_init($url);
    $fp = fopen("php://memory", "w+");

    curl_setopt($ch, CURLOPT_FILE, $fp);
    curl_setopt($ch, CURLOPT_HEADER, 0);

    curl_exec($ch);
    if(curl_error($ch)) {
        fwrite($fp, curl_error($ch));
    }

    $info = curl_getinfo($ch);
    $file_size = $info['size_download'];

    curl_close($ch);
    fseek($fp, 0);

    $txt = fread($fp, $file_size);
    fclose($fp);

    return $txt;
}

function transplant_dt($dt_, $dy, $hr, $mn) {
    $dt = clone $dt_;
    $yr = intval($dt->format('Y'));
    $mo = intval($dt->format('m'));
    $dt->setDate($yr, $mo, $dy)->setTime($hr, $mn, 0);

    $dt_cutoff = clone $dt_;
    $dt_cutoff->add(new DateInterval('P1D'));
    if ($dt > $dt_cutoff) {
        $mo--;
        if ($mo == 0) {
            $mo = 12;
            $yr--;
        }

        $dt->setDate($yr, $mo, $dy);
    }

    return $dt;
}

function download_metars($cycle, $stations) {
    $url = "https://tgftp.nws.noaa.gov/data/observations/metar/cycles/" . $cycle->format('H') . "Z.TXT";
    $txt = curl_file($url);

    $time_pattern = '/([\d]{2})([\d]{2})([\d]{2})Z/';
    $wind_pattern = '/([\d]{3})([\d]{2})(?:G([\d]{2}))?KT/';

    $metars = array();

    $lines = explode("\n", $txt);
    foreach ($lines as $line) {
        $station = substr($line, 0, 4);
        if (in_array($station, $stations)) {
            $ob = array();

            if (preg_match($time_pattern, $line, $matches, PREG_OFFSET_CAPTURE)) {
                $dy = $matches[1][0];
                $hr = $matches[2][0];
                $mn = $matches[3][0];
            }
            else {
                continue;
            }

            if (preg_match($wind_pattern, $line, $matches, PREG_OFFSET_CAPTURE)) {
                $ob['wdir'] = intval($matches[1][0]);
                $ob['wspd'] = intval($matches[2][0]);
                $ob['wgst'] = $matches[3][0];
                if (is_null($ob['wgst'])) {
                    unset($ob['wgst']);
                }
                else {
                    $ob['wgst'] = intval($ob['wgst']);
                }
            }
            else {
                continue;
            }

            $ob_time = transplant_dt($cycle, $dy, $hr, $mn);
            $ob_time_str = $ob_time->format('Y-m-d') . 'T' . $ob_time->format('H:i:s') . 'Z';

            if(!array_key_exists($station, $metars)) {
                $metars[$station] = array();
            }

            $ob['time'] = $ob_time_str;
            $metars[$station][$ob_time_str] = $ob;
        }
    }

    return $metars;
}

function load_wsr88d_info() {
    $wsr88d_json = file_get_contents('wsr88ds.json');
    $wsr88d_info = json_decode($wsr88d_json);
    return $wsr88d_info;
}

function download_metar_obs() {
    $wsr88d_info = load_wsr88d_info();

    $metar_sites = array();
    foreach ($wsr88d_info as $id => $info) {
        $metar_sites[] = $info->{'metar'};
    }

    $cyc_now = floor((time() + 600) / 3600) * 3600;
    $dt = new DateTime(date('c', $cyc_now));

    $metars = array();
    for ($lag = 0; $lag < 2; $lag++) {
        $dt_lag = clone $dt;
        $dt_lag->sub(new DateInterval('PT' . $lag . 'H'));
        $metars_lag = download_metars($dt_lag, $metar_sites);
        
        foreach ($metars_lag as $stn => $obs_stn) {
            if (!array_key_exists($stn, $metars)) {
                $metars[$stn] = array();
            }

            foreach ($obs_stn as $dt_ob => $ob) {
                $metars[$stn][$dt_ob] = $ob;
            }
        }
    }

    $metars_out = array();
    foreach ($metars as $stn => $obs_stn) {
        ksort($obs_stn);
        $metars_out[$stn] = array_values($obs_stn);
    }

    return json_encode($metars_out);
}

function has_valid_cache_file($cache_file_name) {
    if (!file_exists($cache_file_name)) {
        return false;
    }

    $file_mod_time = new DateTime(date('c', filemtime($cache_file_name)));
    $file_mod_time_cutoff = clone $file_mod_time;
    $file_mod_time_cutoff->add(new DateInterval('PT9M'));
    if (new DateTime() > $file_mod_time_cutoff) {
        return false;
    }
    return true;
}

function main_() {
    date_default_timezone_set('UTC');

    $cache_file_name = "json/metars.json";
    if (has_valid_cache_file($cache_file_name)) {
        $fp = fopen($cache_file_name, 'r');
        $metars_out = fread($fp, filesize($cache_file_name));
        fclose($fp);
    }
    else {
        $metars_out = download_metar_obs();

        $fp = fopen($cache_file_name, 'w');
        fwrite($fp, $metars_out);
        fclose($fp);
    }
    print $metars_out;
}

main_();

?>

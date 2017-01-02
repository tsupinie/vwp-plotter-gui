<?php

require "utils.php";

function get_args() {
    $radar_id = addslashes($_GET['radar']);
    $smv = addslashes($_GET['smv']);
    $sfc = addslashes($_GET['sfc']);

    $args = array(
        'radar' => "'$radar_id'",
        'smv' => "'$smv'",
        'sfc' => "'$sfc'",
    );
    return $args;
}

function get_arg_str($args) {
    $arg_str = $args['radar'];

    if ($args['smv'] != "''") {
        $arg_str = $arg_str . " -m {$args['smv']}";
    }

    if ($args['sfc'] != "''") {
        $arg_str = $arg_str . " -s {$args['sfc']}";
    }

    $dt = date("d/Hi");
    $arg_str = $arg_str . " -t $dt -w";

    $md5_args = md5($arg_str);

    $path_bits = explode('/', __FILE__);
    $path = implode('/', array_slice($path_bits, 0, count($path_bits) - 1));

    $img_name = "$md5_args.png";
    $arg_str = $arg_str . " -f $path/imgs/$img_name";
    return array($arg_str, $img_name);
}

function create_image($arg_str) {
    if (is_live_copy()) {
        $script_path = "/home/autumn35/vad-plotter/vad.py";
    }
    else {
        $script_path = "/home/autumn35/vad-plotter-dev/vad.py";
    }

    $cmd = "/usr/bin/python $script_path $arg_str 2>&1";
    $output = shell_exec($cmd);
    return $output;
}

function do_output($output, $img_name) {
    $op_json = json_decode($output);
    if (!array_key_exists('error', $op_json)) {
        $op_json->{'img_name'} = $img_name;
    }
    $full_output = json_encode($op_json);
    echo $full_output;
}

function log_visit($args) {
    $log_file = "/home/autumn35/vad/visits.log";

    $log_time = date('c');

    $log = fopen($log_file, 'a');
    fwrite($log, "$log_time|{$_SERVER['REMOTE_ADDR']}|{$args['radar']}\n");
    fclose($log);
}

function vad_main() {
    date_default_timezone_set('UTC');

    $force_log = false;
    $args = get_args();

    if ($force_log or is_live_copy()) {
        log_visit($args);
    }

    list($arg_str, $img_name) = get_arg_str($args);
    $output = create_image($arg_str);
    do_output($output, $img_name);
}

vad_main();

?>

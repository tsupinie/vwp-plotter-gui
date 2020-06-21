<?php

require "../utils.php";

function get_args() {
    $radar_id = addslashes($_GET['radar']);
    $time = addslashes($_GET['time']);
    $file_id = addslashes($_GET['id']);

    $args = array(
        'radar' => $radar_id,
        'time' => $time,
        'file_id' => $file_id,
    );
    return $args;
}

function download_json($args, $output_path) {
    if (is_live_copy()) {
        $script_path = "/home/autumn35/vad-plotter/vad_json.py";
    }
    else {
        $script_path = "/home/autumn35/vad-plotter-dev/vad_json.py";
    }

    $arg_str = "'{$args['radar']}' -o '$output_path'";

    if ($args['file_id'] != "") {
        $arg_str .= " -i '{$args['file_id']}'";
    }

    $cmd = "/home/autumn35/miniconda3/bin/python $script_path $arg_str 2>&1";
    $output = shell_exec($cmd);
    return $output;
}

function do_output($json_fname, $dl_output) {
    $output = array('warnings' => array());

    if ($dl_output !== NULL) {
        $op_json = json_decode($dl_output);

        if (array_key_exists('error', $op_json)) {
            echo $dl_output;
            return;
        }
        if (basename($op_json->{'filename'}) != basename($json_fname)) {
            $output['warnings'][] = "File name from the python script does not match expected";
            $json_fname = $op_json->{'filename'};
        }
    }

    $json = file_get_contents($json_fname);
    $output['response'] = json_decode($json);
    echo json_encode($output);
}

function _main() {
    date_default_timezone_set('UTC');

    $json_path = root_path() . "/vad/json";
    $args = get_args();

    $json_date = date("Ymd_Hi", strtotime($args['time']));
    $json_fname = "$json_path/{$args['radar']}_$json_date.json";

    $output = NULL;
    if (file_exists($json_fname) === false) {
        $output = download_json($args, $json_path);
    }

    do_output($json_fname, $output);
}

_main();

?>

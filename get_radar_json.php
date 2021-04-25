<?php

/*
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);
*/

require "../utils.php";

$lock_file_name = '';

class TimeoutException extends Exception {}

function run_shell_command($cmd, $timeout) {
    $descriptors = array(
        0 => array('pipe', 'r'), 
        1 => array('pipe', 'w'), 
        2 => array('pipe', 'w')
    );

    $process = proc_open('exec ' . $cmd, $descriptors, $pipes);

    if (!is_resource($process)) {
        throw new \Exception('Could not execute process');
    }

    // Set the stdout and stderr streams to non-blocking.
    stream_set_blocking($pipes[1], 0);
    stream_set_blocking($pipes[2], 0);

    // Turn the timeout into microseconds.
    $timeout = $timeout * 1000000;

    // Output buffer.
    $buffer = '';

    // While we have time to wait.
    while ($timeout > 0) {
        $start = microtime(true);

        // Wait until we have output or the timer expired.
        $read  = array($pipes[1]);
        $other = array();
        stream_select($read, $other, $other, 0, $timeout);

        // Get the status of the process.
        // Do this before we read from the stream,
        // this way we can't lose the last bit of output if the process dies between these functions.
        $status = proc_get_status($process);

        // Read the contents from the buffer.
        // This function will always return immediately as the stream is non-blocking.
        $buffer .= stream_get_contents($pipes[1]);

        if (!$status['running']) {
            // Break from this loop if the process exited before the timeout.
            break;
        }

        // Subtract the number of microseconds that we waited.
        $timeout -= (microtime(true) - $start) * 1000000;
    }

    // Check if there were any errors.
    $buffer .= stream_get_contents($pipes[2]);

    $status = proc_get_status($process);
    $timed_out = false;
    if ($status['running']) {
        // Kill the process in case the timeout expired and it's still running.
        // If the process already exited this won't do anything.
        proc_terminate($process, 9);
        $timed_out = true;
    }

    // Close all streams.
    fclose($pipes[0]);
    fclose($pipes[1]);
    fclose($pipes[2]);

    proc_close($process);

    if ($timed_out) {
        throw new \TimeoutException();
    }

    return $buffer;
}

function get_args() {
    $radar_id = addslashes($_GET['radar']);
    $file_id = addslashes($_GET['id']);
    $session_id = addslashes($_GET['session_id']);

    $args = array(
        'radar' => $radar_id,
        'file_id' => $file_id,
        'session_id' => $session_id,
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
    try {
        $output = run_shell_command($cmd, 15);
    }
    catch (TimeoutException $exc) {
        $output = '{"error": "VWP download timed out"}';
    }
    catch (Exception $exc) {
        $output = "{\"error\": \"{$exc->getMessage()}\"}";
    }
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

function log_visit($args) {
    if (is_live_copy()) {
        $log_file = "/home/autumn35/vad/visits_v2.log";
    }
    else {
        $log_file = "/home/autumn35/vad/visits_v2_dev.log";
    }

    $log_time = date('c');
    $log = fopen($log_file, 'a');
    fwrite($log, "$log_time|{$_SERVER['REMOTE_ADDR']}|{$args['session_id']}|{$args['radar']}|{$args['already_exists']}\n");
    fclose($log);
}

function cleanup_lockfile($fname) {
    // This shouldn't ever be required (I don't think), but an extra safety measure against abandoned lock files
    if (file_exists($fname)) {
        unlink($fname);
    }
}

function handle_sigterm($sig) {
    echo '{"error": "Terminated"}';
    cleanup_lockfile($lock_file_name);
    exit;
}

function _main() {
    global $lock_file_name;

    date_default_timezone_set('UTC');

    $json_path = root_path() . "/vad/json";
    $args = get_args();

    $lock_file_name = "$json_path/{$args['radar']}.{$args['file_id']}.lock";
    $json_fname = "$json_path/{$args['radar']}_{$args['file_id']}.json";

    register_shutdown_function('cleanup_lockfile', $lock_file_name);
    pcntl_signal(SIGTERM, "handle_sigterm");

    $output = NULL;
    $already_exists = (file_exists($json_fname) !== false);

    if (!$already_exists) {
        while (file_exists($lock_file_name)) {
            sleep(1);
        }

        $already_exists = (file_exists($json_fname) !== false);
    }

    if (!$already_exists) {
        touch($lock_file_name);
        $output = download_json($args, $json_path);
        unlink($lock_file_name);
    }

    $args['already_exists'] = $already_exists;
    log_visit($args);

    do_output($json_fname, $output);
}

_main();

?>

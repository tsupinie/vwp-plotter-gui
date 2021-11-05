<?php
date_default_timezone_set('UTC');
$script_name = "/home/autumn35/public_html/{$_SERVER['SCRIPT_NAME']}";
$year = date("Y");
?>
<div id="footer">
<p>Page design (or lack thereof) &copy;2014-<?php echo $year; ?> Tim Supinie</p>
<p><?php echo "Page last modified " . date("d F Y Hi", filemtime($script_name)) . " UTC" ;?></p>
</div>

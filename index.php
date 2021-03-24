<?php

require "../utils.php";

$root_url = root_url();
$root_path = root_path();

$session_time = date('c');
$session_source = $_SERVER['REMOTE_ADDR'];
$session_id = md5("{$session_time}{$session_source}");

?>
<html>
<head>
<title>VWP Hodographs | Autumn Sky</title>
<script src='https://cdnjs.cloudflare.com/ajax/libs/moment.js/2.27.0/moment.min.js'></script>
<script src="https://code.jquery.com/jquery-3.5.1.min.js" integrity="sha256-9/aliU8dGd2tb6OSsuzixeV4y/faTqgFtohetphbbj0=" crossorigin="anonymous"></script>

<script type="text/javascript" src="<?php echo $root_url; ?>/vad/js/map_click.js"></script>
<script type="text/javascript" src="<?php echo $root_url; ?>/vad/js/parms.js"></script>
<script type="text/javascript" src="<?php echo $root_url; ?>/vad/js/utils.js"></script>
<script type="text/javascript" src="<?php echo $root_url; ?>/vad/js/cookie.js"></script>
<script type="text/javascript" src="<?php echo $root_url; ?>/vad/js/index.js"></script>
<script type="text/javascript" src="<?php echo $root_url; ?>/vad/js/app.js"></script>
<script type="text/javascript" src="<?php echo $root_url; ?>/vad/js/vwp_container.js"></script>
<script type="text/javascript" src="<?php echo $root_url; ?>/vad/js/bbox.js"></script>
<script type="text/javascript" src="<?php echo $root_url; ?>/vad/js/context.js"></script>
<script type="text/javascript" src="<?php echo $root_url; ?>/vad/js/hodo.js"></script>
<script type="text/javascript" src="<?php echo $root_url; ?>/vad/js/vwp.js"></script>
<script type="text/javascript" src="<?php echo $root_url; ?>/vad/js/gifjs/gif.js"></script>

<!--script type="text/javascript" src="<?php echo $root_url; ?>/vad/vwp.min.js"></script-->
<link rel="stylesheet" type="text/css" href="<?php echo $root_url; ?>/main.css.php">
<link rel="stylesheet" type="text/css" href="<?php echo $root_url; ?>/vad/vwp_v2.5.css">
</head>
<body>
<input type='hidden' id='root_url' value='<?php echo $root_url; ?>'>
<input type='hidden' id='session_id' value='<?php echo $session_id; ?>'>
<div id="main">
  <h1>VWP Hodographs</h1>
  <div id="selection">
    <p>Click on the map to select a radar</p>
    <div id="mapdiv">
      <ul class="tab-list">
        <li class="selectable selected">WSR-88D</li>
        <li class="selectable">TDWR</li>
      </ul>
      <canvas id="map" width=400 height=248></canvas>
      <div id="mapoverlay"></div>
    </div>
    <div id="mapsel">
      <p>Radar:</p>
    </div>

    <div id="smsel">
      <p>Storm Motion:</p>
      <ul class="toggle-list">
        <li class="selectable needhelp">BLM<span class="help helptop">Bunkers Left Mover Vector</span></li>
        <li class="selectable needhelp">Mean<span class="help helptop">0-6 km Mean Wind</span></li>
        <li class="selectable selected needhelp">BRM<span class="help helptop">Bunkers Right Mover Vector</span></li>
        <li class="selectable needhelp">DDD/SS<span class="help helptop">Select From Hodograph</span></li>
      </ul>
    </div>

    <div id="orgsel">
      <p>Origin:</p>
      <ul class="toggle-list">
        <li id='gr_origin' class="selectable selected needhelp">Ground<span class="help helptop">Ground-Relative Hodograph</span></li>
        <li id='sr_origin' class="selectable grayout needhelp">Storm<span class="help helptop">Storm-Relative Hodograph</span></li>
      </ul>
    </div>

    <div id="sfcsel">
      <p>Surface Wind:</p>
      <ul class="toggle-list">
        <li class="selectable needhelp">None<span class="help helptop">No Surface Wind</span></li>
        <li id='asoswind' class="selectable selected needhelp">ASOS<span class="help helptop">ASOS Surface Wind</span></li>
        <li class="selectable needhelp">DDD/SS<span class="help helptop">Select From Hodograph</span></li>
      </ul>
    </div>

    <div id="autoupdate" class="selectable needhelp">
      <p>Auto-Update</p><span class='help helptop'>Toggle Auto-Update</span>
    </div>
  </div>
  <div id="hododiv">
    <canvas id="hodo" width=620 height=465></canvas>
    <div id="animcontrols">
      <p id="makegif", class='selectable needhelp '>GIF<span class='help helptop'>Create Animated GIF</span></p>
      <p id="animspdup", class='selectable needhelp '>+<span class='help helptop'>Animation Speed Up</span></p>
      <p id="animspddn", class='selectable needhelp'>-<span class='help helptop'>Animation Speed Down</span></p>
      <p id="refresh", class='selectable needhelp'>&nbsp;<span class='arrow'></span><span class='help helptop'>Refresh</span></p>
      <p id="playpause", class='selectable needhelp'>&#9654;&#9616;&#9616;<span class='help helptop'>Start/Stop Animation</span></p>
      <ul id='framelist'>
      </ul>
    </div>
  </div>
  <div id="selecthelp">
    <p>&#8594;</p>
  </div>
  <div id="info">
    <p>
    <script type="text/javascript">
      function wrt() {
        document.write('tsupinie');
        document.write('@');
        document.write('gmail.com');
      }

      document.write('If you notice any problems with the page, e-mail <a href="mailto:');
      wrt();
      document.write('">');
      wrt();
      document.write("</a>.");
    </script>
  </div>
  </p>
</div>
<?php include "$root_path/footer.php" ?>
</body>
</html>

<?php

require "../utils.php";

$root_url = root_url();
$root_path = root_path();

?>
<html>
<head>
<title>VWP Hodographs | Autumn Sky</title>
<script type="text/javascript" src="<?php echo $root_url; ?>/map_click.js"></script>
<script type="text/javascript" src="<?php echo $root_url; ?>/vad/vwp.js"></script>
<link rel="stylesheet" type="text/css" href="<?php echo $root_url; ?>/main.css.php">
<link rel="stylesheet" type="text/css" href="<?php echo $root_url; ?>/vad/vwp.css">
</head>
<body>
<div id="main">
  <h1>VWP Hodographs</h1>
  <div id="selection">
    <p>Click on the map to select a radar</p>
    <div id="mapdiv">
      <canvas id="map" width=400 height=247></canvas>
      <div id="mapoverlay"></div>
    </div>
    <div id="mapsel">
      <p>Radar:</p>
    </div>
    <div id="smsel">
      <p>Storm Motion:</p>
      <ul class="selectable">
        <li>BLM</li>
        <li class="selected">BRM</li>
        <li>DDD/SS</li>
      </ul>
    </div>
    <div id="sfcsel">
      <p>Surface Wind:</p>
      <ul class="selectable">
        <li class="selected">None</li>
        <li>DDD/SS</li>
      </ul>
    </div>
    <div id="generate">
      <p>Generate Hodograph</p>
    </div>
  </div>
  <div id="hododiv">
    <canvas id="hodo" width=620 height=465></canvas>
  </div>
  <div id="selecthelp">
    <p>Select vector by clicking<br>on the hodograph</p>
  </div>
  <div id="info">
    <p>Information on how to interpret the hodograph can be found <a href="https://github.com/tsupinie/vad-plotter/blob/master/README.md#interpretation">on Github</a>, 
       along with the <a href="https://github.com/tsupinie/vad-plotter">Python script</a> that creates the images.</p>
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

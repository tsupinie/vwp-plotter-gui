<?php

require "../utils.php";

$root_url = root_url();
$root_path = root_path();

$session_time = date('c');
$session_source = $_SERVER['REMOTE_ADDR'];
$session_id = md5("{$session_time}{$session_source}");

$version = 'v2.6.1';

date_default_timezone_set('UTC');
$script_name = "/home/autumn35/public_html/{$_SERVER['SCRIPT_NAME']}";

?>
<!DOCTYPE html>
<html>
<head>
<title>VWP Hodographs | Autumn Sky</title>
<script src='https://cdnjs.cloudflare.com/ajax/libs/moment.js/2.27.0/moment.min.js'></script>
<script src="https://code.jquery.com/jquery-3.5.1.min.js" integrity="sha256-9/aliU8dGd2tb6OSsuzixeV4y/faTqgFtohetphbbj0=" crossorigin="anonymous"></script>

<script type="text/javascript" src="<?php echo $root_url; ?>/vad/js/map_click.js?<?php echo $version; ?>"></script>
<script type="text/javascript" src="<?php echo $root_url; ?>/vad/js/parms.js?<?php echo $version; ?>"></script>
<script type="text/javascript" src="<?php echo $root_url; ?>/vad/js/utils.js?<?php echo $version; ?>"></script>
<script type="text/javascript" src="<?php echo $root_url; ?>/vad/js/cookie.js?<?php echo $version; ?>"></script>
<script type="text/javascript" src="<?php echo $root_url; ?>/vad/js/index.js?<?php echo $version; ?>"></script>
<script type="text/javascript" src="<?php echo $root_url; ?>/vad/js/app.js?<?php echo $version; ?>"></script>
<script type="text/javascript" src="<?php echo $root_url; ?>/vad/js/vwp_container.js?<?php echo $version; ?>"></script>
<script type="text/javascript" src="<?php echo $root_url; ?>/vad/js/bbox.js?<?php echo $version; ?>"></script>
<script type="text/javascript" src="<?php echo $root_url; ?>/vad/js/context.js?<?php echo $version; ?>"></script>
<script type="text/javascript" src="<?php echo $root_url; ?>/vad/js/hodo.js?<?php echo $version; ?>"></script>
<script type="text/javascript" src="<?php echo $root_url; ?>/vad/js/vwp.js?<?php echo $version; ?>"></script>
<script type="text/javascript" src="<?php echo $root_url; ?>/vad/js/tabletabletable.js?<?php echo $version; ?>"></script>
<script type="text/javascript" src="<?php echo $root_url; ?>/vad/js/dataview.js?<?php echo $version; ?>"></script>
<script type="text/javascript" src="<?php echo $root_url; ?>/vad/js/gifjs/gif.js?<?php echo $version; ?>"></script>

<!--script type="text/javascript" src="<?php echo $root_url; ?>/vad/vwp.min.js"></script-->
<link rel="stylesheet" type="text/css" href="<?php echo $root_url; ?>/main.css.php">
<link rel="stylesheet" type="text/css" href="<?php echo $root_url; ?>/vad/vwp.css?<?php echo $version; ?>">
<link rel="stylesheet" media="screen and (max-width: 1200px)" type="text/css" href="<?php echo $root_url; ?>/vad/vwp_mobile.css?<?php echo $version; ?>">
</head>
<body>
<input type='hidden' id='root_url' value='<?php echo $root_url; ?>'>
<input type='hidden' id='session_id' value='<?php echo $session_id; ?>'>
<div id="screenstate"></div>
<div id="main">
  <h1>VWP Hodographs</h1>
  <div id="hamburger">
    <span></span><span></span><span></span>
  </div>
  <div id="selection">
    <div>
      <p class="desktop web-src">Click on the map to select a radar</p>
      <p class="desktop local-src">Click to load data from your device</p>
      <p class="mobile">Tap on the map to select a radar</p>
      <div id="mapdiv">
        <ul class="tab-list">
          <li id="defaultsource" class="selectable selected">WSR-88D</li>
          <li class="selectable">TDWR</li>
          <li id="localbutton" class="selectable">From Device</li>
        </ul>
        <canvas id="map"></canvas>
        <div id="mapoverlay"></div>
        <div id="localsel">
          <label for="local" style="display: block;">Choose files from device</label>
          <input type="file" id="local" name="local" multiple>
          <ul id="file-list">
          </ul>
        </div>
      </div>
      <div id="mapsel">
        <p>Radar:</p>
      </div>
    </div>

    <div>
      <div id="orgsel">
        <p>Origin:</p>
        <ul class="toggle-list">
          <li id='gr_origin' class="selectable selected needhelp">Ground<span class="help helptop">Ground-Relative Hodograph</span></li>
          <li id='sr_origin' class="selectable grayout needhelp">Storm<span class="help helptop">Storm-Relative Hodograph</span></li>
        </ul>
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

      <div id="bdysel">
        <p>QLCS Motion:</p>
        <ul class="toggle-list">
          <li class="selectable selected needhelp">None<span class="help helptop">No Boundary</span></li>
          <li class="selectable needhelp">DDD/SS<span class="help helptop">Select From Hodograph</span></li>
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
  </div>
  <div id="hododiv">
    <canvas id="hodo"></canvas>
    <div id="controlstrip">
      <div id="animcontrols">
        <p id="makegif" class='selectable needhelp'>GIF<span class='help helptop'>Create Animated GIF</span></p>
        <p id="animspdup" class='selectable needhelp'>+<span class='help helptop'>Animation Speed Up</span></p>
        <p id="animspddn" class='selectable needhelp'>-<span class='help helptop'>Animation Speed Down</span></p>
        <p id="refresh" class='selectable needhelp'>&nbsp;<span class='arrow'></span><span class='help helptop'>Refresh</span></p>
        <p id="playpause" class='selectable needhelp'><span>&#9654;&#xfe0e;&#9616;&#9616;</span><span class='help helptop'>Start/Stop Animation</span></p>
        <ul id='framelist'>
        </ul>
      </div>
      <div id="doccontrol">
        <p id="displaydoc", class='selectable needhelp'>?<span class='help helptop'>Show Documentation</span></p>
      </div>
    </div>
  </div>
  <div id="parameter-help" class="modal">
    <div class=modal-content>
      <h2>VWP Plotter Documentation</h2>
      <p style="text-align: center">Autumn Sky VWP Plotter <?php echo $version; ?>, released <?php echo date("d F Y", filemtime($script_name)); ?></p>
      <p style="text-align: center">Author: Tim Supinie</p>
      <h3>Hodograph Description</h3>
      <div class='twocol'>
        <p>A hodograph is created by drawing a line between the tips of the wind vectors at many different altitudes.
           Altitude on this hodograph denoted by color and the numbered markers, which give height above radar level in kilometers.
           The colors are red, light green, dark green, purple, and cyan for the 0-3 km, 3-6 km, 6-9 km, 9-12 km, and 12+ km layers, respectively.
           The dashed portion is from the surface wind (if present) to the lowest VAD point, which is usually 100 m (and in some cases much higher) above radar level.</p>
        <p>The data for these hodographs are created from a radar volume by many VAD retrievals, from which you can derive a root mean square error (RMSE) in the retrieval.
           The RMSE for each data point is given by the size of the shaded circles on the hodograph.
           Specifically, the radius is RMSE &times; &Sqrt;2.
           This is intended to be an upper bound on the error envelope (i.e. the true wind could be located anywhere in the circle), but in some cases the true wind probably lies outside the circle.
           I can provide the mathematical derivation for this on request.</p>
        <p>There are several markers on the plot that may be of interest.</p>
        <table>
          <tr><td>&cir;RM</td><td>The Bunkers right mover vector (if available; see Parameter Descriptions)</td></tr>
          <tr><td>&cir;LM</td><td>The Bunkers left mover vector (if available; see Parameter Descriptions)</td></tr>
          <tr><td>+SM</td><td>The user-specified storm motion (if one has been specified)</td></tr>
          <tr><td><span style="color: #a04000">&#9633;MEAN</span></td><td>The 0-6 km mean wind (if available)</td></tr>
          <tr><td><span style="font-size: 0.7em">&#9661;</span>DTM</td><td>Deviant tornado motion (if available; see Parameter Descriptions)</td></tr>
        </table>
        <p>Additionally, there is a thin cyan line from the storm motion (if available) to the lowest point on the hodograph (the surface wind, or if that is not available, the lowest VAD retrieval) and a thin magenta line from the lowest point to 500 m AGL.
           These lines outline the critical angle (see Parameter Descriptions).</p>
      </div>
      <h3>Controls</h3>
      <div class='twocol'>
        <h4>Hodograph Options</h4>
        <p>On the mobile app (the version of the page visible on most mobile devices), tap the "hamburger" button on the top left to bring up the selections.
           On the desktop app, the selections are visible by default to the left of the hodograph.</p>
        <p>To select a radar, click or tap on a dot on the map on the top left.
           This will load all data for the last 45 minutes for that particular radar.
           If you would like this radar to load by default when you load the page, click or tap on the "home" icon to the right of the radar name.</p>
        <p>The row of buttons below the radar name (on the desktop app) or at the top of the right column (on the mobile app) controls where the origin of the hodgraph plot is placed.
           The default is to place the origin at the ground ("Ground"), but for severe storms nowcasting, it can be useful to place the origin at the storm by clicking or tapping "Storm".
           Because the bounds of the hodograph plot are computed from all loaded profiles, if any of the profiles do not have a storm motion, the "Storm" option will be unavailable.
           Selecting a storm motion manually (see below) will always make the "Storm" option available.</p>
        <p>Below the origin control is the storm motion control.
           This allows you to select whether to use the 0-6 km mean wind ("MEAN") or one of the Bunkers supercell motion estimates ("BLM" for the left mover and "BRM" for the right mover) as the storm motion.
           See the Parameter Descriptions section for more information on the Bunkers estimates.
           Additionally, you can select a storm motion manually by clicking or tapping on the "DDD/SS" button and clicking or tapping on the hodograph plot where you would like to place the storm motion vector.
           On the mobile app, the selection menu will temporarily disappear to show the hodograph, and you can tap and drag when placing a vector manually and a readout box will pop up.</p>
        <p>The QLCS motion control is similar to the storm motion control.
           The QLCS motion is assumed to be a vector perpendular to the line with a magnitude equal to the forward speed of the line.
           The default is "None" (for no QLCS) with the "DDD/SS" button to allow you to place a vector manually similar to placing a storm motion manually.
           The QLCS motion is plotted as a line perpendicular to the motion (i.e. along the line).
           When a QLCS motion is plotted, the 0-3 km shear vector will also be plotted in gray for reference in diagnosing QLCS tornado potential.</p>
        <p>Next, the default surface wind is from a nearby ASOS site (the button reads "ASOS" when the page is loaded but will change to the 4-letter identifier of nearby the ASOS site after selecting a radar).
           Additionally, you can place a surface wind manually ("DDD/SS", similar to the storm motion and QLCS motion) or remove it ("None").</p>
        <p>Finally, the "Auto-Update" is a toggle switch which controls whether to automatically update the profiles as they're available or to keep the profiles currently loaded. 
           Auto-update is on by default.</p>
        <h4>Source Controls</h4>
        <p>The data source is controlled by the row of buttons above the map.
           Click or tap on the "WSR-88D" and "TDWR" button to view radars from the those respective networks.</p>
        <p>On the desktop app only, click on the "From Device" button to load VWP files from your device.
           These are typically downloaded from <a href="https://www.ncdc.noaa.gov/nexradinv/" target="_blank">NCEI</a> or <a href="https://console.cloud.google.com/storage/browser/gcp-public-data-nexrad-l3;tab=objects?prefix=&forceOnObjectsSortingFiltering=false" target="_blank">Google Cloud</a>.
           The files in the archives will have the naming convention "[WFO ID]_[6-character code]_[Product ID][Radar ID]_[Time]".
           Only the files with a product ID of "NVW" are required.
           So the file you'd load would be named something like "KOUN_SDUS34_NVWTLX_201605092105".
           You can have up to 15 files loaded at the same time, with files you loaded first being removed from the page as you load new ones.</p>
        <p>Once those files are loaded, they will appear in list form below the "Choose files from device" button.
           Each entry will have a status icon: a green "&check;" if the file loaded without errors or a red "!" if there was an error loading the file.
           Mouse over this icon to see the status of the file, including error messages, if there are any.
           If there's a file that gives errors that you think should be a valid VWP file, send me the file, and I will try to find the error.
           There is also the "&times;", which will remove the VWP from the page when clicked.</p>
        <h4>Animation Controls</h4>
        <p>When profiles are loaded, dots representing the frames will appear to the left of the "<span style="font-size: 0.5em;">&#9654;&#9616;&#9616;</span>" button.
           Click or tap on one of these dots to jump to a particular frame.
           Start and stop the animation by clicking or tapping on the "<span style="font-size: 0.5em;">&#9654;&#9616;&#9616;</span>" button.
           Increase or decrease the speed of the animation by clicking or tapping on the "+" or "-" buttons.
           Force a refresh of the data by clicking or tapping on the refresh button to the right of the "<span style="font-size: 0.5em;">&#9654;&#9616;&#9616;</span>" button.</p>
        <h4>Keyboard Controls</h4>
        <table>
          <tr><td>SPACE</td><td>Start/stop animation</td></tr>
          <tr><td>&larr;</td><td>Move back one frame</td></tr>
          <tr><td>&rarr;</td><td>Move forward one frame</td></tr>
        </table>
        <h4>Downloading Images</h4>
        <p>Clicking or tapping on the hodograph plot while not doing a manual selection will open the current frame as an image in another tab.
           Download this as you would any other image.
           To download the entire sequence as an animated <span class='needhelp' style='position: relative;'>gif<span class='help helptop'>Pronounced "gif"</span></span>, click or tap on the "GIF" button to the bottom right of the hodograph plot.
           This will open a new tab with the gif in it, after a few seconds to render the gif.
           Then download the gif as you would any other image.</p>
      </div>
      <h3>Parameter Descriptions</h3>
      <p>The parameter table has several parameters useful for severe storms nowcasting.</p>
      <table>
        <tr><td>BWD (bulk wind difference, a.k.a. bulk shear)</td><td>The magnitude of the difference between the wind vectors at two vertical levels</td></tr>
        <tr><td>LNBS (line-normal bulk shear)</td><td>The magnitude of the component of the bulk shear which is normal to the specified boundary/QLCS <a href="https://ams.confex.com/ams/26SLS/webprogram/Paper212008.html" target="_blank">(Schaumann and Przybylinski 2012)</a></td></tr>
        <tr><td>SR Flow (storm-relative flow)</td><td>The layer-mean of the magnitude of the vector difference between the wind and the storm motion <a href="https://journals.ametsoc.org/view/journals/atsc/77/9/jasD190355.xml" target="_blank">(Peters et al. 2020)</a></td></tr>
        <tr><td>SRH (storm-relative helicity)</td><td>Storm-relative helicity over a layer</td></tr>
        <tr><td>Mean Wind</td><td>The 0-6 km mean wind</td></tr>
        <tr><td>Bunkers Left Mover/Bunkers Right Mover</td><td>The <a href="https://journals.ametsoc.org/view/journals/wefo/15/1/1520-0434_2000_015_0061_psmuan_2_0_co_2.xml" target="_blank">Bunkers (2000)</a> left-moving and right-moving supercell motion estimates</td></tr>
        <tr><td>Deviant Tornado Motion</td><td>The <a href="https://journals.ametsoc.org/view/journals/wefo/36/1/WAF-D-20-0056.1.xml" target="_blank">Nixon and Allen (2021)</a> estimate of tornado motion when the tornado deviates to the left of the parent supercell motion (DTM<sub>obs</sub> is used regardless of the storm motion selection)</td></tr>
        <tr><td>Critical Angle</td><td>The angle between the surface storm-relative wind and the 0-500 m shear vector <a href="https://ejssm.org/ojs/index.php/ejssm/article/viewArticle/33" target="_blank">(Esterheld and Giuliano 2008)</a></td></tr>
      </table>
      <p>Many of these parameters use the surface wind. 
         If the surface wind is unavailable, either because the user has selected "None" for the surface wind or the nearest ASOS station is not reporting, the parameters will use the lowest point in the VWP as the surface.
         The lowest point is often ~100 m above radar level, but it can be much higher.</p>
      <h3>Acknowledgments</h3>
      <p style="text-align: center;">Cameron Nixon, John Peters, Greg Blumberg, and Heather Supinie have contributed feature ideas, encouragement, and page design advice.</p>
      <div class="modal-close">&times;</div>
    </div>
    <div class="modal-bg">&nbsp;</div>
  </div>
  <div id="selecthelp">
    <p>&#8594;</p>
  </div>
  <div id="tapreadout"></div>
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

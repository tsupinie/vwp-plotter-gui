<?php
header("Content-Type: text/css");

require "utils.php";

if (is_live_copy()) {
    $bg_color = "#aaaaaa";
}
else {
    $bg_color = "#aaaaff";
}

?>

:root {
    --bg-color: <?php echo $bg_color; ?>;
    --layout-width: 67.5em;
}

body {
    font-family:Trebuchet MS;
    background-color: var(--bg-color);
    background-image: url('/imgs/pinwheel.png');
    background-size: cover;
}


div#main {
    background-color:#ffffff;
    border:1px solid #000000;
    width: var(--layout-width);
    margin-left:auto;
    margin-right:auto;
    padding:5px;
    border-radius:5px;
/*  overflow:hidden; */
}

div#main h1 {
    text-align:center;
    width:100%;
}

div#footer {
    width:75%;
    margin-left:auto;
    margin-right:auto;
    padding-top:0.7em;
}

div#footer p {
    width:100%;
    text-align:center;
    font-size:0.7em;
    margin:0px;
}

a {
    text-decoration:none;
    color:#0066cc;
}

a:visited {
    color:#0066cc;
}

a:hover {
    color:#000000;
}

div#mainmenu ul {
    margin:0px;
    padding-left:0px;
    list-style-type:none;

    background-color:#0066cc;
    cursor:default;
}

div#mainmenu ul li {
    width:140px;
    display:inline-block;
    text-align:center;
}

div#mainmenu ul li a {
    display:block;

    padding-top:5px;
    padding-bottom:5px;

    color:white;
}

div#mainmenu ul li a:hover {
    color:black;
}

div#mainmenu ul li:hover {
    background-color:#cccccc;
}

div#mainmenu ul li.onpage {
    background-color:#003399;
}

div#mainmenu ul li.onpage p {
    margin:0px;
    padding-top:5px;
    padding-bottom:5px;
    color:white;
}

div#social {
    width:50%;
    margin-left:auto;
    margin-right:auto;
    text-align:center;
}

div#social ul {
    padding-left:0px;
    margin:0px;
    list-style-type:none;
}

div#social h3 {
    margin-top:30px;
    margin-bottom:10px;
}

div#social ul li {
    display:inline-block;
    padding-left:5px;
    padding-right:5px;
}

div#social img {
    width:40px;
    overflow:hidden;
}

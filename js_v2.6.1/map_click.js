
class ClickableMap {
    constructor(img_fname, points_fname, click_callback, type_plot) {
        this._dpr = window.devicePixelRatio || 1;

        this.selected = null;
        this.type_plot = type_plot;
        this._click_callback = click_callback

        if (this._click_callback === undefined) {
            this._click_callback = function(rad) {
                var sel = document.getElementById("mapsel");

                var sel_txt = document.createTextNode(rad.id + " (" + rad.name + ")");
                if (sel.childNodes.length == 3) {
                    var sel_li = document.createElement("li");
                    var sel_ul = document.createElement("ul");

                    sel_li.appendChild(sel_txt);
                    sel_ul.appendChild(sel_li);
                    sel.appendChild(sel_ul);
                }
                else {
                    var old_txt = sel.childNodes[3].childNodes[0];
                    old_txt.replaceChild(sel_txt, old_txt.childNodes[0]);
                }
            }
        }

        var map = document.getElementById("map");

        this._elem_width = map.width;
        this._elem_height = map.height;

        map.style.width = map.width + "px";
        map.style.height = map.height + "px";

        map.width *= this._dpr;
        map.height *= this._dpr;

        var parse_pts = (function(text) {
            this.points = JSON.parse(text);
            this.set_background(img_fname);

            if (this.selected !== null) {
                var rad = this.points.find(pt => pt.id == this.selected);
                this._click_callback(rad);
            }

            map.onmousemove = this.mousemove.bind(this);
            map.onmouseup = this.mouseclick.bind(this);
            map.onmouseout = this.clear_overlay.bind(this);
        }).bind(this);
 
        this.dl_json(points_fname, parse_pts);
    }

    set_background(img_fname) {
        this.map_bg = new Image();
        this.map_bg.onload = (function() {
            this._img_pr = this.map_bg.naturalWidth / this._elem_width;
            this.draw_map()
        }).bind(this);
    
        this.map_bg.src = img_fname;
    }

    set_type(type_plot) {
        this.type_plot = type_plot;

        this.draw_map();
    }

    draw_map() {
        var map = document.getElementById("map");
        var ctx = map.getContext('2d');
        var scale_factor = this._dpr / this._img_pr
        ctx.scale(scale_factor, scale_factor);

        ctx.drawImage(this.map_bg, 0, 0);
        for (var i = 0; i < this.points.length; i++) {
            if (this.type_plot === undefined || this.type_plot == this.points[i].type) {
                ctx.beginPath();
                ctx.arc(this.points[i].x_pix, map.height / scale_factor - this.points[i].y_pix, 2.75 * this._img_pr, 0, 2 * Math.PI);
                if (this.points[i].id == this.selected) {
                    ctx.fillStyle = "#dddddd"; // "#aacccc";
                }
                else {
                    ctx.fillStyle = "black";
                }
                ctx.fill();
                ctx.lineWidth = 1.5 * this._img_pr;
                ctx.strokeStyle = "black";
                ctx.stroke();
            }
        }

        ctx.scale(1 / scale_factor, 1 / scale_factor);
    }

    check_point(x, y) {
        var map = document.getElementById("map");
        const pix_buf = 4;
        var scale_factor = this._dpr / this._img_pr

        x = (x - map.offsetLeft) * this._img_pr;
        y = map.height / scale_factor - (y - map.offsetTop) * this._img_pr;

        var cutoff = (pix_buf * this._img_pr) * (pix_buf * this._img_pr)
        var rad = this.points.filter(pt => (this.type_plot === undefined || pt.type == this.type_plot)).find(pt => (pt.x_pix - x) * (pt.x_pix - x) + (pt.y_pix - y) * (pt.y_pix - y) <= cutoff);

        return rad;
    }

    select_point(id) {
        this.selected = id;
        if (this.points !== undefined && this.map_bg !== undefined) {
            this.draw_map();

            var rad = this.points.find(pt => pt.id == id);
            this._click_callback(rad);
        }
    }

    mousemove(event) {
        var rad = this.check_point(event.pageX, event.pageY);

        if (rad !== undefined) {
            this.show_overlay(event.pageX + 11, event.pageY + 5, rad.id);
        }
        else {
            this.clear_overlay();
        }
    }

    mouseclick(event) {
        var rad = this.check_point(event.pageX, event.pageY);

        if (rad !== undefined) {
            this.select_point(rad.id);
        }
    }

    show_overlay(x, y, content) {
        var map = document.getElementById("map");
        var overlay = document.getElementById("mapoverlay");

        overlay.innerHTML= "<p>" + content + "</p>";
        overlay.style.offsetLeft = x;
        overlay.style.offsetTop = y;
        overlay.style.left = x;
        overlay.style.top = y;
        overlay.style.visibility = "visible";
        
        map.style.cursor = "pointer";
    }

    clear_overlay() {
        var map = document.getElementById("map");
        var overlay = document.getElementById("mapoverlay");

        overlay.innerHTML = "";
        overlay.style.offsetLeft = 0;
        overlay.style.offsetTop = 0;
        overlay.style.left = 0;
        overlay.style.top = 0;
        overlay.style.visibility = "hidden";

        map.style.cursor = "default";
    }

    dl_json(path, callback) {
        var req = new XMLHttpRequest();
        req.overrideMimeType("application/json");
        req.open("GET", path, true);
        req.onreadystatechange = function() {
            if (req.readyState == 4 && req.status == "200") {
                callback(req.responseText);
            }
        };
        req.send(null);
    }
}

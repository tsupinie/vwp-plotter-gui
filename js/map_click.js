
class ClickableMap {
    constructor(img_fname, points_fname, click_callback, type_plot) {
        this._dpr = window.devicePixelRatio || 1;

        this.selected = null;
        this.type_plot = type_plot;
        this._click_callback = click_callback

        this._map = document.getElementById("map");

        let rect = this._map.getBoundingClientRect();

        this._elem_width = rect.width;
        this._elem_height = rect.height;

        this._map.width = rect.width * this._dpr;
        this._map.height = rect.height * this._dpr;

        let parse_pts = text => {
            this.points = JSON.parse(text);
            this.set_background(img_fname);

            if (this.selected !== null) {
                var rad = this.points.find(pt => pt.id == this.selected);
                this._click_callback(rad);
            }

            this._map.onmousemove = this.mousemove.bind(this);
            this._map.onmouseup = this.mouseclick.bind(this);
            this._map.onmouseout = this.clear_overlay.bind(this);
        };
 
        this.dl_json(points_fname, parse_pts);
    }

    set_background(img_fname) {
        this.map_bg = new Image();
        this.map_bg.onload = () => {
            this._img_pr = this.map_bg.naturalWidth / this._elem_width;
            this.draw_map()
        };
    
        this.map_bg.src = img_fname;
    }

    set_type(type_plot) {
        this.type_plot = type_plot;

        this.draw_map();
    }

    draw_map() {
        let ctx = this._map.getContext('2d');
        const scale_factor = this._dpr / this._img_pr
        ctx.scale(scale_factor, scale_factor);

        ctx.drawImage(this.map_bg, 0, 0);
        for (let i = 0; i < this.points.length; i++) {
            if (this.type_plot === undefined || this.type_plot == this.points[i].type) {
                ctx.beginPath();
                ctx.arc(this.points[i].x_pix, this._map.height / scale_factor - this.points[i].y_pix, 2.75 * this._dpr, 0, 2 * Math.PI);
                if (this.points[i].id == this.selected) {
                    ctx.fillStyle = "#dddddd"; // "#aacccc";
                }
                else {
                    ctx.fillStyle = "black";
                }
                ctx.fill();
                ctx.lineWidth = 1.5 * this._dpr;
                ctx.strokeStyle = "black";
                ctx.stroke();
            }
        }

        ctx.scale(1 / scale_factor, 1 / scale_factor);
    }

    check_point(x, y) {
        const pix_buf = 4;
        const scale_factor = this._dpr / this._img_pr

        x = (x - this._map.offsetLeft) * this._img_pr;
        y = this._map.height / scale_factor - (y - this._map.offsetTop) * this._img_pr;

        const cutoff = (pix_buf * this._img_pr) * (pix_buf * this._img_pr)
        const rad = this.points.filter(pt => (this.type_plot === undefined || pt.type == this.type_plot)).find(pt => (pt.x_pix - x) * (pt.x_pix - x) + (pt.y_pix - y) * (pt.y_pix - y) <= cutoff);

        return rad;
    }

    select_point(id) {
        this.selected = id;
        if (this.points !== undefined && this.map_bg !== undefined) {
            this.draw_map();

            const rad = this.points.find(pt => pt.id == id);
            this._click_callback(rad);
        }
    }

    mousemove(event) {
        const rad = this.check_point(event.pageX, event.pageY);

        if (rad !== undefined) {
            this.show_overlay(event.pageX + 11, event.pageY + 5, rad.id);
        }
        else {
            this.clear_overlay();
        }
    }

    mouseclick(event) {
        const rad = this.check_point(event.pageX, event.pageY);

        if (rad !== undefined) {
            this.select_point(rad.id);
        }
    }

    show_overlay(x, y, content) {
        let overlay = document.getElementById("mapoverlay");

        overlay.innerHTML= "<p>" + content + "</p>";
        overlay.style.offsetLeft = x + 'px';
        overlay.style.offsetTop = y + 'px';
        overlay.style.left = x + 'px';
        overlay.style.top = y + 'px';
        overlay.style.visibility = "visible";
        
        this._map.style.cursor = "pointer";
    }

    clear_overlay() {
        let overlay = document.getElementById("mapoverlay");

        overlay.innerHTML = "";
        overlay.style.offsetLeft = 0;
        overlay.style.offsetTop = 0;
        overlay.style.left = 0;
        overlay.style.top = 0;
        overlay.style.visibility = "hidden";

        this._map.style.cursor = "default";
    }

    dl_json(path, callback) {
        let req = new XMLHttpRequest();
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

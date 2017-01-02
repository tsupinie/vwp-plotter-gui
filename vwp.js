window.onload = function() {
    var app = new VWPApp();
}

function _page_pos(obj) {
    var x, y;
    if (obj.offsetLeft !== undefined) {
        x = obj.offsetLeft;
        y = obj.offsetTop;
    }
    else {
        x = obj.left;
        y = obj.top;
    }

    if (obj.offsetParent !== null) {
        offset_parent = _page_pos(obj.offsetParent);
        x += offset_parent.x;
        y += offset_parent.y;
    }
    return {'x':x, 'y':y};
}

function VWPApp() {
    var _app = this;

    this.smv = "BRM";
    this.sfc = "None";
    this.waiting = false;
    this.prev_selection = null;

    this.init = function() {
        _app.radars = new WSR88DMap();
        _app.hodo = new HodoPlot();

        selectables = document.getElementsByClassName("selectable");
        for (var i = 0; i < selectables.length; i++) {
            selectables[i].onmouseup = this.select;

            children = selectables[i].getElementsByTagName("li");
            for (var j = 0; j < children.length; j++) {
                if (children[j].childNodes[0].textContent == "DDD/SS") {
                    children[j].vector_select = true;
                }
                else {
                    children[j].vector_select = false;
                }
            }
        }

        document.getElementById("generate").onmouseup = _app.generate;
    };

    this.select = function(event) {
        target = event.target;

        if (_app.hodo.selecting) {
            _app._abort_selection();
        }

        if (target.vector_select) {
            _app.prev_selection = _app._select_box(target);
            help = document.getElementById("selecthelp");

            help.style.visibility = "visible";
            target_pos = _page_pos(target);
/*
            if (target.offsetLeft !== undefined) {
                help.offsetLeft = target.offsetLeft + 100;
                help.offsetTop = target.offsetTop;
            }
            else {
                help.left = target.left + 100;
                help.top = target.top;
            }
*/
            console.log(target_pos);
            help.style.offsetLeft = target_pos.x + 70;
            help.style.offsetTop = target_pos.y - 17;
            help.style.left = target_pos.x + 70;
            help.style.top = target_pos.y - 17;

            vector_callback = function(wspd, wdir) {
                if (wspd !== null && wdir !== null) {
                    wdir = Math.round(wdir)
                    if      (wdir < 10)  { wdir_str = "00" + wdir; }
                    else if (wdir < 100) { wdir_str = "0" + wdir; }
                    else                 { wdir_str = "" + wdir; }

                    wspd = Math.round(Math.min(wspd, 99));
                    if (wspd < 10)  { wspd_str = "0" + wspd; }
                    else            { wspd_str = "" + wspd; }

                    vec_str = wdir_str + "/" + wspd_str
                }
                else {
                    vec_str = "DDD/SS";
                }

                txt = document.createTextNode(vec_str);
                target.replaceChild(txt, target.childNodes[0]);

                _app._update_state(target, vec_str);
            }

            done_callback = function() {
                help.style.visibility = "hidden";
                help.style.offsetLeft = 0;
                help.style.offsetTop = 0;
                help.style.left = 0;
                help.style.top = 0;
            }

            _app.hodo.selection_start(vector_callback, done_callback);
        }
        else {
            _app._select_box(target);
            _app._update_state(target, target.childNodes[0].textContent);
        }
    };

    this.generate = function() {
        if (_app.radars.selected === null || _app.radars.selected == "") {
            window.alert("Select a radar first!");
            return;
        }

        if (_app.waiting) {
            return;
        }

        if (_app.hodo.selecting) {
            _app._abort_selection();
        }

        req = new XMLHttpRequest();
        path = "create_vad.php?radar=" + _app.radars.selected

        if (_app.smv != "DDD/SS") {
            path += "&smv=" + _app.smv
        }

        if (_app.sfc != "None" && _app.sfc != "DDD/SS") {
            path += "&sfc=" + _app.sfc
        }

        req.open("GET", path, true);
        req.onreadystatechange = function() {
            if (req.readyState == 4 && req.status == "200") {
                _app.hodo.stop_loading();

                resp_json = JSON.parse(req.responseText);
               
                if (!('error' in resp_json)) {
                    _app.hodo.set_image("imgs/" + resp_json.img_name, 
                        resp_json.min_u, resp_json.max_u, resp_json.min_v, resp_json.max_v
                    );
                }
                else {
                    _app.hodo.draw_hodo();
                    window.alert("An error occurred!");
                }
                _app.waiting = false;
    	    }
        };
        req.send(null);
        _app.hodo.start_loading();
        _app.waiting = true;
    };

    this._select_box = function(obj) {
        was_selected = null;
        siblings = obj.parentElement.getElementsByTagName(obj.tagName);
        for (var i = 0; i < siblings.length; i++) {
            if (siblings[i].className != "") {
                was_selected = siblings[i];
            }
            siblings[i].className = "";
        }

        obj.className = "selected";
        return was_selected;
    };

    this._update_state = function(obj, val) {
        if (obj.parentElement.parentElement.id == "smsel") {
            _app.smv = val;
        }
        else if (obj.parentElement.parentElement.id == "sfcsel") {
            _app.sfc = val;
        }
    };

    this._abort_selection = function () {
        if (_app.prev_selection !== null) {
            _app._select_box(_app.prev_selection)
            _app._update_state(_app.prev_selection, _app.prev_selection.childNodes[0].textContent);
        }
        _app.hodo.selection_finish();
    }

    this.init();
}

function HodoPlot() {
    var _hodo = this;
    this._port_lbx = 26 * 0.64;
    this._port_lby = 22 * 0.64;
    this._port_ubx = 702 * 0.64;
    this._port_uby = 698 * 0.64;
/*
    this._port_lbu = -40;
    this._port_lbv = -40;
    this._port_ubu = 80;
    this._port_ubv = 80;
*/
    this.callback = null;
    this._selecting = false;
    this._anim_timer = null;
    this.not_default = false;

    this.init = function() {
        hodo = document.getElementById("hodo");

        _hodo.img = new Image();
        _hodo.img.onload = function() {
            _hodo.draw_hodo();
        }

        _hodo.set_image("imgs/static/default.png", -40, 80, -40, 80);
      
        hodo.onmousemove = this.mousemove;
        hodo.onmouseup = this.mouseclick;
        hodo.onmouseout = this.mouseleave;
    };

    this.draw_hodo = function() {
        hodo = document.getElementById("hodo");
        ctx = hodo.getContext('2d');
        ctx.drawImage(_hodo.img, -15, -10, 640, 480);
    };

    this.set_image = function(img_src, lbu, ubu, lbv, ubv) {
        _hodo.img.src = img_src;
        _hodo._port_lbu = lbu;
        _hodo._port_ubu = ubu;
        _hodo._port_lbv = lbv;
        _hodo._port_ubv = ubv;
    }

    this.mousemove = function(event) {
        hodo = document.getElementById("hodo");
        mx = event.pageX - hodo.offsetLeft;
        my = event.pageY - hodo.offsetTop;

        if (_hodo.callback === null) {
            if (mx >= _hodo._port_lbx && mx <= _hodo._port_ubx && my >= _hodo._port_lby && my <= _hodo._port_uby && _hodo.not_default) {
                hodo.style.cursor = "pointer";
            }
            else {
                hodo.style.cursor = "default";
            }
        }
        else {
            wind = _hodo.xy2uv(mx, my);

           if (wind.u !== null && wind.v !== null) {
                hodo.style.cursor = "crosshair";
                vec = _hodo.uv2sd(u, v);
                _hodo.callback(wspd, wdir);

            }
            else {
                hodo.style.cursor = "default";
                _hodo.callback(null, null);
            }
        }
    };

    this.mouseclick = function(event) {
        if (_hodo.callback === null) {
            hodo = document.getElementById("hodo");
            mx = event.pageX - hodo.offsetLeft;
            my = event.pageY - hodo.offsetTop;

            if (mx >= _hodo._port_lbx && mx <= _hodo._port_ubx && my >= _hodo._port_lby && my <= _hodo._port_uby && _hodo.not_default) {
                window.open(_hodo.img.src, '_blank');
            }
        }
        else {
            _hodo.selection_finish();
        }
    };

    this.mouseleave = function(event) {
        if (_hodo.callback !== null) {
            _hodo.callback(null, null);
        }
    };

    this.xy2uv = function(x, y) {
        u = null;
        v = null;

        if (mx >= _hodo._port_lbx && mx <= _hodo._port_ubx && my >= _hodo._port_lby && my <= _hodo._port_uby) {
            u = _hodo._port_lbu + (_hodo._port_ubu - _hodo._port_lbu) * (mx - _hodo._port_lbx) / (_hodo._port_ubx - _hodo._port_lbx);
            v = _hodo._port_lbv + (_hodo._port_ubv - _hodo._port_lbv) * (_hodo._port_uby - my) / (_hodo._port_uby - _hodo._port_lby);
        }

        return {'u':u,'v':v};
    };

    this.uv2sd = function(u, v) {
        wspd = Math.sqrt(Math.pow(u, 2) + Math.pow(v, 2));
        wdir = 90 - Math.atan2(-v, -u) * 180 / Math.PI;
        if (wdir < 0) {
            wdir += 360;
        }
        return {'wspd':wspd, 'wdir':wdir}
    }

    this.selection_start = function(callback, done_cb) {
        hodo = document.getElementById("hodo");

        _hodo.callback = callback;
        _hodo.done_cb = done_cb;

        _hodo.selecting = true;
    };

    this.selection_finish = function() {
        hodo = document.getElementById("hodo");

        _hodo.done_cb();

        hodo.style.cursor = "default";
        _hodo.callback = null;
        _hodo.done_cb = null;

        _hodo.selecting = false;
    };

    this.start_loading = function() {
        hodo = document.getElementById("hodo");
        ctx = hodo.getContext('2d');
        num = 0;

        ctr_x = (_hodo._port_ubx - _hodo._port_lbx) / 2;
        ctr_y = (_hodo._port_uby - _hodo._port_lby) / 2;

        circ_rad = 50;
        dot_rad = 20;

        pos_x = [];
        pos_y = [];

        for (var i = 0; i < 8; i++) {
            pos_x[i] = ctr_x + circ_rad * Math.cos(Math.PI * i / 4);
            pos_y[i] = ctr_y + circ_rad * Math.sin(Math.PI * i / 4);
        }

        anim = function() {
            num++;

            _hodo.draw_hodo();

            ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
            ctx.fillRect(0, 0, hodo.width, hodo.height);

            for (var i = 0; i < 8; i++) {
                pos_i = (i + num) % 8;
                ctx.beginPath();
                ctx.fillStyle = 'rgba(30, 30, 30, ' + (0.1 * (i + 2)) + ')';
                ctx.arc(pos_x[pos_i], pos_y[pos_i], dot_rad / 8 * i, 0, 2 * Math.PI);
                ctx.fill();
            }
        }

        _hodo.anim_timer = window.setInterval(anim, 100);
    }

    this.stop_loading = function() {
        window.clearInterval(_hodo.anim_timer);
        _hodo.not_default = true;
    }

    this.init();
}

function WSR88DMap() {
    var _map = this;
    this.selected = null;

    this.init = function() {
        map = document.getElementById("map");

        parse_88ds = function(text) {
            _map.wsr88ds = JSON.parse(text);
            _map.draw_map()

            map.onmousemove = _map.mousemove;
            map.onmouseup = _map.mouseclick;
            map.onmouseout = _map.clear_overlay;
        }
 
        _map.map_bg = new Image();
        _map.map_bg.onload = function() {
            _map.dl_json("wsr88ds.json", parse_88ds);
        }
    
        _map.map_bg.src = "imgs/static/map.png";    
        
    };

    this.draw_map = function() {
        map = document.getElementById("map");
        ctx = map.getContext('2d');

        ctx.drawImage(_map.map_bg, 0, 0);
        for (var i = 0; i < _map.wsr88ds.length; i++) {
            ctx.beginPath();
            ctx.arc(_map.wsr88ds[i].x_pix, map.height - _map.wsr88ds[i].y_pix, 3, 0, 2 * Math.PI);
            if (_map.wsr88ds[i].id == _map.selected) {
                ctx.fillStyle = "#aacccc";
            }
            else {
                ctx.fillStyle = "black";
            }
            ctx.fill();
            ctx.lineWidth = 0.5;
            ctx.strokeStyle = "black";
            ctx.stroke();
        }
    }

    this.check_point = function(x, y) {
        map = document.getElementById("map");
        rad_id = "";
        rad_name = "";
        rad_x = -1;
        rad_y = -1;
        
    	for (var i = 0; i < _map.wsr88ds.length; i++) {
    	    if (Math.pow(_map.wsr88ds[i].x_pix - x, 2) + Math.pow((map.height - _map.wsr88ds[i].y_pix) - y, 2) <= 16) {
    	    	rad_id = _map.wsr88ds[i].id;
                rad_name = _map.wsr88ds[i].name;
    	    	rad_x = _map.wsr88ds[i].x_pix;
    	    	rad_y = _map.wsr88ds[i].y_pix;
    	    	break;
    	    }
    	} 
    	
    	rad = {'id':rad_id, 'name':rad_name}
    	if (rad_id != "") {
    	    rad.x = rad_x;
    	    rad.y = rad_y;
    	}
    	
    	return rad;
    };
    
    this.mousemove = function(event) {
        map = document.getElementById("map");

        mx = event.pageX - map.offsetLeft
        my = event.pageY - map.offsetTop
    	rad = _map.check_point(mx, my);
    	
    	if (rad.id != "") {
            _map.show_overlay(event.pageX + 11, event.pageY + 5, rad.id);
    	}
    	else {
            _map.clear_overlay();
    	}
    };

    this.mouseclick = function(event) {
        map = document.getElementById("map");

        mx = event.pageX - map.offsetLeft
        my = event.pageY - map.offsetTop
    	rad = _map.check_point(mx, my);

        if (rad.id != "") {
            _map.selected = rad.id;

            sel = document.getElementById("radarsel");

            sel_txt = document.createTextNode(rad.id + " (" + rad.name + ")");
            if (sel.childNodes.length == 3) {
                sel_li = document.createElement("li");
                sel_ul = document.createElement("ul");

                sel_li.appendChild(sel_txt);
                sel_ul.appendChild(sel_li);
                sel.appendChild(sel_ul);
            }
            else {
                old_txt = sel.childNodes[3].childNodes[0];
                old_txt.replaceChild(sel_txt, old_txt.childNodes[0]);
            }

            _map.draw_map();
        }
    };

    this.show_overlay = function(x, y, content) {
        map = document.getElementById("map");
        overlay = document.getElementById("mapradar");

        overlay.innerHTML= "<p>" + content + "</p>";
        overlay.style.offsetLeft = x;
    	overlay.style.offsetTop = y;
    	overlay.style.left = x;
    	overlay.style.top = y;
        overlay.style.visibility = "visible";
        
        map.style.cursor = "pointer";
    };

    this.clear_overlay = function() {
        map = document.getElementById("map");
        overlay = document.getElementById("mapradar");

        overlay.innerHTML = "";
        overlay.style.offsetLeft = 0;
        overlay.style.offsetTop = 0;
        overlay.style.left = 0;
        overlay.style.top = 0;
        overlay.style.visibility = "hidden";

        map.style.cursor = "default";
    };

    this.dl_json = function(path, callback) {
        req = new XMLHttpRequest();
        req.overrideMimeType("application/json");
        req.open("GET", path, true);
        req.onreadystatechange = function() {
            if (req.readyState == 4 && req.status == "200") {
                callback(req.responseText);
    	    }
        };
        req.send(null);
    };
    
    this.init();
}

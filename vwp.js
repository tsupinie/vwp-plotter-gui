window.onload = function() {
    var app = new VWPApp();

    VWP.from_server('KTLX', moment.utc("2015-05-06T23:00:00Z"), null, function(vwp) { 
        console.log(vwp);
        app.hodo.add_vwp(vwp);
    });

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

function format_vector(wdir, wspd, units) {
    if (isNaN(wdir) || isNaN(wspd)) {
        return "--";
    }

    if (units === undefined) {
        units = '';
    }
    else {
        units = ' ' + units;
    }

    return wdir.toFixed(0).padStart(3, '0') + '/' + Math.min(99, wspd).toFixed(0).padStart(2, '0') + units;
}

class VWPApp {
    constructor() {
        this.sfc = "None";
        this.waiting = false;
        this.file_pre_download = null;
        this.prev_selection = null;

        this.file_times = {};

        var mapclick = (function(rad) {
            $('#mapsel').html('<p>Radar:</p> <ul><li>' + rad.id + ' (' + rad.name + ')</li></ul>')
            this._check_file_times(rad.id);
        }).bind(this);

        this.radars = new ClickableMap('imgs/static/map.png', 'wsr88ds.json', mapclick);
        this.hodo = new HodoPlot();

        var selectables = document.getElementsByClassName("selectable");
        for (var i = 0; i < selectables.length; i++) {
            selectables[i].onmouseup = this.select.bind(this);

            var children = selectables[i].getElementsByTagName("li");
            for (var j = 0; j < children.length; j++) {
                if (children[j].childNodes[0].textContent == "DDD/SS") {
                    children[j].vector_select = true;
                }
                else {
                    children[j].vector_select = false;
                }
            }
        }

        document.getElementById("generate").onmouseup = this.generate.bind(this);
    }

    select(event) {
        var target = event.target;

        if (this.hodo.selecting) {
            this._abort_selection();
        }

        if (target.vector_select) {
            this.prev_selection = this._select_box(target);
            var help = document.getElementById("selecthelp");

            help.style.visibility = "visible";
            var target_pos = _page_pos(target);
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
            help.style.offsetLeft = target_pos.x + 70;
            help.style.offsetTop = target_pos.y - 17;
            help.style.left = target_pos.x + 70;
            help.style.top = target_pos.y - 17;

            var vector_callback = (function(wspd, wdir) {
                if (wspd !== null && wdir !== null) {
                    var vec_str = format_vector(wdir, wspd);
                }
                else {
                    var vec_str = "DDD/SS";
                }

                var txt = document.createTextNode(vec_str);
                target.replaceChild(txt, target.childNodes[0]);
            }).bind(this);

            var done_callback = (function(wspd, wdir) {
                if (wdir !== null && wspd !== null) {
                    this._update_state(target, [wdir, wspd]);
                }

                help.style.visibility = "hidden";
                help.style.offsetLeft = 0;
                help.style.offsetTop = 0;
                help.style.left = 0;
                help.style.top = 0;
            }).bind(this);

            this.hodo.selection_start(vector_callback, done_callback);
        }
        else {
            this._select_box(target);
            this._update_state(target, target.childNodes[0].textContent);
        }
    }

    generate() {
        if (this.radars.selected === null || this.radars.selected == "") {
            window.alert("Select a radar first!");
            return;
        }

        if (this.waiting) {
            return;
        }

        if (this.hodo.selecting) {
            this._abort_selection();
        }

        if (this.file_pre_download !== null && this.file_pre_download.radar_id == this.radars.selected) {
            this.hodo.add_vwp(this.file_pre_download);
        }
        else {
            VWP.from_server(this.radars.selected, moment.utc(), null, (function(vwp) {
                this.waiting = false;
                this.hodo.stop_loading();
                this.hodo.add_vwp(vwp);
            }).bind(this));

            this.waiting = true;
            this.hodo.start_loading();
        }
    }

    _check_file_times(radar_id) {
        check_files(radar_id, (function(file_times) {
            file_times = file_times['times'];
            this.file_times[radar_id] = file_times;

            var latest = Object.keys(file_times).reduce((e1, e2) => (file_times[e1] > file_times[e2] ? e1 : e2));
            var time_latest = file_times[latest];

            var id_latest = latest.substring(3);
            if (id_latest == 'last') {
                id_latest = null;
            }

            VWP.from_server(radar_id, time_latest, id_latest, (function(vwp) {
                this.file_pre_download = vwp;
            }).bind(this));
        }).bind(this));
    }

    _select_box(obj) {
        var was_selected = null;
        var siblings = obj.parentElement.getElementsByTagName(obj.tagName);
        for (var i = 0; i < siblings.length; i++) {
            if (siblings[i].className != "") {
                was_selected = siblings[i];
            }
            siblings[i].className = "";
        }

        obj.className = "selected";
        return was_selected;
    };

    _update_state(obj, val) {
        if (obj.parentElement.parentElement.id == "smsel") {
            this.hodo.change_storm_motion(val);
        }
        else if (obj.parentElement.parentElement.id == "sfcsel") {
            this.hodo.change_surface_wind(val);
        }
    };

    _abort_selection() {
        if (this.prev_selection !== null) {
            this._select_box(this.prev_selection)
            this._update_state(this.prev_selection, this.prev_selection.childNodes[0].textContent);
        }
        this.hodo.selection_finish(null, null);
    }
}

class BBox {
    constructor(lbx, lby, ubx, uby) {
        this.lbx = lbx;
        this.lby = lby;
        this.ubx = ubx;
        this.uby = uby;
    }

    contains(x, y) {
        return (this.lbx <= x && x <= this.ubx && this.lby <= y && y <= this.uby);
    }
}

class Context2DWrapper {
    constructor(bbox_pixels, bbox_data, dpr) {
        this.bbox_pixels = bbox_pixels;
        this.bbox_data = bbox_data;
        this._dpr = dpr;
    }

    get(target, prop) {
        if (prop in this) {
            // Override functions that are defined in the wrapper
            if (typeof this[prop] == 'function') {
                return (function() {
                    // Modify the argument list to add the original drawing context as the first argument
                    //  before passing to the wrapper function
                    var args = Array.from(arguments);
                    args.unshift(target);
                    return this[prop].apply(this, args);
                }).bind(this);
            }
            else {
                return this[prop];
            }
        }
        else {
            // Otherwise pass through to the original drawing context
            if (typeof target[prop] == 'function') {
                return target[prop].bind(target);
            }
            else {
                return target[prop];
            }
        }
    }

    set(target, prop, value) {
        if ('__set_' + prop in this) {
            // Override any property with a __set_ name in the wrapper
            return this['__set_' + prop](target, value);
        }
        else {
            // Otherwise pass through to the original drawing context
            return (target[prop] = value);
        }
    }

    circle(ctx, x_data, y_data, rad, rad_units) {
        // Syntactic sugar since I only ever want to draw full circles
        this.arc(ctx, x_data, y_data, rad, 0, 2 * Math.PI, rad_units);
    }

    arc(ctx, x_data, y_data, rad, arc_start, arc_end, rad_units) {
        if (rad_units === undefined) {
            rad_units = 'data';
        }

        var [x, y] = this.data_to_pix(ctx, x_data, y_data);

        var canvas_rad;

        if (rad_units == 'pixels') {
            canvas_rad = rad * this._dpr;
        }
        else if (rad_units == 'data') {
            var [x_edge, y_edge] = this.data_to_pix(ctx, x_data + rad, y_data);
            canvas_rad = x_edge - x;
        }
        else {
            throw "Unknown units '" + rad_units + "'";
        }

        ctx.arc(x, y, canvas_rad, arc_start, arc_end);
    }

    moveTo(ctx, x_data, y_data) {
        var [x, y] = this.data_to_pix(ctx, x_data, y_data);
        ctx.moveTo(x, y);
    }

    lineTo(ctx, x_data, y_data) {
        var [x, y] = this.data_to_pix(ctx, x_data, y_data);
        ctx.lineTo(x, y);
    }

    rect(ctx, x_data_lb, y_data_lb, data_width, data_height) {
        var [lbx, lby] = this.data_to_pix(ctx, x_data_lb, y_data_lb);
        var [ubx, uby] = this.data_to_pix(ctx, x_data_lb + data_width, y_data_lb + data_height);

        ctx.rect(lbx, lby, ubx - lbx, uby - lby);
    }

    fillText(ctx, str, x_data, y_data) {
        var [x, y] = this.data_to_pix(ctx, x_data, y_data);
        ctx.fillText(str, x, y);
    }

    setLineDash(ctx, segments) {
        var segs_dpr = segments.map(seg => (seg * this._dpr));
        ctx.setLineDash(segs_dpr);
    }

    __set_bbox_data(_, bbox_data) {
        return (this.bbox_data = bbox_data);
    }

    __set_lineWidth(ctx, line_width) {
        return (ctx.lineWidth = this._dpr * line_width);
    }

    __set_font(ctx, font) {
        var font_size_regex = /([.\d]+)(?=px)/g
        var font_size = font.match(font_size_regex);
        var font_dpr = font;

        if (font_size) {
            font_size = font_size[0] * this._dpr;
            var font_dpr = font.replace(font_size_regex, font_size);
        }

        return (ctx.font = font_dpr);
    }

    pixelOffset(_, x_data, y_data, x_offset, y_offset) {
        // Computes values in data coordinates with a given pixel offset from a given value
        // First argument is a dummy because the get proxy sticks the original drawing context in there. Surely there's
        //  a better way to handle that?
        var [x, y] = this.data_to_pix(_, x_data, y_data);
        return this.pix_to_data(_, x + x_offset * this._dpr, y + y_offset * this._dpr);
    }

    data_to_pix(_, x_data, y_data) {
        var x = linear_interp(x_data, this.bbox_data.lbx, this.bbox_data.ubx, this.bbox_pixels.lbx, this.bbox_pixels.ubx);
        var y = linear_interp(y_data, this.bbox_data.lby, this.bbox_data.uby, this.bbox_pixels.uby, this.bbox_pixels.lby);
        return [x * this._dpr, y * this._dpr];
    }

    pix_to_data(_, x, y) {
        var x_data = linear_interp(x / this._dpr, this.bbox_pixels.lbx, this.bbox_pixels.ubx, this.bbox_data.lbx, this.bbox_data.ubx);
        var y_data = linear_interp(y / this._dpr, this.bbox_pixels.uby, this.bbox_pixels.lby, this.bbox_data.lby, this.bbox_data.uby);
        return [x_data, y_data];
    }

}


class HodoPlot {
    constructor() {
        this._dpr = window.devicePixelRatio || 1;

        this._canvas = document.getElementById("hodo");
        this._canvas.style.width = this._canvas.width + "px";
        this._canvas.style.height = this._canvas.height + "px";

        this._canvas.width *= this._dpr;
        this._canvas.height *= this._dpr;

        this._background_image = null;

        this._contexts = {};

        var hodo_bbox_pixels = new BBox(16.64, 17.92, 449.28, 449.92);
        var hodo_bbox_uv = new BBox(-40, -40, 80, 80);
        this._contexts['hodo'] = HodoPlot._create_ctx_proxy(this._canvas, hodo_bbox_pixels, hodo_bbox_uv, this._dpr);

        var table_bbox_pixels = new BBox(455.92, 17.92, 608.36, 160);
        var table_bbox_data = new BBox(0, 0, 1, 11);
        this._contexts['table'] = HodoPlot._create_ctx_proxy(this._canvas, table_bbox_pixels, table_bbox_data, this._dpr);

        var srwind_bbox_pixels = new BBox(470, 180, 608.36, 449.92);
        var srwind_bbox_data = new BBox(0, 0, 70, 12);
        this._contexts['srwind'] = HodoPlot._create_ctx_proxy(this._canvas, srwind_bbox_pixels, srwind_bbox_data, this._dpr);

        this.clear_vwps();

        this._move_callback = null;
        this._done_callback = null;
        this.selecting = false;

        this._canvas.onmousemove = this.mousemove.bind(this);
        this._canvas.onmouseup = this.mouseclick.bind(this);
        this._canvas.onmouseout = this.mouseleave.bind(this);
    }

    add_vwp(vwp) {
//      this._vwps.push(vwp);
        this._vwps = [vwp];
        this._contexts['hodo'].bbox_data = vwp.get_bbox();
        this._draw_vwp(vwp, this._canvas, this._contexts);
    }

    clear_vwps() {
        this._vwps = [];
        this._clear_and_draw_background(this._canvas, this._contexts);
    }

    mousemove(event) {
        var mx = event.pageX - this._canvas.offsetLeft;
        var my = event.pageY - this._canvas.offsetTop;

        if (this._move_callback === null) {
            if (this._contexts['hodo'].bbox_pixels.contains(mx, my)) {
                this._canvas.style.cursor = "pointer";
            }
            else {
                this._canvas.style.cursor = "default";
            }
        }
        else {
            var [u, v] = this._contexts['hodo'].pix_to_data(mx * this._dpr, my * this._dpr);

            if (this._contexts['hodo'].bbox_data.contains(u, v)) {
                hodo.style.cursor = "crosshair";
                var [wdir, wspd] = comp2vec(u, v);
                this._move_callback(wspd, wdir);

            }
            else {
                hodo.style.cursor = "default";
                this._move_callback(null, null);
            }
        }
    }

    mouseclick(event) {
        var mx = event.pageX - hodo.offsetLeft;
        var my = event.pageY - hodo.offsetTop;

        if (this._move_callback === null) {
            if (this._contexts['hodo'].bbox_pixels.contains(mx, my)) {
                this.screenshot()
            }
        }
        else {
            if (this._contexts['hodo'].bbox_pixels.contains(mx, my)) {
                this.selection_finish(mx, my);
            }
        }
    }

    mouseleave(event) {
        if (this._move_callback !== null) {
            this._move_callback(null, null);
        }
    }

    selection_start(move_callback, done_callback) {
        this._move_callback = move_callback;
        this._done_callback = done_callback;
        this.selecting = true;
    }

    selection_finish(mx, my) {
        if (mx !== null && my !== null) {
            var [u, v] = this._contexts['hodo'].pix_to_data(mx * this._dpr, my * this._dpr);
            var [wdir, wspd] = comp2vec(u, v);
        }
        else {
            var [wdir, wspd] = [null, null];
        }
        this._done_callback(wspd, wdir);

        this._move_callback = null;
        this._done_callback = null;

        this._canvas.style.cursor = "pointer";
        this.selecting = false;
    }

    screenshot() {
        var dpr = 4;
        var ss_canvas = document.createElement('canvas');
        ss_canvas.width = this._canvas.width * dpr / this._dpr;
        ss_canvas.height = this._canvas.height * dpr / this._dpr;

        var contexts = {};
        for (var ctx_name in this._contexts) {
            var ctx = this._contexts[ctx_name];
            contexts[ctx_name] = HodoPlot._create_ctx_proxy(ss_canvas, ctx.bbox_pixels, ctx.bbox_data, dpr);
        }

        this._draw_vwp(this._vwps[this._vwps.length - 1], ss_canvas, contexts);

        var canvas_img = ss_canvas.toDataURL();
        var header = "<head><title>VWP Image</title></head>";
        var iframe = "<body><img width='100%' src='" + String(canvas_img) + "'></body>"
        var win = window.open();
        win.document.open();
        win.document.write(header + iframe);
        win.document.close();
    }

    _clear_and_draw_background(canvas, contexts) {
        var ctx = canvas.getContext('2d');
        ctx.beginPath();
        ctx.rect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle='#ffffff';
        ctx.fill();

/*      if (this._background_image === null) {
            
        }
        else { */

           /**********************************
            * Draw hodograph background
            **********************************/
            var ctx = contexts['hodo'];

            var [lbu, lbv, ubu, ubv] = [ctx.bbox_data.lbx, ctx.bbox_data.lby, ctx.bbox_data.ubx, ctx.bbox_data.uby];

            var max_u = Math.max(Math.abs(lbu), Math.abs(ubu));
            var max_v = Math.max(Math.abs(lbv), Math.abs(ubv));
            var max_ring = Math.hypot(max_u, max_v);

            ctx.lineWidth = 1;

            ctx.save();
            ctx.beginPath();
            ctx.rect(lbu, lbv, ubu - lbu, ubv - lbv);
            ctx.clip();

            var hodo_ring_spacing = 10;

            for (var irng = hodo_ring_spacing; irng < max_ring; irng += hodo_ring_spacing) {
                ctx.beginPath();

                ctx.setLineDash([3, 4]);
                ctx.strokeStyle = '#999999';

                ctx.circle(0, 0, irng);
                ctx.stroke();

                if (irng <= ubu - hodo_ring_spacing) {
                    ctx.font = '11px Trebuchet MS';
                    ctx.fillStyle = '#999999';
                    ctx.textBaseline = 'top';

                    var label_text = irng + "";
                    if (irng > ubu - 2 * hodo_ring_spacing) {
                        label_text = irng + " kts";
                    }

                    var [txtu, txtv] = ctx.pixelOffset(irng, 0, 1, 1);
                    ctx.fillText(label_text, txtu, txtv);
                }
            } 

            ctx.restore()

            ctx.beginPath();
            ctx.setLineDash([]);
            ctx.strokeStyle = '#999999';

            ctx.moveTo(0, lbv);
            ctx.lineTo(0, ubv);
            ctx.moveTo(lbu, 0);
            ctx.lineTo(ubu, 0);
            ctx.stroke()

            ctx.beginPath();

            ctx.strokeStyle = '#000000';
            ctx.rect(lbu, lbv, ubu - lbu, ubv - lbv);
            ctx.stroke();

            var [txtu, txtv] = ctx.pixelOffset(ubu, lbv, 0, 2);
            ctx.fillStyle = '#000000';
            ctx.font = '11px Trebuchet MS';
            ctx.textBaseline = 'top';
            ctx.textAlign = 'right';
            ctx.fillText("http://www.autumnsky.us/vad/", txtu, txtv);

           /**********************************
            * Draw table background
            **********************************/
            ctx = contexts['table'];

            // This is stupid. Find another way to do it.
            var row = 11;

            ctx.fillStyle = '#000000';
            ctx.font = 'bold 10.5px Trebuchet MS';
            ctx.textBaseline = 'top';
            ctx.textAlign = 'center';

            ctx.fillText('Parameters', 0.5, row);
            row -= 1;

            ctx.lineWidth = 1;
            ctx.strokeStyle = '#000000';
            ctx.moveTo(0, row);
            ctx.lineTo(1, row);
            ctx.stroke();
            row -= 0.2;

            ctx.textAlign = 'left';
            ctx.fillText('BWD (kts)', 0.28, row);
            ctx.fillText('SRH (m\u{00b2}/s\u{00b2})', 0.63, row);
            row -= 1;

            ctx.fillText('0-1 km', 0, row);
            row -= 1;

            ctx.fillText('0-3 km', 0, row);
            row -= 1;

            ctx.fillText('0-6 km', 0, row);
            row -= 1;

            ctx.moveTo(0, row);
            ctx.lineTo(1, row);
            ctx.stroke();
            row -= 0.2

            ctx.fillText('Storm Motion:', 0, row);
            row -= 1;

            ctx.fillText('Bunkers Left Mover:', 0, row);
            row -= 1;

            ctx.fillText('Bunkers Right Mover:', 0, row);
            row -= 1;

            ctx.fillText('Mean Wind:', 0, row);
            row -= 1;

            ctx.moveTo(0, row);
            ctx.lineTo(1, row);
            ctx.stroke();
            row -= 0.2;

            ctx.fillText('Critical Angle:', 0, row);

           /**********************************
            * Draw SR wind plot background
            **********************************/
            ctx = contexts['srwind'];
            var [lbs, lbz, ubs, ubz] = [ctx.bbox_data.lbx, ctx.bbox_data.lby, ctx.bbox_data.ubx, ctx.bbox_data.uby];

            ctx.save();

            ctx.beginPath();
            ctx.rect(lbs, lbz, ubs - lbs, ubz - lbz);
            ctx.stroke();

            var srwind_z_spacing = 1;
            var srwind_s_spacing = 10

            ctx.beginPath();
            ctx.setLineDash([3, 4]);
            ctx.strokeStyle = '#999999';

            for (var iz = lbz + srwind_z_spacing; iz < ubz; iz += srwind_z_spacing) {
                ctx.moveTo(lbs, iz);
                ctx.lineTo(ubs, iz);
            }

            for (var is = lbs + srwind_s_spacing; is < ubs; is += srwind_s_spacing) {
                ctx.moveTo(is, lbz);
                ctx.lineTo(is, ubz);
            }

            ctx.stroke();

            ctx.fillStyle = '#000000';
            ctx.font = '11px Trebuchet MS';
            ctx.textAlign = 'right';
            ctx.textBaseline = 'middle';
            for (var iz = lbz; iz <= ubz; iz += srwind_z_spacing) {
                var [txtu, txtv] = ctx.pixelOffset(lbs, iz, -2, 0);
                ctx.fillText(iz, txtu, txtv);
            }

            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            for (var is = lbs; is <= ubs; is += srwind_s_spacing) {
                var [txtu, txtv] = ctx.pixelOffset(is, lbz, 0, 2);
                var label = is + '';
                if (is == ubs) {
                    label = 'kts  ';
                }
                ctx.fillText(label, txtu, txtv);
            }

            ctx.fillStyle = '#000000';
            ctx.font = '11px Trebuchet MS';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'alphabetic';
            var [txtu, txtv] = ctx.pixelOffset((lbs + ubs) / 2, ubz, 0, -5);
            ctx.fillText('SR Wind vs. Height', txtu, txtv);

            ctx.restore();
//      }
    }

    _draw_vwp(vwp, canvas, contexts) {
        var ctx = contexts['hodo'];

       /**********************************
        * Draw background
        **********************************/
        this._clear_and_draw_background(canvas, contexts);

       /**********************************
        * Draw hodograph
        **********************************/
        ctx.lineWidth = 2;
        ctx.font = "11px Trebuchet MS";

        vwp.draw(contexts['hodo'], contexts['srwind']);

       /**********************************
        * Draw title
        **********************************/
        var title_str = vwp.radar_id + " VWP valid " + moment.utc(vwp.radar_dt).format("DD MMM YYYY HHmm UTC");
        ctx.fillStyle = '#000000';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';

        var [lbu, lbv, ubu, ubv] = [ctx.bbox_data.lbx, ctx.bbox_data.lby, ctx.bbox_data.ubx, ctx.bbox_data.uby];
        var [txtu, txtv] = ctx.pixelOffset((lbu + ubu) / 2, ubv, 0, -5);

        ctx.font = "14px Trebuchet MS";
        ctx.fillText(title_str, txtu, txtv);

       /**********************************
        * Fill in parameter table
        **********************************/
        ctx = contexts['table'];

        ctx.font = "10.5px Trebuchet MS";
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';

        function format(val, units) {
            if (isNaN(val)) {
                return '--';
            }

            if (units === undefined) {
                units = "";
            }

            return val.toFixed(0) + units
        }

        ctx.fillText(format(vwp.params['bwd01']), 0.28, 8.8);
        ctx.fillText(format(vwp.params['bwd03']), 0.28, 7.8);
        ctx.fillText(format(vwp.params['bwd06']), 0.28, 6.8);

        ctx.fillText(format(vwp.params['srh01']), 0.63, 8.8);
        ctx.fillText(format(vwp.params['srh03']), 0.63, 7.8);

        var [dir, spd] = comp2vec.apply(null, vwp.sm_vec);
        ctx.fillText(format_vector(dir, spd, 'kts'), 0.7, 5.6);

        var [dir, spd] = comp2vec.apply(null, vwp.params['bunkers_left']);
        ctx.fillText(format_vector(dir, spd, 'kts'), 0.7, 4.6);

        var [dir, spd] = comp2vec.apply(null, vwp.params['bunkers_right']);
        ctx.fillText(format_vector(dir, spd, 'kts'), 0.7, 3.6);

        var [dir, spd] = comp2vec.apply(null, vwp.params['bunkers_mean']);
        ctx.fillText(format_vector(dir, spd, 'kts'), 0.7, 2.6);

        ctx.fillText(format(vwp.params['ca'], '\u{00b0}'), 0.5, 1.4);
    }

    change_surface_wind(new_vec) {
        this._vwps.forEach(function(vwp) {
            vwp.change_surface_wind(new_vec);
        });

        if (this._vwps.length > 0) {
            this._draw_vwp(this._vwps[this._vwps.length - 1], this._canvas, this._contexts);
        }
    }

    change_storm_motion(new_vec) {
        this._vwps.forEach(function(vwp) {
            vwp.change_storm_motion(new_vec);
        });

        if (this._vwps.length > 0) {
            this._draw_vwp(this._vwps[this._vwps.length - 1], this._canvas, this._contexts);
        }
    }

    start_loading() {
        var ctx = this._contexts['hodo'];
        var num = 0;

        var [lbu, lbv, ubu, ubv] = [ctx.bbox_data.lbx, ctx.bbox_data.lby, ctx.bbox_data.ubx, ctx.bbox_data.uby];
        var ctr_u = (lbu + ubu) / 2;
        var ctr_v = (lbv + ubv) / 2;

        var circ_rad = 50;
        var dot_rad = 20;

        var pos_x = [];
        var pos_y = [];

        for (var i = 0; i < 8; i++) {
            [pos_x[i], pos_y[i]] = ctx.pixelOffset(ctr_u, ctr_v, circ_rad * Math.cos(Math.PI * i / 4), circ_rad * Math.sin(Math.PI * i / 4));
        }

        function anim() {
            num++;

            this._draw_vwp(this._vwps[this._vwps.length - 1], this._canvas, this._contexts);

            ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
            ctx.fillRect(0, 0, this._canvas.width, this._canvas.height);

            for (var i = 0; i < 8; i++) {
                var pos_i = (i + num) % 8;
                ctx.beginPath();
                ctx.fillStyle = 'rgba(30, 30, 30, ' + (0.1 * (i + 2)) + ')';
                ctx.circle(pos_x[pos_i], pos_y[pos_i], dot_rad / 8 * i, 'pixels');
                ctx.fill();
            }
        }

        this.anim_timer = window.setInterval(anim.bind(this), 100);
    }

    stop_loading() {
        window.clearInterval(this.anim_timer);
    }

    static _create_ctx_proxy(canvas, bbox_pixels, bbox_data, dpr) {
        // Set up a wrapper for the drawing context that handles transformations and the device pixel ratio
        var ctx = canvas.getContext('2d');
        var ctx_wrapper = new Context2DWrapper(bbox_pixels, bbox_data, dpr);
        return new Proxy(ctx, ctx_wrapper)
    }
}


class VWP {
    constructor(radar_id, radar_dt, wdir, wspd, alt, rmse) {
        this.radar_id = radar_id;
        this.radar_dt = radar_dt;

        this.wdir = wdir;
        this.wspd = wspd;
        this.alt = alt;
        this.rmse = rmse;

        this.u = [];
        this.v = [];

        for (var i = 0; i < this.wdir.length; i++) {
            var [u, v] = vec2comp(this.wdir[i], this.wspd[i]);

            this.u.push(u);
            this.v.push(v);
        }

        this.sm_vec = null;
        this.sfc_wind = null;

        this._compute_parameters();
    }

    _compute_parameters() {
        this.params = {};

        var u = this.u;
        var v = this.v;
        var alt = this.alt;

        if (this.sfc_wind !== null) {
            var [usfc, vsfc] = this.sfc_wind;
            u = [usfc].concat(u);
            v = [vsfc].concat(v);
            alt = [0.01].concat(alt);
        }

        var storm_motions = storm_motion(u, v, alt);
        for (var smv in storm_motions) {
            var [ustm, vstm] = storm_motions[smv];
            this.params['bunkers_' + smv] = [ustm, vstm]; //comp2vec(ustm, vstm);
        }

        if (this.sm_vec === null) {
            this.sm_vec = storm_motions['right'];
        }
        storm_motions['user'] = this.sm_vec;

        [1, 3, 6].forEach((function(lyr_ub) {
            try {
                var [shr_u, shr_v] = wind_shear(u, v, alt, alt[0], lyr_ub);
            }
            catch (err) {
                var [shr_u, shr_v] = [NaN, NaN];
            }

            this.params['bwd0' + lyr_ub] = Math.hypot(shr_u, shr_v);
        }).bind(this));

        [1, 3].forEach((function(lyr_ub) {
            try {
                var srh = storm_relative_helicity(u, v, alt, alt[0], lyr_ub, {'user': this.sm_vec});
            }
            catch (err) {
                var srh = {'user': NaN};
            }

            this.params['srh0' + lyr_ub] = srh['user'];
        }).bind(this));

        try {
            var critical_angles = critical_angle(u, v, alt, {'user': this.sm_vec});
        }
        catch (err) {
            var critical_angles = {'user': NaN, 'lyr_ub': NaN};
        }

        this.params['ca'] = critical_angles['user'];
        this.params['ca_lyr_ub'] = critical_angles['lyr_ub'];

        this.srwind = [];
        var [smu, smv] = this.sm_vec;

        for (var i = 0; i < this.u.length; i++) {
            this.srwind.push(Math.hypot(this.u[i] - smu, this.v[i] - smv));
        }

        this.sr_sfc_wind = null;
        if (this.sfc_wind !== null) {
            var [usfc, vsfc] = this.sfc_wind;
            this.sr_sfc_wind = Math.hypot(usfc - smu, vsfc - smv);
        }
    }

    get_bbox() {
        var buffer = 0.4

        var min_u = Math.min(...this.u);
        var min_v = Math.min(...this.v);
        var max_u = Math.max(...this.u);
        var max_v = Math.max(...this.v);

        var ctr_u = (min_u + max_u) / 2;
        var ctr_v = (min_v + max_v) / 2;

        var side = Math.max(60, Math.max(max_u - min_u, max_v - min_v));

        min_u = ctr_u - (1 + buffer) * side / 2;
        min_v = ctr_v - (1 + buffer) * side / 2;
        max_u = ctr_u + (1 + buffer) * side / 2;
        max_v = ctr_v + (1 + buffer) * side / 2;

        var bbox = new BBox(min_u, min_v, max_u, max_v);
        return bbox;
    }

    draw(hodo_ctx, srwind_ctx) {

        var colors = ['#ff0000', '#00ff00', '#008800', '#993399', '#00ffff'];
        var seg_cutoffs = [3, 6, 9, 12];

       /**********************************
        * Draw error envelopes
        **********************************/
        var ctx = hodo_ctx;

        var [lbu, lbv, ubu, ubv] = [ctx.bbox_data.lbx, ctx.bbox_data.lby, ctx.bbox_data.ubx, ctx.bbox_data.uby];

        ctx.save()
        ctx.beginPath();
        ctx.rect(lbu, lbv, ubu - lbu, ubv - lbv);
        ctx.clip();

        ctx.globalAlpha = 0.05;

        var iseg = 0;
        for (var i = 0; i < this.u.length; i++) {
            while (this.alt[i] > seg_cutoffs[iseg]) {
                iseg++;
            }

            ctx.beginPath();
            ctx.fillStyle = colors[iseg];
            ctx.circle(this.u[i], this.v[i], this.rmse[i] * Math.sqrt(2));
            ctx.fill()
        }

        ctx.restore();

       /**********************************
        * Draw hodograph
        **********************************/
        if (this.sfc_wind !== null) {
            var [usfc, vsfc] = this.sfc_wind;
            ctx.beginPath();
            ctx.strokeStyle = colors[0];
            ctx.setLineDash([4, 3]);
            ctx.moveTo(usfc, vsfc);
            ctx.lineTo(this.u[0], this.v[0]);
            ctx.stroke()
        }

        ctx.beginPath();
        ctx.setLineDash([]);
        ctx.moveTo(this.u[0], this.v[0]);

        iseg = 0;
        ctx.strokeStyle = colors[iseg];

        for (var i = 1; i < this.u.length; i++) {
            while (this.alt[i] > seg_cutoffs[iseg]) {
                var u_cutoff = linear_interp(seg_cutoffs[iseg], this.alt[i - 1], this.alt[i], this.u[i -  1], this.u[i]);
                var v_cutoff = linear_interp(seg_cutoffs[iseg], this.alt[i - 1], this.alt[i], this.v[i -  1], this.v[i]);

                ctx.lineTo(u_cutoff, v_cutoff);
                ctx.stroke();

                ctx.beginPath();
                ctx.moveTo(u_cutoff, v_cutoff);

                iseg++;
                ctx.strokeStyle = colors[iseg];
            }

            ctx.lineTo(this.u[i], this.v[i]);
        }
        ctx.stroke();

       /**********************************
        * Draw critical angle markers
        **********************************/
        ctx.save()
        ctx.lineWidth = 1;

        ctx.beginPath();
        ctx.strokeStyle = '#00cccc';

        var [smu, smv] = this.sm_vec;
        ctx.moveTo(smu, smv);

        var [low_u, low_v] = [this.u[0], this.v[0]];
        if (this.sfc_wind !== null) {
            [low_u, low_v] = this.sfc_wind;
        }

        ctx.lineTo(low_u, low_v);
        ctx.stroke();        

        ctx.beginPath();
        ctx.strokeStyle = '#cc00cc';

        ctx.moveTo(low_u, low_v);

        var [calu, calv] = this.params['ca_lyr_ub'];
        ctx.lineTo(calu, calv);

        ctx.stroke();
        ctx.restore();

       /**********************************
        * Draw storm motion markers
        **********************************/
        ctx.save();
        ctx.lineWidth = 1;

        var smv_names = {'bunkers_right': 'RM', 'bunkers_left': 'LM', 'bunkers_mean': 'MEAN'};

        Object.keys(smv_names).forEach((function(smv) {
            var marker_rad = 3;

            ctx.beginPath();

            var [mkru, mkrv] = this.params[smv];

            if (smv == 'bunkers_mean') {
                ctx.strokeStyle = '#a04000';
                ctx.fillStyle = '#a04000';

                // I don't like this as much as I could
                var [rect_lbu, rect_lbv] = ctx.pixelOffset(mkru, mkrv, -marker_rad, -marker_rad);
                var [rect_ubu, rect_ubv] = ctx.pixelOffset(mkru, mkrv, marker_rad, marker_rad);
                ctx.rect(rect_lbu, rect_lbv, rect_ubu - rect_lbu, rect_ubv - rect_lbv);
            }
            else {
                ctx.strokeStyle = '#000000';
                ctx.fillStyle = '#000000';
                ctx.circle(mkru, mkrv, marker_rad, 'pixels');
            }

            ctx.stroke();

            ctx.textBaseline = 'top';

            var [txt_u, txt_v] = ctx.pixelOffset(mkru, mkrv, marker_rad / Math.sqrt(2), marker_rad / Math.sqrt(2));
            ctx.fillText(smv_names[smv], txt_u, txt_v);
        }).bind(this));

        var needs_user_smv = true; 
        Object.keys(smv_names).forEach((function(smv) {
            needs_user_smv &= !(this.params[smv][0] == this.sm_vec[0] && this.params[smv][1] == this.sm_vec[1]);
        }).bind(this));

        if (needs_user_smv) {
            var marker_rad = 3;

            var [mkru, mkrv] = this.sm_vec;
            var [plus_lbu, plus_lbv] = ctx.pixelOffset(mkru, mkrv, -marker_rad, -marker_rad);
            var [plus_ubu, plus_ubv] = ctx.pixelOffset(mkru, mkrv, marker_rad, marker_rad);

            ctx.strokeStyle = '#000000';
            ctx.fillStyle = '#000000';

            ctx.beginPath();
            ctx.moveTo(plus_lbu, mkrv);
            ctx.lineTo(plus_ubu, mkrv);
            ctx.moveTo(mkru, plus_lbv);
            ctx.lineTo(mkru, plus_ubv);
            ctx.stroke();

            var [txt_u, txt_v] = ctx.pixelOffset(mkru, mkrv, marker_rad / Math.sqrt(2), marker_rad / Math.sqrt(2));
            ctx.fillText('SM', txt_u, txt_v);
        }

        ctx.restore();

       /**********************************
        * Draw height markers
        **********************************/
        ctx.save()
        var marker_fudge = 0.5 // This is unnecessary in Safari
        var marker_rad = 6;

        var mkr_val = 1;

        for (var i = 1; i < this.u.length; i++) {
            while (this.alt[i - 1] < mkr_val && mkr_val <= this.alt[i]) {
                var umkr = linear_interp(mkr_val, this.alt[i - 1], this.alt[i], this.u[i - 1], this.u[i]);
                var vmkr = linear_interp(mkr_val, this.alt[i - 1], this.alt[i], this.v[i - 1], this.v[i]);

                ctx.beginPath();
                ctx.fillStyle = '#000000';
                ctx.circle(umkr, vmkr, marker_rad, 'pixels');
                ctx.fill();

                ctx.fillStyle = '#ffffff';
                ctx.font = "9px Trebuchet MS";
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';

                var [txt_u, txt_v] = ctx.pixelOffset(umkr, vmkr, 0, marker_fudge);
                ctx.fillText(mkr_val, txt_u, txt_v);

                mkr_val++;
            }
        }

        ctx.restore()

       /**********************************
        * Draw SR wind
        **********************************/
        ctx = srwind_ctx;

        var [lbs, lbz, ubs, ubz] = [ctx.bbox_data.lbx, ctx.bbox_data.lby, ctx.bbox_data.ubx, ctx.bbox_data.uby];

        // Should I add the plot bounds as a clip path?
        ctx.save();
        ctx.beginPath();
        ctx.rect(lbs, lbz, ubs - lbs, ubz - lbz);
        ctx.clip();
        var srwind = this.srwind;
        var alt = this.alt;
        ctx.strokeStyle = '#ff0000';

        if (this.sr_sfc_wind !== null) {
            ctx.setLineDash([4, 3]);
            ctx.beginPath();
            ctx.moveTo(this.sr_sfc_wind, 0.01);
            ctx.lineTo(srwind[0], alt[0]);
            ctx.stroke();
        }
        
        ctx.setLineDash([]);
        ctx.linewidth = 2;
        ctx.beginPath();
        ctx.moveTo(srwind[0], alt[0]);
        for (var i = 1; i < srwind.length; i++) {
            ctx.lineTo(srwind[i], alt[i]);
        }
        ctx.stroke();

        ctx.restore();
    }

    change_surface_wind(new_vec) {
        if (typeof new_vec == 'string') {
            if (new_vec.toLowerCase() == 'none') {
                this.sfc_wind = null;
            }
        }
        else{
            var [wdir, wspd] = new_vec;
            this.sfc_wind = vec2comp(wdir, wspd);
        }

        var has_user_smv = true; 
        ['bunkers_left', 'bunkers_right'].forEach((function(smv) {
            has_user_smv &= !(this.params[smv][0] == this.sm_vec[0] && this.params[smv][1] == this.sm_vec[1]);
        }).bind(this));

        if (!has_user_smv) {
            this.sm_vec = null;
        }

        this._compute_parameters();
    }

    change_storm_motion(new_vec) {
        if (typeof new_vec == 'string') {
            if (new_vec.toLowerCase() == 'blm') {
                this.sm_vec = this.params['bunkers_left'];
            }
            else if (new_vec.toLowerCase() == 'brm') {
                this.sm_vec = this.params['bunkers_right'];
            }
        }
        else {
            var [wdir, wspd] = new_vec;
            this.sm_vec = vec2comp(wdir, wspd);
        }
        this._compute_parameters();
    }

    static from_server(radar_id, dt, file_id, callback) {
        var dt_str = dt.format('YYYY-MM-DD[T]HH:mm:ss[Z]');
        var root_url = $('#root_url').val();

        if (!window.location.hostname.includes('www')) {
            root_url = root_url.replace('www.', '');
        }

        var url = root_url + "/vad/get_radar_json.php?radar=" + radar_id + '&time=' + dt_str;
        if (file_id !== null) {
            url += '&id=' + file_id;
        }

        $.getJSON(url, function(json) {
            json['warnings'].forEach(function(warn) { console.warn(warn); });
            callback(VWP.from_json(json['response']));
        });
    }

    static from_json(json) {
        var vwp = new VWP(json['radar_id'], moment.utc(json['datetime']),
                          json['data']['wind_dir'], json['data']['wind_spd'], json['data']['altitude'], json['data']['rms_error']);
        return vwp;
    }
}

function check_files(radar_id, callback) {
    var root_url = $('#root_url').val();

    if (!window.location.hostname.includes('www')) {
        root_url = root_url.replace('www.', '');
    }

    $.getJSON(root_url + "/vad/get_radar_times.php?radar=" + radar_id, function(json) {
        for (fname in json['times']) {
            json['times'][fname] = moment.utc(json['times'][fname]);
        }
        callback(json);
    })
}

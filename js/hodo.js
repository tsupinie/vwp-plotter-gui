
class HodoPlot {
    constructor() {
        this._vwp_container = null;

        this._dpr = window.devicePixelRatio || 1;

        this._canvas = document.getElementById("hodo");
        this._canvas.style.width = this._canvas.width + "px";
        this._canvas.style.height = this._canvas.height + "px";

        this._canvas.width *= this._dpr;
        this._canvas.height *= this._dpr;

        this._background_image = null;

        this._contexts = {};

        this._default_hodo_bbox_uv = new BBox(-40, -40, 80, 80);

        var hodo_bbox_pixels = new BBox(16.64, 17.92, 449.28, 449.92);
        this._contexts['hodo'] = HodoPlot._create_ctx_proxy(this._canvas, hodo_bbox_pixels, this._default_hodo_bbox_uv, this._dpr);
        this._contexts['hodo_gr'] = HodoPlot._create_ctx_proxy(this._canvas, hodo_bbox_pixels, this._default_hodo_bbox_uv, this._dpr);

        var table_bbox_pixels = new BBox(455.92, 17.92, 608.36, 160);
        var table_bbox_data = new BBox(0, 0, 1, 11);
        this._contexts['table'] = HodoPlot._create_ctx_proxy(this._canvas, table_bbox_pixels, table_bbox_data, this._dpr);

        var srwind_bbox_pixels = new BBox(470, 180, 608.36, 449.92);
        var srwind_bbox_data = new BBox(0, 0, 70, 12);
        this._contexts['srwind'] = HodoPlot._create_ctx_proxy(this._canvas, srwind_bbox_pixels, srwind_bbox_data, this._dpr);

        this._clear_and_draw_background(this._canvas, this._contexts);

        this._move_callback = null;
        this._done_callback = null;
        this.selecting = false;

        this._canvas.onmousemove = this.mousemove.bind(this);
        this._canvas.onmouseup = this.mouseclick.bind(this);
        this._canvas.onmouseout = this.mouseleave.bind(this);
    }

    reset() {
        this.set_bbox(this._default_hodo_bbox_uv);
        this._contexts['hodo_gr'].bbox_data = this._default_hodo_bbox_uv
        this._clear_and_draw_background(this._canvas, this._contexts);
    }

    add_vwp_container(vwp_container) {
        this._vwp_container = vwp_container;
    }

    set_bbox(bbox) {
        // Warning: this could let the display and ground-relative bboxes get out of sync. This doesn't happen
        //  currently because the calling functions immediately draw a vwp, which updates the ground-relative bbox.
        this._contexts['hodo'].bbox_data = bbox;
    }

    draw_vwp(vwp) {
        var [vwp_smu, vwp_smv] = vwp.sm_vec;
        var hodo_bbox = this._contexts['hodo'].bbox_data;

        if (vwp.origin == 'storm' && isFinite(vwp_smu) && isFinite(vwp_smv)) {
            this._contexts['hodo_gr'].bbox_data = hodo_bbox.translate(vwp_smu, vwp_smv);
        }
        else {
            this._contexts['hodo_gr'].bbox_data = hodo_bbox;
        }

        this._draw_vwp(vwp, this._canvas, this._contexts);
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
            var [u, v] = this._contexts['hodo_gr'].pix_to_data(mx * this._dpr, my * this._dpr);

            if (this._contexts['hodo_gr'].bbox_data.contains(u, v)) {
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
                this._vwp_container.screenshot()
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
            var [u, v] = this._contexts['hodo_gr'].pix_to_data(mx * this._dpr, my * this._dpr);
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

    screenshot(vwp, dpr) {
        if (dpr === undefined) {
            dpr = 4;
        }

        var ss_canvas = document.createElement('canvas');
        ss_canvas.width = this._canvas.width * dpr / this._dpr;
        ss_canvas.height = this._canvas.height * dpr / this._dpr;

        var contexts = {};
        for (var ctx_name in this._contexts) {
            var ctx = this._contexts[ctx_name];
            contexts[ctx_name] = HodoPlot._create_ctx_proxy(ss_canvas, ctx.bbox_pixels, ctx.bbox_data, dpr);
        }

        this._draw_vwp(vwp, ss_canvas, contexts);

        return ss_canvas;
    }

    _draw_hodo_coordinates(ctx, origin_u, origin_v, color, draw_labels) {
        if (draw_labels === undefined) {
            draw_labels = true;
        }

        var [lbu, lbv, ubu, ubv] = [ctx.bbox_data.lbx, ctx.bbox_data.lby, ctx.bbox_data.ubx, ctx.bbox_data.uby];

        var hodo_ring_spacing = 10;

        var max_u = Math.max(Math.abs(lbu - origin_u), Math.abs(ubu - origin_u));
        var max_v = Math.max(Math.abs(lbv - origin_v), Math.abs(ubv - origin_v));
        var max_ring = Math.hypot(max_u, max_v);
        var min_label = Math.ceil((lbu - origin_u) / hodo_ring_spacing) * hodo_ring_spacing;
        var max_label = Math.floor((ubu - origin_u) / hodo_ring_spacing) * hodo_ring_spacing - hodo_ring_spacing;

        ctx.lineWidth = 1;

        ctx.save();
        ctx.beginPath();
        ctx.rect(lbu, lbv, ubu - lbu, ubv - lbv);
        ctx.clip();

        for (var irng = hodo_ring_spacing; irng < max_ring; irng += hodo_ring_spacing) {
            ctx.beginPath();

            ctx.setLineDash([3, 4]);
            ctx.strokeStyle = color;

            ctx.circle(origin_u, origin_v, irng);
            ctx.stroke();
        }

        if (draw_labels) {
            for (var irng = min_label; irng <= max_label; irng += hodo_ring_spacing) {
                ctx.font = '11px Trebuchet MS';
                ctx.fillStyle = color;
                ctx.textBaseline = 'top';

                var label_text = Math.abs(irng) + "";
                if (irng == max_label) {
                    label_text += " kts";
                }

                var [txtu, txtv] = ctx.pixelOffset(origin_u + irng, origin_v, 1, 1);
                ctx.fillText(label_text, txtu, txtv);
            } 
        }

        ctx.restore()

        ctx.beginPath();
        ctx.setLineDash([]);
        ctx.strokeStyle = color;

        if (lbu < origin_u && origin_u < ubu) {
            ctx.moveTo(origin_u, lbv);
            ctx.lineTo(origin_u, ubv);
        }
        if (lbv < origin_v && origin_v < ubv) {
            ctx.moveTo(lbu, origin_v);
            ctx.lineTo(ubu, origin_v);
        }

        ctx.stroke()
    }

    _clear_and_draw_background(canvas, contexts) {
        var ctx = canvas.getContext('2d');
        ctx.beginPath();
        ctx.rect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle='#ffffff';
        ctx.fill();

       /**********************************
        * Draw hodograph background
        **********************************/
        var ctx = contexts['hodo'];
        var [lbu, lbv, ubu, ubv] = [ctx.bbox_data.lbx, ctx.bbox_data.lby, ctx.bbox_data.ubx, ctx.bbox_data.uby];

        this._draw_hodo_coordinates(ctx, 0, 0, '#999999', true);

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
    }

    _draw_vwp(vwp, canvas, contexts) {
        var ctx = contexts['hodo'];

       /**********************************
        * Draw background
        **********************************/
        this._clear_and_draw_background(canvas, contexts);
/*
        if (vwp.origin == 'storm') {
            var [gnd_x, gnd_y] = vwp.sm_vec;
            gnd_x = -gnd_x;
            gnd_y = -gnd_y;

            this._draw_hodo_coordinates(ctx, gnd_x, gnd_y, '#e6e6e6', false);
        }
*/
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

    static _create_ctx_proxy(canvas, bbox_pixels, bbox_data, dpr) {
        // Set up a wrapper for the drawing context that handles transformations and the device pixel ratio
        var ctx = canvas.getContext('2d');
        var ctx_wrapper = new Context2DWrapper(bbox_pixels, bbox_data, dpr);
        return new Proxy(ctx, ctx_wrapper)
    }
}



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

        this.sm_vec_str = 'brm';
        this.sm_vec = null;
        this.sfc_wind = null;
        this.origin = 'ground';

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

        if (this.sm_vec_str == 'brm') {
            this.sm_vec = storm_motions['right'];
        }
        else if (this.sm_vec_str == 'blm') {
            this.sm_vec = storm_motions['left'];
        }
        storm_motions['user'] = this.sm_vec;
        var [smu, smv] = this.sm_vec;

        for (var smvec in storm_motions) {
            var [ustm, vstm] = storm_motions[smvec];
            this.params['sr_bunkers_' + smvec] = [ustm - smu, vstm - smv];
        }

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
            var critical_angles = {'user': NaN, 'lyr_ub': [NaN, NaN]};
        }

        this.params['ca'] = critical_angles['user'];
        this.params['ca_lyr_ub'] = critical_angles['lyr_ub'];
        var [ca_lyr_u, ca_lyr_v] = critical_angles['lyr_ub'];
        this.params['sr_ca_lyr_ub'] = [ca_lyr_u - smu, ca_lyr_v - smv];

        this.sru = [];
        this.srv = [];
        this.srwind = [];

        for (var i = 0; i < this.u.length; i++) {
            this.sru.push(this.u[i] - smu);
            this.srv.push(this.v[i] - smv);
            this.srwind.push(Math.hypot(this.sru[i], this.srv[i]));
        }

        this.sr_sfc_u = null;
        this.sr_sfc_v = null;
        this.sr_sfc_wind = null;
        if (this.sfc_wind !== null) {
            var [usfc, vsfc] = this.sfc_wind;
            this.sr_sfc_u = usfc - smu;
            this.sr_sfc_v = vsfc - smv;
            this.sr_sfc_wind = Math.hypot(this.sr_sfc_u, this.sr_sfc_v);
        }
    }

    has_sm_vec() {
        var [smu, smv] = this.sm_vec;
        return !(isNaN(smu) || isNaN(smv));
    }

    get_bbox() {
        var buffer = 0.4

        var u = this.u;
        var v = this.v;

        if (this.origin == 'storm') {
            u = this.sru;
            v = this.srv;
        }

        var min_u = Math.min(...u);
        var min_v = Math.min(...v);
        var max_u = Math.max(...u);
        var max_v = Math.max(...v);

        if (this.sfc_wind !== null) {
            var [sfc_u, sfc_v] = this.sfc_wind;
            min_u = Math.min(min_u, sfc_u);
            max_u = Math.max(max_u, sfc_u);
            min_v = Math.min(min_v, sfc_v);
            max_v = Math.max(max_v, sfc_v);
        }

        var ctr_u = (min_u + max_u) / 2;
        var ctr_v = (min_v + max_v) / 2;

        var side = Math.max(60, Math.max(max_u - min_u, max_v - min_v));

        min_u = ctr_u - (1 + buffer) * side / 2;
        min_v = ctr_v - (1 + buffer) * side / 2;
        max_u = ctr_u + (1 + buffer) * side / 2;
        max_v = ctr_v + (1 + buffer) * side / 2;

        if (isNaN(min_u) || isNaN(max_u) || isNaN(min_v) || isNaN(max_v)) {
            [min_u, max_u, min_v, max_v] = [undefined, undefined, undefined, undefined];
        }

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
        var hodo_u = this.u;
        var hodo_v = this.v;
        var [hodo_sfc_u, hodo_sfc_v] = [NaN, NaN];

        if (this.sfc_wind !== null) {
            [hodo_sfc_u, hodo_sfc_v] = this.sfc_wind;
        }

        if (this.origin == 'storm') {
            hodo_u = this.sru;
            hodo_v = this.srv;
            hodo_sfc_u = this.sr_sfc_u;
            hodo_sfc_v = this.sr_sfc_v;
        }

        if (this.alt.length == 0 || hodo_u.length == 0 || hodo_v.length == 0) {
            ctx.font = "36px Trebuchet MS";
            ctx.fillStyle = '#000000';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText("Empty Profile", (lbu + ubu) / 2, (lbv + ubv) / 2);
            return;
        }

        ctx.save()
        ctx.beginPath();
        ctx.rect(lbu, lbv, ubu - lbu, ubv - lbv);
        ctx.clip();

        ctx.globalAlpha = 0.05;

        var iseg = 0;
        for (var i = 0; i < hodo_u.length; i++) {
            while (this.alt[i] > seg_cutoffs[iseg]) {
                iseg++;
            }

            ctx.beginPath();
            ctx.fillStyle = colors[iseg];
            ctx.circle(hodo_u[i], hodo_v[i], this.rmse[i] * Math.sqrt(2));
            ctx.fill()
        }

        ctx.restore();

       /**********************************
        * Draw hodograph
        **********************************/
        if (this.sfc_wind !== null) {
            ctx.beginPath();
            ctx.strokeStyle = colors[0];
            ctx.setLineDash([4, 3]);
            ctx.moveTo(hodo_sfc_u, hodo_sfc_v);
            ctx.lineTo(hodo_u[0], hodo_v[0]);
            ctx.stroke()
        }

        ctx.beginPath();
        ctx.setLineDash([]);
        ctx.moveTo(hodo_u[0], hodo_v[0]);

        iseg = 0;
        ctx.strokeStyle = colors[iseg];

        for (var i = 1; i < hodo_u.length; i++) {
            while (this.alt[i] > seg_cutoffs[iseg]) {
                var u_cutoff = linear_interp(seg_cutoffs[iseg], this.alt[i - 1], this.alt[i], hodo_u[i -  1], hodo_u[i]);
                var v_cutoff = linear_interp(seg_cutoffs[iseg], this.alt[i - 1], this.alt[i], hodo_v[i -  1], hodo_v[i]);

                ctx.lineTo(u_cutoff, v_cutoff);
                ctx.stroke();

                ctx.beginPath();
                ctx.moveTo(u_cutoff, v_cutoff);

                iseg++;
                ctx.strokeStyle = colors[iseg];
            }

            ctx.lineTo(hodo_u[i], hodo_v[i]);
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
        if (this.origin == 'storm') {
            [smu, smv] = [0, 0];
        }
        ctx.moveTo(smu, smv);

        var [low_u, low_v] = [hodo_u[0], hodo_v[0]];
        if (this.sfc_wind !== null) {
            low_u = hodo_sfc_u;
            low_v = hodo_sfc_v;
        }

        ctx.lineTo(low_u, low_v);
        ctx.stroke();        

        ctx.beginPath();
        ctx.strokeStyle = '#cc00cc';

        ctx.moveTo(low_u, low_v);

        var [calu, calv] = this.params['ca_lyr_ub'];
        if (this.origin == 'storm') {
            [calu, calv] = this.params['sr_ca_lyr_ub'];
        }
        ctx.lineTo(calu, calv);

        ctx.stroke();
        ctx.restore();

       /**********************************
        * Draw storm motion markers
        **********************************/
        ctx.save();
        ctx.lineWidth = 1;

        var smv_names = {'bunkers_right': 'RM', 'bunkers_left': 'LM', 'bunkers_mean': 'MEAN'};
        if (this.origin == 'storm') {
            var smv_names = {'sr_bunkers_right': 'RM', 'sr_bunkers_left': 'LM', 'sr_bunkers_mean': 'MEAN'};
        }

        var sm_vec_str = {'brm': 'bunkers_right', 'blm': 'bunkers_left'}[this.sm_vec_str];

        Object.keys(smv_names).forEach((function(smv) {
            var marker_rad = 3;
            var off_sign;

            var [mkru, mkrv] = this.params[smv];

            if (!(this.origin == 'storm' && smv.includes(sm_vec_str))) {
                ctx.beginPath();

                if (smv.includes('bunkers_mean')) {
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
            }
            else {
                ctx.strokeStyle = '#000000';
                ctx.fillStyle = '#000000';
            }

            ctx.textBaseline = 'alphabetic';
            ctx.textAlign = 'right';
            off_sign = -1;

            var [txt_u, txt_v] = ctx.pixelOffset(mkru, mkrv, off_sign * marker_rad / Math.sqrt(2), off_sign * marker_rad / Math.sqrt(2));
            ctx.fillText(smv_names[smv], txt_u, txt_v);
        }).bind(this));

        if (this.sm_vec_str == 'user') {
            var marker_rad = 3;

            var off_sign;
            ctx.strokeStyle = '#000000';
            ctx.fillStyle = '#000000';


            if (this.origin != 'storm') {
                var [mkru, mkrv] = this.sm_vec;
                var [plus_lbu, plus_lbv] = ctx.pixelOffset(mkru, mkrv, -marker_rad, -marker_rad);
                var [plus_ubu, plus_ubv] = ctx.pixelOffset(mkru, mkrv, marker_rad, marker_rad);

                ctx.beginPath();
                ctx.moveTo(plus_lbu, mkrv);
                ctx.lineTo(plus_ubu, mkrv);
                ctx.moveTo(mkru, plus_lbv);
                ctx.lineTo(mkru, plus_ubv);
                ctx.stroke();
            }
            else {
                var [mkru, mkrv] = [0, 0];
            }

            ctx.textBaseline = 'alphabetic';
            ctx.textAlign = 'right';
            off_sign = -1;

            var [txt_u, txt_v] = ctx.pixelOffset(mkru, mkrv, off_sign * marker_rad / Math.sqrt(2), off_sign * marker_rad / Math.sqrt(2));
            ctx.fillText('SM', txt_u, txt_v);
        }

        ctx.restore();

       /**********************************
        * Draw origin (if storm-relative)
        **********************************/
        if (this.origin == 'storm') {

            ctx.save();
            var [mkru, mkrv] = this.sm_vec;
            mkru = -mkru;
            mkrv = -mkrv;

            ctx.lineWidth = 1;
            ctx.strokeStyle = '#dddddd';
            ctx.fillStyle = '#cccccc';
            ctx.textBaseline = 'top';
            ctx.textAlign = 'right';

            ctx.beginPath();
            ctx.moveTo(lbu, mkrv);
            ctx.lineTo(ubu, mkrv);
            ctx.moveTo(mkru, lbv);
            ctx.lineTo(mkru, ubv);
            ctx.stroke();

            var [txt_u, txt_v] = ctx.pixelOffset(mkru, mkrv, -1, 1);
            ctx.fillText('GRND', txt_u, txt_v);

            ctx.restore();
        }

       /**********************************
        * Draw height markers
        **********************************/
        ctx.save()
        var marker_fudge = 0.5 // This is unnecessary in Safari
        var marker_rad = 6;

        var mkr_val = 1;

        for (var i = 1; i < hodo_u.length; i++) {
            while (this.alt[i - 1] < mkr_val && mkr_val <= this.alt[i]) {
                var umkr = linear_interp(mkr_val, this.alt[i - 1], this.alt[i], hodo_u[i - 1], hodo_u[i]);
                var vmkr = linear_interp(mkr_val, this.alt[i - 1], this.alt[i], hodo_v[i - 1], hodo_v[i]);

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
        * Draw surface wind source
        **********************************/
        ctx.save();

        var [txtu, txtv] = ctx.pixelOffset(lbu, lbv, 0, 2);
        ctx.fillStyle = '#000000';
        ctx.font = '11px Trebuchet MS';
        ctx.textBaseline = 'top';
        ctx.textAlign = 'left';
        var sfc_wind_src_txt = "Surface Wind: "

        if (this.sfc_wind !== null) {
            var [hodo_sfc_u, hodo_sfc_v] = this.sfc_wind;
            var [hodo_sfc_wdir, hodo_sfc_wspd] = comp2vec(hodo_sfc_u, hodo_sfc_v);
            sfc_wind_src_txt += format_vector(hodo_sfc_wdir, hodo_sfc_wspd) + " (" + this.sfc_wind_src + ")"
        }
        else {
            sfc_wind_src_txt += "None"
        }
        ctx.fillText(sfc_wind_src_txt, txtu, txtv);

        ctx.restore();

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

    change_surface_wind(new_vec, source) {
        if (typeof new_vec == 'string') {
            if (new_vec.toLowerCase() == 'none') {
                this.sfc_wind = null;
            }
        }
        else{
            var [wdir, wspd] = new_vec;
            this.sfc_wind = vec2comp(wdir, wspd);
        }

        this.sfc_wind_src = source;

        if (this.sm_vec_str == 'blm' || this.sm_vec_str == 'brm') {
            // Force a recompute of the storm motion vector if the user hasn't set one
            this.sm_vec = null;
        }

        this._compute_parameters();
    }

    change_storm_motion(new_vec) {
        if (typeof new_vec == 'string') {
            this.sm_vec_str = new_vec.toLowerCase();

            if (this.sm_vec_str == 'blm') {
                this.sm_vec = this.params['bunkers_left'];
            }
            else if (this.sm_vec_str == 'brm') {
                this.sm_vec = this.params['bunkers_right'];
            }
        }
        else {
            var [wdir, wspd] = new_vec;
            this.sm_vec = vec2comp(wdir, wspd);
            this.sm_vec_str = 'user';
        }
        this._compute_parameters();
    }

    change_origin(origin) {
        this.origin = origin;
    }

    static from_server(radar_id, dt, file_id, callback) {
        var dt_str = dt.format('YYYY-MM-DD[T]HH:mm:ss[Z]');
        var root_url = $('#root_url').val();
        var session_id = $('#session_id').val();

        if (!window.location.hostname.includes('www')) {
            root_url = root_url.replace('www.', '');
        }

        var url = root_url + "/vad/get_radar_json.php?radar=" + radar_id + '&time=' + dt_str + '&session_id=' + session_id;
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

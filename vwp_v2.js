window.onload = function() {
    var app = new VWPApp();

/*
    VWP.from_server('KICT', moment.utc("2016-12-21T05:00:00Z"), null, function(vwp) { 
        console.log(vwp);
        var bbox = vwp.get_bbox();

        if (bbox.lbx === undefined || bbox.ubx === undefined || bbox.lby === undefined || bbox.uby === undefined) {
            app.hodo.reset();
        }
        else {
            app.hodo.set_bbox(bbox);
        }

        app.hodo.draw_vwp(vwp);
    });
*/
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

function compare_dt(dt1, dt2) {
    return dt1.isBefore(dt2) ? -1 : (dt1.isSame(dt2) ? 0 : 1);
}

class VWPApp {
    constructor() {
        this.sfc = "None";
        this.prev_selection = null;
        this._refresh_timer = null
        this._refresh_intv = 60 * 1000;

        this._metar_refresh_intv = 10 * 60 * 1000;
        this._metar_timer = window.setInterval(this.metar_refresh.bind(this), this._metar_refresh_intv);
        this._metars = null;
        this._metar_button_text = null;
        this.metar_refresh();

        this.file_times = {};

        this._dt_fmt = "YYYY-MM-DD[T]HH:mm:ss[Z]";

        var mapclick = (function(rad) {
            $('#mapsel').html('<p>Radar:</p> <ul><li>' + rad.id + ' (' + rad.name + ')</li></ul>');
            this.vwp_container.check_file_times(rad.id, false);
            this.update_asos_wind();
        }).bind(this);

        var age_limit = 2700;

        this.radars = new ClickableMap('imgs/map.png', 'wsr88ds.json', mapclick);
        this.hodo = new HodoPlot(this);
        this.vwp_container = new VWPContainer(this, this.hodo, age_limit);
        this.hodo.add_vwp_container(this.vwp_container);

        this.toggle_autoupdate();

        var toggle_lists = document.getElementsByClassName("toggle-list");
        for (var i = 0; i < toggle_lists.length; i++) {
            toggle_lists[i].onmouseup = this.select.bind(this);

            var children = toggle_lists[i].getElementsByTagName("li");
            for (var j = 0; j < children.length; j++) {
                if (children[j].childNodes[0].textContent == "DDD/SS") {
                    children[j].vector_select = true;
                }
                else {
                    children[j].vector_select = false;
                }
            }
        }

        $('#autoupdate').mouseup(this.toggle_autoupdate.bind(this));
        $('#animspdup').mouseup(this.animation_speed_up.bind(this));
        $('#animspddn').mouseup(this.animation_speed_down.bind(this));
        $('#playpause').mouseup(this.animation_play_pause.bind(this));
        $('#refresh').mouseup(this.refresh.bind(this));
        $('#makegif').mouseup(this.vwp_container.make_gif.bind(this.vwp_container));
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

    set_frame_list(frames) {
        var anim_controls = $('#animcontrols');
        $('#framelist').remove();
        $('#datamissing').remove();

        if (frames.length == 0) {
            anim_controls.append('<p id="datamissing">No Data</p>');
        }
        else {
            anim_controls.append('<ul id="framelist"></ul>');
            var frame_list = $('#framelist');

            var dt_fmt = this._dt_fmt;

            frames.reverse().forEach((function(frame) {
                frame_list.append('<li data-datetime="' + frame['dt'].format(dt_fmt) + '">&nbsp;</li>');
                var child = frame_list.children().last();

                if (frame['status'] == 'notloaded') {
                    child.addClass('framenotloaded');
                }
                else {
                    child.click((function() {
                        this.vwp_container.set_anim_time(moment.utc(child.attr('data-datetime')));
                    }).bind(this));
                }

                if (frame['status'] == 'active') {
                    child.addClass('frameactive');
                }
            }).bind(this));
        }
    }

    toggle_autoupdate() {
        $('#autoupdate').toggleClass('selected');
        if (this._refresh_timer === null) {
            this._refresh_timer = window.setInterval(this.refresh.bind(this), this._refresh_intv);

            this.refresh();
        }
        else {
            window.clearInterval(this._refresh_timer);
            this._refresh_timer = null;
        }
    }

    animation_speed_up() {
        this.vwp_container.animation_speed_up();
    }

    animation_speed_down() {
        this.vwp_container.animation_speed_down();
    }

    animation_play_pause() {
        this.vwp_container.toggle_animation();
    }

    refresh() {
        if (this.radars.selected !== null) {
            this.vwp_container.check_file_times(this.radars.selected, true);
        }
    }

    refresh_circle_start() {
        $('#refresh > span').addClass('animate');
    }

    refresh_circle_stop() {
        $('#refresh > span').removeClass('animate');
    }

    animation_play() {
        $('#playpause').addClass('selected');
    }

    animation_pause() {
        $('#playpause').removeClass('selected');
    }

    metar_refresh() {
        check_metars((function(metars) {
            this._metars = metars;
            this.update_asos_wind();
        }).bind(this));
    }

    update_asos_wind() {
        if (this.radars.selected === null || this._metars === null) {
            return;
        }

        var radar_info;
        var radar_selected = this.radars.selected;
        this.radars.points.forEach(function(rad) {
            if (rad['id'] == radar_selected) {
                radar_info = rad;
            }
        });

        var metar = this._metars[radar_info['metar']];
        if (metar === undefined) {
            metar = [];
        }
        else {
            metar.sort((m1, m2) => compare_dt(m1['time'], m2['time']));
        }

        console.log(metar);

        if (this._metar_button_text === null) {
            this._metar_button_text = $('#asoswind').html();
        }
        var new_button_text = this._metar_button_text.replace("ASOS", radar_info['metar']);
        $('#asoswind').html(new_button_text);
        this.vwp_container.set_metar_obs(metar);
    }

    _select_box(obj) {
        var was_selected = null;
        var siblings = obj.parentElement.getElementsByTagName(obj.tagName);
        for (var i = 0; i < siblings.length; i++) {
            if (siblings[i].classList.contains("selected")) {
                was_selected = siblings[i];
            }
            siblings[i].classList.remove("selected");
        }

        obj.classList.add("selected");
        return was_selected;
    };

    _update_state(obj, val) {
        if (obj.parentElement.parentElement.id == "smsel") {
            this.vwp_container.change_storm_motion(val);
        }
        else if (obj.parentElement.parentElement.id == "sfcsel") {
            if (typeof val == 'string' && val != "None") {
                val = 'metar';
            }
            this.vwp_container.change_surface_wind(val);
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


class VWPContainer {
    constructor(ui, hodo, age_limit) {
        this._ui = ui;
        this._hodo = hodo;
        this._age_limit = age_limit;

        this._is_animating = false;
        this._is_animation_paused = true;
        this._anim_timer = null;
        this._anim_intv = 500;

        this._storm_motion = 'brm';
        this._surface_wind = 'metar';
        this._metars = null;

        // TODO: These might not need to be instance variables (only local to check_file_times), but I'm confused about Javascript variable scoping ...
        this._expected_new_frames = 0;
        this._new_frames_loaded = 0;
        this._want_latest_frame = true;

        this.frame_list = new Map();
        this._radar = null;
    }

    check_file_times(radar_id, is_refresh) {
        this._ui.refresh_circle_start()

        if (this._radar !== null && this._radar != radar_id) {
            this.frame_list.clear();
        }
        this._radar = radar_id;

        this._want_latest_frame = (this.frame_list.size == 0 || Array.from(this.frame_list.values()).findIndex(f => f['status'] == 'active') == this.frame_list.size - 1);

        check_files(radar_id, this._age_limit, (function(file_times) {
            // Check to see if this is still the radar we're looking for (user might have changed it while we were waiting for data).
            if (this._radar != file_times['radar']) {
                return;
            }

            file_times = file_times['times'];
            file_times = Object.entries(file_times).sort(([fn1, dt1], [fn2, dt2]) => compare_dt(dt1, dt2));

            // Add new frames to frame list
            file_times.forEach((function([file_name, dt]) {
                if (!this.frame_list.has(file_name)) {
                    this.frame_list.set(file_name, {'dt': dt, 'status': 'notloaded'});
                }
            }).bind(this));

            // Delete frames older than the age limit
            this.frame_list.forEach((function(frame, file_name) {
                if (frame['dt'].isBefore(moment.utc().subtract(this._age_limit, 'seconds'))) {
                    this.frame_list.delete(file_name);
                }
            }).bind(this))

            // If we removed the active frame, make the latest frame the new active frame
            if (Array.from(this.frame_list.values()).findIndex(f => f['status'] == 'active') == -1) {
                var frame = Array.from(this.frame_list.values()).reverse().find(f => f['status'] != 'notloaded');
                if (frame !== undefined) {
                    this._set_active_frame(frame);
                    this._hodo.draw_vwp(frame['data']);
                }

                this._want_latest_frame = true;
            }

            // Update the UI
            this._update_ui_frame_list();

            this._new_frames_loaded = 0;
            this._expected_new_frames = 0;

            // Load new frames
            Array.from(this.frame_list.entries()).reverse().forEach((function([file_name, frame]) {
                var id = file_name.substring(3);
                var dt_str = frame['dt'].format(this._dt_fmt);

                if (frame['status'] == 'notloaded') {
                    this._expected_new_frames++;

                    console.log('Downloading vwp at ' + frame['dt'].format(this._dt_format));
                    VWP.from_server(radar_id, frame['dt'], id, (function(vwp) {
                        // Check to see if this is still the radar we're looking for (user might have changed it while we were waiting for data).
                        if (this._radar != vwp.radar_id) {
                            return;
                        }

                        // Set storm motion and surface wind
                        if (this._surface_wind == 'metar') {
                            if (this._metars !== null) {
                                var metar = this._metars.slice().reverse().find(m => m['time'].isBefore(vwp.radar_dt));
                                if (metar === undefined) {
                                    vwp.change_surface_wind('none');
                                }
                                else {
                                    vwp.change_surface_wind([metar['wdir'], metar['wspd']]);
                                }
                            }
                            else {
                                vwp.change_surface_wind('none');
                            }
                        }
                        else {
                            vwp.change_surface_wind(this._surface_wind);
                        }
                        vwp.change_storm_motion(this._storm_motion);

                        // Update frame data structure
                        var frame = this.frame_list.get(file_name);

                        frame['status'] = 'loaded';
                        frame['dt'] = vwp.radar_dt;
                        frame['data'] = vwp;

                        // Update hodograph bounding box
                        var bbox = Array.from(this.frame_list.values()).filter(f => f['status'] != 'notloaded').map(f => f['data'].get_bbox()).reduce(BBox.union);
                        if (bbox.lbx === undefined || bbox.ubx === undefined || bbox.lby === undefined || bbox.uby === undefined) {
                            this._hodo.reset();
                        }
                        else {
                            this._hodo.set_bbox(bbox);
                        }

                        // Update hodograph
                        if (!is_refresh || this._want_latest_frame) {
                            var [latest_fn, latest_frame] = Array.from(this.frame_list.entries()).filter(([fn, frame]) => frame['status'] != 'notloaded').reverse()[0]
                            this._set_active_frame(latest_frame);
                        }

                        var frame = Array.from(this.frame_list.values()).find(f => f['status'] == 'active');
                        this._hodo.draw_vwp(frame['data']);

                        // Update UI
                        this._update_ui_frame_list();

                        // Restart animation if it's paused
                        if (this._is_animating && this._is_animation_paused) {
                            this.start_animation();
                        }

                        // Check to see if we've loaded all the frames we expect from this update and cancel the refresh animation if so.
                        this._new_frames_loaded++;

                        if (this._new_frames_loaded >= this._expected_new_frames) {
                            this._ui.refresh_circle_stop();
                        }

                    }).bind(this));
                }
            }).bind(this));

            // If there are no new frames, stop the animation refresh
            if (this._expected_new_frames == 0) {
                this._ui.refresh_circle_stop();
            }

            // If there are no data at all (e.g. radar is down), reset the hodograph
            if (this.frame_list.size == 0) {
                this._hodo.reset();
            }
        }).bind(this));
    }

    set_metar_obs(metars) {
        this._metars = metars;

        if (this.frame_list.size > 0) {
            this.change_surface_wind(this._surface_wind);
        }
    }

    set_anim_time(dt) {
        var frame = Array.from(this.frame_list.values()).find(f => (f['dt'].isSame(dt)));

        this.stop_animation();

        this._set_active_frame(frame);
        this._update_ui_frame_list();

        this._hodo.draw_vwp(frame['data']);
    }

    _set_active_frame(frame) {
        this.frame_list.forEach(function(f) {
            if (f['status'] != 'notloaded') {
                f['status'] = 'loaded';
            }
        });

        frame['status'] = 'active';
    }

    toggle_animation() {
        if (!this._is_animating) {
            this.start_animation();
        }
        else {
            this.stop_animation();
        }
    }

    start_animation() {
        this._is_animation_paused = false;

        var advance_frame = (function() {
            var frame;
            var anim_idx;

            var has_some_loaded = this.frame_list.size > 0 && Array.from(this.frame_list.values()).map(f => f['status'] != 'notloaded').reduce((s1, s2) => s1 || s2);

            if (has_some_loaded) {
                anim_idx = Array.from(this.frame_list.values()).findIndex(f => (f['status'] == 'active'));
                // Increment animation counter
                do {
                    anim_idx = (anim_idx + 1) % this.frame_list.size;
                    frame = Array.from(this.frame_list.values())[anim_idx];
                } while (frame['status'] == 'notloaded');
            }
            else {
                this._is_animation_paused = true;
                return;
            }

            // Update UI
            this._set_active_frame(frame);
            this._update_ui_frame_list();

            // Draw VWP
            this._hodo.draw_vwp(frame['data']);

            // Set timer for next frame
            var intv = this._anim_intv;
            if (anim_idx == this.frame_list.size - 1) {
                intv *= 2.5;
            }

            this._anim_timer = window.setTimeout(advance_frame, intv);
        }).bind(this);

        advance_frame();
        this._is_animating = true;
        this._ui.animation_play();
    }

    stop_animation() {
        window.clearTimeout(this._anim_timer);
        this._is_animating = false;
        this._is_animation_paused = true;
        this._ui.animation_pause();
    }

    animation_speed_up() {
        this._anim_intv /= 1.5;
    }

    animation_speed_down() {
        this._anim_intv *= 1.5;
    }

    screenshot() {
        var frame = Array.from(this.frame_list.values()).find(f => f['status'] == 'active');

        if (frame !== undefined) {
            var img_data_url = this._hodo.screenshot(frame['data']).toDataURL();

            var header = "<head><title>VWP Image</title></head>";
            var iframe = "<body><img width='100%' src='" + String(img_data_url) + "'></body>"
            var win = window.open();
            win.document.open();
            win.document.write(header + iframe);
            win.document.location = '#';
            win.document.close();
        }
    }

    make_gif() {
        var gif = new GIF({workers: 4, workerScript: 'gifjs/gif.worker.js', quality: 10});
        var n_frames = 0;
        var anim_intv = this._anim_intv;

        var gif_frames = this.frame_list.forEach((function(frame) {
            if (frame['status'] != 'notloaded') {
                n_frames++;

                var canvas = this._hodo.screenshot(frame['data'], 3);

                var delay = anim_intv;
                if (n_frames == this.frame_list.size) {
                    delay *= 2.5;
                }
                gif.addFrame(canvas, {delay: delay});
            }
        }).bind(this))

        if (n_frames > 0) {
            var header = "<head>";
            header += "<title>VWP GIF [Rendering ...]</title>";
            header += "<style>";
            header += "body { font-family: Trebuchet MS; }";
            header += "@keyframes loading { from {transform: translate(-200px, 0) }; to {transform: translate(0, 0)} }";
            header += "#bar { width: calc(100% + 200px); height: 50px; background: repeating-linear-gradient(90deg, #aacccc, #aacccc 100px, #ffffff 100px, #ffffff 200px); animation: loading 1s linear 0s infinite; }";
            header += "h1 { text-align: center; }";
            header += "#container {width: 100%; position: fixed; top: 50%; transform: translate(0, -80%)}";
            header += "</style>";
            header += "</head>";
            var body = "<body><div id='container'><h1>Rendering GIF ...</h1><div id='bar'>&nbsp;</div></div></body>"
            var win = window.open();
            win.document.open();
            win.document.write(header + body);
            win.document.close();

            gif.on('finished', function(blob) {
                var reader = new FileReader();
                reader.onloadend = function() {
                    var header = "<head><title>VWP GIF</title></head>";
                    var iframe = "<body><img width='100%' src='" + String(reader.result) + "'></body>"

                    win.document.open();
                    win.document.write(header + iframe);
                    win.document.location = '#';
                    win.document.close();
                }

                reader.readAsDataURL(blob);
            });

            gif.render();
        }
    }

    change_surface_wind(new_vec) {
        this.frame_list.forEach((function(frame) {
            if (frame['status'] != 'notloaded') {
                var vwp = frame['data'];
                if (new_vec == 'metar') {
                    if (this._metars !== null) {
                        var metar = this._metars.slice().reverse().find(m => m['time'].isBefore(vwp.radar_dt));
                        if (metar === undefined) {
                            vwp.change_surface_wind('none');
                        }
                        else {
                            vwp.change_surface_wind([metar['wdir'], metar['wspd']]);
                        }
                    }
                    else {
                        vwp.change_surface_wind('none');
                    }
                }
                else {
                    vwp.change_surface_wind(new_vec);
                }
            }
        }).bind(this));

        this._surface_wind = new_vec;

        if (this.frame_list.size > 0) {
            var frame = Array.from(this.frame_list.values()).find(f => f['status'] == 'active');
            if (frame !== undefined) {
                this._hodo.draw_vwp(frame['data']);
            }
        }
    }

    change_storm_motion(new_vec) {
        this.frame_list.forEach(function(frame) {
            if (frame['status'] != 'notloaded') {
                frame['data'].change_storm_motion(new_vec);
            }
        });

        this._storm_motion = new_vec;

        if (this.frame_list.size > 0) {
            var frame = Array.from(this.frame_list.values()).find(f => f['status'] == 'active');
            this._hodo.draw_vwp(frame['data']);
        }
    }

    _update_ui_frame_list() {
        this._ui.set_frame_list(Array.from(this.frame_list.values()));
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

    static union(bbox1, bbox2) {
        var lbx = Math.min(...[bbox1.lbx, bbox2.lbx].filter(e => e !== undefined));
        var lby = Math.min(...[bbox1.lby, bbox2.lby].filter(e => e !== undefined));
        var ubx = Math.max(...[bbox1.ubx, bbox2.ubx].filter(e => e !== undefined));
        var uby = Math.max(...[bbox1.uby, bbox2.uby].filter(e => e !== undefined));

        if (!isFinite(lbx) || !isFinite(lby) || !isFinite(ubx) || !isFinite(uby)) {
              [lbx, lby, ubx, uby] = [undefined, undefined, undefined, undefined];
        }

        return new BBox(lbx, lby, ubx, uby);
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
        this._clear_and_draw_background(this._canvas, this._contexts);
    }

    add_vwp_container(vwp_container) {
        this._vwp_container = vwp_container;
    }

    set_bbox(bbox) {
        this._contexts['hodo'].bbox_data = bbox;
    }

    draw_vwp(vwp) {
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

        this.sm_vec_str = 'brm';
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

        if (this.sm_vec_str == 'brm') {
            this.sm_vec = storm_motions['right'];
        }
        else if (this.sm_vec_str == 'blm') {
            this.sm_vec = storm_motions['left'];
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
            var critical_angles = {'user': NaN, 'lyr_ub': [NaN, NaN]};
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

        if (this.alt.length == 0 || this.u.length == 0 || this.v.length == 0) {
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

function check_files(radar_id, age_limit, callback) {
    var root_url = $('#root_url').val();

    if (!window.location.hostname.includes('www')) {
        root_url = root_url.replace('www.', '');
    }

    $.getJSON(root_url + "/vad/get_radar_times.php?radar=" + radar_id + '&age=' + age_limit, function(json) {
        for (fname in json['times']) {
            json['times'][fname] = moment.utc(json['times'][fname]);
        }
        callback(json);
    })
}

function check_metars(callback) {
    var root_url = $('#root_url').val();

    if (!window.location.hostname.includes('www')) {
        root_url = root_url.replace('www.', '');
    }

    $.getJSON(root_url + '/vad/get_metar_json.php', function(json) {
        for (stid in json) {
            json[stid].forEach(function(ob) {
                ob['time'] = moment.utc(ob['time']);
            });
        }
        callback(json);
    });
}


const _home_svg = `<svg width="12" height="12" viewBox="15 12 70 70" xmlns="http://www.w3.org/2000/svg">
  <polygon points="25,80 45,80 45,60 55,60 55,80 75,80 75,50 25,50" />
  <polygon points="84,50 50,16 16,50" />
  <rect x="60" y="20" width="10" height="30"/>
</svg>`;

class VWPApp {
    constructor() {
        this.sfc = "None";
        this.prev_selection = null;
        this._data_refresh_timer = null
        this._map_refresh_timer = null
        this._vwp_refresh_intv = 60 * 1000;
        this._map_refresh_intv = 120 * 1000;

        this._metar_refresh_intv = 10 * 60 * 1000;
        this._metar_timer = window.setInterval(this.metar_refresh.bind(this), this._metar_refresh_intv);
        this._metars = null;
        this._metar_button_text = null;
        this.metar_refresh();

        this.file_times = {};

        this._dt_fmt = "YYYY-MM-DD[T]HH:mm:ss[Z]";

        var mapclick = (function(rad) {
            $('#mapsel').html('<p>Radar:</p> <ul class="toggle-list"><li id="radarname">' + rad.id + ' (' + rad.name + ')</li>' +
                              '<li id="default" class="selectable needhelp">' + _home_svg + '<span class="help helptop">Make Default</span></li></ul>');

            if (get_cookie('default') == rad.id) {
                $('#default').toggleClass('selected');
            }
            $('#default').click(this.toggle_default.bind(this));

            this.vwp_container.check_file_times(rad.id, false);
            this.update_asos_wind();
        }).bind(this);

        var age_limit = 2700;

        this.map_fname = 'imgs/map.png';
        this.radars = new ClickableMap(this.map_fname, 'wsr88ds.json', mapclick, "WSR-88D");
        if (get_cookie('default') !== undefined) {
            this.radars.select_point(get_cookie('default'));
        }
        this.hodo = new HodoPlot(this);
        this.vwp_container = new VWPContainer(this, this.hodo, age_limit);
        this.hodo.add_vwp_container(this.vwp_container);

        this.toggle_autoupdate();

        var select_func = this.select.bind(this);
        function bind_select() {
            $(this).mouseup(select_func);
            $(this).find('li').each(function() {
                this.vector_select = false;

                if (this.childNodes[0].textContent == "DDD/SS") {
                    this.vector_select = true;
                }
            });
        }

        $('.toggle-list').each(bind_select);
        $('.tab-list').each(bind_select);

        $('#autoupdate').mouseup(this.toggle_autoupdate.bind(this));
        $('#animspdup').mouseup(this.animation_speed_up.bind(this));
        $('#animspddn').mouseup(this.animation_speed_down.bind(this));
        $('#playpause').mouseup(this.animation_play_pause.bind(this));
        $('#refresh').mouseup(this.refresh.bind(this));
        $('#makegif').mouseup(this.vwp_container.make_gif.bind(this.vwp_container));
    }

    select(event) {
        var target = event.target;

        if (target.classList.contains("grayout")) {
            return;
        }

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

                if (this.vwp_container.is_animating) {
                    this.vwp_container.start_animation();
                }

                help.style.visibility = "hidden";
                help.style.offsetLeft = 0;
                help.style.offsetTop = 0;
                help.style.left = 0;
                help.style.top = 0;
            }).bind(this);

            if (this.vwp_container.is_animating) {
                this.vwp_container.pause_animation();
            }
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

        if (this._data_refresh_timer === null) {
            this._data_refresh_timer = window.setInterval(this.refresh.bind(this), this._vwp_refresh_intv);

            this.refresh();
        }
        else {
            window.clearInterval(this._data_refresh_timer);
            this._data_refresh_timer = null;
        }

        if (this._map_refresh_timer === null) {
            this._map_refresh_timer = window.setInterval(this.refresh_map.bind(this), this._map_refresh_intv);

            this.refresh_map();
        }
        else {
            window.clearInterval(this._map_refresh_timer);
            this._map_refresh_timer = null;
        }

    }

    refresh_map() {
        var dt = moment.utc().format(this._dt_fmt)
        this.radars.set_background(this.map_fname + "?" + dt);
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

    set_sr_available(is_available) {
        if (is_available) {
            $('#sr_origin').removeClass('grayout');
        }
        else {
            // XXX: This will do weird things if this is set while sr_origin is selected
            $('#sr_origin').addClass('grayout');
            this.select({'target': $('#gr_origin')[0]});
        }
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

        metar.forEach(function(m) {
            m['id'] = radar_info['metar'];
        });

        console.log(metar);

        if (this._metar_button_text === null) {
            this._metar_button_text = $('#asoswind').html();
        }
        var new_button_text = this._metar_button_text.replace("ASOS", radar_info['metar']);
        $('#asoswind').html(new_button_text);
        this.vwp_container.set_metar_obs(metar);
    }

    toggle_default() {
        $('#default').toggleClass('selected');
        if (get_cookie('default') === this.radars.selected) {
            delete_cookie('default');
        }
        else {
            set_cookie('default', this.radars.selected);
        }
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
        else if (obj.parentElement.parentElement.id == "orgsel") {
            this.vwp_container.change_origin(val.toLowerCase());
        }
        else if (obj.parentElement.parentElement.id == "mapdiv") {
            this.radars.set_type(val)
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

        this.is_animating = false;
        this._is_animation_paused = true;
        this._anim_timer = null;
        this._anim_intv = 500;

        this._storm_motion = 'brm';
        this._surface_wind = 'metar';
        this._metars = null;

        this._origin = 'ground';

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

                        vwp.change_storm_motion(this._storm_motion);
                        vwp.change_origin(this._origin);

                        // Update frame data structure
                        var frame = this.frame_list.get(file_name);

                        frame['status'] = 'loaded';
                        frame['dt'] = vwp.radar_dt;
                        frame['data'] = vwp;

                        this.change_surface_wind(this._surface_wind);
                        this._update_ui_origin_selection();
                        this._update_hodo_bbox();

                        // Update hodograph
                        if (!is_refresh || this._want_latest_frame) {
                            var [latest_fn, latest_frame] = Array.from(this.frame_list.entries()).filter(([fn, frame]) => frame['status'] != 'notloaded').reverse()[0]
                            this._set_active_frame(latest_frame);
                        }

                        this._draw_active_frame();

                        // Update UI
                        this._update_ui_frame_list();

                        // Restart animation if it's paused
                        if (this.is_animating && this._is_animation_paused) {
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
        if (!this.is_animating) {
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

            if (has_some_loaded && !this._is_animation_paused) {
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
        this.is_animating = true;
        this._ui.animation_play();
    }

    pause_animation() {
        this._is_animation_paused = true;
    }

    stop_animation() {
        window.clearTimeout(this._anim_timer);
        this.is_animating = false;
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
                            vwp.change_surface_wind([metar['wdir'], metar['wspd']], metar['id'] + " " + metar['time'].format("HHmm") + " UTC");
                        }
                    }
                    else {
                        vwp.change_surface_wind('none');
                    }
                }
                else {
                    vwp.change_surface_wind(new_vec, 'User');
                }
            }
        }).bind(this));

        this._surface_wind = new_vec;
        this._draw_active_frame();
    }

    change_storm_motion(new_vec) {
        this.frame_list.forEach(function(frame) {
            if (frame['status'] != 'notloaded') {
                frame['data'].change_storm_motion(new_vec);
            }
        });

        this._storm_motion = new_vec;
        this._update_ui_origin_selection();
        this._update_hodo_bbox();
        this._draw_active_frame();
    }

    change_origin(org) {
        this.frame_list.forEach(function(frame) {
            if (frame['status'] != 'notloaded') {
                frame['data'].change_origin(org);
            }
        });

        this._origin = org;
        this._update_hodo_bbox();
        this._draw_active_frame();
    }
 
    _draw_active_frame() {
        if (this.frame_list.size > 0) {
            var frame = Array.from(this.frame_list.values()).find(f => f['status'] == 'active');
            if (frame !== undefined) {
                this._hodo.draw_vwp(frame['data']);
            }
        }
    }

    _update_ui_origin_selection() {
        var have_sm = Array.from(this.frame_list.values()).filter(f => f['status'] != 'notloaded').map(f => f['data'].has_sm_vec());
        if (have_sm.length == 0) {
            return;
        }

        if (have_sm.reduce((a, b) => a && b)) {
            this._ui.set_sr_available(true);
        }
        else {
            this._ui.set_sr_available(false);
        }
    }

    _update_hodo_bbox() {
        var bboxes = Array.from(this.frame_list.values()).filter(f => f['status'] != 'notloaded').map(f => f['data'].get_bbox());
        if (bboxes.length == 0) {
            this._hodo.reset();
        }
        else {
            var bbox = bboxes.reduce(BBox.union);
            if (bbox.lbx === undefined || bbox.ubx === undefined || bbox.lby === undefined || bbox.uby === undefined) {
                this._hodo.reset();
            }
            else {
                this._hodo.set_bbox(bbox);
            }
        }
    }

    _update_ui_frame_list() {
        this._ui.set_frame_list(Array.from(this.frame_list.values()));
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

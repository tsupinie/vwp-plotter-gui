
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
            $(this).find('li').each(function() {
                $(this).mouseup(select_func);
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
            }).bind(this);

            if (this.vwp_container.is_animating) {
                this.vwp_container.pause_animation();
            }
            this.hodo.selection_start(vector_callback, done_callback);
            this.vwp_container.draw_active_frame();
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

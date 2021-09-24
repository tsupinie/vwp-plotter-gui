
const _home_svg = `<svg viewBox="15 12 70 70" xmlns="http://www.w3.org/2000/svg">
  <polygon points="25,80 45,80 45,60 55,60 55,80 75,80 75,50 25,50" />
  <polygon points="84,50 50,16 16,50" />
  <rect x="60" y="20" width="10" height="30"/>
</svg>`;

const _KEY_SPACEBAR = 32;
const _KEY_LEFT_ARROW = 37;
const _KEY_RIGHT_ARROW = 39;

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

        this.local_file_list = [];

        this.file_times = {};

        this._dt_fmt = "YYYY-MM-DD[T]HH:mm:ss[Z]";

        var mapclick = (function(rad) {
            $('#mapsel').html('<p>Radar:</p> <ul class="toggle-list"><li id="radarname">' + rad.id + ' (' + rad.name + ')' +
                              '<span id="default" class="selectable needhelp">' + _home_svg + '<span class="help helptop">Make Default</span></span></li></ul>');

            if (get_cookie('default') == rad.id) {
                $('#default').toggleClass('selected');
            }
            $('#default').click(this.toggle_default.bind(this));

            this.vwp_container.check_file_times(rad.id, false);
            this.update_asos_wind();
        }).bind(this);

        var age_limit = 2700;

        this.map_fname = 'imgs/map.png';
        this.radars = new ClickableMap(this.map_fname, 'vwp_radars.json', mapclick, "WSR-88D");
        if (get_cookie('default') !== undefined) {
            this.radars.select_point(get_cookie('default'));
        }
        this.hodo = new HodoPlot(this);
        this.vwp_container = new VWPContainer(this, this.hodo, age_limit);
        this.hodo.add_vwp_container(this.vwp_container);

        this.toggle_autoupdate(false);

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
        $('#makegif').mouseup(this.make_gif.bind(this));

        $('#displaydoc').mouseup(this.show_parameter_help.bind(this));
        $('#parameter-help .modal-close').mouseup(this.hide_parameter_help.bind(this));

        $('#local').change(this.load_local.bind(this));

        $('#hamburger').mouseup(this.hamburger_tap.bind(this));

        $(document).keydown(ev => {
            switch(ev.which) {
                case _KEY_SPACEBAR:
                    this.animation_play_pause();
                    break;
                case _KEY_LEFT_ARROW:
                    this.advance_frame(-1);
                    break;
                case _KEY_RIGHT_ARROW:
                    this.advance_frame(1);
                    break;

                default: return;
            }
            ev.preventDefault();
        });
    }

    select(event) {
        const target = event.target;

        if (target.classList.contains("grayout")) {
            return;
        }

        if (this.hodo.selecting) {
            this._abort_selection();
        }

        if (target.vector_select) {
            this.prev_selection = this._select_box(target);
            let help = document.getElementById("selecthelp");

            help.style.visibility = "visible";
            let target_pos = _page_pos(target);

            help.style.offsetLeft = target_pos.x + 70;
            help.style.offsetTop = target_pos.y;
            help.style.left = target_pos.x + 70;
            help.style.top = target_pos.y;

            const vector_callback = (wspd, wdir) => {
                let vec_str;

                if (wspd !== null && wdir !== null) {
                    vec_str = format_vector(wdir, wspd);
                }
                else {
                    vec_str = "DDD/SS";
                }

                const txt = document.createTextNode(vec_str);
                target.replaceChild(txt, target.childNodes[0]);
            };

            const vector_callback_boundary = (wspd, wdir, ctx) => {
                let vec_str;

                if (wspd !== null && wdir !== null) {
                    vec_str = format_vector(wdir, wspd);

                    const [[bdy_lbu, bdy_lbv], [bdy_ubu, bdy_ubv]] = compute_boundary_segment(ctx.bbox_data, vec2comp(wdir, wspd));
                    ctx.save();

                    ctx.lineWidth = 0.5;
                    ctx.strokeStyle = '#666666';

                    ctx.beginPath();
                    ctx.moveTo(bdy_lbu, bdy_lbv);
                    ctx.lineTo(bdy_ubu, bdy_ubv);
                    ctx.stroke();

                    ctx.restore();
                }
                else {
                    vec_str = "DDD/SS";
                }

                const txt = document.createTextNode(vec_str);
                target.replaceChild(txt, target.childNodes[0]);
            };

            const done_callback = (wspd, wdir) => {
                if (wdir !== null && wspd !== null) {
                    this._update_state(target, [wdir, wspd]);
                }

                if (this.vwp_container.is_animating) {
                    this.vwp_container.start_animation(true);
                }

                help.style.visibility = "hidden";
                help.style.offsetLeft = 0;
                help.style.offsetTop = 0;
                help.style.left = 0;
                help.style.top = 0;
            };

            if (this.vwp_container.is_animating) {
                this.vwp_container.pause_animation(true);
            }
            if (target.parentElement.parentElement.id == "bdysel") {
                this.hodo.selection_start(vector_callback_boundary, done_callback);
            }
            else {
                this.hodo.selection_start(vector_callback, done_callback);
            }
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

            frames.reverse().forEach(frame => {
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
            });
        }
    }

    advance_frame(direction) {
        let frame_list = $('#framelist');
        let current_active = frame_list.find('.frameactive');

        if (current_active.length == 0) {
            return
        }

        let new_active = current_active;

        do {
            // These seem backwards because the list elements are in reverse chronological order (because float right)
            if (direction > 0) {
                new_active = new_active.prev();
                if (new_active.length == 0) {
                    new_active = frame_list.find('li').last();
                }
            }
            else if (direction < 0) {
                new_active = new_active.next();
                if (new_active.length == 0) {
                    new_active = frame_list.find('li').first();
                }
            }
        } while (new_active.hasClass('framenotloaded'));

        this.vwp_container.set_anim_time(moment.utc(new_active.attr('data-datetime')));
    }

    toggle_autoupdate(refresh) {
        if (refresh === undefined) {
            refresh = true;
        }

        $('#autoupdate').toggleClass('selected');

        if (this._data_refresh_timer === null) {
            this._data_refresh_timer = window.setInterval(this.refresh.bind(this), this._vwp_refresh_intv);

            if (refresh) {
                this.refresh();
            }
        }
        else {
            window.clearInterval(this._data_refresh_timer);
            this._data_refresh_timer = null;
        }

        if (this._map_refresh_timer === null) {
            this._map_refresh_timer = window.setInterval(this.refresh_map.bind(this), this._map_refresh_intv);

            if (refresh) {
                this.refresh_map();
            }
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

    make_gif() {
        if (this.hodo.selecting) {
            this._abort_selection();
        }

        this.vwp_container.make_gif();
    }

    show_parameter_help() {
        $('#parameter-help').css('display', 'flex');
    }

    hide_parameter_help() {
        $('#parameter-help').css('display', 'none');
    }

    hamburger_tap() {
        if ($('#selection').css('visibility') == 'hidden') {
            $('#selection').addClass('fadein');
            $('#selection').removeClass('fadeout');
        }
        else {
            $('#selection').addClass('fadeout');
            $('#selection').removeClass('fadein');
        }
    }

    set_sr_available(is_available) {
        if (is_available) {
            $('#sr_origin').removeClass('grayout');
        }
        else {
            // XXX: This will do weird things if this is set while sr_origin is selected
            $('#sr_origin').addClass('grayout');
            var target = $('#gr_origin')[0];

            this._select_box(target);
            this._update_state(target, target.childNodes[0].textContent);
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

    load_local() {
        const files = $('#local').get(0).files;
        for (const file of files) {
            if (!this.local_file_list.map(f => f.name).includes(file.name)) {
                file.status = "notloaded";
                this.local_file_list.push(file);

                VWP.from_blob(file).then(vwp => {
                    file.status = "ok";
                    file.vwp = vwp;
                }).catch(error => {
                    file.status = "error";
                    console.error(error);
                }).then(() => {
                    this._update_local_file_list();
                });
            }
        }

        this.local_file_list.sort((a, b) => (a.name > b.name ? 1 : -1));
        this._update_local_file_list();
    }

    remove_local_file_from_list(fname) {
        this.local_file_list = this.local_file_list.filter(f => f.name != fname);
        this._update_local_file_list();
    }

    _update_local_file_list() {
        this.vwp_container.set_local_files(this.local_file_list);

        $('#file-list').empty()
        this.local_file_list.forEach(file => {
            const status_char = {'notloaded': '&ctdot;', 'error': '!', 'ok': '&check;'}[file.status]

            $('#file-list').append('<li data-filename="' + file.name + '">' + file.name + '<span class="file-rm">&times;</span><span>' + status_char + '</span></li>');
        });

        const this_ = this;
        $('#file-list .file-rm').each(function() {
            const elem = $(this);
            elem.mouseup(() => this_.remove_local_file_from_list(elem.parent().attr('data-filename')));
        });
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
        else if (obj.parentElement.parentElement.id == "bdysel") {
            this.vwp_container.change_boundary(val);
        }
        else if (obj.parentElement.parentElement.id == "mapdiv") {
            if (val == 'Local') {
                $('#map').css('display', 'none');
                $('#localsel').css('display', 'block');
            }
            else {
                $('#map').css('display', 'block');
                $('#localsel').css('display', 'none');

                this.radars.set_type(val)
            }
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

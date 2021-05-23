
function _indexToPos(idx, weights, align) {
    if (align === undefined) {
        align = 'lower';
    }

    const sum = (a, b) => a + b;
    let pos, pos_lower, pos_upper;

    if (align == 'lower' || align == 'center') {
        pos_lower = weights.slice(0, idx).reduce(sum, 0) / weights.reduce(sum, 0)
    }
    if (align == 'upper' || align == 'center') {
        pos_upper = weights.slice(0, idx + 1).reduce(sum, 0) / weights.reduce(sum, 0)
    }

    if (align == 'lower') {
        pos = pos_lower;
    }
    else if (align == 'center') {
        pos = (pos_lower + pos_upper) / 2;
    }
    else if (align == 'upper') {
        pos = pos_upper;
    }

    return pos;
}

class Table {
    constructor(rows, cols, canvas, bbox_pixels, dpr) {

        if (Array.isArray(rows)) {
            this.n_rows = rows.length;
            this._row_weights = rows;
        }
        else {
            this.n_rows = rows;
            this._row_weights = new Array(this.n_rows).fill(1);
        }

        if (Array.isArray(cols)) {
            this.n_cols = cols.length;
            this._col_weights = cols;
        }
        else {
            this.n_cols = cols;
            this._col_weights = new Array(this.n_cols).fill(1);
        }

        this._col_headers = null;
        this._row_headers = null;

        var bbox_data = new BBox(0, 0, 1, 1);
        this._ctx = Context2DWrapper.create_proxy(canvas, bbox_pixels, bbox_data, dpr);
    }

    set_col_headers(headers, height_weight) {
        if (headers.length != this.n_cols) {
            throw "set_col_headers: length should be " + this.n_cols;
        }

        var add_row = false;
        if (this._col_headers === null) {
            add_row = true;
        }

        this._col_headers = headers;

        if (height_weight === undefined) {
            height_weight = 1;
        }

        if (add_row) {
            this._row_weights.unshift(height_weight);
        }
        else {
            this._row_weights[0] = height_weight;
        }
    }

    set_row_headers(headers, width_weight) {
        if (headers.length != this.n_rows) {
            throw "set_row_headers: length should be " + this.n_rows;
        }

        var add_col = false;
        if (this._row_headers === null) {
            add_col = true;
        }

        this._row_headers = headers;

        if (width_weight === undefined) {
            width_weight = 1;
        }

        if (add_col) {
            this._col_weights.unshift(width_weight);
        }
        else {
            this._col_weights[0] = height_weight;
        }
    }

    draw_headers(font) {
        this._ctx.font = font;
        this._ctx.textBaseline = 'middle';
        this._ctx.textAlign = 'left';

        if (this._col_headers !== null) {
            let start_pos = this._row_headers === null ? 0 : 1;
            let y_pos = _indexToPos(0, this._row_weights, 'center');

            this._col_headers.forEach((h, i) => {
                let x_pos = _indexToPos(start_pos + i, this._col_weights, 'lower');

                this._ctx.fillText(h, x_pos, 1 - y_pos);
            });
        }

        if (this._row_headers !== null) {
            let start_pos = this._col_headers === null ? 0 : 1;
            let x_pos = _indexToPos(0, this._col_weights, 'lower');

            this._row_headers.forEach((h, i) => {
                let y_pos = _indexToPos(start_pos + i, this._row_weights, 'center');

                this._ctx.fillText(h, x_pos, 1 - y_pos);
            });
        }
    }

    draw_data(data, font) {
        this._ctx.font = font;
        this._ctx.textBaseline = 'middle';
        this._ctx.textAlign = 'left';

        let start_x = this._row_headers === null ? 0 : 1;
        let start_y = this._col_headers === null ? 0 : 1;

        data.forEach((row, jdy) => {
            let y_pos = _indexToPos(start_y + jdy, this._row_weights, 'center');
            row.forEach((col, idx) => {
                let x_pos = _indexToPos(start_x + idx, this._col_weights, 'lower');

                this._ctx.fillText(col, x_pos, 1 - y_pos);
            });
        });
    }


}


DataView.prototype.getUTF8String = function(offset, length) {
    return String.fromCharCode.apply(null, new Uint8Array(this.buffer.slice(offset, offset + length)));
}

class DataView_ {
    constructor(buffer, offset) {
        if (offset === undefined) {
            offset = 0;
        }

        this._dv = new DataView(buffer);
        this._ptr = offset;
    }

    seek(position, anchor) {
        if (anchor === undefined) {
            anchor = DataView_.ANCH_BEG;
        }

        switch (anchor) {
            case DataView_.ANCH_CUR:
                this._ptr += position;
                break;
            case DataView_.ANCH_BEG:
                this._ptr = position;
                break;
            case DataView_.ANCH_END:
                this._ptr = this._dv.buffer.byteLength + position;
                break;
            default:
                throw "Unknown anchor " + anchor;
        }
    }

    tell() {
        return this._ptr;
    }

    getUTF8String(length) {
        const val = this._dv.getUTF8String(this._ptr, length);
        this._ptr += length;
        return val;
    }

    getInt16() {
        const val = this._dv.getInt16(this._ptr);
        this._ptr += 2;
        return val;
    }

    getInt32() {
        const val = this._dv.getInt32(this._ptr);
        this._ptr += 4;
        return val;
    }

    getDecompressedView() {
        const decompressed = pako.inflateRaw(this._dv.buffer.slice(this._ptr + 2));
        return new DataView_(decompressed.buffer);
    }
}

DataView_.ANCH_CUR = 0;
DataView_.ANCH_BEG = 1;
DataView_.ANCH_END = 2;

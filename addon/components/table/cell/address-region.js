import Component from '@glimmer/component';
import { detectRegion, REGION_STYLE } from '@fleetbase/fleetops-engine/utils/vietnam-region';

export default class TableCellAddressRegionComponent extends Component {
    // Trả về display name (name hoặc street1)
    get address() {
        const row = this.args.row;
        const prop = this.args.column?.valuePath;
        if (!prop || !row) return null;
        return prop.split('.').reduce((obj, key) => obj?.[key], row) ?? null;
    }

    // Lấy Place object từ payload
    get place() {
        const row = this.args.row;
        const prop = this.args.column?.valuePath;
        if (!prop || !row) return null;
        const placeKey = prop === 'pickupName' ? 'pickup' : prop === 'dropoffName' ? 'dropoff' : null;
        if (!placeKey) return null;
        const place = row.payload?.[placeKey];
        return place;
    }

    _get(field) {
        const p = this.place;
        if (!p) return null;
        return p?.get ? p.get(field) : p?.[field];
    }

    get region() {
        // Thử lần lượt: province → city → address (full) → name (display)
        return (
            detectRegion(this._get('province')) ??
            detectRegion(this._get('city')) ??
            detectRegion(this._get('address')) ??
            detectRegion(this.address)
        );
    }

    get style() {
        const r = this.region;
        if (!r) return null;
        return REGION_STYLE[r];
    }

    get badgeStyle() {
        const s = this.style;
        if (!s) return '';
        return `color:${s.color};background:${s.bg};`;
    }

    get textStyle() {
        const s = this.style;
        if (!s) return '';
        return `color:${s.color};`;
    }
}

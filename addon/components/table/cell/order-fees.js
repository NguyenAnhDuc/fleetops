import Component from '@glimmer/component';

const VND = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 });
const FEE_KEYS = ['roadLaw_fee', 'food_fee', 'handling_fee', 'repair_fee', 'external_fuel_fee', 'other_fee'];

export default class TableCellOrderFeesComponent extends Component {
    get order() {
        return this.args.row;
    }

    get driverFees() {
        const d = this.order?.fees_driver;
        if (!d) return VND.format(0);
        const total = FEE_KEYS.reduce((s, k) => s + (parseFloat(d[k]) || 0), 0);
        return VND.format(total);
    }

    get approvedFees() {
        const f = this.order?.approved_fees;
        if (!f) return null;
        const total = FEE_KEYS.reduce((s, k) => s + (Number(f[k]) || 0), 0);
        if (total <= 0) return null;
        return VND.format(total);
    }
}

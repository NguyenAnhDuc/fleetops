import Component from '@glimmer/component';

const VND = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 });

export default class TableCellOrderTotalFeesComponent extends Component {
    get displayValue() {
        const qty = parseFloat(this.args.row?.quantity_fees ?? 0);
        const rawPrice = this.args.row?.unit_price_fees;
        const price = parseFloat((rawPrice ?? '').toString().replace(/[^\d.]/g, ''));
        if (!qty || !price) return '-';
        return VND.format(qty * price);
    }
}

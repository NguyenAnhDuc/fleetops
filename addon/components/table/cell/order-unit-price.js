import Component from '@glimmer/component';

const VND = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 });

export default class TableCellOrderUnitPriceComponent extends Component {
    get displayValue() {
        const raw = this.args.row?.unit_price_fees;
        const num = parseFloat((raw ?? '').toString().replace(/[^\d.]/g, ''));
        if (!num || num === 0) return '-';
        return VND.format(num);
    }
}

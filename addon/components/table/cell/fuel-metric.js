import Component from '@glimmer/component';

const VND = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 });

export default class FuelMetricCellComponent extends Component {
    get value() {
        if (!this.args.column || !this.args.row) {
            return null;
        }

        let valuePath = this.args.column.valuePath;
        let raw = this.args.row.get(valuePath);

        if (this.args.column.currencyFormat) {
            let num = parseFloat(raw) || 0;
            return VND.format(num);
        }

        return raw;
    }

    get differenceValue() {
        let diffPath = this.args.column.differencePath;
        if (!diffPath) return null;
        return this.args.row.get(diffPath);
    }

    get hasDifference() {
        let diff = parseFloat(this.differenceValue);
        return !isNaN(diff) && diff !== 0;
    }

    get differenceFormatted() {
        let diff = parseFloat(this.differenceValue);
        if (isNaN(diff)) { return null; }

        if (this.args.column.currencyFormat) {
            return diff > 0 ? `+${VND.format(diff)}` : VND.format(diff);
        }

        return diff > 0 ? `+${diff}` : `${diff}`;
    }

    get differenceColorClass() {
        let diff = parseFloat(this.differenceValue);
        if (isNaN(diff)) { return 'text-gray-500'; }
        
        let type = this.args.column.differenceType || 'positive-green';
        if (type === 'positive-green') {
            return diff > 0 ? 'text-green-500 font-bold' : 'text-red-500 font-bold';
        }
        
        return 'text-blue-500 font-bold';
    }
}

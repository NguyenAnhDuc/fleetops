import Component from '@glimmer/component';

const VND = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 });

export default class IssueItemsCellComponent extends Component {
    get items() {
        if (!this.args.row) return [];
        const items = this.args.row.get('items');
        return Array.isArray(items) ? items : [];
    }

    get previewItems() {
        return this.items.slice(0, 2);
    }

    get extraCount() {
        const extra = this.items.length - 2;
        return extra > 0 ? extra : 0;
    }

    get tooltipText() {
        if (this.items.length === 0) return '';
        return this.items
            .map(item => `${item.name}: ${VND.format(parseFloat(item.money) || 0)}`)
            .join('\n');
    }
}

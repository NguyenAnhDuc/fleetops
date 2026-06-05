import Component from '@glimmer/component';

const VND = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 });

/**
 * Hiển thị gộp 3 thông số tiền của lái xe trên 1 ô:
 *  - Thu : driver_earnings      (lái xe đã thu)
 *  - Ứng : driver_advance_fee   (lái xe ứng trước)
 *  - Nộp : driver_remittance    (lái xe nộp lại)
 * Nguồn field giống báo cáo thu chi (finances).
 */
export default class TableCellOrderDriverCashComponent extends Component {
    get order() {
        return this.args.row;
    }

    format(value) {
        const n = parseFloat((value ?? '').toString().replace(/[^\d.-]/g, ''));
        return VND.format(Number.isFinite(n) ? n : 0);
    }

    get thu() {
        return this.format(this.order?.driver_earnings);
    }

    get ung() {
        return this.format(this.order?.driver_advance_fee);
    }

    get nop() {
        return this.format(this.order?.driver_remittance);
    }
}

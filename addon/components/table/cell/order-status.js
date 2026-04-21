import Component from '@glimmer/component';

const FEE_KEYS = ['roadLaw_fee', 'food_fee', 'handling_fee', 'repair_fee', 'external_fuel_fee', 'other_fee'];

/**
 * Cell hiển thị trạng thái đơn hàng kèm cảnh báo khi:
 *  - Đơn đã "completed" (tài xế đã hoàn thành chuyến)
 *  - Nhưng fees_driver chưa nhập (null/empty) hoặc tổng = 0
 */
export default class TableCellOrderStatusComponent extends Component {
    get order() {
        return this.args.row;
    }

    /**
     * Các status được coi là "đã hoàn thành" cần tài xế nhập chi phí.
     * Không tính 'finished' (đã chốt báo cáo) và 'canceled' (huỷ).
     */
    get isCompletedStatus() {
        return this.order?.status === 'completed';
    }

    get hasDriverFees() {
        const d = this.order?.fees_driver;
        if (!d) return false;
        const total = FEE_KEYS.reduce((s, k) => s + (parseFloat(d[k]) || 0), 0);
        return total > 0;
    }

    /**
     * Hiển thị warning khi đơn completed mà tài xế chưa nhập fees.
     */
    get showFeesWarning() {
        return this.isCompletedStatus && !this.hasDriverFees;
    }
}

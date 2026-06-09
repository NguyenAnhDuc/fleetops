import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';

const VND = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 });

export default class VehicleTransferApprovalFormComponent extends Component {
    @tracked approvedAmount;
    @tracked approvalNote;

    constructor() {
        super(...arguments);

        const state = this.args.options?.state || {};
        const transfer = this.args.options?.transfer;

        // Khởi tạo từ state (đã được controller điền sẵn = số yêu cầu).
        // Chuẩn hoá về số nguyên (VND không có phần thập phân) — tránh hiển thị "1230000.00".
        this.approvedAmount = this._toIntString(state.approvedAmount ?? transfer?.amount ?? '');
        this.approvalNote = state.approvalNote ?? '';

        // Đồng bộ ngược vào shared state ngay từ đầu để admin không sửa gì vẫn duyệt đúng.
        this._syncState();
    }

    get transfer() {
        return this.args.options?.transfer;
    }

    get requestedAmountFormatted() {
        return VND.format(parseFloat(this.transfer?.amount) || 0);
    }

    get approvedAmountFormatted() {
        return VND.format(parseFloat(this.approvedAmount) || 0);
    }

    _toIntString(value) {
        const n = parseFloat(value);
        return Number.isFinite(n) ? String(Math.round(n)) : '';
    }

    _syncState() {
        const state = this.args.options?.state;
        if (state) {
            state.approvedAmount = this.approvedAmount;
            state.approvalNote = this.approvalNote;
        }
    }

    @action updateApprovedAmount(event) {
        // chỉ giữ số
        this.approvedAmount = (event.target.value || '').replace(/[^0-9]/g, '');
        this._syncState();
    }

    @action updateApprovalNote(event) {
        this.approvalNote = event.target.value || '';
        this._syncState();
    }
}

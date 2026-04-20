import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';

const FEE_KEYS = ['roadLaw_fee', 'food_fee', 'handling_fee', 'repair_fee', 'external_fuel_fee', 'other_fee'];

const VND = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 });

export default class OrderApprovalBillingFormComponent extends Component {
    /**
     * Tracked approved fees object: {roadLaw_fee, food_fee, handling_fee, repair_fee, external_fuel_fee, other_fee}
     * null means "not yet approved" (will init from fees_driver as suggestion)
     */
    @tracked approvedFees = null;

    /** Từng field đã được admin chỉnh chưa (true = đã duyệt/xanh, false = gợi ý/vàng) */
    @tracked editedRoadLawFee = false;
    @tracked editedFoodFee = false;
    @tracked editedHandlingFee = false;
    @tracked editedRepairFee = false;
    @tracked editedExternalFuelFee = false;
    @tracked editedOtherFee = false;

    constructor(owner, args) {
        super(...arguments);
        this._initApprovedFees();

        // Hook into modal confirm to save back to order
        if (args.options && typeof args.options.setConfirmCallback === 'function') {
            args.options.setConfirmCallback(this.onConfirm.bind(this));
        }
    }

    _initApprovedFees() {
        const order = this.args.options?.order;
        if (!order) return;

        const existing = order.approved_fees;
        const driver = order.fees_driver || {};

        if (existing && FEE_KEYS.some(k => Number(existing[k]) > 0)) {
            // Đã có giá trị duyệt trước → hiện màu xanh
            this.approvedFees = { ...existing };
            this.editedRoadLawFee = true;
            this.editedFoodFee = true;
            this.editedHandlingFee = true;
            this.editedRepairFee = true;
            this.editedExternalFuelFee = true;
            this.editedOtherFee = true;
        } else {
            // Gợi ý từ lái xe → màu vàng
            this.approvedFees = FEE_KEYS.reduce((acc, k) => {
                acc[k] = driver[k] !== undefined ? String(driver[k]) : '0';
                return acc;
            }, {});
        }
    }

    get totalApproved() {
        if (!this.approvedFees) return 0;
        return FEE_KEYS.reduce((sum, k) => sum + (parseInt(this.approvedFees[k], 10) || 0), 0);
    }

    get formattedTotal() {
        return VND.format(this.totalApproved);
    }

    _setEdited(key) {
        if (key === 'roadLaw_fee')       this.editedRoadLawFee = true;
        else if (key === 'food_fee')     this.editedFoodFee = true;
        else if (key === 'handling_fee') this.editedHandlingFee = true;
        else if (key === 'repair_fee')   this.editedRepairFee = true;
        else if (key === 'external_fuel_fee') this.editedExternalFuelFee = true;
        else if (key === 'other_fee')    this.editedOtherFee = true;
    }

    @action
    updateFee(key, event) {
        const value = (event.target.value || '').replace(/[^0-9]/g, '');
        this.approvedFees = { ...this.approvedFees, [key]: value };
        this._setEdited(key);

        // Chỉ update shared state — KHÔNG write vào order model cho đến khi confirm
        const state = this.args.options?.state;
        if (state) {
            state.approvedFees = { ...this.approvedFees };
            state.total = this.totalApproved;
        }
    }

    get driverFeesFormatted() {
        const d = this.args.options?.order?.fees_driver || {};
        const fmt = (v) => VND.format(parseFloat(v) || 0);
        return {
            roadLaw_fee:      fmt(d.roadLaw_fee),
            food_fee:         fmt(d.food_fee),
            handling_fee:     fmt(d.handling_fee),
            repair_fee:       fmt(d.repair_fee),
            external_fuel_fee:fmt(d.external_fuel_fee),
            other_fee:        fmt(d.other_fee),
            total:            fmt(FEE_KEYS.reduce((s, k) => s + (parseFloat(d[k]) || 0), 0)),
        };
    }
}

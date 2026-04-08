import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { inject as service } from '@ember/service';
import { action } from '@ember/object';
import { task } from 'ember-concurrency';
import { schedule } from '@ember/runloop';
import contextComponentCallback from '@fleetbase/ember-core/utils/context-component-callback';
import applyContextComponentArguments from '@fleetbase/ember-core/utils/apply-context-component-arguments';

export default class FuelReportFormPanelComponent extends Component {
    @service store;
    @service notifications;
    @service intl;
    @service hostRouter;
    @service contextPanel;

    /**
     * Overlay context.
     * @type {any}
     */
    @tracked context;

    /**
     * Fuel Report status options
     * @type {Array}
     */
    @tracked statusOptions = ['draft', 'pending-approval', 'approved', 'rejected', 'revised', 'submitted', 'in-review', 'confirmed', 'processed', 'archived', 'cancelled'];

    /**
     * Permission needed to update or create record.
     */
    @tracked savePermission;

    /**
     * The current controller if any.
     */
    @tracked controller;

    /**
     * Giá trị chi phí tự tính hiển thị dạng string (volume * unit_price)
     * @type {string}
     */
    @tracked computedAmount = '0.00';

    /**
     * Constructs the component and applies initial state.
     */
    constructor(owner, { fuelReport = null, controller }) {
        super(...arguments);
        this.fuelReport = fuelReport;
        this.controller = controller;
        this.savePermission = fuelReport && fuelReport.isNew ? 'fleet-ops create fuel-report' : 'fleet-ops update fuel-report';
        applyContextComponentArguments(this);

        // Defer mutation sang sau khi render để tránh lỗi Glimmer revalidation
        schedule('afterRender', this, () => {
            // Set mặc định status = approved nếu chưa có
            if (this.fuelReport && !this.fuelReport.status) {
                this.fuelReport.status = 'approved';
            }
            // Strip .00 trên các trường tiền tệ khi init edit form
            if (this.fuelReport) {
                const toInt = (val) => {
                    const num = parseFloat(val);
                    if (!isNaN(num)) return String(Math.round(num));
                    return val;
                };
                this.fuelReport.unit_price = toInt(this.fuelReport.unit_price);
                this.fuelReport.volume_extra = toInt(this.fuelReport.volume_extra);
                this.fuelReport.amount_extra = toInt(this.fuelReport.amount_extra);
            }
            // Tính lại computedAmount từ dữ liệu hiện có (khi edit)
            this._recalculateAmount();
        });
    }

    /**
     * Sets the overlay context.
     */
    @action setOverlayContext(overlayContext) {
        this.context = overlayContext;
        contextComponentCallback(this, 'onLoad', ...arguments);
    }

    /**
     * Xử lý khi volume thay đổi → tính lại chi phí
     */
    @action onVolumeChange(value) {
        this.fuelReport.volume = value;
        this._recalculateAmount();
    }

    /**
     * Lấy giá trị ngày dưới dạng chuỗi chuẩn YYYY-MM-DD để hiển thị trên input
     */
    get fueledAtDate() {
        if (!this.fuelReport || !this.fuelReport.fueled_at) return '';
        const d = new Date(this.fuelReport.fueled_at);
        return isNaN(d) ? '' : d.toISOString().split('T')[0];
    }

    /**
     * Sự kiện khi người dùng chọn Ngày đổ dầu
     */
    @action onFueledAtChange(event) {
        if (event.target.value) {
            this.fuelReport.fueled_at = new Date(event.target.value);
        } else {
            this.fuelReport.fueled_at = null;
        }
    }

    /**
     * Xử lý khi unit_price thay đổi → tính lại chi phí
     */
    @action onUnitPriceChange(event) {
        this.fuelReport.unit_price = event.target.value;
        this._recalculateAmount();
    }

    /**
     * Tính lại amount = volume * unit_price
     * @private
     */
    _recalculateAmount() {
        const volume = parseFloat(this.fuelReport.volume) || 0;
        const unitPrice = parseFloat(this.fuelReport.unit_price) || 0;
        const result = volume * unitPrice;
        this.computedAmount = result.toLocaleString('vi-VN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
        // Đồng thời lưu vào fuelReport.amount để gửi lên server
        this.fuelReport.amount = result.toFixed(2);
    }

    /**
     * Task to save fuel report.
     */
    @task *save() {
        // Client-side verification
        const driverId = this.fuelReport.belongsTo('driver').id() || this.fuelReport.driver_uuid;
        if (!driverId) {
            this.notifications.warning('Vui lòng chọn Tài xế.');
            return;
        }

        const vehicleId = this.fuelReport.belongsTo('vehicle').id() || this.fuelReport.vehicle_uuid;
        if (!vehicleId) {
            this.notifications.warning('Vui lòng chọn Phương tiện.');
            return;
        }
        if (!this.fuelReport.fueled_at) {
            this.notifications.warning('Vui lòng nhập Ngày đổ dầu.');
            return;
        }
        if (!this.fuelReport.odometer || isNaN(this.fuelReport.odometer)) {
            this.notifications.warning('Vui lòng nhập Công tơ mét hợp lệ.');
            return;
        }
        if (!this.fuelReport.volume || isNaN(this.fuelReport.volume)) {
            this.notifications.warning('Vui lòng nhập Khối lượng hợp lệ.');
            return;
        }
        if (!this.fuelReport.unit_price || isNaN(this.fuelReport.unit_price)) {
            this.notifications.warning('Vui lòng nhập Đơn giá hợp lệ.');
            return;
        }

        // Đảm bảo status luôn là approved nếu chưa set
        if (!this.fuelReport.status) {
            this.fuelReport.status = 'approved';
        }

        // Tính lại amount trước khi save
        this._recalculateAmount();

        contextComponentCallback(this, 'onBeforeSave', this.fuelReport);

        try {
            this.fuelReport = yield this.fuelReport.save();
        } catch (error) {
            this.notifications.serverError(error);
            return;
        }

        this.notifications.success(this.intl.t('fleet-ops.component.fuel-report-form-panel.success-message'));
        contextComponentCallback(this, 'onAfterSave', this.fuelReport);
    }

    /**
     * View the details of the fuel-report.
     */
    @action onViewDetails() {
        const isActionOverrided = contextComponentCallback(this, 'onViewDetails', this.fuelReport);

        if (!isActionOverrided) {
            this.contextPanel.focus(this.fuelReport, 'viewing');
        }
    }

    /**
     * Handles cancel button press.
     */
    @action onPressCancel() {
        return contextComponentCallback(this, 'onPressCancel', this.fuelReport);
    }
}

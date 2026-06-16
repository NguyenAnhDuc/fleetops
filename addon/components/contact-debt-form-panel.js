import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { inject as service } from '@ember/service';
import { action } from '@ember/object';
import { isArray } from '@ember/array';
import { task } from 'ember-concurrency';
import contextComponentCallback from '@fleetbase/ember-core/utils/context-component-callback';
import applyContextComponentArguments from '@fleetbase/ember-core/utils/apply-context-component-arguments';

export default class ContactDebtFormPanelComponent extends Component {
    @service store;
    @service fetch;
    @service intl;
    @service notifications;
    @service hostRouter;
    @service contextPanel;
    
    /**
     * Accepted file types for image upload
     * @type {Array}
     */

    /**
     * The contactDebt record being created or edited.
     * @type {ContactDebtModel}
     */
    @tracked contactDebt;

    /**
     * Overlay context.
     * @type {any}
     */
    @tracked context;

    /**
     * Permission needed to update or create record.
     *
     * @memberof ContactDebtFormPanelComponent
     */
    @tracked savePermission;

    /**
     * The current controller if any.
     *
     * @memberof ContactDebtFormPanelComponent
     */
    @tracked controller;

    /**
     * Validation errors keyed by field name.
     *
     * @memberof ContactDebtFormPanelComponent
     */
    @tracked validationErrors = {};

    /**
     * Constructs the component and applies initial state.
     */
    constructor(owner, { contactDebt = null, controller }) {
        super(...arguments);
        
        this.contactDebt = contactDebt;
        this.controller = controller;
        this.savePermission = contactDebt && contactDebt.isNew ? 'fleet-ops create contactDebt' : 'fleet-ops update contactDebt';
        applyContextComponentArguments(this);
    }

    /**
     * Sets the overlay context.
     *
     * @action
     * @param {OverlayContextObject} overlayContext
     */
    @action setOverlayContext(overlayContext) {
        this.context = overlayContext;
        contextComponentCallback(this, 'onLoad', ...arguments);
    }

    /**
     * Task to save contactDebt.
     *
     * @return {void}
     * @memberof ContactDebtFormPanelComponent
     */
    @task *save() {
        // Validate bắt buộc trước khi lưu
        if (!this.validate()) {
            return;
        }

        contextComponentCallback(this, 'onBeforeSave', this.contactDebt);

        try {
            this.contactDebt = yield this.contactDebt.save();
        } catch (error) {
            this.notifications.serverError(error);
            return;
        }

        this.clearValidation();
        this.notifications.success(this.intl.t('fleet-ops.component.contact-debt-form-panel.success-message'));
        contextComponentCallback(this, 'onAfterSave', this.contactDebt);
    }

    /**
     * Validate các trường bắt buộc: Khách hàng, Ngày nhận tiền, Số tiền.
     *
     * @return {boolean} true nếu hợp lệ
     * @memberof ContactDebtFormPanelComponent
     */
    validate() {
        const errors = {};
        const debt = this.contactDebt;

        // Khách hàng (belongsTo contact) — lấy id đồng bộ
        const contactId = debt?.belongsTo?.('contact')?.id?.() || debt?.contact_uuid || null;
        if (!contactId) {
            errors.contact = this.intl.t('fleet-ops.component.contact-debt-form-panel.validation-contact-required');
        }

        // Ngày nhận tiền
        if (!debt?.received_at) {
            errors.received_at = this.intl.t('fleet-ops.component.contact-debt-form-panel.validation-received-at-required');
        }

        // Số tiền > 0
        const amount = parseFloat(String(debt?.amount ?? '').replace(/[^\d.-]/g, '')) || 0;
        if (!amount || amount <= 0) {
            errors.amount = this.intl.t('fleet-ops.component.contact-debt-form-panel.validation-amount-required');
        }

        this.validationErrors = errors;

        const messages = Object.values(errors);
        if (messages.length) {
            this.notifications.warning(messages.join(' '));
            return false;
        }

        return true;
    }

    /**
     * Xoá toàn bộ lỗi validate.
     *
     * @memberof ContactDebtFormPanelComponent
     */
    clearValidation() {
        this.validationErrors = {};
    }

    /**
     * View the details of the contactDebt.
     *
     * @action
     */
    @action onViewDetails() {
        const isActionOverrided = contextComponentCallback(this, 'onViewDetails', this.contactDebt);

        if (!isActionOverrided) {
            this.contextPanel.focus(this.contactDebt, 'viewing');
        }
    }

    /**
     * Updates received_at từ DateTimeInput.
     * Nhận vào Date instance (local), chuyển về midnight UTC giống màn Create Order
     * để backend lưu đúng ngày, không lệch ở GMT+7.
     */
    @action updateReceivedAt(dateInstance) {
        if (!dateInstance) {
            this.contactDebt.received_at = null;
        } else {
            const d = new Date(dateInstance);
            if (!isNaN(d)) {
                this.contactDebt.received_at = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
            }
        }
        if (this.validationErrors.received_at) {
            this.validationErrors = { ...this.validationErrors, received_at: null };
        }
    }

    /**
     * Updates the selected contact (khách hàng).
     */
    @action onSelectContact(contact) {
        this.contactDebt.contact = contact;
        if (this.validationErrors.contact) {
            this.validationErrors = { ...this.validationErrors, contact: null };
        }
    }

    /**
     * Ghi giá trị số tiền về model (MoneyInput không tự two-way bind).
     */
    @action onAmountChange(event) {
        let raw = '';
        if (event && typeof event === 'object') {
            raw = event.newValue ?? event.target?.value ?? '';
        } else {
            raw = event ?? '';
        }
        const numeric = parseFloat(String(raw).replace(/[^\d.-]/g, '')) || 0;
        this.contactDebt.amount = numeric;
        if (this.validationErrors.amount) {
            this.validationErrors = { ...this.validationErrors, amount: null };
        }
    }

    /**
     * Handles cancel button press.
     *
     * @action
     * @returns {any}
     */
    @action onPressCancel() {
        return contextComponentCallback(this, 'onPressCancel', this.contactDebt);
    }
}

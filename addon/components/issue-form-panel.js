import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { inject as service } from '@ember/service';
import { action } from '@ember/object';
import { isArray } from '@ember/array';
import { task } from 'ember-concurrency';
import getWithDefault from '@fleetbase/ember-core/utils/get-with-default';
import contextComponentCallback from '@fleetbase/ember-core/utils/context-component-callback';
import applyContextComponentArguments from '@fleetbase/ember-core/utils/apply-context-component-arguments';
import getIssueTypes from '../utils/get-issue-types';
import getIssueCategories from '../utils/get-issue-categories';

export default class IssueFormPanelComponent extends Component {
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
    @tracked acceptedImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

    /** @type {any} */
    @tracked context;

    /** @type {String} */
    @tracked issueTypes = getIssueTypes();

    /** @type {Object} */
    @tracked issueCategoriesByType = getIssueCategories({ fullObject: true });

    /** @type {Array} */
    @tracked issueCategories = [];

    /** @type {Array} */
    @tracked issueStatusOptions = ['pending', 'in-progress', 'backlogged', 'requires-update', 'in-review', 're-opened', 'duplicate', 'pending-review', 'escalated', 'completed', 'canceled'];

    /** @type {Array} */
    @tracked issuePriorityOptions = ['low', 'medium', 'high', 'critical', 'scheduled-maintenance', 'operational-suggestion'];

    /** @type {String} */
    @tracked savePermission;

    /** @type {any} */
    @tracked controller;

    /**
     * Dynamic expense items: [{name, money, namePlaceholder?, nameError?, moneyError?}]
     * @type {Array}
     */
    @tracked items = [];

    /**
     * Default name placeholders for the first 4 items.
     */
    defaultNamePlaceholders = ['LƯƠNG', 'Lãi Ngân hàng', 'Lương quản lý', 'Phí đường bộ'];

    /**
     * Form-level validation errors: {vehicle, car_repair_date, items}
     * @type {Object}
     */
    @tracked validationErrors = {};

    /**
     * Constructs the component and applies initial state.
     */
    constructor(owner, { issue = null, controller }) {
        super(...arguments);
        this.issue = issue;
        this.controller = controller;
        this.issueCategories = getWithDefault(this.issueCategoriesByType, getWithDefault(issue, 'type', 'operational'), []);
        this.savePermission = issue && issue.isNew ? 'fleet-ops create issue' : 'fleet-ops update issue';

        // Initialize items from existing issue data, or default 4 empty items for new issues
        if (issue && isArray(issue.items) && issue.items.length > 0) {
            this.items = issue.items.map((item, i) => ({
                name: item.name || '',
                money: item.money !== undefined ? String(item.money) : '',
                namePlaceholder: this.defaultNamePlaceholders[i] || '',
            }));
        } else {
            this.items = this.defaultNamePlaceholders.map(placeholder => ({
                name: '',
                money: '',
                namePlaceholder: placeholder,
            }));
        }

        applyContextComponentArguments(this);
    }

    /**
     * Computed total money from items.
     * @returns {number}
     */
    get totalMoney() {
        return this.items.reduce((sum, item) => sum + (parseInt(item.money, 10) || 0), 0);
    }

    /**
     * Formatted total money string.
     * @returns {string}
     */
    get formattedTotalMoney() {
        const currency = this.issue?.currency || 'VND';
        try {
            return new Intl.NumberFormat('vi-VN', { style: 'currency', currency }).format(this.totalMoney);
        } catch {
            return `${this.totalMoney.toLocaleString('vi-VN')} ₫`;
        }
    }

    /**
     * Validate the form. Returns true if valid, false otherwise.
     *
     * Rules:
     * - Vehicle: phải chọn
     * - Date: phải chọn
     * - Items: phải có ít nhất 1 row có cả name lẫn money > 0
     *   - Row trống hoàn toàn (name rỗng VÀ money rỗng/0): bỏ qua, không validate
     *   - Row có 1 trong 2: báo lỗi inline trên row đó
     *
     * @returns {boolean}
     */
    validate() {
        const errors = {};
        let isValid = true;

        // --- Vehicle required ---
        // Dùng vehicle_uuid hoặc check id của relationship object
        const vehicleId = this.issue.vehicle_uuid
            || (this.issue.vehicle && (this.issue.vehicle.id || this.issue.vehicle.get?.('id')));
        if (!vehicleId) {
            errors.vehicle = this.intl.t('fleet-ops.component.issue-form-panel.validation-vehicle-required');
            isValid = false;
        }

        // --- Date required ---
        if (!this.issue.car_repair_date) {
            errors.car_repair_date = this.intl.t('fleet-ops.component.issue-form-panel.validation-date-required');
            isValid = false;
        }

        // --- Items: ít nhất 1 row hợp lệ ---
        let hasAtLeastOneValidItem = false;

        const validatedItems = this.items.map(item => {
            const name = (item.name || '').trim();
            const money = parseInt(item.money, 10) || 0;
            const isEmpty = !name && money === 0;

            // Row trống hoàn toàn => bỏ qua, xóa error cũ nếu có
            if (isEmpty) {
                const { nameError, moneyError, ...clean } = item;
                return clean;
            }

            // Row có ít nhất 1 field => validate cả 2
            const itemErrors = {};
            if (!name) {
                itemErrors.nameError = this.intl.t('fleet-ops.component.issue-form-panel.validation-item-name-required');
                isValid = false;
            }
            if (money <= 0) {
                itemErrors.moneyError = this.intl.t('fleet-ops.component.issue-form-panel.validation-item-money-required');
                isValid = false;
            }

            if (name && money > 0) {
                hasAtLeastOneValidItem = true;
            }

            return { ...item, ...itemErrors };
        });

        // Cần ít nhất 1 item hợp lệ
        if (!hasAtLeastOneValidItem) {
            errors.items = this.intl.t('fleet-ops.component.issue-form-panel.validation-items-required');
            isValid = false;
        }

        this.items = validatedItems;
        this.validationErrors = errors;
        return isValid;
    }

    /**
     * Clear all validation errors.
     */
    clearValidation() {
        this.validationErrors = {};
        this.items = this.items.map(({ nameError, moneyError, ...item }) => item);
    }

    /**
     * Sets the overlay context.
     */
    @action setOverlayContext(overlayContext) {
        this.context = overlayContext;
        contextComponentCallback(this, 'onLoad', ...arguments);
    }

    /**
     * Task to save issue — validates first.
     */
    @task *save() {
        // Run validation
        const isValid = this.validate();
        if (!isValid) {
            return;
        }

        // Đảm bảo currency luôn là VND khi lưu
        if (!this.issue.currency) {
            this.issue.set('currency', 'VND');
        }

        // Chỉ lưu row có đủ name + money > 0, bỏ row trống
        const cleanItems = this.items
            .filter(item => (item.name || '').trim() && (parseInt(item.money, 10) || 0) > 0)
            .map(({ nameError, moneyError, namePlaceholder, ...item }) => ({
                name: item.name.trim(),
                money: parseInt(item.money, 10),
            }));
        this.issue.set('items', cleanItems);
        this.issue.set('total_money', this.totalMoney);

        contextComponentCallback(this, 'onBeforeSave', this.issue);

        try {
            this.issue = yield this.issue.save();
        } catch (error) {
            this.notifications.serverError(error);
            return;
        }

        this.clearValidation();
        this.notifications.success(this.intl.t('fleet-ops.component.issue-form-panel.success-message', { publicId: this.issue.public_id }));
        contextComponentCallback(this, 'onAfterSave', this.issue);
    }

    /**
     * Add a new empty expense item.
     */
    @action addItem() {
        this.items = [...this.items, { name: '', money: '' }];
        if (this.validationErrors.items) {
            this.validationErrors = { ...this.validationErrors, items: null };
        }
    }

    /**
     * Remove an expense item by index.
     * @param {number} index
     */
    @action removeItem(index) {
        this.items = this.items.filter((_, i) => i !== index);
    }

    /**
     * Update a field ('name' or 'money') of an expense item.
     * @param {number} index
     * @param {string} field
     * @param {Event} event
     */
    @action updateItemField(index, field, event) {
        let value = event.target ? event.target.value : event;

        if (field === 'money') {
            // Strip tất cả ký tự không phải số
            value = value.replace(/[^0-9]/g, '');
        }

        // Dùng change event (blur) nên re-render ở đây không gây mất focus
        this.items = this.items.map((item, i) => {
            if (i !== index) return item;
            const updated = { ...item, [field]: value };
            if (field === 'name') delete updated.nameError;
            if (field === 'money') delete updated.moneyError;
            return updated;
        });
    }

    /** @action */
    @action onSelectIssueType(type) {
        this.issue.type = type;
        this.issue.category = null;
        this.issueCategories = getWithDefault(this.issueCategoriesByType, type, []);
    }

    /** @action */
    @action addTag(tag) {
        if (!isArray(this.issue.tags)) {
            this.issue.tags = [];
        }
        this.issue.tags.pushObject(tag);
    }

    /** @action */
    @action removeTag(index) {
        this.issue.tags.removeAt(index);
    }

    /** @action */
    @action onViewDetails() {
        const isActionOverrided = contextComponentCallback(this, 'onViewDetails', this.issue);
        if (!isActionOverrided) {
            this.contextPanel.focus(this.issue, 'viewing');
        }
    }

    /** @action */
    @action onPressCancel() {
        return contextComponentCallback(this, 'onPressCancel', this.issue);
    }

    /**
     * Handle native date input change (type="date" returns "yyyy-mm-dd" string).
     * Phải convert sang Date object vì model có @attr('date').
     * @param {Event} event
     */
    @action onDateChange(event) {
        const dateStr = event.target.value;
        if (dateStr) {
            // Parse manually để tránh timezone offset khi dùng new Date('yyyy-mm-dd')
            const [year, month, day] = dateStr.split('-').map(Number);
            this.issue.set('car_repair_date', new Date(year, month - 1, day));
        } else {
            this.issue.set('car_repair_date', null);
        }
        if (this.validationErrors.car_repair_date) {
            this.validationErrors = { ...this.validationErrors, car_repair_date: null };
        }
    }

    /** @action */
    @action setReporter(user) {
        this.issue.set('reporter', user);
        this.issue.set('reported_by_uuid', user.id);
    }

    /**
     * Handles file upload for issue image.
     * @action
     */
    @action onImageFileAdded(file) {
        if (['queued', 'failed', 'timed_out', 'aborted'].indexOf(file.state) === -1) {
            return;
        }
        this.file = file;
        const fileUrl = URL.createObjectURL(file.file);
        this.fetch.uploadFile.perform(
            file,
            { path: 'uploads/fleet-ops/issue-images', type: 'issue_image' },
            (uploadedFile) => {
                this.file = undefined;
                this.issue.set('image', uploadedFile);
                this.issue.set('image_uuid', uploadedFile.id);
                this.issue.set('photo_url', fileUrl);
            },
            () => {
                if (file.queue && typeof file.queue.remove === 'function') {
                    file.queue.remove(file);
                }
                this.file = undefined;
            }
        );
    }

    /** @action */
    @action removeImage() {
        this.issue.set('image', null);
        this.issue.set('image_uuid', null);
    }
}

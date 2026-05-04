import BaseController from '@fleetbase/fleetops-engine/controllers/base-controller';
import { inject as service } from '@ember/service';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
import { computed } from '@ember/object';
import { htmlSafe } from '@ember/template';
import { format as formatDate } from 'date-fns';
import { isEmpty } from '@ember/utils';

// Helper: format VND – "19.829.000 đ"
const fmtVND = (amount) => {
    const num = parseFloat(amount) || 0;
    const abs = Math.abs(num);
    const formatted = Math.round(abs).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return (num < 0 ? '-' : '') + formatted + ' đ';
};

export default class ManagementDebtReportController extends BaseController {
    @service store;
    @service fetch;
    @service intl;
    @service notifications;

    @tracked customers = [];
    @tracked selectedCustomer = null;
    @tracked startDate = this.formatDateToInput(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
    @tracked endDate = this.formatDateToInput(new Date());
    @tracked results = [];
    @tracked isLoading = false;

    // ---------------- Pagination (client-side) ----------------
    @tracked page = 1;
    @tracked pageSize = 20;
    pageSizeOptions = [10, 20, 50, 100];

    // ---------------- Column resize (client-side) ----------------
    @tracked columnWidths = [
        6,   // Ngày
        7,   // Số xe
        9,   // Tên hàng
        10,  // Khách hàng
        12,  // Nơi nhận
        12,  // Nơi giao
        5,   // Số lượng
        8,   // Đơn giá
        9,   // Thành tiền
        8,   // Trạng thái
        14,  // Ghi chú
    ];

    _resizeState = null;

    @computed('columnWidths.[]')
    get colStyles() {
        return (this.columnWidths || []).map((w) => htmlSafe(`width:${w}%;`));
    }

    @action startColumnResize(index, event) {
        event.preventDefault();
        event.stopPropagation();
        const th = event.target.closest('th');
        const tableEl = th?.closest('table');
        const tableWidth = tableEl?.getBoundingClientRect().width || 1000;
        const startX = event.clientX;
        const startWidth = this.columnWidths[index] || 5;
        this._resizeState = { index, startX, startWidth, tableWidth };

        const onMove = (e) => {
            if (!this._resizeState) return;
            const dx = e.clientX - this._resizeState.startX;
            const dxPct = (dx / this._resizeState.tableWidth) * 100;
            const next = Math.max(3, this._resizeState.startWidth + dxPct);
            const widths = [...this.columnWidths];
            widths[this._resizeState.index] = next;
            this.columnWidths = widths;
        };

        const onUp = () => {
            this._resizeState = null;
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            document.body.classList.remove('select-none', 'cursor-col-resize');
        };

        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
        document.body.classList.add('select-none', 'cursor-col-resize');
    }

    // ---------------- Pagination computed ----------------
    @computed('results', 'pageSize')
    get totalPages() {
        return Math.max(1, Math.ceil((this.results?.length || 0) / this.pageSize));
    }

    @computed('results', 'page', 'pageSize')
    get paginatedResults() {
        const start = (this.page - 1) * this.pageSize;
        return (this.results || []).slice(start, start + this.pageSize);
    }

    @computed('results', 'page', 'pageSize')
    get pageStartIndex() {
        if (!this.results?.length) return 0;
        return (this.page - 1) * this.pageSize + 1;
    }

    @computed('results', 'page', 'pageSize')
    get pageEndIndex() {
        return Math.min(this.page * this.pageSize, this.results?.length || 0);
    }

    @computed('results', 'page', 'pageSize', 'totalPages', 'pageStartIndex', 'pageEndIndex')
    get meta() {
        return {
            from: this.pageStartIndex,
            to: this.pageEndIndex,
            total: this.results?.length || 0,
            current_page: this.page,
            last_page: this.totalPages,
            per_page: this.pageSize,
        };
    }

    // ---------------- Summary computed ----------------
    @computed('results')
    get totalIncomeValue() {
        return (this.results || [])
            .filter((r) => r.type === 'debt_estimate')
            .reduce((sum, r) => sum + parseFloat(r.amount || 0), 0);
    }

    @computed('results')
    get totalExpenseValue() {
        return (this.results || [])
            .filter((r) => r.type === 'debt_received')
            .reduce((sum, r) => sum + parseFloat(r.amount || 0), 0);
    }

    @computed('totalIncomeValue', 'totalExpenseValue')
    get totalProfitValue() {
        return this.totalIncomeValue - this.totalExpenseValue;
    }

    @computed('totalIncomeValue')
    get totalIncome() {
        return fmtVND(this.totalIncomeValue);
    }

    @computed('totalExpenseValue')
    get totalExpense() {
        return fmtVND(this.totalExpenseValue);
    }

    @computed('totalProfitValue')
    get totalProfit() {
        return fmtVND(this.totalProfitValue);
    }

    // ---------------- Actions ----------------
    @computed('page', 'totalPages')
    get pageItems() {
        const total = this.totalPages;
        const current = this.page;
        const items = [];
        const push = (p) => items.push({ label: p, page: p, isCurrent: p === current, isEllipsis: false });
        const ellipsis = () => items.push({ label: '…', page: null, isCurrent: false, isEllipsis: true });
        if (total <= 7) {
            for (let i = 1; i <= total; i++) push(i);
            return items;
        }
        push(1);
        if (current > 4) ellipsis();
        const from = Math.max(2, current - 2);
        const to = Math.min(total - 1, current + 2);
        for (let i = from; i <= to; i++) push(i);
        if (current < total - 3) ellipsis();
        push(total);
        return items;
    }

    @action gotoPage(p) {
        const n = Number(p);
        if (!n || n < 1 || n > this.totalPages) return;
        this.page = n;
    }

    @action nextPage() {
        if (this.page < this.totalPages) this.page += 1;
    }

    @action prevPage() {
        if (this.page > 1) this.page -= 1;
    }

    @action setPageSize(event) {
        const v = parseInt(event.target.value, 10);
        if (!Number.isNaN(v) && v > 0) {
            this.pageSize = v;
            this.page = 1;
        }
    }

    constructor() {
        super(...arguments);
        this.loadCustomers();
    }

    async loadCustomers() {
        try {
            this.customers = await this.store.findAll('contact');
        } catch (error) {
            this.notifications.error('Không thể tải danh sách Khách hàng');
        }
    }

    formatDateToInput(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    @action
    updateSelectedCustomer(customer) {
        this.selectedCustomer = customer || null;
    }

    @action
    updateStartDate(event) {
        this.startDate = event.target.value;
    }

    @action
    updateEndDate(event) {
        this.endDate = event.target.value;
    }

    @action
    async viewDetail(record) {
        if (!record?.record_public_id) return;
        try {
            const model = await this.store.queryRecord('order', {
                public_id: record.record_public_id,
                single: true,
                with: ['payload', 'driverAssigned', 'orderConfig', 'customer', 'trackingStatuses', 'trackingNumber'],
            });
            return this.transitionToRoute('operations.orders.index.view', model);
        } catch (error) {
            this.notifications.error('Không thể mở chi tiết đơn hàng: ' + error.message);
        }
    }

    @action
    openCreateOverlay() {
        return this.transitionToRoute('management.debt-reports.index.new');
    }

    @action
    async search(event) {
        event.preventDefault();
        return this.doSearch();
    }

    async doSearch() {
        this.page = 1;
        this.isLoading = true;

        let loadingNotice = this.notifications.info('Đang lấy dữ liệu công nợ ...', { autoClear: false });
        try {
            var orders = null;
            var contactDebts = null;

            try {
                orders = await this.fetch.get(`orders/finance`, {
                    customer_id: this.selectedCustomer ? this.selectedCustomer.uuid : '',
                    is_receive_cash_fees: 0,
                    is_finish: 1,
                    start_date: this.startDate,
                    end_date: this.endDate,
                });
            } catch (error) {
                this.notifications.error('Lỗi order: ' + error);
            }

            try {
                contactDebts = await this.fetch.get(`contact-debts/get`, {
                    contact_uuid: this.selectedCustomer ? this.selectedCustomer.uuid : '',
                    start_date: this.startDate,
                    end_date: this.endDate,
                });
            } catch (error) {
                this.notifications.error('Lỗi lấy thông tin công nợ: ' + error);
            }

            const results = [];
            orders = orders?.data ?? [];
            contactDebts = contactDebts?.data ?? [];

            orders.forEach((order) => {
                results.push({
                    date: formatDate(new Date(order.started_at), 'yyyy-MM-dd'),
                    type: 'debt_estimate',
                    plate_number: order.vehicle_assigned
                        ? order.vehicle_assigned.plate_number || order.vehicle_assigned.display_name || ''
                        : '',
                    sku_name: order.payload.entities?.length > 0 ? order.payload.entities[0].name : '',
                    customerName: order.customer ? order.customer.name : '',
                    pickup: order.payload.pickup
                        ? isEmpty(order.payload.pickup.city)
                            ? order.payload.pickup.address
                            : ''
                        : '',
                    dropoff: order.payload.dropoff
                        ? isEmpty(order.payload.dropoff.city)
                            ? order.payload.dropoff.address
                            : ''
                        : '',
                    quantity_fees: order.quantity_fees,
                    unit_price_fees_display: fmtVND(order.unit_price_fees),
                    amount: order.quantity_fees * order.unit_price_fees,
                    amount_display: fmtVND(order.quantity_fees * order.unit_price_fees),
                    record_type: 'order',
                    record_public_id: order.public_id,
                    note: `Đơn hàng # ${order.public_id.replace('order_', '')}`,
                });
            });

            contactDebts.forEach((debt) => {
                // Map contact_uuid → tên khách hàng từ danh sách đã load
                const matchedCustomer = (this.customers || []).find((c) => c.uuid === debt.contact_uuid || c.id === debt.contact_uuid);
                const customerName = matchedCustomer?.name || this.selectedCustomer?.name || '';

                results.push({
                    date: formatDate(new Date(debt.received_at), 'yyyy-MM-dd'),
                    type: 'debt_received',
                    plate_number: '',
                    sku_name: '',
                    customerName,
                    pickup: '',
                    dropoff: '',
                    quantity_fees: '',
                    unit_price_fees_display: '',
                    amount: debt.amount,
                    amount_display: fmtVND(debt.amount),
                    note: debt.note,
                });
            });

            results.sort((a, b) => new Date(a.date) - new Date(b.date));
            this.results = results;

            this.notifications.removeNotification(loadingNotice);
            if (this.results.length === 0) {
                this.notifications.success('Đã tổng hợp dữ liệu thành công nhưng không có data phù hợp!');
            } else {
                this.notifications.success('Đã tổng hợp dữ liệu thành công!');
            }
        } catch (error) {
            this.notifications.error('Lỗi khi tìm kiếm dữ liệu công nợ: ' + error);
        } finally {
            this.isLoading = false;
        }
    }
}

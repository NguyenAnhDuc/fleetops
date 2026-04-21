import BaseController from '@fleetbase/fleetops-engine/controllers/base-controller';
import { inject as service } from '@ember/service';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
import { computed } from '@ember/object';
import { htmlSafe } from '@ember/template';
import { format as formatDate, isValid as isValidDate, formatDistanceToNow } from 'date-fns';
import formatCurrency from '@fleetbase/ember-ui/utils/format-currency';
import { isEmpty } from '@ember/utils';

// Helper: format VND – "19.829.000 đ" (dấu chấm ngăn nghìn, ký hiệu đ sau)
const fmtVND = (amount) => {
    const num = parseFloat(amount) || 0;
    const abs = Math.abs(num);
    const formatted = Math.round(abs).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return (num < 0 ? '-' : '') + formatted + ' đ';
};

export default class ManagementFinanceController extends BaseController {
    @service store;
    @service fetch;
    @service intl;
    @service notifications;

    @tracked vehicles = [];
    @tracked customers = [];
    @tracked selectedVehicle = null;
    @tracked selectedCustomer = null;
    @tracked startDate = null;
    @tracked endDate = null;
    @tracked results = [];
    @tracked startDate = this.formatDateToInput(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
    @tracked endDate = this.formatDateToInput(new Date());
    @tracked isLoading = false;

    // ---------------- Pagination (client-side) ----------------
    @tracked page = 1;
    @tracked pageSize = 20;
    pageSizeOptions = [10, 20, 50, 100];

    // ---------------- Column resize (client-side, percent widths) ----------------
    // Độ rộng cột tính bằng % của table (table-layout: fixed + table width: 100%).
    // Tổng mặc định = 100% -> fit vừa viewport, KHÔNG cần scrollbar ngang.
    // Khi user kéo to ra, tổng có thể > 100% -> mới xuất hiện horizontal scroll.
    @tracked columnWidths = [
        5,   // Ngày       (nhỏ lại, yyyy-MM-dd vừa đủ)
        6,   // Hàng
        7,   // Phương tiện (chỉ biển số ~8-10 ký tự)
        8,   // Khách hàng
        9,   // Nơi nhận
        9,   // Nơi trả
        4,   // Tải trọng
        7,   // Cước        (to hơn để dễ đọc tiền)
        8,   // Thành tiền  (to hơn)
        7,   // Chi phí     (to hơn)
        6,   // LX thu      (to hơn)
        5,   // LX ứng      (to hơn)
        5,   // LX nộp      (to hơn)
        6,   // Đổ dầu      (to hơn)
        8,   // Mô tả       (nhỏ lại)
    ];

    _resizeState = null;

    /**
     * Trả về mảng htmlSafe("width: N%;") dành cho <col>, tránh warning của Ember
     * khi bind trực tiếp style động.
     */
    @computed('columnWidths.[]')
    get colStyles() {
        return (this.columnWidths || []).map((w) => htmlSafe(`width:${w}%;`));
    }

    @action startColumnResize(index, event) {
        event.preventDefault();
        event.stopPropagation();

        // Lấy width thực tế của container để quy đổi px -> %
        const th = event.target.closest('th');
        const tableEl = th?.closest('table');
        const tableWidth = tableEl?.getBoundingClientRect().width || 1000;

        const startX = event.clientX;
        const startWidth = this.columnWidths[index] || 5;
        this._resizeState = { index, startX, startWidth, tableWidth };

        const onMove = (e) => {
            if (!this._resizeState) return;
            const dx = e.clientX - this._resizeState.startX;
            // Quy đổi px sang % tương đối so với bề rộng bảng lúc bắt đầu kéo.
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

    @computed('results.length', 'pageSize')
    get totalPages() {
        const total = this.results?.length || 0;
        return Math.max(1, Math.ceil(total / this.pageSize));
    }

    @computed('results.[]', 'page', 'pageSize')
    get paginatedResults() {
        const start = (this.page - 1) * this.pageSize;
        return (this.results || []).slice(start, start + this.pageSize);
    }

    @computed('results.length', 'page', 'pageSize')
    get pageStartIndex() {
        if (!this.results?.length) return 0;
        return (this.page - 1) * this.pageSize + 1;
    }

    @computed('results.length', 'page', 'pageSize')
    get pageEndIndex() {
        const total = this.results?.length || 0;
        return Math.min(this.page * this.pageSize, total);
    }

    /**
     * Meta object consumed by the shared <Pagination> component.
     * Shape matches the convention used across Fleetbase list screens
     * (drivers list, etc.).
     */
    @computed('results.length', 'page', 'pageSize', 'totalPages', 'pageStartIndex', 'pageEndIndex')
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

    /**
     * Sinh danh sách số trang hiển thị — tối đa 7 nút, có "..." ở giữa.
     *
     * @return {Array<{label: string|number, page: number|null, isCurrent: boolean, isEllipsis: boolean}>}
     */
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
        this.loadVehicles();
        // this.loadCustomers();
    }

    async loadVehicles() {
        try {
            this.vehicles = await this.store.findAll('vehicle');
        } catch (error) {
            this.notifications.error('Không thể tải danh sách xe');
        }
    }

    async loadCustomers(){
        try{
            this.customers = await this.store.findAll('contact');
        }catch(error){
            this.notifications.error('Không thể tải danh sách Khách hàng');
        }
    }

    formatDateToInput(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0'); // getMonth() là 0-11
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    @computed('results')
    get totalIncomeValue() {
        return this.results
            .filter((r) => r.type === 'thu_tienmat' || r.type === 'thu_congno')
            .reduce((sum, r) => sum + parseFloat(r.amount || 0), 0);
    }

    @computed('results')
    get totalIncome_ReceiveValue() {
        return this.results
            .filter((r) => r.type === 'thu_tienmat' || r.type === 'thu_congno')
            .reduce((sum, r) => sum + parseFloat(r.laixe_thu || 0), 0);
    }

    @computed('totalIncomeValue')
    get totalIncome() {
        return fmtVND(this.totalIncomeValue);
    }

    @computed('totalIncome_ReceiveValue')
    get totalIncome_Receive() {
        return fmtVND(this.totalIncome_ReceiveValue);
    }

    @computed('totalIncomeValue', 'totalIncome_ReceiveValue')
    get totalDiffIncomeReceiveValue() {
        return this.totalIncome_ReceiveValue - this.totalIncomeValue;
    }

    @computed('totalDiffIncomeReceiveValue')
    get totalDiffIncomeReceive() {
        return fmtVND(this.totalDiffIncomeReceiveValue);
    }

    @computed('results')
    get totalExpenseValue() {
        return this.results
        .reduce((sum, r) => sum + parseFloat(r.chiphi || 0) + parseFloat(r.do_dau || 0), 0);
    }

    @computed('totalExpenseValue')
    get totalExpense() {
        return fmtVND(this.totalExpenseValue);
    }

    @computed('results')
    get tien_tonValue(){
        return this.results
                .filter((r) => r.type === 'thu_tienmat' || r.type === 'thu_congno')
                .reduce((sum, r) => sum + parseFloat(r.laixe_thu || 0)
                            + parseFloat(r.laixe_ung || 0)
                            - parseFloat(r.chiphi || 0)
                            - parseFloat(r.laixe_nop || 0),0);
    }

    @computed('tien_tonValue')
    get tien_ton(){
        return fmtVND(this.tien_tonValue);
    }

    @computed('totalIncomeValue', 'totalExpenseValue')
    get lai_loValue(){
        return this.totalIncomeValue - this.totalExpenseValue;
    }

    @computed('lai_loValue')
    get lai_lo(){
        return fmtVND(this.lai_loValue);
    }

    @action
    updateSelectedVehicle(vehicle) {
        this.selectedVehicle = vehicle || null;
    }

    @action
    updateSelectedCustomer(customer) {
        if(customer){
            this.selectedCustomer = customer;
        }
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
    openCreateOverlay() {
        return this.transitionToRoute('management.finances.index.new');
    }

    @action
    async viewDetail(record) {
        if (!record || !record.record_public_id) return;

        try {
            if (record.record_type === 'fuel-report') {
                const model = await this.store.queryRecord('fuel-report', {
                    public_id: record.record_public_id,
                    single: true,
                    with: ['driver', 'vehicle', 'reporter'],
                });
                return this.transitionToRoute('management.fuel-reports.index.details', model);
            }
            if (record.record_type === 'issue') {
                const model = await this.store.queryRecord('issue', {
                    public_id: record.record_public_id,
                    single: true,
                    with: ['driver', 'vehicle', 'assignee', 'reporter'],
                });
                return this.transitionToRoute('management.issues.index.details', model);
            }
            if (record.record_type === 'order') {
                const model = await this.store.queryRecord('order', {
                    public_id: record.record_public_id,
                    single: true,
                    with: ['payload', 'driverAssigned', 'orderConfig', 'customer', 'trackingStatuses', 'trackingNumber'],
                });
                return this.transitionToRoute('operations.orders.index.view', model);
            }
        } catch (error) {
            this.notifications.error('Không thể mở chi tiết: ' + error.message);
        }
    }

    @action
    async search(event) {
        event.preventDefault();

        // reset pagination về trang đầu mỗi lần search mới
        this.page = 1;
        this.isLoading = true;

        // Giả sử có API hoặc model để lấy dữ liệu thu chi theo xe và khoảng thời gian
        // Mình sẽ lấy dữ liệu đơn hàng (thu) và chi phí (chi) rồi gộp lại
        // Hiển thị thông báo đang load
        let loadingNotice = this.notifications.info("Đang lấy dữ liệu để tổng hợp báo cáo thu chi ...", { autoClear: false });

        try {
            var orders = null;
            var fuelReports = null;
            var issues = null;
            try{
                // Lấy đơn hàng (thu)
                orders = await this.fetch.get(`orders/finance`,{
                    vehicle_id: this.selectedVehicle ? this.selectedVehicle.uuid : '',
                    //is_receive_cash_fees: 0, //Chỉ lấy những đơn hàng là thanh toán tiền mặt
                    is_finish: 1,
                    start_date: this.startDate,
                    end_date: this.endDate,
                });
            }catch (error) {
                this.notifications.error("Lỗi order:" + error);
            }

            try{
                fuelReports = await this.fetch.get(`fuel-reports/finance`,{
                    vehicle_id: this.selectedVehicle ? this.selectedVehicle.uuid : '',
                    start_date: this.startDate,
                    end_date: this.endDate,
                });
            }catch (error){
                this.notifications.error("Lỗi fuel-report:" + error);
            }
            
            try{
                issues = await this.fetch.get(`issues/finance`,{
                    vehicle_id: this.selectedVehicle ? this.selectedVehicle.uuid : '',
                    start_date: this.startDate,
                    end_date: this.endDate,
                });
            }catch(error){
                this.notifications.error("Lỗi issues:" + error);
            }

            // Gộp dữ liệu thu chi
            const results = [];
            orders = orders?.data ?? [];
            fuelReports = fuelReports?.data ?? [];
            issues = issues?.data ?? [];
            orders.forEach((order) => {
                results.push({
                    date: formatDate(new Date(order.started_at), 'yyyy-MM-dd'),
                    type: order.is_receive_cash_fees ? 'thu_tienmat' : 'thu_congno',
                    record_type: 'order',
                    record_public_id: order.public_id,
                    plate_number: order.vehicle_assigned ? (order.vehicle_assigned.plate_number || '') : "",
                    sku_name: order.payload.entities ? (order.payload.entities.length > 0 ? order.payload.entities[0].name : "") : "",
                    customerName: order.customer? order.customer.name : "",
                    pickup: order.payload.pickup? (isEmpty(order.payload.pickup.city)? order.payload.pickup.address : "") : "",
                    dropoff: order.payload.dropoff? (isEmpty(order.payload.dropoff.city)?  order.payload.dropoff.address : "") : "",
                    weight_unit: order.payload.entities ? (order.payload.entities.length > 0 ? order.payload.entities[0].weight_unit : "") : "",
                    quantity_fees: order.quantity_fees,
                    unit_price_fees: order.unit_price_fees,
                    unit_price_fees_display: fmtVND(order.unit_price_fees),
                    amount: order.quantity_fees * order.unit_price_fees,
                    amount_display: fmtVND(order.quantity_fees * order.unit_price_fees),
                    chiphi:order.approval_fees,
                    chiphi_display: fmtVND(order.approval_fees),
                    laixe_thu: order.driver_earnings,
                    laixe_thu_display: fmtVND(order.driver_earnings),
                    laixe_ung: order.driver_advance_fee,
                    laixe_ung_display: fmtVND(order.driver_advance_fee),
                    laixe_nop: order.driver_remittance,
                    laixe_nop_display: fmtVND(order.driver_remittance),
                    do_dau: 0,
                    do_dau_display: "",
                    note: (order.is_receive_cash_fees ? 'Tiền mặt' : 'Công Nợ') + ` # ${order.public_id.replace('order_','')}`,

                });
            });

            fuelReports.forEach((fuel) => {
                results.push({
                    date: formatDate(new Date(fuel.created_at), 'yyyy-MM-dd'),
                    type: 'chi',
                    record_type: 'fuel-report',
                    record_public_id: fuel.public_id,
                    note: 'Chi phí nhiên liệu',
                    do_dau: (parseFloat(fuel.amount) || 0) + (parseFloat(fuel.amount_extra) || 0),
                    do_dau_display: fmtVND((parseFloat(fuel.amount) || 0) + (parseFloat(fuel.amount_extra) || 0)),
                    plate_number: fuel.vehicle_plate_number || '',
                    customerName: "",
                    sku_name: "",
                    pickup: "",
                    weight_unit: "",
                    quantity_fees: "",
                    chiphi: 0,

                });
            });

            issues.forEach((issue) => {
                results.push({
                    date: formatDate(new Date(issue.created_at), 'yyyy-MM-dd'),
                    type: 'chi',
                    record_type: 'issue',
                    record_public_id: issue.public_id,
                    note: 'Chi phí chung',
                    chiphi: issue.total_money,
                    chiphi_display: fmtVND(issue.total_money),
                    plate_number: issue.vehicle_plate_number || '',
                    customerName: "",
                    sku_name: "",
                    pickup: "",
                    weight_unit: ""
                });
            });

            // Sắp xếp theo ngày
            results.sort((a, b) => new Date(a.date) - new Date(b.date));
            this.results = results;

            // Clear hoặc update thông báo khi xong
            this.notifications.removeNotification(loadingNotice);

            if(this.results.length === 0){
                this.notifications.success("Đã tổng hợp dữ liệu thành công nhưng không có data phù hợp!");
            }else{
                this.notifications.success("Đã tổng hợp dữ liệu thành công!");
            }
        } catch (error) {
            this.notifications.error("Lỗi khi tìm kiếm dữ liệu thu chi: "+ error);
        } finally {
            this.isLoading = false;
        }
    }
}
import BaseController from '@fleetbase/fleetops-engine/controllers/base-controller';
import { inject as service } from '@ember/service';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
import { computed } from '@ember/object';
import { format as formatDate, isValid as isValidDate, formatDistanceToNow } from 'date-fns';
import formatCurrency from '@fleetbase/ember-ui/utils/format-currency';
import { isEmpty } from '@ember/utils';

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
        return formatCurrency(this.totalIncomeValue, "VND").replace('₫', '');
    }

    @computed('totalIncome_ReceiveValue')
    get totalIncome_Receive() {
        return formatCurrency(this.totalIncome_ReceiveValue, "VND").replace('₫', '');
    }

    @computed('totalIncomeValue', 'totalIncome_ReceiveValue')
    get totalDiffIncomeReceiveValue() {
        return this.totalIncome_ReceiveValue - this.totalIncomeValue;
    }

    @computed('totalDiffIncomeReceiveValue')
    get totalDiffIncomeReceive() {
        return formatCurrency(this.totalDiffIncomeReceiveValue, "VND").replace('₫', '');
    }

    @computed('results')
    get totalExpense() {
        return formatCurrency(this.results
            .reduce((sum, r) => sum + parseFloat(r.chiphi || 0) 
                            + parseFloat(r.do_dau || 0), 0), "VND").replace('₫', '');
    }

    @action
    updateSelectedVehicle(vehicle) {
        if(vehicle){
            this.selectedVehicle = vehicle;
            console.log(this.selectedVehicle);
        }
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
    async search(event) {
        event.preventDefault();

        // if (!this.selectedVehicleId) {
        //     this.notifications.error(this.intl.t('Vui lòng chọn xe'));
        //     return;
        // }

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
                    plate_number: order.vehicle_assigned ? order.vehicle_assigned.display_name : "",
                    sku_name: order.payload.entities ? (order.payload.entities.length > 0 ? order.payload.entities[0].name : "") : "",
                    customerName: order.customer? order.customer.name : "",
                    pickup: order.payload.pickup? (isEmpty(order.payload.pickup.city)? order.payload.pickup.address : "") : "",
                    dropoff: order.payload.dropoff? (isEmpty(order.payload.dropoff.city)?  order.payload.dropoff.address : "") : "",
                    weight_unit: order.payload.entities ? (order.payload.entities.length > 0 ? order.payload.entities[0].weight_unit : "") : "",
                    quantity_fees: order.quantity_fees,
                    unit_price_fees: order.unit_price_fees,
                    unit_price_fees_display: formatCurrency(order.unit_price_fees, "VND").replace('₫', ''),
                    amount: order.quantity_fees * order.unit_price_fees,
                    amount_display: formatCurrency(order.quantity_fees * order.unit_price_fees, "VND").replace('₫', ''),
                    chiphi:order.approval_fees,
                    chiphi_display: formatCurrency(order.approval_fees, "VND").replace('₫', ''),
                    laixe_thu: order.driver_earnings,
                    laixe_thu_display: formatCurrency(order.driver_earnings, "VND").replace('₫', ''),
                    laixe_ung: order.driver_advance_fee,
                    laixe_ung_display: formatCurrency(order.driver_advance_fee, "VND").replace('₫', ''),
                    laixe_nop: order.driver_remittance,
                    laixe_nop_display: formatCurrency(order.driver_remittance, "VND").replace('₫', ''),
                    do_dau: 0,
                    do_dau_display: "",
                    note: order.is_receive_cash_fees ? 'Thu Tiền mặt' : 'Tính Công Nợ',
                });
            });

            fuelReports.forEach((fuel) => {
                results.push({
                    date: formatDate(new Date(fuel.created_at), 'yyyy-MM-dd'),
                    type: 'chi',
                    note: 'Chi phí nhiên liệu',
                    do_dau: fuel.amount,
                    do_dau_display: formatCurrency(fuel.amount, "VND").replace('₫', ''),
                    plate_number: fuel.vehicle_name,
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
                    description: 'Chi phí sửa xe',
                    chiphi: issue.total_money,
                    chiphi_display: formatCurrency(issue.total_money, "VND").replace('₫', ''),
                    plate_number: issue.vehicle_name,
                    customerName: "",
                    sku_name: "",
                    pickup: "",
                    weight_unit: "",
                    chiphi: 0

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
        }
    }
}
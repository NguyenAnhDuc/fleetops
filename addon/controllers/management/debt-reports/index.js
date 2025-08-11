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
        //this.loadVehicles();
        this.loadCustomers();
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
    get totalIncome() {
        return formatCurrency(this.results
            .filter((r) => r.type === 'debt_received')
            .reduce((sum, r) => sum + parseFloat(r.amount || 0), 0), "VND");
    }

    @computed('results')
    get totalExpense() {
        return formatCurrency(this.results
            .filter((r) => r.type === 'debt_estimate')
            .reduce((sum, r) => sum + parseFloat(r.amount || 0), 0), "VND");
    }

    @action
    updateSelectedVehicle(vehicle) {
        if(vehicle){
            this.selectedVehicle = vehicle;
        }
    }

    @action
    updateSelectedCustomer(customer) {
        if(customer){
            this.selectedCustomer = customer;
            console.log(this.selectedCustomer);
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
        return this.transitionToRoute('management.debt-reports.index.new');
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
        let loadingNotice = this.notifications.info("Đang lấy dữ liệu công nợ ...", { autoClear: false });
        try {
            var orders = null;
            var contactDebts = null;
            try {
                // Lấy đơn hàng (thu)
                orders = await this.fetch.get(`orders/finance`,{
                    //vehicle_id: this.selectedVehicle ? this.selectedVehicle.uuid : '',
                    customer_id: this.selectedCustomer? this.selectedCustomer.uuid : '',
                    is_receive_cash_fees: 1, //Chỉ lấy những đơn hàng là công nợ
                    is_finish: 1,
                    start_date: this.startDate,
                    end_date: this.endDate,
                });

            }catch (error) {
                this.notifications.error("Lỗi order:" + error);
            }

            //Lấy thông tin công nợ
            try{
                contactDebts = await this.fetch.get(`contact-debts/get`,{
                    contact_uuid: this.selectedCustomer? this.selectedCustomer.uuid : '',
                    start_date: this.startDate,
                    end_date: this.endDate,
                });
            }catch(error){
                this.notifications.error("Lỗi lấy thông tin công nợ:" + error);
            }
            
            console.log("contactDebts:" + contactDebts);

            // Gộp dữ liệu thu chi
            const results = [];
            orders = orders?.data ?? [];
            orders.forEach((order) => {
                results.push({
                    date: formatDate(new Date(order.started_at), 'yyyy-MM-dd'),
                    type: 'debt_estimate',
                    plate_number: order.vehicle_assigned ? order.vehicle_assigned.display_name : "",
                    sku_name: order.payload.entities ? order.payload.entities[0].name : "",
                    customerName: order.customer? order.customer.name : "",
                    pickup: order.payload.pickup? (isEmpty(order.payload.pickup.city)? order.payload.pickup.address : "") : "",
                    dropoff: order.payload.dropoff? (isEmpty(order.payload.dropoff.city)?  order.payload.dropoff.address : "") : "",
                    weight_unit: order.payload.entities ? order.payload.entities[0].weight_unit : "",
                    quantity_fees: order.quantity_fees,
                    unit_price_fees: order.unit_price_fees,
                    amount: order.quantity_fees * order.unit_price_fees,
                    amount_display: formatCurrency(order.quantity_fees * order.unit_price_fees, "VND"),
                    note: "",
                });
            });

            contactDebts = contactDebts?.data ?? [];
            contactDebts.forEach((debt) => {
                results.push({
                    date: formatDate(new Date(debt.received_at), 'yyyy-MM-dd'),
                    type: 'debt_received',
                    note: debt.note,
                    amount: debt.amount,
                    amount_display: formatCurrency(debt.amount, "VND"),
                    plate_number: "",
                    customerName: ""
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
            this.notifications.error("Lỗi khi tìm kiếm dữ liệu công nợ: "+ error);
        }
    }
}
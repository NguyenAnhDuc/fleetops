import BaseController from '@fleetbase/fleetops-engine/controllers/base-controller';
import { inject as service } from '@ember/service';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
import { computed } from '@ember/object';
import { format as formatDate, isValid as isValidDate, formatDistanceToNow } from 'date-fns';
import formatCurrency from '@fleetbase/ember-ui/utils/format-currency';

export default class ManagementFinanceController extends BaseController {
    @service store;
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
    get totalIncome() {
        return formatCurrency(this.results
            .filter((r) => r.type === 'Thu')
            .reduce((sum, r) => sum + parseFloat(r.amount || 0), 0), "VND");
    }

    @computed('results')
    get totalExpense() {
        return formatCurrency(this.results
            .filter((r) => r.type === 'Chi')
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

        try {
            var orders = null;
            var fuelReports = null;
            try{
                // Lấy đơn hàng (thu)
                orders = await this.store.query('order', {
                    vehicle_assigned_uuid: this.selectedVehicle ? this.selectedVehicle.uuid : '',
                    // customer_id: this.selectedCustomer? this.selectedCustomer.uuid : null,
                    is_finish: 1,
                    start_date: this.startDate,
                    end_date: this.endDate,
                });
            }catch (error) {
                this.notifications.error("Lỗi order:" + error);
            }

            try{
                // Lấy chi phí (chi) - ví dụ fuel-report và sửa xe (issues)
                fuelReports = await this.store.query('fuel-report', {
                    vehicle_id: this.selectedVehicle ? this.selectedVehicle.uuid : null,
                    start_date: this.startDate,
                    end_date: this.endDate,
                });
            }catch (error){
                this.notifications.error("Lỗi fuel-report:" + error);
            }

            

            const issues = await this.store.query('issue', {
                vehicle_id: this.selectedVehicle ? this.selectedVehicle.uuid : null,
                start_date: this.startDate,
                end_date: this.endDate,
            });

            // Gộp dữ liệu thu chi
            const results = [];

            orders.forEach((order) => {
                results.push({
                    date: formatDate(order.created_at, 'yyyy-MM-dd'),
                    type: 'Thu',
                    description: `Đơn hàng #${order.internal_id}`,
                    amount: order.fees,
                    amount_display: formatCurrency(order.fees, "VND"),
                    plate_number: order.vehicle_assigned ? order.vehicle_assigned.display_name : ""
                });
            });

            fuelReports.forEach((fuel) => {
                results.push({
                    date: formatDate(fuel.created_at, 'yyyy-MM-dd'),
                    type: 'Chi',
                    description: 'Chi phí nhiên liệu',
                    amount: fuel.amount,
                    amount_display: formatCurrency(fuel.amount, "VND"),
                    plate_number: fuel.vehicle_name
                });
            });

            issues.forEach((issue) => {
                results.push({
                    date: formatDate(issue.created_at, 'yyyy-MM-dd'),
                    type: 'Chi',
                    description: 'Chi phí sửa xe',
                    amount: issue.total_money,
                    amount_display: formatCurrency(issue.total_money, "VND"),
                    plate_number: issue.vehicle_name
                });
            });

            // Sắp xếp theo ngày
            results.sort((a, b) => new Date(a.date) - new Date(b.date));

            this.results = results;
        } catch (error) {
            this.notifications.error("Lỗi khi tìm kiếm dữ liệu thu chi");
        }
    }
}
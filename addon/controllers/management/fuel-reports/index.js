import BaseController from '@fleetbase/fleetops-engine/controllers/base-controller';
import { inject as service } from '@ember/service';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
import { isBlank } from '@ember/utils';
import { timeout } from 'ember-concurrency';
import { task } from 'ember-concurrency-decorators';

export default class ManagementFuelReportsIndexController extends BaseController {
    @service notifications;
    @service modalsManager;
    @service intl;
    @service crud;
    @service store;
    @service hostRouter;
    @service contextPanel;
    @service filters;
    @service loader;

    /**
     * Queryable parameters for this controller's model
     *
     * @var {Array}
     */
    queryParams = ['page', 'limit', 'sort', 'query', 'public_id', 'internal_id', 'vehicle', 'driver', 'created_by', 'updated_by', 'status', 'country', 'volume', 'odometer'];

    /**
     * The current page of data being viewed
     *
     * @var {Integer}
     */
    @tracked page = 1;

    /**
     * The maximum number of items to show per page
     *
     * @var {Integer}
     */
    @tracked limit;

    /**
     * The param to sort the data on, the param with prepended `-` is descending
     *
     * @var {String}
     */
    @tracked sort = '-fueled_at';

    /**
     * The filterable param `public_id`
     *
     * @var {String}
     */
    @tracked public_id;

    /**
     * The filterable param `internal_id`
     *
     * @var {String}
     */
    @tracked internal_id;

    /**
     * The filterable param `driver`
     *
     * @var {String}
     */
    @tracked driver;

    /**
     * The filterable param `vehicle`
     *
     * @var {String}
     */
    @tracked vehicle;

    /**
     * The filterable param `vehicle`
     *
     * @var {String}
     */
    @tracked reporter;

    /**
     * The filterable param `vehicle`
     *
     * @var {String}
     */
    @tracked volume;

    /**
     * The filterable param `vehicle`
     *
     * @var {String}
     */
    @tracked odometer;

    /**
     * The filterable param `status`
     *
     * @var {Array}
     */
    @tracked status;

    /**
     * All columns applicable for orders
     *
     * @var {Array}
     */
    @tracked columns = [
        {
            label: 'Ngày Đổ Dầu',
            valuePath: 'fueledAt',
            sortParam: 'fueled_at',
            width: '150px',
            resizable: true,
            sortable: true,
            filterable: true,
            filterComponent: 'filter/date',
        },
        {
            label: 'Tài xế',
            valuePath: 'driver_name',
            width: '120px',
            cellComponent: 'table/cell/anchor',
            permission: 'fleet-ops view driver',
            onClick: async (fuelReport) => {
                let driver = await fuelReport.loadDriver();

                if (driver) {
                    this.contextPanel.focus(driver);
                }
            },
            resizable: true,
            sortable: true,
            filterable: true,
            filterComponent: 'filter/model',
            filterComponentPlaceholder: 'Select driver',
            filterParam: 'driver',
            model: 'driver',
        },
        {
            label: 'Phương tiện',
            valuePath: 'vehicle_name',
            width: '120px',
            cellComponent: 'table/cell/anchor',
            permission: 'fleet-ops view vehicle',
            onClick: async (fuelReport) => {
                let vehicle = await fuelReport.loadVehicle();

                if (vehicle) {
                    this.contextPanel.focus(vehicle);
                }
            },
            resizable: true,
            sortable: true,
            filterable: true,
            filterComponent: 'filter/model',
            filterComponentPlaceholder: 'Select vehicle',
            filterParam: 'vehicle',
            model: 'vehicle',
            modelNamePath: 'displayName',
        },
        {
            label: 'Công tơ mét',
            valuePath: 'odometer',
            sortParam: 'odometer',
            width: '150px',
            cellComponent: 'table/cell/fuel-metric',
            differencePath: 'odometer_difference',
            differenceType: 'positive-green',
            resizable: true,
            sortable: true,
            filterable: true,
            hidden: false,
            filterComponent: 'filter/string',
        },
        {
            label: 'Thể tích',
            valuePath: 'volume',
            width: '130px',
            cellComponent: 'table/cell/fuel-metric',
            differencePath: 'volume_extra',
            differenceType: 'positive-green',
            resizable: true,
            sortable: true,
            filterable: true,
            hidden: false,
            filterComponent: 'filter/string',
        },
        {
            label: 'Đơn giá',
            valuePath: 'unit_price',
            width: '140px',
            cellComponent: 'table/cell/fuel-metric',
            currencyFormat: true,
            resizable: true,
            sortable: true,
            filterable: false,
        },
        {
            label: 'Chi phí',
            valuePath: 'amount',
            width: '180px',
            cellComponent: 'table/cell/fuel-metric',
            differencePath: 'amount_extra',
            differenceType: 'positive-green',
            currencyFormat: true,
            resizable: true,
            sortable: true,
            filterable: false,
        },
        {
            label: 'Trạng thái',
            valuePath: 'status',
            cellComponent: 'table/cell/status',
            width: '100px',
            resizable: true,
            sortable: true,
            filterable: true,
            filterComponent: 'filter/multi-option',
            filterOptions: ['draft', 'pending-approval', 'approved', 'rejected', 'revised', 'submitted', 'in-review', 'confirmed', 'processed', 'archived', 'cancelled'],
        },
        {
            label: '',
            cellComponent: 'table/cell/dropdown',
            ddButtonText: false,
            ddButtonIcon: 'ellipsis-h',
            ddButtonIconPrefix: 'fas',
            ddMenuLabel: 'Thao tác Báo cáo Nhiên liệu',
            cellClassNames: 'overflow-visible',
            wrapperClass: 'flex items-center justify-end mx-2',
            width: '10%',
            actions: [
                {
                    label: this.intl.t('fleet-ops.management.fuel-reports.index.view'),
                    fn: this.viewFuelReport,
                    permission: 'fleet-ops view fuel-report',
                },
                {
                    label: this.intl.t('fleet-ops.management.fuel-reports.index.edit-fuel'),
                    fn: this.editFuelReport,
                    permission: 'fleet-ops update fuel-report',
                },
                {
                    separator: true,
                },
                {
                    label: this.intl.t('fleet-ops.management.fuel-reports.index.delete'),
                    fn: this.deleteFuelReport,
                    permission: 'fleet-ops delete fuel-report',
                },
            ],
            sortable: false,
            filterable: false,
            resizable: false,
            searchable: false,
        },
    ];

    /**
     * The search task.
     *
     * @void
     */
    @task({ restartable: true }) *search({ target: { value } }) {
        // if no query don't search
        if (isBlank(value)) {
            this.query = null;
            return;
        }

        // timeout for typing
        yield timeout(250);

        // reset page for results
        if (this.page > 1) {
            this.page = 1;
        }

        // update the query param
        this.query = value;
    }

    /**
     * Toggles dialog to export a fuel report
     *
     * @void
     */
    @action exportFuelReports() {
        this.crud.export('fuel-report');
    }

    /**
     * Handles and prompts for spreadsheet imports of fuel report.
     *
     * @void
     */
    @action importFuelReports() {
        this.crud.import('fuel-report', {
            onImportCompleted: () => {
                this.hostRouter.refresh();
            },
        });
    }

    /**
     * View the selected fuel report
     *
     * @param {FuelReportModel} fuelReport
     * @param {Object} options
     * @void
     */
    @action viewFuelReport(fuelReport) {
        this.transitionToRoute('management.fuel-reports.index.details', fuelReport);
    }

    /**
     * Reload layout view.
     */
    @action reload() {
        return this.hostRouter.refresh();
    }

    /**
     * Create a new fuel report
     *
     * @void
     */
    @action createFuelReport() {
        this.transitionToRoute('management.fuel-reports.index.new');
    }

    /**
     * Edit a fuel report
     *
     * @param {FuelReportModel} fuelReport
     * @void
     */
    @action editFuelReport(fuelReport) {
        this.transitionToRoute('management.fuel-reports.index.edit', fuelReport);
    }

    /**
     * Prompt to delete a fuel report
     *
     * @param {FuelReportModel} fuelReport
     * @param {Object} options
     * @void
     */
    @action deleteFuelReport(fuelReport, options = {}) {
        this.crud.delete(fuelReport, {
            title: 'Bạn có chắc chắn muốn xoá báo cáo nhiên liệu này không?',
            acceptButtonText: 'Xác nhận',
            acceptButtonIcon: 'check',
            cancelButtonText: 'Hủy',
            cancelButtonIcon: 'times',
            successNotification: 'Đã xóa báo cáo nhiên liệu.',
            onConfirm: () => {
                this.hostRouter.refresh();
            },
            ...options,
        });
    }

    /**
     * Bulk deletes selected fuel report's via confirm prompt
     *
     * @param {Array} selected an array of selected models
     * @void
     */
    @action bulkDeleteFuelReports() {
        const selected = this.table.selectedRows;

        this.crud.bulkDelete(selected, {
            modelNamePath: `name`,
            title: 'Bạn có chắc chắn muốn xoá các báo cáo nhiên liệu đã chọn không?',
            acceptButtonText: 'Xác nhận',
            acceptButtonIcon: 'check',
            cancelButtonText: 'Hủy',
            cancelButtonIcon: 'times',
            successNotification: 'Các báo cáo nhiên liệu đã được xoá.',
            onSuccess: async () => {
                await this.hostRouter.refresh();
                this.table.untoggleSelectAll();
            },
        });
    }
}

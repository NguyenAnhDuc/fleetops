import BaseController from '@fleetbase/fleetops-engine/controllers/base-controller';
import { inject as service } from '@ember/service';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
import { isBlank } from '@ember/utils';
import { timeout } from 'ember-concurrency';
import { task } from 'ember-concurrency-decorators';

export default class ManagementVehicleTransfersIndexController extends BaseController {
    @service notifications;
    @service modalsManager;
    @service intl;
    @service crud;
    @service store;
    @service fetch;
    @service hostRouter;
    @service filters;

    /**
     * Queryable parameters
     *
     * @var {Array}
     */
    queryParams = ['page', 'limit', 'sort', 'query', 'public_id', 'status', 'from_vehicle', 'to_vehicle'];

    @tracked page = 1;
    @tracked limit;
    @tracked sort = '-transferred_at';
    @tracked query;
    @tracked public_id;
    @tracked status;
    @tracked from_vehicle;
    @tracked to_vehicle;

    /**
     * All columns for the vehicle money transfers table
     *
     * @var {Array}
     */
    @tracked columns = [
        {
            label: 'Ngày chuyển',
            valuePath: 'transferredAt',
            sortParam: 'transferred_at',
            width: '12%',
            resizable: true,
            sortable: true,
            filterable: true,
            filterComponent: 'filter/date',
        },
        {
            label: 'Người thực hiện',
            valuePath: 'created_by_name',
            width: '14%',
            resizable: true,
            sortable: false,
            filterable: false,
        },
        {
            label: 'Xe chuyển',
            valuePath: 'from_vehicle_name',
            width: '12%',
            resizable: true,
            sortable: false,
            filterable: true,
            filterComponent: 'filter/model',
            filterComponentPlaceholder: 'Chọn xe chuyển',
            filterParam: 'from_vehicle',
            model: 'vehicle',
            modelNamePath: 'displayName',
        },
        {
            label: 'Xe nhận',
            valuePath: 'to_vehicle_name',
            width: '12%',
            resizable: true,
            sortable: false,
            filterable: true,
            filterComponent: 'filter/model',
            filterComponentPlaceholder: 'Chọn xe nhận',
            filterParam: 'to_vehicle',
            model: 'vehicle',
            modelNamePath: 'displayName',
        },
        {
            label: 'Số tiền yêu cầu',
            valuePath: 'amountDisplay',
            width: '14%',
            resizable: true,
            sortable: true,
            sortParam: 'amount',
            filterable: false,
        },
        {
            label: 'Số tiền duyệt',
            valuePath: 'approvedAmountDisplay',
            width: '14%',
            resizable: true,
            sortable: true,
            sortParam: 'approved_amount',
            filterable: false,
        },
        {
            label: 'Tài xế chuyển',
            valuePath: 'from_driver_name',
            width: '130px',
            resizable: true,
            sortable: false,
            filterable: false,
            hidden: true,
        },
        {
            label: 'Tài xế nhận',
            valuePath: 'to_driver_name',
            width: '130px',
            resizable: true,
            sortable: false,
            filterable: false,
            hidden: true,
        },
        {
            label: 'Ghi chú',
            valuePath: 'note',
            width: '160px',
            resizable: true,
            sortable: false,
            filterable: false,
            hidden: false,
        },
        {
            label: 'Ghi chú duyệt',
            valuePath: 'approval_note',
            width: '160px',
            resizable: true,
            sortable: false,
            filterable: false,
            hidden: false,
        },
        {
            label: 'Trạng thái',
            valuePath: 'status',
            cellComponent: 'table/cell/status',
            width: '12%',
            resizable: true,
            sortable: true,
            filterable: true,
            filterComponent: 'filter/multi-option',
            filterOptions: ['pending', 'approved', 'rejected'],
        },
        {
            label: '',
            cellComponent: 'table/cell/dropdown',
            ddButtonText: false,
            ddButtonIcon: 'ellipsis-h',
            ddButtonIconPrefix: 'fas',
            ddMenuLabel: 'Thao tác chuyển tiền',
            cellClassNames: 'overflow-visible',
            wrapperClass: 'flex items-center justify-end mx-2',
            width: '10%',
            actions: [
                {
                    label: 'Duyệt lệnh chuyển',
                    fn: this.approveTransfer,
                    permission: 'fleet-ops update vehicle',
                },
                {
                    label: 'Từ chối',
                    fn: this.rejectTransfer,
                    permission: 'fleet-ops update vehicle',
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
        if (isBlank(value)) {
            this.query = null;
            return;
        }

        yield timeout(250);

        if (this.page > 1) {
            this.page = 1;
        }

        this.query = value;
    }

    /**
     * Reload layout view.
     */
    @action reload() {
        return this.hostRouter.refresh();
    }

    /**
     * Open the approval modal for a transfer.
     *
     * @param {VehicleMoneyTransferModel} transfer
     * @void
     */
    @action approveTransfer(transfer) {
        // Shared state: component ghi vào đây, controller đọc lúc confirm.
        // Khởi tạo sẵn = số tài xế yêu cầu để admin không sửa gì vẫn duyệt đúng số.
        const state = {
            approvedAmount: transfer.approved_amount ?? transfer.amount,
            approvalNote: transfer.approval_note,
        };

        this.modalsManager.show('modals/vehicle-transfer-approval-form', {
            title: 'Phê duyệt lệnh chuyển tiền',
            acceptButtonText: 'Duyệt',
            acceptButtonIcon: 'check',
            declineButtonText: 'Hủy',
            transfer,
            state,
            confirm: async (modal) => {
                modal.startLoading();
                try {
                    await this.fetch.post(`vehicle-money-transfers/${transfer.id}/approve`, {
                        approved_amount: state.approvedAmount,
                        approval_note: state.approvalNote,
                    });
                    this.notifications.success('Đã duyệt lệnh chuyển tiền.');
                    modal.done();
                    this.hostRouter.refresh();
                } catch (error) {
                    this.notifications.serverError(error);
                    modal.stopLoading();
                }
            },
        });
    }

    /**
     * Reject a transfer (with confirm).
     *
     * @param {VehicleMoneyTransferModel} transfer
     * @void
     */
    @action rejectTransfer(transfer) {
        // Shared state: component ghi lý do vào đây, controller đọc lúc confirm.
        const state = {
            rejectNote: transfer.approval_note ?? '',
        };

        this.modalsManager.show('modals/vehicle-transfer-reject-form', {
            title: 'Từ chối lệnh chuyển tiền',
            acceptButtonText: 'Từ chối',
            acceptButtonIcon: 'times',
            acceptButtonScheme: 'danger',
            declineButtonText: 'Hủy',
            transfer,
            state,
            confirm: async (modal) => {
                // Bắt buộc nhập lý do để lái xe biết vì sao bị từ chối.
                const note = (state.rejectNote || '').trim();
                if (!note) {
                    this.notifications.warning('Vui lòng nhập lý do từ chối để lái xe được biết.');
                    return;
                }

                modal.startLoading();
                try {
                    await this.fetch.post(`vehicle-money-transfers/${transfer.id}/reject`, {
                        approval_note: note,
                    });
                    this.notifications.success('Đã từ chối lệnh chuyển tiền.');
                    modal.done();
                    this.hostRouter.refresh();
                } catch (error) {
                    this.notifications.serverError(error);
                    modal.stopLoading();
                }
            },
        });
    }
}

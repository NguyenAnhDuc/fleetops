import Route from '@ember/routing/route';
import { inject as service } from '@ember/service';
import { action } from '@ember/object';

export default class ManagementDebtReportsIndexEditRoute extends Route {
    @service store;
    @service notifications;
    @service hostRouter;

    @action error(error) {
        this.notifications.serverError(error);
        return this.hostRouter.transitionTo('console.fleet-ops.management.debt-reports.index');
    }

    /**
     * Dùng public_id cho dynamic segment thay vì id mặc định.
     */
    serialize(model) {
        return { id: model.public_id ?? model.id };
    }

    /**
     * Load khoản công nợ cần sửa theo public_id (param `:id`).
     * Chỉ chạy khi vào bằng URL trực tiếp; khi bấm "Sửa" thì model được
     * truyền thẳng nên hook này được bỏ qua.
     *
     * @param {Object} params
     */
    model({ id }) {
        return this.store.queryRecord('contact-debt', {
            public_id: id,
            single: true,
        });
    }

    /**
     * Nếu rời màn sửa mà chưa lưu thì rollback các thay đổi trên record.
     */
    resetController(controller, isExiting) {
        if (isExiting && controller.model && controller.model.hasDirtyAttributes) {
            controller.model.rollbackAttributes();
        }
    }
}

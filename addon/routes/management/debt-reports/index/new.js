import Route from '@ember/routing/route';
import { inject as service } from '@ember/service';

export default class ManagementDebtReportsIndexNewRoute extends Route {
    @service store;

    /**
     * Reset form mỗi lần vào màn tạo mới để không còn dữ liệu cũ.
     *
     * @param {ManagementContactDebtIndexNewController} controller
     */
    setupController(controller) {
        super.setupController(...arguments);

        if (typeof controller.resetForm === 'function') {
            controller.resetForm();
        }
    }
}

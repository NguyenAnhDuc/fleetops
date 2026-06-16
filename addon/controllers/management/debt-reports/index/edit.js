import BaseController from '@fleetbase/fleetops-engine/controllers/base-controller';
import { tracked } from '@glimmer/tracking';
import { inject as service } from '@ember/service';
import { action } from '@ember/object';
import { getOwner } from '@ember/application';

export default class ManagementDebtReportsIndexEditController extends BaseController {
    @service store;
    @service hostRouter;
    @service intl;

    /**
     * The overlay component context.
     */
    @tracked overlay;

    @action setOverlayContext(overlay) {
        this.overlay = overlay;
    }

    @action transitionBack() {
        return this.transitionToRoute('management.debt-reports.index');
    }

    /**
     * Sau khi lưu: đóng popup, về list và reload lại search.
     */
    @action onAfterSave() {
        if (this.overlay) {
            this.overlay.close();
        }

        this.transitionToRoute('management.debt-reports.index').then(() => {
            try {
                const indexController = getOwner(this).lookup('controller:management/debt-reports/index');
                if (indexController && typeof indexController.doSearch === 'function') {
                    indexController.doSearch();
                }
            } catch (_) {
                // ignore nếu lookup thất bại
            }
        });
    }
}

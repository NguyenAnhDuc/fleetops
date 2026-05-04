import BaseController from '@fleetbase/fleetops-engine/controllers/base-controller';
import { tracked } from '@glimmer/tracking';
import { inject as service } from '@ember/service';
import { action } from '@ember/object';
import { getOwner } from '@ember/application';

export default class ManagementContactDebtIndexNewController extends BaseController {
    /**
     * Inject the `store` service
     *
     * @memberof ManagementContactDebtIndexNewController
     */
    @service store;

    /**
     * Inject the `hostRouter` service
     *
     * @memberof ManagementContactDebtIndexNewController
     */
    @service hostRouter;

    /**
     * Inject the `intl` service
     *
     * @memberof intl
     */
    @service intl;

    /**
     * Inject the `currentUser` service
     *
     * @memberof ManagementContactDebtIndexNewController
     */
    @service currentUser;

    /**
     * Inject the `hostRouter` service
     *
     * @memberof ManagementContactDebtIndexNewController
     */
    @service modalsManager;

    /**
     * The overlay component context.
     *
     * @memberof ManagementContactDebtIndexNewController
     */
    @tracked overlay;

    /**
     * The contactDebt being created.
     *
     * @var {ContactDebtModel}
     */
    @tracked contactDebt = this.store.createRecord('contactDebt', { 
        contact_uuid: null,
        amount: '',
        received_at: new Date(),
        note: ''
     });

    /**
     * Set the overlay component context object.
     *
     * @param {OverlayContext} overlay
     * @memberof ManagementContactDebtIndexNewController
     */
    @action setOverlayContext(overlay) {
        this.overlay = overlay;
    }

    /**
     * When exiting the overlay.
     *
     * @return {Transition}
     * @memberof ManagementContactDebtIndexNewController
     */
    @action transitionBack() {
        return this.transitionToRoute('management.debt-reports.index');
    }

    /**
     * Trigger a route refresh and focus the new issue created.
     *
     * @param {ContactDebtModel} contactDebt
     * @return {Promise}
     * @memberof ManagementContactDebtIndexNewController
     */
    @action onAfterSave() {
        if (this.overlay) {
            this.overlay.close();
        }

        // Reset form ngay lập tức để lần mở tiếp theo sạch data
        this.resetForm();

        // Quay về màn hình list
        this.transitionToRoute('management.debt-reports.index').then(() => {
            // Re-trigger search để load lại list với filter đang nhập
            try {
                const owner = getOwner(this);
                const indexController = owner.lookup('controller:management/debt-reports/index');
                if (indexController && indexController.results.length > 0) {
                    indexController.doSearch();
                }
            } catch (_) {
                // ignore nếu lookup thất bại
            }
        });
    }

    /**
     * Resets the form with a new issue record
     *
     * @memberof ManagementContactDebtIndexNewController
     */
    resetForm() {
        this.contactDebt = this.store.createRecord('contactDebt', { 
            contact_uuid: null,
            amount: 0,
            received_at: new Date(),
            note: ''    
        });
    }
}

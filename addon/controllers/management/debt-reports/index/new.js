import BaseController from '@fleetbase/fleetops-engine/controllers/base-controller';
import { tracked } from '@glimmer/tracking';
import { inject as service } from '@ember/service';
import { action } from '@ember/object';

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
    @action onAfterSave(contactDebt) {
        if (this.overlay) {
            this.overlay.close();
        }

        this.hostRouter.refresh();
        return this.transitionToRoute('management.debt-reports.index.details', contactDebt).then(() => {
            this.resetForm();
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

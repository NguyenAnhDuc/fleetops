import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { inject as service } from '@ember/service';
import { action } from '@ember/object';
import { isArray } from '@ember/array';
import { task } from 'ember-concurrency';
import contextComponentCallback from '@fleetbase/ember-core/utils/context-component-callback';
import applyContextComponentArguments from '@fleetbase/ember-core/utils/apply-context-component-arguments';

export default class ContactDebtFormPanelComponent extends Component {
    @service store;
    @service fetch;
    @service intl;
    @service notifications;
    @service hostRouter;
    @service contextPanel;
    
    /**
     * Accepted file types for image upload
     * @type {Array}
     */

    /**
     * Overlay context.
     * @type {any}
     */
    @tracked context;

    /**
     * Permission needed to update or create record.
     *
     * @memberof ContactDebtFormPanelComponent
     */
    @tracked savePermission;

    /**
     * The current controller if any.
     *
     * @memberof ContactDebtFormPanelComponent
     */
    @tracked controller;

    /**
     * Constructs the component and applies initial state.
     */
    constructor(owner, { contactDebt = null, controller }) {
        super(...arguments);
        
        this.contactDebt = contactDebt;
        this.controller = controller;
        this.savePermission = contactDebt && contactDebt.isNew ? 'fleet-ops create contactDebt' : 'fleet-ops update contactDebt';
        applyContextComponentArguments(this);
    }

    /**
     * Sets the overlay context.
     *
     * @action
     * @param {OverlayContextObject} overlayContext
     */
    @action setOverlayContext(overlayContext) {
        this.context = overlayContext;
        contextComponentCallback(this, 'onLoad', ...arguments);
    }

    /**
     * Task to save contactDebt.
     *
     * @return {void}
     * @memberof ContactDebtFormPanelComponent
     */
    @task *save() {
        contextComponentCallback(this, 'onBeforeSave', this.contactDebt);

        try {
            this.contactDebt = yield this.contactDebt.save();
        } catch (error) {
            this.notifications.serverError(error);
            return;
        }

        this.notifications.success(this.intl.t('fleet-ops.component.issue-form-panel.success-message'));
        contextComponentCallback(this, 'onAfterSave', this.contactDebt);
    }

    /**
     * View the details of the contactDebt.
     *
     * @action
     */
    @action onViewDetails() {
        const isActionOverrided = contextComponentCallback(this, 'onViewDetails', this.contactDebt);

        if (!isActionOverrided) {
            this.contextPanel.focus(this.contactDebt, 'viewing');
        }
    }

    /**
     * Handles cancel button press.
     *
     * @action
     * @returns {any}
     */
    @action onPressCancel() {
        return contextComponentCallback(this, 'onPressCancel', this.contactDebt);
    }
}

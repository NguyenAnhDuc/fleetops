import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { inject as service } from '@ember/service';
import { action } from '@ember/object';
import { isArray } from '@ember/array';
import { task } from 'ember-concurrency';
import getWithDefault from '@fleetbase/ember-core/utils/get-with-default';
import contextComponentCallback from '@fleetbase/ember-core/utils/context-component-callback';
import applyContextComponentArguments from '@fleetbase/ember-core/utils/apply-context-component-arguments';
import getIssueTypes from '../utils/get-issue-types';
import getIssueCategories from '../utils/get-issue-categories';

export default class FinanceFormPanelComponent extends Component {
    @service store;
    @service fetch;
    @service intl;
    @service notifications;
    @service hostRouter;
    @service contextPanel;
    
    /**
     * Overlay context.
     * @type {any}
     */
    @tracked context;

    /**
     * Permission needed to update or create record.
     *
     * @memberof FinanceFormPanelComponent
     */
    @tracked savePermission;

    /**
     * The current controller if any.
     *
     * @memberof FinanceFormPanelComponent
     */
    @tracked controller;

    /**
     * Constructs the component and applies initial state.
     */
    constructor(owner, { finance = null, controller }) {
        super(...arguments);
        this.finance = finance;
        this.controller = controller;
        this.savePermission = finance && finance.isNew ? 'fleet-ops create issue' : 'fleet-ops update issue';
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
     * Task to save issue.
     *
     * @return {void}
     * @memberof FinanceFormPanelComponent
     */
    @task *save() {
        contextComponentCallback(this, 'onBeforeSave', this.finance);

        try {
            this.finance = yield this.finance.save();
        } catch (error) {
            this.notifications.serverError(error);
            return;
        }

        this.notifications.success(this.intl.t('fleet-ops.component.issue-form-panel.success-message', { publicId: this.finance.public_id }));
        contextComponentCallback(this, 'onAfterSave', this.finance);
    }

    /**
     * Add a tag to the issue
     *
     * @param {String} tag
     * @memberof FinanceFormPanelComponent
     */
    @action addTag(tag) {
        if (!isArray(this.issue.tags)) {
            this.issue.tags = [];
        }

        this.issue.tags.pushObject(tag);
    }

    /**
     * Remove a tag from the issue tags.
     *
     * @param {Number} index
     * @memberof FinanceFormPanelComponent
     */
    @action removeTag(index) {
        this.issue.tags.removeAt(index);
    }

    /**
     * View the details of the finance.
     *
     * @action
     */
    @action onViewDetails() {
        const isActionOverrided = contextComponentCallback(this, 'onViewDetails', this.finance);

        if (!isActionOverrided) {
            this.contextPanel.focus(this.finance, 'viewing');
        }
    }

    /**
     * Handles cancel button press.
     *
     * @action
     * @returns {any}
     */
    @action onPressCancel() {
        return contextComponentCallback(this, 'onPressCancel', this.finance);
    }

}

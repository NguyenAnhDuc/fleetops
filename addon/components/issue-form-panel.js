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

export default class IssueFormPanelComponent extends Component {
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
    @tracked acceptedImageTypes = [
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp'
    ];

    /**
     * Overlay context.
     * @type {any}
     */
    @tracked context;

    /**
     * All possible issue types
     *
     * @var {String}
     */
    @tracked issueTypes = getIssueTypes();

    /**
     *  The subcategories for issue types.
     *
     * @var {Object}
     */
    @tracked issueCategoriesByType = getIssueCategories({ fullObject: true });

    /**
     * Selectable issue categories.
     *
     * @memberof IssueFormPanelComponent
     */
    @tracked issueCategories = [];

    /**
     * Issue status options.
     *
     * @memberof IssueFormPanelComponent
     */
    @tracked issueStatusOptions = ['pending', 'in-progress', 'backlogged', 'requires-update', 'in-review', 're-opened', 'duplicate', 'pending-review', 'escalated', 'completed', 'canceled'];

    /**
     * Issue priorty options.
     *
     * @memberof IssueFormPanelComponent
     */
    @tracked issuePriorityOptions = ['low', 'medium', 'high', 'critical', 'scheduled-maintenance', 'operational-suggestion'];

    /**
     * Permission needed to update or create record.
     *
     * @memberof IssueFormPanelComponent
     */
    @tracked savePermission;

    /**
     * The current controller if any.
     *
     * @memberof IssueFormPanelComponent
     */
    @tracked controller;

    /**
     * Constructs the component and applies initial state.
     */
    constructor(owner, { issue = null, controller }) {
        super(...arguments);
        this.issue = issue;
        this.controller = controller;
        this.issueCategories = getWithDefault(this.issueCategoriesByType, getWithDefault(issue, 'type', 'operational'), []);
        this.savePermission = issue && issue.isNew ? 'fleet-ops create issue' : 'fleet-ops update issue';
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
     * @memberof IssueFormPanelComponent
     */
    @task *save() {
        contextComponentCallback(this, 'onBeforeSave', this.issue);

        try {
            this.issue = yield this.issue.save();
        } catch (error) {
            this.notifications.serverError(error);
            return;
        }

        this.notifications.success(this.intl.t('fleet-ops.component.issue-form-panel.success-message', { publicId: this.issue.public_id }));
        contextComponentCallback(this, 'onAfterSave', this.issue);
    }

    /**
     * Trigger when the issue type is selected.
     *
     * @param {String} type
     * @memberof IssueFormPanelComponent
     */
    @action onSelectIssueType(type) {
        this.issue.type = type;
        this.issue.category = null;
        this.issueCategories = getWithDefault(this.issueCategoriesByType, type, []);
    }

    /**
     * Add a tag to the issue
     *
     * @param {String} tag
     * @memberof IssueFormPanelComponent
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
     * @memberof IssueFormPanelComponent
     */
    @action removeTag(index) {
        this.issue.tags.removeAt(index);
    }

    /**
     * View the details of the issue.
     *
     * @action
     */
    @action onViewDetails() {
        const isActionOverrided = contextComponentCallback(this, 'onViewDetails', this.issue);

        if (!isActionOverrided) {
            this.contextPanel.focus(this.issue, 'viewing');
        }
    }

    /**
     * Handles cancel button press.
     *
     * @action
     * @returns {any}
     */
    @action onPressCancel() {
        return contextComponentCallback(this, 'onPressCancel', this.issue);
    }

    @action setReporter(user) {
        this.issue.set('reporter', user);
        this.issue.set('reported_by_uuid', user.id);
    }
    
    /**
     * Handles file upload for issue image
     *
     * @param {File} file
     * @action
     */
    @action onImageFileAdded(file) {
        // Validate file state
        if (['queued', 'failed', 'timed_out', 'aborted'].indexOf(file.state) === -1) {
            return;
        }
        
        // Set file for progress state
        this.file = file;
        
        // Queue and upload immediately
        this.fetch.uploadFile.perform(
            file,
            {
                path: 'uploads/fleet-ops/issue-images',
                type: 'issue_image',
            },
            (uploadedFile) => {
                this.file = undefined;
                this.issue.set('image', uploadedFile);
                this.issue.set('image_uuid', uploadedFile.id);
            },
            () => {
                // remove file from queue
                if (file.queue && typeof file.queue.remove === 'function') {
                    file.queue.remove(file);
                }
                this.file = undefined;
            }
        );
    }
    
    /**
     * Removes the uploaded image
     *
     * @action
     */
    @action removeImage() {
        const image = this.issue.image;
        
        if (isModel(image)) {
            image.destroyRecord();
        }
        
        this.issue.set('image', null);
        this.issue.set('image_uuid', null);
    }
}

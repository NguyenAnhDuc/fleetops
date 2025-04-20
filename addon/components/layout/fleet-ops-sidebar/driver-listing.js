import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { inject as service } from '@ember/service';
import { action } from '@ember/object';
import { later } from '@ember/runloop';
import { task } from 'ember-concurrency-decorators';

export default class LayoutFleetOpsSidebarDriverListingComponent extends Component {
    @service store;
    @service universe;
    @service contextPanel;
    @service driverActions;
    @service hostRouter;
    @service abilities;
    @service notifications;
     /**
     * Inject the `intl` service
     *
     * @var {Service}
     */
     @service intl;
    @tracked drivers = [];

    constructor() {
        super(...arguments);
        this.fetchDrivers.perform();
        this.universe.on('fleet-ops.driver.saved', () => {
            this.fetchDrivers.perform();
        });
    }

    displayPanelDropdown = true;
    panelDropdownButtonActions = [
        {
            label: this.intl.t('fleet-ops.management.drivers.index.create-driver'),
            disabled: this.abilities.cannot('fleet-ops create driver'),
            onClick: () => {
                const driver = this.store.createRecord('driver');
                this.contextPanel.focus(driver, 'editing');
            },
        },
    ];

    dropdownButtonActions = [
        {
            label: this.intl.t('fleet-ops.management.drivers.index.view-details'),
            disabled: this.abilities.cannot('fleet-ops view driver'),
            onClick: (driver) => {
                this.contextPanel.focus(driver);
            },
        },
        {
            label: this.intl.t('fleet-ops.management.drivers.index.edit-details'),
            disabled: this.abilities.cannot('fleet-ops update driver'),
            onClick: (driver) => {
                this.contextPanel.focus(driver, 'editing');
            },
        },
        {
            separator: true,
        },
        {
            label: this.intl.t('fleet-ops.management.drivers.index.assign-order-driver'),
            disabled: this.abilities.cannot('fleet-ops assign-order-for driver'),
            onClick: (driver) => {
                this.driverActions.assignOrder(driver);
            },
        },
        {
            label: this.intl.t('fleet-ops.management.drivers.index.assign-vehicle-driver'),
            disabled: this.abilities.cannot('fleet-ops assign-vehicle-for driver'),
            onClick: (driver) => {
                this.driverActions.assignVehicle(driver);
            },
        },
        {
            label: this.intl.t('fleet-ops.management.drivers.index.locate-driver-map'),
            disabled: this.abilities.cannot('fleet-ops view driver'),
            onClick: (driver) => {
                // If currently on the operations dashboard focus driver on the map
                if (typeof this.hostRouter.currentRouteName === 'string' && this.hostRouter.currentRouteName.startsWith('console.fleet-ops.operations.orders')) {
                    return this.onDriverClicked(driver);
                }

                this.driverActions.locate(driver);
            },
        },
        {
            separator: true,
        },
        {
            label: this.intl.t('fleet-ops.management.drivers.index.delete-driver'),
            disabled: this.abilities.cannot('fleet-ops delete driver'),
            onClick: (driver) => {
                this.driverActions.delete(driver);
            },
        },
    ];

    @action calculateDropdownPosition(trigger, content) {
        let { top, left, width, height } = trigger.getBoundingClientRect();
        let { height: contentHeight } = content.getBoundingClientRect();
        let style = {
            left: 3 + left + width,
            top: 29 + top + window.pageYOffset + height / 2 - contentHeight / 2,
        };

        return { style };
    }

    @action calculateDropdownItemPosition(trigger) {
        let { top, left, width } = trigger.getBoundingClientRect();
        let style = {
            left: 11 + left + width,
            top: top + 2,
        };

        return { style };
    }

    @action transitionToRoute(toggleApiContext) {
        if (typeof this.args.route === 'string') {
            if (typeof this.hostRouter.currentRouteName === 'string' && this.hostRouter.currentRouteName.startsWith('console.fleet-ops.management.fleets.index')) {
                if (typeof toggleApiContext.toggle === 'function') {
                    toggleApiContext.toggle();
                }
            }

            this.hostRouter.transitionTo(this.args.route);
        }
    }

    @action onDriverClicked(driver) {
        // Transition to dashboard/map display
        return this.hostRouter.transitionTo('console.fleet-ops.operations.orders.index', { queryParams: { layout: 'map' } }).then(() => {
            // Focus vehicle on live map
            this.focusDriverOnMap(driver);

            // Fire callback
            if (typeof this.args.onFocusDriver === 'function') {
                this.args.onFocusDriver(driver);
            }
        });
    }

    focusDriverOnMap(driver) {
        const liveMap = this.universe.get('component:fleet-ops:live-map');

        if (liveMap) {
            if (liveMap.contextPanel) {
                liveMap.contextPanel.clear();
            }

            liveMap.showAll();
            liveMap.focusLayerByRecord(driver, 16, {
                onAfterFocusWithRecord: function () {
                    later(
                        this,
                        () => {
                            liveMap.onDriverClicked(driver);
                        },
                        1200
                    );
                },
            });
        }
    }

    @task *fetchDrivers() {
        try {
            this.drivers = yield this.store.query('driver', { limit: 20, without: ['vendor'] });
        } catch (error) {
            this.notifications.serverError(error);
        }
    }
}

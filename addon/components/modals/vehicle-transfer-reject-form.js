import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';

export default class VehicleTransferRejectFormComponent extends Component {
    @tracked rejectNote;

    constructor() {
        super(...arguments);

        const state = this.args.options?.state || {};
        this.rejectNote = state.rejectNote ?? '';
        this._syncState();
    }

    get transfer() {
        return this.args.options?.transfer;
    }

    _syncState() {
        const state = this.args.options?.state;
        if (state) {
            state.rejectNote = this.rejectNote;
        }
    }

    @action updateRejectNote(event) {
        this.rejectNote = event.target.value || '';
        this._syncState();
    }
}

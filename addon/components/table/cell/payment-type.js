import Component from '@glimmer/component';

export default class TableCellPaymentTypeComponent extends Component {
    get isCash() {
        return this.args.row?.is_receive_cash_fees !== false;
    }
}

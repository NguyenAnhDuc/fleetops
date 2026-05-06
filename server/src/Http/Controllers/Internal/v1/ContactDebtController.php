<?php

namespace Fleetbase\FleetOps\Http\Controllers\Internal\v1;


use Fleetbase\FleetOps\Exports\DebtReportExport;
use Fleetbase\FleetOps\Http\Controllers\FleetOpsController;
use Fleetbase\FleetOps\Http\Resources\v1\ContactDebt as ContactDebtResource;
use Fleetbase\FleetOps\Models\ContactDebt;
use Fleetbase\FleetOps\Models\Contact;
use Fleetbase\FleetOps\Models\Order;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Maatwebsite\Excel\Facades\Excel;

class ContactDebtController extends FleetOpsController
{
    /**
     * The resource to query.
     *
     * @var string
     */
    public $resource = 'contact_debt';
    
    public function get( Request $request){
        $results = ContactDebt::queryWithRequest($request,  function (&$query, $request) {
            if($request->filled('contact_uuid')){
                $query->where('contact_uuid', $request->input('contact_uuid'));
            }

            if($request->filled('start_date')){
                $query->whereDate('received_at', '>=', $request->input('start_date'));
            }

            if($request->filled('end_date')){
                $query->whereDate('received_at', '<=', $request->input('end_date'));
            }
        });

        return ContactDebtResource::collection($results);
    }

    public function debtExport(Request $request)
    {
        $contactUuid = $request->input('contact_uuid', '');
        $startDate   = $request->input('start_date');
        $endDate     = $request->input('end_date');

        // Query orders (debt_estimate: công nợ chưa thu)
        $orders = Order::where('company_uuid', session('company'))
            ->where('is_finish', 1)
            ->where('is_receive_cash_fees', 0)
            ->when($contactUuid, fn($q) => $q->where('customer_uuid', $contactUuid))
            ->when($startDate,   fn($q) => $q->whereDate('started_at', '>=', $startDate))
            ->when($endDate,     fn($q) => $q->whereDate('started_at', '<=', $endDate))
            ->with(['vehicleAssigned', 'payload.pickup', 'payload.dropoff', 'payload.entities', 'customer'])
            ->get();

        // Query contact-debts (debt_received: đã thu)
        // ContactDebt không có company_uuid — scope bằng contact_uuid và date
        $contactDebts = ContactDebt::when($contactUuid, fn($q) => $q->where('contact_uuid', $contactUuid))
            ->when($startDate, fn($q) => $q->whereDate('received_at', '>=', $startDate))
            ->when($endDate,   fn($q) => $q->whereDate('received_at', '<=', $endDate))
            ->get();

        // Build contact_uuid → name map
        $contactUuids = $contactDebts->pluck('contact_uuid')->filter()->unique()->values()->toArray();
        $customers    = [];
        if (!empty($contactUuids)) {
            Contact::whereIn('uuid', $contactUuids)
                ->get(['uuid', 'name'])
                ->each(function ($c) use (&$customers) {
                    $customers[$c->uuid] = $c->name;
                });
        }

        $fileName = 'Bao_cao_cong_no_' . ($startDate ?? '') . '_' . ($endDate ?? '') . '.xlsx';

        return Excel::download(new DebtReportExport($orders, $contactDebts, $customers), $fileName);
    }
}

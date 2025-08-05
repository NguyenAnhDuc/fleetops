<?php

namespace Fleetbase\FleetOps\Http\Controllers\Internal\v1;


use Fleetbase\FleetOps\Http\Controllers\FleetOpsController;
use Illuminate\Support\Str;
use Maatwebsite\Excel\Facades\Excel;
use Illuminate\Http\Request;
use Fleetbase\FleetOps\Http\Resources\v1\ContactDebt as ContactDebtResource;  
use Fleetbase\FleetOps\Models\ContactDebt;

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
}

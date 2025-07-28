<?php

namespace Fleetbase\FleetOps\Http\Controllers\Internal\v1;

use Fleetbase\FleetOps\Exports\FuelReportExport;
use Fleetbase\FleetOps\Http\Controllers\FleetOpsController;
use Fleetbase\FleetOps\Imports\FuelReportImport;
use Fleetbase\Http\Requests\ExportRequest;
use Fleetbase\Http\Requests\ImportRequest;
use Illuminate\Support\Str;
use Maatwebsite\Excel\Facades\Excel;
use Illuminate\Http\Request;
use Fleetbase\FleetOps\Http\Resources\v1\FuelReport as FuelReportResource;  
use Fleetbase\FleetOps\Models\FuelReport;

class FuelReportController extends FleetOpsController
{
    /**
     * The resource to query.
     *
     * @var string
     */
    public $resource = 'fuel_report';

    /**
     * Export the fleets to excel or csv.
     *
     * @return \Illuminate\Http\Response
     */
    public function export(ExportRequest $request)
    {
        $format       = $request->input('format', 'xlsx');
        $selections   = $request->array('selections');
        $fileName     = trim(Str::slug('fuel_report-' . date('Y-m-d-H:i')) . '.' . $format);

        return Excel::download(new FuelReportExport($selections), $fileName);
    }

    public function import(ImportRequest $request)
    {
        $disk           = $request->input('disk', config('filesystems.default'));
        $files          = $request->resolveFilesFromIds();

        foreach ($files as $file) {
            try {
                Excel::import(new FuelReportImport(), $file->path, $disk);
            } catch (\Throwable $e) {
                return response()->error('Invalid file, unable to proccess.');
            }
        }

        return response()->json(['status' => 'ok', 'message' => 'Import completed']);
    }

    public function finance( Request $request){
        $results = FuelReport::queryWithRequest($request,  function (&$query, $request) {
            if($request->filled('vehicle_id')){
                $query->where('vehicle_uuid', $request->input('vehicle_id'));
            }

            if($request->filled('start_date')){
                $query->whereDate('created_at', '>=', $request->input('start_date'));
            }

            if($request->filled('end_date')){
                $query->whereDate('created_at', '<=', $request->input('end_date'));
            }
        });

        return FuelReportResource::collection($results);
    }
}

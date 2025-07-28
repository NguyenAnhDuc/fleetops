<?php

namespace Fleetbase\FleetOps\Http\Controllers\Internal\v1;

use Fleetbase\FleetOps\Exports\IssueExport;
use Fleetbase\FleetOps\Http\Controllers\FleetOpsController;
use Fleetbase\FleetOps\Imports\IssueImport;
use Fleetbase\Http\Requests\ExportRequest;
use Fleetbase\Http\Requests\ImportRequest;
use Fleetbase\FleetOps\Models\Issue;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Maatwebsite\Excel\Facades\Excel;
use Fleetbase\FleetOps\Http\Resources\v1\Issue as IssueResource;

class IssueController extends FleetOpsController
{
    /**
     * The resource to query.
     *
     * @var string
     */
    public $resource = 'issue';

    /**
     * Export the issue to excel or csv.
     *
     * @return \Illuminate\Http\Response
     */
    public function export(ExportRequest $request)
    {
        $format       = $request->input('format', 'xlsx');
        $selections   = $request->array('selections');
        $fileName     = trim(Str::slug('issue-' . date('Y-m-d-H:i')) . '.' . $format);

        return Excel::download(new IssueExport($selections), $fileName);
    }

    /**
     * Process import files (excel,csv) into Fleetbase order data.
     *
     * @return \Illuminate\Http\Response
     */
    public function import(ImportRequest $request)
    {
        $disk           = $request->input('disk', config('filesystems.default'));
        $files          = $request->resolveFilesFromIds();

        foreach ($files as $file) {
            try {
                Excel::import(new IssueImport(), $file->path, $disk);
            } catch (\Throwable $e) {
                return response()->error('Invalid file, unable to proccess.');
            }
        }

        return response()->json(['status' => 'ok', 'message' => 'Import completed']);
    }

    public function finance( Request $request){
        $results = Issue::queryWithRequest($request,  function (&$query, $request) {
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

        return IssueResource::collection($results);
    }
}

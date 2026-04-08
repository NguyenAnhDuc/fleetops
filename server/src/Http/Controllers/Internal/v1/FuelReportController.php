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
use Fleetbase\FleetOps\Http\Requests\CreateFuelReportRequest;
use Fleetbase\FleetOps\Http\Requests\UpdateFuelReportRequest;
use Fleetbase\Exceptions\FleetbaseRequestValidationException;
use Fleetbase\FleetOps\Models\Driver;
use Fleetbase\FleetOps\Models\FuelReport;

class FuelReportController extends FleetOpsController
{
    /**
     * The resource to query.
     *
     * @var string
     */
    public $resource = 'fuel_report';

    public function createRecord(Request $request)
    {
        if ($request->has('fuelReport')) {
            $request->merge($request->input('fuelReport'));
        }

        try {
            $this->request = CreateFuelReportRequest::class;
            $this->validateRequest($request);

            $input = $request->only([
                'odometer',
                'volume',
                'volume_extra',
                'metric_unit',
                'amount',
                'amount_extra',
                'currency',
                'unit_price',
                'fueled_at',
                'status',
                'report',
            ]);
            
            $input['location'] = new \Fleetbase\LaravelMysqlSpatial\Types\Point(0, 0);

            if (!empty($input['unit_price']) && !empty($input['volume'])) {
                $input['amount'] = round((float) $input['unit_price'] * (float) $input['volume'], 2);
            }

            if (!empty($input['fueled_at'])) {
                $input['fueled_at'] = \Carbon\Carbon::parse($input['fueled_at'])->format('Y-m-d H:i:s');
            }

            try {
                $driverId = is_array($request->input('driver')) ? ($request->input('driver.uuid') ?? $request->input('driver_uuid')) : ($request->input('driver_uuid') ?? $request->input('driver'));
                $driver = Driver::where('uuid', $driverId)->firstOrFail();
            } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $exception) {
                return response()->error('Driver reporting fuel report not found.');
            }

            $input['company_uuid']      = $driver->company_uuid;
            $input['driver_uuid']       = $driver->uuid;
            $input['reported_by_uuid']  = $driver->user_uuid;
            
            $vehicleId = is_array($request->input('vehicle')) ? ($request->input('vehicle.uuid') ?? $request->input('vehicle_uuid')) : ($request->input('vehicle_uuid') ?? $request->input('vehicle'));
            $input['vehicle_uuid']      = $vehicleId ?? $driver->vehicle_uuid;

            $fuelReport = FuelReport::create($input);

            FuelReportResource::wrap('fuel_report');
            return new FuelReportResource($fuelReport);
        } catch (FleetbaseRequestValidationException $e) {
            return response()->error($e->getErrors());
        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->error($e->errors());
        } catch (\Exception $e) {
            return response()->error($e->getMessage());
        }
    }

    public function updateRecord(Request $request, string $id)
    {
        if ($request->has('fuelReport')) {
            $request->merge($request->input('fuelReport'));
        }

        try {
            $this->request = UpdateFuelReportRequest::class;
            $this->validateRequest($request);

            try {
                $fuelReport = FuelReport::where('uuid', $id)->orWhere('public_id', $id)->orWhere('id', $id)->firstOrFail();
            } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $exception) {
                return response()->error('FuelReport resource not found.');
            }

            $input = $request->only([
                'odometer',
                'volume',
                'volume_extra',
                'metric_unit',
                'amount',
                'amount_extra',
                'currency',
                'unit_price',
                'fueled_at',
                'status',
                'report',
            ]);

            if (!empty($input['unit_price']) && !empty($input['volume'])) {
                $input['amount'] = round((float) $input['unit_price'] * (float) $input['volume'], 2);
            } elseif (!empty($input['unit_price']) && !empty($fuelReport->volume)) {
                $input['amount'] = round((float) $input['unit_price'] * (float) $fuelReport->volume, 2);
            }

            if (!empty($input['fueled_at'])) {
                $input['fueled_at'] = \Carbon\Carbon::parse($input['fueled_at'])->format('Y-m-d H:i:s');
            }

            // if driver/vehicle is sent, update them (unlike public API)
            if ($request->has('driver') || $request->has('driver_uuid')) {
                $driverId = is_array($request->input('driver')) ? ($request->input('driver.uuid') ?? $request->input('driver_uuid')) : ($request->input('driver_uuid') ?? $request->input('driver'));
                if ($driverId) $input['driver_uuid'] = $driverId;
            }
            if ($request->has('vehicle') || $request->has('vehicle_uuid')) {
                $vehicleId = is_array($request->input('vehicle')) ? ($request->input('vehicle.uuid') ?? $request->input('vehicle_uuid')) : ($request->input('vehicle_uuid') ?? $request->input('vehicle'));
                if ($vehicleId) $input['vehicle_uuid'] = $vehicleId;
            }

            $fuelReport->update($input);

            FuelReportResource::wrap('fuel_report');
            return new FuelReportResource($fuelReport);
        } catch (FleetbaseRequestValidationException $e) {
            return response()->error($e->getErrors());
        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->error($e->errors());
        } catch (\Exception $e) {
            return response()->error($e->getMessage());
        }
    }

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

<?php

namespace Fleetbase\FleetOps\Http\Controllers\Internal\v1;

use Fleetbase\FleetOps\Exports\VehicleExport;
use Fleetbase\FleetOps\Http\Controllers\FleetOpsController;
use Fleetbase\FleetOps\Imports\VehicleImport;
use Fleetbase\FleetOps\Models\Vehicle;
use Fleetbase\Http\Requests\ExportRequest;
use Fleetbase\Http\Requests\ImportRequest;
use Fleetbase\Support\Http;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Maatwebsite\Excel\Facades\Excel;

class VehicleController extends FleetOpsController
{
    /**
     * The resource to query.
     *
     * @var string
     */
    public $resource = 'vehicle';

    /**
     * Override queryRecord to apply priority sorting:
     * 1. Expired or near-expiry inspection date (within 30 days) – listed first
     * 2. Vehicles with ⚠️ fuel warning – listed second
     * 3. Everything else
     *
     * @return \Illuminate\Http\Response
     */
    public function queryRecord(Request $request)
    {
        $today    = now()->toDateString();
        $in30days = now()->addDays(30)->toDateString();

        // Lấy Query Builder với các bộ lọc filter nhưng CHƯA phân trang
        $builder = $this->model->searchBuilder($request);
        
        // Lấy tất cả collection phù hợp điều kiện ra để có thể custom sort toàn cục
        $all = $builder->get();

        // Sort in PHP (vì logic FuelReport phức tạp không query thẳng trên SQL được)
        // Priority 0 = inspection expired or within 30 days
        // Priority 1 = has ⚠️ fuel warning
        // Priority 2 = normal
        $sorted = $all->sortBy(function ($vehicle) use ($today, $in30days) {
            $inspectionDate = $vehicle->inspection_expire_date;

            $inspectionPriority = 2; // Mặc định là bình thường
            if ($inspectionDate) {
                $dateStr = $inspectionDate instanceof \Carbon\Carbon
                    ? $inspectionDate->toDateString()
                    : (string) $inspectionDate;

                if ($dateStr <= $today || $dateStr <= $in30days) {
                    $inspectionPriority = 0; // Hết hạn hoặc gần hết hạn
                }
            }

            // Mất chút thời gian chạy loop, nhưng cần thiết cho việc check nhiên liệu
            $fuelStatus  = $vehicle->fuel_report_status ?? '';
            $fuelPriority = Str::contains($fuelStatus, '⚠️') ? 1 : 2;

            // Ưu tiên tốt nhất (số nhỏ nhất)
            return min($inspectionPriority, $fuelPriority);
        })->values();

        // Custom Pagination manually
        $page  = $request->integer('page', 1);
        $limit = $request->integer('limit', 20);
        $total = $sorted->count();
        
        // Slice items based on page and limit
        $items = $sorted->slice(($page - 1) * $limit, $limit)->values();

        $paginator = new \Illuminate\Pagination\LengthAwarePaginator(
            $items,
            $total,
            $limit,
            $page,
            ['path' => $request->url(), 'query' => $request->query()]
        );

        if (Http::isInternalRequest($request)) {
            $this->resource::wrap($this->resourcePluralName);

            return $this->resource::collection($paginator);
        }

        return $this->resource::collection($paginator);
    }

    /**
     * Get all status options for an vehicle.
     *
     * @return \Illuminate\Http\Response
     */
    public function statuses()
    {
        $statuses = DB::table('vehicles')
            ->select('status')
            ->where('company_uuid', session('company'))
            ->distinct()
            ->get()
            ->pluck('status')
            ->filter()
            ->values();

        return response()->json($statuses);
    }

    /**
     * Get all avatar options for an vehicle.
     *
     * @return \Illuminate\Http\Response
     */
    public function avatars()
    {
        $options = Vehicle::getAvatarOptions();

        return response()->json($options);
    }

    /**
     * Export the vehicles to excel or csv.
     *
     * @return \Illuminate\Http\Response
     */
    public static function export(ExportRequest $request)
    {
        $format       = $request->input('format', 'xlsx');
        $selections   = $request->array('selections');
        $fileName     = trim(Str::slug('vehicles-' . date('Y-m-d-H:i')) . '.' . $format);

        return Excel::download(new VehicleExport($selections), $fileName);
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
                Excel::import(new VehicleImport(), $file->path, $disk);
            } catch (\Throwable $e) {
                return response()->error('Invalid file, unable to proccess.');
            }
        }

        return response()->json(['status' => 'ok', 'message' => 'Import completed']);
    }
}

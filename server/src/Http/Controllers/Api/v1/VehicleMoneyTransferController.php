<?php

namespace Fleetbase\FleetOps\Http\Controllers\Api\v1;

use Fleetbase\FleetOps\Http\Resources\v1\VehicleMoneyTransfer as VehicleMoneyTransferResource;
use Fleetbase\FleetOps\Models\Driver;
use Fleetbase\FleetOps\Models\Vehicle;
use Fleetbase\FleetOps\Models\VehicleMoneyTransfer;
use Fleetbase\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class VehicleMoneyTransferController extends Controller
{
    /**
     * Tài xế tạo lệnh chuyển tiền từ App.
     *
     * Xe nguồn tự động = xe hiện tại của tài xế đang đăng nhập (driver->vehicle_uuid).
     * Lệnh luôn ở trạng thái 'pending' chờ admin duyệt — chưa ảnh hưởng tiền tồn.
     */
    public function create(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'amount'     => ['required', 'numeric', 'gt:0'],
            'to_vehicle' => ['required'],
            'note'       => ['nullable', 'string'],
        ], [
            'amount.required'     => 'Số tiền chuyển là bắt buộc.',
            'amount.gt'           => 'Số tiền chuyển phải lớn hơn 0.',
            'to_vehicle.required' => 'Cần chọn xe nhận.',
        ]);

        if ($validator->fails()) {
            return response()->json(['error' => $validator->errors()->first()], 422);
        }

        // Tài xế thực hiện
        try {
            $driver = Driver::findRecordOrFail($request->input('driver'));
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $exception) {
            return response()->json(['error' => 'Không tìm thấy tài xế thực hiện.'], 404);
        }

        // Xe nguồn = xe hiện tại của tài xế (ưu tiên from_vehicle nếu client gửi).
        // Lưu ý: public API trả vehicle id = public_id, nên resolve bằng findRecord (nhận cả public_id lẫn uuid).
        $fromVehicleId = $request->input('from_vehicle') ?? $request->input('from_vehicle_uuid') ?? $driver->vehicle_uuid;
        $toVehicleId   = $request->input('to_vehicle') ?? $request->input('to_vehicle_uuid');

        if (empty($fromVehicleId)) {
            return response()->json(['error' => 'Tài xế chưa được gán xe nên không thể chuyển tiền.'], 422);
        }

        // Resolve xe theo uuid HOẶC public_id.
        // Lưu ý: findRecordOrFail() chỉ match public_id/internal_id, KHÔNG match uuid,
        // mà $driver->vehicle_uuid là UUID → phải tự query cả 2 cột.
        $resolveVehicle = function ($id) use ($driver) {
            if (empty($id)) {
                return null;
            }

            return Vehicle::where('company_uuid', $driver->company_uuid)
                ->where(function ($q) use ($id) {
                    $q->where('uuid', $id)
                      ->orWhere('public_id', $id);
                })
                ->first();
        };

        $fromVehicle = $resolveVehicle($fromVehicleId);
        $toVehicle   = $resolveVehicle($toVehicleId);

        if (!$fromVehicle || !$toVehicle) {
            return response()->json([
                'error' => 'Không tìm thấy xe chuyển đi hoặc xe nhận.',
                'debug' => [
                    'from_vehicle_id'    => $fromVehicleId,
                    'to_vehicle_id'      => $toVehicleId,
                    'from_vehicle_found' => (bool) $fromVehicle,
                    'to_vehicle_found'   => (bool) $toVehicle,
                ],
            ], 404);
        }

        if ($fromVehicle->uuid === $toVehicle->uuid) {
            return response()->json(['error' => 'Không thể chuyển tiền cho cùng một xe.'], 422);
        }

        $transfer = VehicleMoneyTransfer::create([
            'company_uuid'      => $driver->company_uuid,
            'from_vehicle_uuid' => $fromVehicle->uuid,
            'to_vehicle_uuid'   => $toVehicle->uuid,
            'from_driver_uuid'  => $driver->uuid,
            'to_driver_uuid'    => data_get($toVehicle, 'driver.uuid'),
            'created_by_uuid'   => $driver->user_uuid,
            'amount'            => (float) $request->input('amount'),
            'currency'          => $request->input('currency', 'VND'),
            'note'              => $request->input('note'),
            'transferred_at'    => now(),
            'status'            => 'pending',
            'approved_amount'   => null,
        ]);

        return new VehicleMoneyTransferResource($transfer);
    }

    /**
     * Danh sách giao dịch chuyển tiền của một xe — gồm cả chuyển đi lẫn nhận về.
     * App truyền vehicle_id = xe của tài xế.
     */
    public function query(Request $request)
    {
        $results = VehicleMoneyTransfer::queryWithRequest($request, function (&$query, $request) {
            if ($request->filled('vehicle_id')) {
                $vehicleId = $request->input('vehicle_id');
                $query->where(function ($q) use ($vehicleId) {
                    $q->where('from_vehicle_uuid', $vehicleId)
                      ->orWhere('to_vehicle_uuid', $vehicleId);
                });
            }

            if ($request->filled('status')) {
                $query->where('status', $request->input('status'));
            }

            // Tìm kiếm: theo ghi chú (note) hoặc biển số xe chuyển/nhận.
            // note là cột → LIKE thẳng; tên xe là accessor (plate_number) → dùng whereHas.
            if ($request->filled('query')) {
                $like = '%' . trim($request->input('query')) . '%';
                $query->where(function ($w) use ($like) {
                    $w->where('note', 'like', $like)
                      ->orWhereHas('toVehicle', function ($v) use ($like) {
                          $v->where('plate_number', 'like', $like);
                      })
                      ->orWhereHas('fromVehicle', function ($v) use ($like) {
                          $v->where('plate_number', 'like', $like);
                      });
                });
            }

            if ($request->filled('start_date')) {
                $query->whereDate('transferred_at', '>=', $request->input('start_date'));
            }

            if ($request->filled('end_date')) {
                $query->whereDate('transferred_at', '<=', $request->input('end_date'));
            }

            // Phân trang cho App: queryFromRequest (public) chỉ áp dụng `limit`, không có offset.
            // Thêm offset ở đây để App load theo trang (infinite scroll).
            if ($request->filled('offset')) {
                $query->offset((int) $request->input('offset'));
            }
        });

        return VehicleMoneyTransferResource::collection($results);
    }

    /**
     * Chi tiết một lệnh chuyển tiền.
     */
    public function find($id)
    {
        try {
            $transfer = VehicleMoneyTransfer::findRecordOrFail($id);
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $exception) {
            return response()->json(['error' => 'Không tìm thấy lệnh chuyển tiền.'], 404);
        }

        return new VehicleMoneyTransferResource($transfer);
    }

    /**
     * Tài xế xoá lệnh chuyển tiền của chính mình.
     *
     * Ràng buộc:
     *  - Chỉ xoá được lệnh do xe của tài xế đó tạo (from_vehicle = xe hiện tại của tài xế).
     *  - Chỉ xoá khi status là 'pending' (chờ duyệt) hoặc 'rejected' (bị từ chối).
     *  - Lệnh đã duyệt ('approved') KHÔNG được xoá vì đã ảnh hưởng tiền tồn.
     */
    public function destroy($id, Request $request)
    {
        try {
            $transfer = VehicleMoneyTransfer::findRecordOrFail($id);
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $exception) {
            return response()->json(['error' => 'Không tìm thấy lệnh chuyển tiền.'], 404);
        }

        // Xác định tài xế thực hiện (App truyền driver = public_id của tài xế đang đăng nhập).
        try {
            $driver = Driver::findRecordOrFail($request->input('driver'));
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $exception) {
            return response()->json(['error' => 'Không tìm thấy tài xế thực hiện.'], 404);
        }

        // Chỉ chủ lệnh (xe nguồn = xe của tài xế) mới được xoá.
        if (empty($driver->vehicle_uuid) || $transfer->from_vehicle_uuid !== $driver->vehicle_uuid) {
            return response()->json(['error' => 'Bạn không có quyền xoá lệnh chuyển tiền này.'], 403);
        }

        // Không cho xoá lệnh đã duyệt.
        if (!in_array($transfer->status, ['pending', 'rejected'], true)) {
            return response()->json(['error' => 'Chỉ có thể xoá lệnh đang chờ duyệt hoặc đã bị từ chối.'], 422);
        }

        $transfer->delete();

        return response()->json(['status' => 'ok', 'message' => 'Đã xoá lệnh chuyển tiền.']);
    }
}

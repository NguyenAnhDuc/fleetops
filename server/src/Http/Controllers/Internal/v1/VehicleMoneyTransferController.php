<?php

namespace Fleetbase\FleetOps\Http\Controllers\Internal\v1;

use Fleetbase\FleetOps\Http\Controllers\FleetOpsController;
use Fleetbase\FleetOps\Http\Resources\v1\VehicleMoneyTransfer as VehicleMoneyTransferResource;
use Fleetbase\FleetOps\Models\Driver;
use Fleetbase\FleetOps\Models\Vehicle;
use Fleetbase\FleetOps\Models\VehicleMoneyTransfer;
use Fleetbase\FleetOps\Notifications\VehicleMoneyTransferStatus;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;
use Spatie\ResponseCache\Facades\ResponseCache;

class VehicleMoneyTransferController extends FleetOpsController
{
    /**
     * The resource to query.
     *
     * @var string
     */
    public $resource = 'vehicle_money_transfer';

    /**
     * Create a new money transfer between two vehicles.
     *
     * Chuyển tiền áp dụng ngay (không qua duyệt). Người thực hiện (tài xế) được ghi vào created_by_uuid.
     * Snapshot tài xế đang cầm xe đi/nhận được lưu lại tại thời điểm chuyển.
     */
    public function createRecord(Request $request)
    {
        if ($request->has('vehicleMoneyTransfer')) {
            $request->merge($request->input('vehicleMoneyTransfer'));
        }

        try {
            $validator = Validator::make($request->all(), [
                'amount' => ['required', 'numeric', 'gt:0'],
                'note'   => ['nullable', 'string'],
            ], [
                'amount.required' => 'Số tiền chuyển là bắt buộc.',
                'amount.gt'       => 'Số tiền chuyển phải lớn hơn 0.',
            ]);

            if ($validator->fails()) {
                return response()->error($validator->errors());
            }

            $fromVehicleId = $this->resolveId($request, 'from_vehicle');
            $toVehicleId   = $this->resolveId($request, 'to_vehicle');

            if (empty($fromVehicleId) || empty($toVehicleId)) {
                return response()->error('Cần chọn xe chuyển đi và xe nhận.');
            }

            if ($fromVehicleId === $toVehicleId) {
                return response()->error('Không thể chuyển tiền cho cùng một xe.');
            }

            $fromVehicle = Vehicle::where('uuid', $fromVehicleId)->first();
            $toVehicle   = Vehicle::where('uuid', $toVehicleId)->first();

            if (!$fromVehicle || !$toVehicle) {
                return response()->error('Không tìm thấy xe chuyển đi hoặc xe nhận.');
            }

            $user = $request->user();

            $transfer = VehicleMoneyTransfer::create([
                'company_uuid'      => $fromVehicle->company_uuid ?? session('company'),
                'from_vehicle_uuid' => $fromVehicle->uuid,
                'to_vehicle_uuid'   => $toVehicle->uuid,
                'from_driver_uuid'  => data_get($fromVehicle, 'driver.uuid'),
                'to_driver_uuid'    => data_get($toVehicle, 'driver.uuid'),
                'created_by_uuid'   => $user?->uuid,
                'amount'            => (float) $request->input('amount'),
                'currency'          => $request->input('currency', 'VND'),
                'note'              => $request->input('note'),
                'transferred_at'    => $request->filled('transferred_at')
                    ? \Carbon\Carbon::parse($request->input('transferred_at'))->format('Y-m-d H:i:s')
                    : now(),
                // Luôn ở trạng thái chờ duyệt khi tài xế tạo; chưa tính vào tiền tồn.
                'status'            => 'pending',
                'approved_amount'   => null,
            ]);

            VehicleMoneyTransferResource::wrap('vehicle_money_transfer');

            return new VehicleMoneyTransferResource($transfer);
        } catch (\Exception $e) {
            return response()->error($e->getMessage());
        }
    }

    /**
     * Admin phê duyệt một lệnh chuyển tiền.
     * approved_amount mặc định = amount tài xế yêu cầu nếu admin không nhập số khác.
     * Chỉ khi approved thì khoản này mới được tính vào tiền tồn của xe.
     */
    public function approve(Request $request, string $id)
    {
        try {
            $transfer = VehicleMoneyTransfer::where('uuid', $id)->orWhere('public_id', $id)->orWhere('id', $id)->first();
            if (!$transfer) {
                return response()->error('Không tìm thấy lệnh chuyển tiền.');
            }

            $validator = Validator::make($request->all(), [
                'approved_amount' => ['nullable', 'numeric', 'gte:0'],
            ], [
                'approved_amount.gte' => 'Số tiền phê duyệt không được âm.',
            ]);

            if ($validator->fails()) {
                return response()->error($validator->errors());
            }

            $approvedAmount = $request->filled('approved_amount')
                ? (float) $request->input('approved_amount')
                : (float) $transfer->amount;

            $transfer->update([
                'status'           => 'approved',
                'approved_amount'  => $approvedAmount,
                'approved_by_uuid' => $request->user()?->uuid,
                'approved_at'      => now(),
                'approval_note'    => $request->input('approval_note', $transfer->approval_note),
            ]);

            // Bắn notify cho cả người gửi và người nhận.
            $this->notifyDriver($this->resolveSenderDriver($transfer), $transfer, 'approved', 'sender');
            $this->notifyDriver($this->resolveReceiverDriver($transfer), $transfer, 'approved', 'receiver');

            // Duyệt làm thay đổi tiền tồn 2 xe → xoá cache để danh sách/panel xe cập nhật ngay.
            $this->clearResponseCache();

            VehicleMoneyTransferResource::wrap('vehicle_money_transfer');

            return new VehicleMoneyTransferResource($transfer);
        } catch (\Exception $e) {
            return response()->error($e->getMessage());
        }
    }

    /**
     * Admin từ chối một lệnh chuyển tiền. Không tính vào tiền tồn.
     */
    public function reject(Request $request, string $id)
    {
        try {
            $transfer = VehicleMoneyTransfer::where('uuid', $id)->orWhere('public_id', $id)->orWhere('id', $id)->first();
            if (!$transfer) {
                return response()->error('Không tìm thấy lệnh chuyển tiền.');
            }

            // Bắt buộc nhập lý do từ chối để lái xe biết.
            $validator = Validator::make($request->all(), [
                'approval_note' => ['required', 'string'],
            ], [
                'approval_note.required' => 'Vui lòng nhập lý do từ chối để lái xe được biết.',
            ]);

            if ($validator->fails()) {
                return response()->error($validator->errors());
            }

            $transfer->update([
                'status'           => 'rejected',
                'approved_amount'  => null,
                'approved_by_uuid' => $request->user()?->uuid,
                'approved_at'      => now(),
                'approval_note'    => $request->input('approval_note'),
            ]);

            // Bắn notify cho người gửi để họ biết lý do.
            $this->notifyDriver($this->resolveSenderDriver($transfer), $transfer, 'rejected', 'sender');

            // Trạng thái đổi (đã duyệt → từ chối) có thể ảnh hưởng tiền tồn → xoá cache.
            $this->clearResponseCache();

            VehicleMoneyTransferResource::wrap('vehicle_money_transfer');

            return new VehicleMoneyTransferResource($transfer);
        } catch (\Exception $e) {
            return response()->error($e->getMessage());
        }
    }

    /**
     * Hook search cho danh sách (admin web): tìm theo người thực hiện, xe chuyển, xe nhận, ghi chú.
     *
     * Mặc định param `query` của framework KHÔNG được áp dụng cho resource này → search không ăn.
     * Ở đây ta tự apply LIKE trên note + whereHas các quan hệ.
     *
     * @param \Illuminate\Database\Eloquent\Builder $builder
     */
    public function onQueryRecord($builder, Request $request)
    {
        if ($request->filled('query')) {
            $like = '%' . trim($request->input('query')) . '%';
            $builder->where(function ($w) use ($like) {
                $w->where('note', 'like', $like)
                  ->orWhere('public_id', 'like', $like)
                  ->orWhereHas('fromVehicle', function ($v) use ($like) {
                      $v->where('plate_number', 'like', $like);
                  })
                  ->orWhereHas('toVehicle', function ($v) use ($like) {
                      $v->where('plate_number', 'like', $like);
                  })
                  ->orWhereHas('createdBy', function ($u) use ($like) {
                      $u->where('name', 'like', $like);
                  })
                  ->orWhereHas('fromDriver.user', function ($u) use ($like) {
                      $u->where('name', 'like', $like);
                  })
                  ->orWhereHas('toDriver.user', function ($u) use ($like) {
                      $u->where('name', 'like', $like);
                  });
            });
        }

        return $builder;
    }

    /**
     * Người gửi = tài xế tạo lệnh (from_driver_uuid), fallback tài xế hiện tại của xe chuyển.
     */
    private function resolveSenderDriver(VehicleMoneyTransfer $transfer): ?Driver
    {
        if (!empty($transfer->from_driver_uuid)) {
            $driver = Driver::where('uuid', $transfer->from_driver_uuid)->first();
            if ($driver) {
                return $driver;
            }
        }

        return data_get($transfer, 'fromVehicle.driver');
    }

    /**
     * Người nhận = tài xế của xe nhận (to_driver_uuid snapshot), fallback tài xế hiện tại của xe nhận.
     */
    private function resolveReceiverDriver(VehicleMoneyTransfer $transfer): ?Driver
    {
        if (!empty($transfer->to_driver_uuid)) {
            $driver = Driver::where('uuid', $transfer->to_driver_uuid)->first();
            if ($driver) {
                return $driver;
            }
        }

        return data_get($transfer, 'toVehicle.driver');
    }

    /**
     * Gửi push cho 1 tài xế; bọc try/catch để không làm vỡ luồng duyệt/từ chối nếu push lỗi.
     */
    private function notifyDriver(?Driver $driver, VehicleMoneyTransfer $transfer, string $event, string $audience): void
    {
        if (!$driver) {
            return;
        }

        try {
            $driver->notify(new VehicleMoneyTransferStatus($transfer, $event, $audience));
        } catch (\Throwable $e) {
            Log::warning('[VehicleMoneyTransfer] notify failed: ' . $e->getMessage());
        }
    }

    /**
     * Xoá response cache (Spatie) sau khi tiền tồn xe thay đổi.
     * Route danh sách xe nội bộ bị cache nên nếu không xoá sẽ hiển thị số tồn cũ.
     */
    private function clearResponseCache(): void
    {
        try {
            ResponseCache::clear();
        } catch (\Throwable $e) {
            Log::warning('[VehicleMoneyTransfer] cache clear failed: ' . $e->getMessage());
        }
    }

    /**
     * Lấy uuid của xe từ payload, hỗ trợ cả dạng object {uuid} lẫn string uuid.
     */
    private function resolveId(Request $request, string $key): ?string
    {
        $value = $request->input($key);
        if (is_array($value)) {
            return $value['uuid'] ?? $request->input($key . '_uuid');
        }

        return $value ?? $request->input($key . '_uuid');
    }
}

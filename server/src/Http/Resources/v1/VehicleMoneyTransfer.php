<?php

namespace Fleetbase\FleetOps\Http\Resources\v1;

use Fleetbase\Http\Resources\FleetbaseResource;
use Fleetbase\Support\Http;

class VehicleMoneyTransfer extends FleetbaseResource
{
    /**
     * Transform the resource into an array.
     *
     * @param \Illuminate\Http\Request $request
     *
     * @return array
     */
    public function toArray($request)
    {
        return [
            'id'                => $this->when(Http::isInternalRequest(), $this->id, $this->public_id),
            'uuid'              => $this->when(Http::isInternalRequest(), $this->uuid),
            'public_id'         => $this->when(Http::isInternalRequest(), $this->public_id),
            'company_uuid'      => $this->when(Http::isInternalRequest(), $this->company_uuid),

            // Luôn trả vehicle uuid để App xác định hướng (chuyển đi / nhận về) theo xe của tài xế.
            'from_vehicle_uuid' => $this->from_vehicle_uuid,
            'to_vehicle_uuid'   => $this->to_vehicle_uuid,
            'from_driver_uuid'  => $this->when(Http::isInternalRequest(), $this->from_driver_uuid),
            'to_driver_uuid'    => $this->when(Http::isInternalRequest(), $this->to_driver_uuid),
            'created_by_uuid'   => $this->when(Http::isInternalRequest(), $this->created_by_uuid),

            'from_vehicle_name' => $this->from_vehicle_name,
            'to_vehicle_name'   => $this->to_vehicle_name,
            'from_driver_name'  => $this->from_driver_name,
            'to_driver_name'    => $this->to_driver_name,
            'created_by_name'   => $this->created_by_name,

            'amount'            => $this->amount,
            'approved_amount'   => $this->approved_amount,
            'currency'          => $this->currency,
            'note'              => $this->note,
            'transferred_at'    => $this->transferred_at,

            'status'            => $this->status,
            'approved_by_uuid'  => $this->when(Http::isInternalRequest(), $this->approved_by_uuid),
            'approved_by_name'  => $this->approved_by_name,
            'approved_at'       => $this->approved_at,
            'approval_note'     => $this->approval_note,

            'updated_at'        => $this->updated_at,
            'created_at'        => $this->created_at,
        ];
    }
}

<?php

namespace Fleetbase\FleetOps\Http\Resources\v1;

use Fleetbase\Http\Resources\FleetbaseResource;
use Fleetbase\LaravelMysqlSpatial\Types\Point;
use Fleetbase\Support\Http;

class ContactDebt extends FleetbaseResource
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
            'contact_uuid'       => $this->contact_uuid,
            'amount'             => (float)$this->amount,
            'note'               => $this->note,
            'received_at'        => $this->received_at,
            'updated_at'         => $this->updated_at,
            'created_at'         => $this->created_at,
        ];
    }

    /**
     * Transform the resource into an webhook payload.
     *
     * @return array
     */
    public function toWebhookPayload()
    {
        return [
            'id'                 => $this->public_id,
            'contact_uuid'       => $this->contact_uuid,
            'amount'             => (float)$this->amount,
            'note'               => $this->note,
            'received_at'        => $this->received_at,
            'updated_at'         => $this->updated_at,
            'created_at'         => $this->created_at,
        ];
    }
}

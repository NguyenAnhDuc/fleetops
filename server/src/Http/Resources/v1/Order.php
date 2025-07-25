<?php

namespace Fleetbase\FleetOps\Http\Resources\v1;

use Fleetbase\FleetOps\Support\Utils;
use Fleetbase\Http\Resources\Comment;
use Fleetbase\Http\Resources\File;
use Fleetbase\Http\Resources\FleetbaseResource;
use Fleetbase\Support\Http;
use Fleetbase\Support\Resolve;

class Order extends FleetbaseResource
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
            'id'                       => $this->when(Http::isInternalRequest(), $this->id, $this->public_id),
            'uuid'                     => $this->when(Http::isInternalRequest(), $this->uuid),
            'public_id'                => $this->when(Http::isInternalRequest(), $this->public_id),
            'internal_id'              => $this->internal_id,
            'company_uuid'             => $this->when(Http::isInternalRequest(), $this->company_uuid),
            'transaction_uuid'         => $this->when(Http::isInternalRequest(), $this->transaction_uuid),
            'customer_uuid'            => $this->when(Http::isInternalRequest(), $this->customer_uuid),
            'customer_type'            => $this->when(Http::isInternalRequest(), $this->customer_type),
            'facilitator_uuid'         => $this->when(Http::isInternalRequest(), $this->facilitator_uuid),
            'facilitator_type'         => $this->when(Http::isInternalRequest(), $this->facilitator_type),
            'payload_uuid'             => $this->when(Http::isInternalRequest(), $this->payload_uuid),
            'route_uuid'               => $this->when(Http::isInternalRequest(), $this->route_uuid),
            'purchase_rate_uuid'       => $this->when(Http::isInternalRequest(), $this->purchase_rate_uuid),
            'tracking_number_uuid'     => $this->when(Http::isInternalRequest(), $this->tracking_number_uuid),
            'driver_assigned_uuid'     => $this->when(Http::isInternalRequest(), $this->driver_assigned_uuid),
            'vehicle_assigned_uuid'    => $this->when(Http::isInternalRequest(), $this->vehicle_assigned_uuid),
            'service_quote_uuid'       => $this->when(Http::isInternalRequest(), $this->service_quote_uuid),
            'has_driver_assigned'      => $this->when(Http::isInternalRequest(), $this->has_driver_assigned),
            'is_scheduled'             => $this->when(Http::isInternalRequest(), $this->is_scheduled),
            'order_config_uuid'        => $this->when(Http::isInternalRequest(), $this->order_config_uuid),
            'order_config'             => $this->when(Http::isInternalRequest(), $this->whenLoaded('orderConfig', fn () => $this->orderConfig), data_get($this->orderConfig, 'public_id')),
            'custom_field_values'      => $this->when(Http::isInternalRequest(), $this->customFieldValues),
            'customer'                 => $this->setCustomerType(Resolve::resourceForMorph($this->customer_type, $this->customer_uuid)),
            'payload'                  => new Payload($this->payload),
            'facilitator'              => $this->setFacilitatorType(Resolve::resourceForMorph($this->facilitator_type, $this->facilitator_uuid)),
            'driver_assigned'          => new Driver($this->driverAssigned()->without(['jobs', 'currentJob'])->first()),
            'vehicle_assigned'         => new Vehicle($this->vehicleAssigned()->without(['fleets', 'vendor'])->first()),
            'tracking_number'          => new TrackingNumber($this->trackingNumber),
            'tracking_statuses'        => $this->whenLoaded('trackingStatuses', fn () => TrackingStatus::collection($this->trackingStatuses)),
            'tracking'                 => $this->when(Http::isInternalRequest(), $this->trackingNumber ? $this->trackingNumber->tracking_number : null),
            'barcode'                  => $this->when(Http::isInternalRequest(), $this->trackingNumber ? $this->trackingNumber->barcode : null),
            'qr_code'                  => $this->when(Http::isInternalRequest(), $this->trackingNumber ? $this->trackingNumber->qr_code : null),
            'comments'                 => $this->when(Http::isInternalRequest(), Comment::collection($this->comments)),
            'files'                    => $this->when(Http::isInternalRequest(), $this->files, File::collection($this->files)),
            'purchase_rate'            => new PurchaseRate($this->purchaseRate),
            'notes'                    => $this->notes,
            ...$this->getCustomFieldValues(),
            'custom_fields'         => $this->when(Http::isPublicRequest(), fn () => $this->getCustomFieldKeys()),
            'type'                  => $this->type,
            'status'                => $this->status,
            'pod_method'            => $this->pod_method,
            'pod_required'          => (bool) data_get($this, 'pod_required', false),
            'dispatched'            => (bool) data_get($this, 'dispatched', false),
            'adhoc'                 => (bool) data_get($this, 'adhoc', false),
            'adhoc_distance'        => (int) $this->getAdhocDistance(),
            'distance'              => (int) $this->distance,
            'time'                  => (int) $this->time,
            'tracker_data'          => $this->when($request->has('with_tracker_data') || !empty($this->resource->tracker_data), fn () => $this->resource->tracker_data ?? $this->resource->tracker()->toArray()),
            'eta'                   => $this->when($request->has('with_eta') || !empty($this->resource->eta), fn () => $this->resource->eta ?? $this->resource->tracker()->eta()),
            'meta'                  => data_get($this, 'meta', []),
            'fees'                  => (int) $this->fees,
            'is_collected_fees'     => (bool) $this->is_collected_fees,
            'dispatched_at'         => $this->dispatched_at,
            'started_at'            => $this->started_at,
            'scheduled_at'          => $this->scheduled_at,
            'updated_at'            => $this->updated_at,
            'created_at'            => $this->created_at,
            'estimate_date'         => $this->estimate_date, //2025-05-08 QuyenPN
            'image_billing_uuid'    => $this->image_billing_uuid ?? [],
            'image_billing_urls'    => $this->image_billing_urls ?? [],
            'fees_driver'           => data_get($this, 'fees_driver', []),
            'is_receive_cash_fees'  => (bool) $this->is_receive_cash_fees,
            'quantity_fees'         => (int) $this->quantity_fees,
            'unit_price_fees'       => (float) $this->unit_price_fees,
            'is_fees_type_by_order' => (bool) $this->is_fees_type_by_order,
            'approval_fees'         => (float) $this->approval_fees,
            'is_finish'             => (bool) $this->is_finish,
        ];
    }

    /**
     * Set the customer type for the given data array.
     *
     * @param array $resolved the input data array
     *
     * @return array the modified data array with the customer type set
     */
    public function setCustomerType($resolved)
    {
        if (empty($resolved)) {
            return $resolved;
        }

        data_set($resolved, 'type', 'customer');
        data_set($resolved, 'customer_type', 'customer-' . Utils::toEmberResourceType($this->customer_type));

        return $resolved;
    }

    /**
     * Set the facilitator type for the given data array.
     *
     * @param array $resolved the input data array
     *
     * @return array the modified data array with the facilitator type set
     */
    public function setFacilitatorType($resolved)
    {
        if (empty($resolved)) {
            return $resolved;
        }

        data_set($resolved, 'type', 'facilitator');
        data_set($resolved, 'facilitator_type', 'facilitator-' . Utils::toEmberResourceType($this->facilitator_type));

        return $resolved;
    }

    /**
     * Transform the resource into an webhook payload.
     *
     * @return array
     */
    public function toWebhookPayload()
    {
        return [
            'id'              => $this->public_id,
            'internal_id'     => $this->internal_id,
            'customer'        => Resolve::resourceForMorph($this->customer_type, $this->customer_uuid),
            'payload'         => new Payload($this->payload),
            'facilitator'     => Resolve::resourceForMorph($this->facilitator_type, $this->facilitator_uuid),
            'driver_assigned' => new Driver($this->driverAssigned),
            'tracking_number' => new TrackingNumber($this->trackingNumber),
            'purchase_rate'   => new PurchaseRate($this->purchaseRate),
            'notes'           => $this->notes ?? '',
            'type'              => $this->type ?? null,
            'status'            => $this->status,
            'adhoc'             => $this->adhoc,
            'meta'              => $this->meta ?? [],
            'fees'              => (float) $this->fees,
            'is_collected_fees' => (bool) $this->is_collected_fees,
            'dispatched_at'     => $this->dispatched_at,
            'started_at'        => $this->started_at,
            'scheduled_at'      => $this->scheduled_at,
            'updated_at'        => $this->updated_at,
            'created_at'        => $this->created_at,
            'estimate_date'     => $this->estimate_date, //2025-05-08 QuyenPN
            'image_billing_uuid'    => $this->image_billing_uuid ?? [],
            'image_billing_urls'    => $this->image_billing_urls ?? [],
            'fees_driver'       => $this->fees_driver ?? [],
            'is_receive_cash_fees'  => (bool) $this->is_receive_cash_fees,
            'quantity_fees'         => (int) $this->quantity_fees,
            'unit_price_fees'       => (float) $this->unit_price_fees,
            'is_fees_type_by_order' => (bool) $this->is_fees_type_by_order,
            'approval_fees'         => (float) $this->approval_fees,
            'is_finish'         => (bool) $this->is_finish
        ];
    }
}

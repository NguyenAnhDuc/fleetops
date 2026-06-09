<?php

namespace Fleetbase\FleetOps\Models;

use Fleetbase\Models\Model;
use Fleetbase\Models\User;
use Fleetbase\Traits\HasApiModelBehavior;
use Fleetbase\Traits\HasPublicId;
use Fleetbase\Traits\HasUuid;
use Fleetbase\Traits\Searchable;
use Fleetbase\Traits\TracksApiCredential;

class VehicleMoneyTransfer extends Model
{
    use HasUuid;
    use HasPublicId;
    use HasApiModelBehavior;
    use TracksApiCredential;
    use Searchable;

    /**
     * The database table used by the model.
     *
     * @var string
     */
    protected $table = 'vehicle_money_transfers';

    /**
     * The type of public Id to generate.
     *
     * @var string
     */
    protected $publicIdType = 'transfer';

    /**
     * These attributes that can be queried.
     *
     * @var array
     */
    protected $searchableColumns = [
        'public_id',
        'fromVehicle.plate_number',
        'toVehicle.plate_number',
        'fromDriver.user.name',
        'toDriver.user.name',
        'note',
    ];

    /**
     * The attributes that are mass assignable.
     *
     * @var array
     */
    protected $fillable = [
        'company_uuid',
        'from_vehicle_uuid',
        'to_vehicle_uuid',
        'from_driver_uuid',
        'to_driver_uuid',
        'created_by_uuid',
        'amount',
        'approved_amount',
        'currency',
        'note',
        'transferred_at',
        'status',
        'approved_by_uuid',
        'approved_at',
        'approval_note',
    ];

    /**
     * The attributes that should be cast to native types.
     *
     * @var array
     */
    protected $casts = [
        'amount'          => 'decimal:2',
        'approved_amount' => 'decimal:2',
        'transferred_at'  => 'datetime',
        'approved_at'     => 'datetime',
    ];

    /**
     * Dynamic attributes that are appended to object.
     *
     * @var array
     */
    protected $appends = ['from_vehicle_name', 'to_vehicle_name', 'from_driver_name', 'to_driver_name', 'created_by_name', 'approved_by_name'];

    /**
     * The attributes excluded from the model's JSON form.
     *
     * @var array
     */
    protected $hidden = ['fromVehicle', 'toVehicle', 'fromDriver', 'toDriver', 'createdBy', 'approvedBy'];

    /**
     * Filterable attributes/parameters.
     *
     * @var array
     */
    protected $filterParams = ['status', 'from_vehicle', 'to_vehicle'];

    /**
     * @return \Illuminate\Database\Eloquent\Relations\BelongsTo
     */
    public function fromVehicle()
    {
        return $this->belongsTo(Vehicle::class, 'from_vehicle_uuid', 'uuid')->without(['driver']);
    }

    /**
     * @return \Illuminate\Database\Eloquent\Relations\BelongsTo
     */
    public function toVehicle()
    {
        return $this->belongsTo(Vehicle::class, 'to_vehicle_uuid', 'uuid')->without(['driver']);
    }

    /**
     * @return \Illuminate\Database\Eloquent\Relations\BelongsTo
     */
    public function fromDriver()
    {
        return $this->belongsTo(Driver::class, 'from_driver_uuid', 'uuid')->without(['vehicle']);
    }

    /**
     * @return \Illuminate\Database\Eloquent\Relations\BelongsTo
     */
    public function toDriver()
    {
        return $this->belongsTo(Driver::class, 'to_driver_uuid', 'uuid')->without(['vehicle']);
    }

    /**
     * @return \Illuminate\Database\Eloquent\Relations\BelongsTo
     */
    public function createdBy()
    {
        return $this->belongsTo(User::class, 'created_by_uuid', 'uuid');
    }

    /**
     * @return \Illuminate\Database\Eloquent\Relations\BelongsTo
     */
    public function approvedBy()
    {
        return $this->belongsTo(User::class, 'approved_by_uuid', 'uuid');
    }

    public function getFromVehicleNameAttribute()
    {
        // Hiển thị Biển số xe
        return data_get($this, 'fromVehicle.plate_number');
    }

    public function getToVehicleNameAttribute()
    {
        // Hiển thị Biển số xe
        return data_get($this, 'toVehicle.plate_number');
    }

    public function getFromDriverNameAttribute()
    {
        return data_get($this, 'fromDriver.name');
    }

    public function getToDriverNameAttribute()
    {
        return data_get($this, 'toDriver.name');
    }

    public function getCreatedByNameAttribute()
    {
        return data_get($this, 'createdBy.name');
    }

    public function getApprovedByNameAttribute()
    {
        return data_get($this, 'approvedBy.name');
    }
}

<?php

namespace Fleetbase\FleetOps\Models;

use Fleetbase\Casts\Json;
use Fleetbase\FleetOps\Casts\Point;
use Fleetbase\FleetOps\Support\Utils;
use Fleetbase\LaravelMysqlSpatial\Eloquent\SpatialTrait;
use Fleetbase\Models\Model;
use Fleetbase\Models\User;
use Fleetbase\Traits\HasApiModelBehavior;
use Fleetbase\Traits\HasPublicId;
use Fleetbase\Traits\HasUuid;
use Fleetbase\Traits\Searchable;
use Fleetbase\Traits\TracksApiCredential;

class ContactDebt extends Model
{
    use HasUuid;
    use TracksApiCredential;
    use HasPublicId;
    use HasApiModelBehavior;
    use SpatialTrait;
    use Searchable;

    /**
     * The database table used by the model.
     *
     * @var string
     */
    protected $table = 'contact_debts';

    /**
     * The type of public Id to generate.
     *
     * @var string
     */
    protected $publicIdType = 'contact_debt';

    /**
     * These attributes that can be queried.
     *
     * @var array
     */
    protected $searchableColumns = ['note', 'contact.name'];

    /**
     * The attributes that are mass assignable.
     *
     * @var array
     */
    protected $fillable = [
        'contact_uuid',
        'amount',
        'received_at',
        'note',
    ];

    /**
     * The attributes that are spatial columns.
     *
     * @var array
     */
    protected $spatialFields = [];

    /**
     * The attributes that should be cast to native types.
     *
     * @var array
     */
    protected $casts = [
       
    ];

    /**
     * Dynamic attributes that are appended to object.
     *
     * @var array
     */
    protected $appends = [];

    /**
     * The attributes excluded from the model's JSON form.
     *
     * @var array
     */
    protected $hidden = [];

    /**
     * Filterable attributes/parameters.
     *
     * @var array
     */
    protected $filterParams = ['note'];

    /**
     * @return \Illuminate\Database\Eloquent\Relations\BelongsTo
     */
    public function contact()
    {
        return $this->belongsTo(Contact::class);
    }
}

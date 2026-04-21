<?php

namespace Fleetbase\FleetOps\Http\Filter;

use Carbon\Carbon;
use Fleetbase\FleetOps\Support\Utils;
use Fleetbase\Http\Filter\Filter;
use Fleetbase\Support\Http;
use Illuminate\Support\Arr;
use Illuminate\Support\Str;

class OrderFilter extends Filter
{
    public function queryForInternal()
    {
        $this->builder
            ->where('company_uuid', $this->request->session()->get('company'))
            ->whereHas(
                'payload',
                function ($q) {
                    $q->where(
                        function ($q) {
                            $q->whereHas('waypoints');
                            $q->orWhereHas('pickup');
                            $q->orWhereHas('dropoff');
                        }
                    );
                    $q->with(['entities', 'waypoints', 'dropoff', 'pickup', 'return']);
                }
            )
            ->whereHas('trackingNumber')
            ->whereHas('trackingStatuses')
            ->with(
                [
                    'payload',
                    'trackingNumber',
                    'trackingStatuses',
                    'driverAssigned',
                ]
            );
    }

    public function queryForPublic()
    {
        $this->builder->where('company_uuid', $this->session->get('company'));
    }

    public function query(?string $query)
    {
        if (!$query) {
            return;
        }

        $query = trim($query);
        // Chuẩn hoá khoảng trắng giữa 2 ngày (nhiều space, tab → 1 space)
        $normalized = preg_replace('/\s+/', ' ', $query);

        // 1) Detect full date range: "2025-10-01 2025-11-01" hoặc single "2025-10-01"
        // Format: yyyy-MM-dd
        $fullDatePattern = '/^(\d{4}-\d{1,2}-\d{1,2})(?:\s+(\d{4}-\d{1,2}-\d{1,2}))?$/';
        if (preg_match($fullDatePattern, $normalized, $matches)) {
            try {
                $date1 = Carbon::parse($matches[1])->startOfDay();

                if (!empty($matches[2])) {
                    $date2 = Carbon::parse($matches[2])->endOfDay();
                    // Đảm bảo date1 <= date2
                    if ($date1->gt($date2)) {
                        [$date1, $date2] = [$date2->startOfDay(), $date1->endOfDay()];
                    }
                    $this->builder->whereBetween('scheduled_at', [$date1, $date2]);
                } else {
                    $this->builder->whereDate('scheduled_at', $date1->toDateString());
                }
            } catch (\Exception $e) {
                // Không parse được → fallback về text search
            }
            return;
        }

        // 2) Detect short date range: "04-06 07-06" hoặc single date "04-06"
        // Format: dd-MM (ngày-tháng), năm lấy hiện tại
        $datePattern = '/^(\d{1,2}-\d{1,2})(?:\s+(\d{1,2}-\d{1,2}))?$/';
        if (preg_match($datePattern, $normalized, $matches)) {
            $year = (int) date('Y');
            try {
                [$d1, $m1] = explode('-', $matches[1]);
                $date1 = Carbon::createFromDate($year, (int) $m1, (int) $d1)->startOfDay();

                if (!empty($matches[2])) {
                    // Khoảng ngày
                    [$d2, $m2] = explode('-', $matches[2]);
                    $date2 = Carbon::createFromDate($year, (int) $m2, (int) $d2)->endOfDay();
                    if ($date1->gt($date2)) {
                        [$date1, $date2] = [$date2->startOfDay(), $date1->endOfDay()];
                    }
                    $this->builder->whereBetween('scheduled_at', [$date1, $date2]);
                } else {
                    // Ngày đơn
                    $this->builder->whereDate('scheduled_at', $date1->toDateString());
                }
            } catch (\Exception $e) {
                // Không parse được → fallback về text search
            }
            return;
        }

        // Multi-field text search
        $like = '%' . $query . '%';
        $this->builder->where(function ($builder) use ($like) {
            // Tài xế — search qua user name (drivers join users)
            $builder->orWhereHas('driverAssigned', function ($q) use ($like) {
                $q->whereHas('user', function ($q) use ($like) {
                    $q->where('users.name', 'LIKE', $like);
                });
            });

            // Khách hàng — search thẳng vào contacts và vendors
            $builder->orWhereExists(function ($sub) use ($like) {
                $sub->from('contacts')
                    ->whereColumn('contacts.uuid', 'orders.customer_uuid')
                    ->where('contacts.name', 'LIKE', $like);
            });
            $builder->orWhereExists(function ($sub) use ($like) {
                $sub->from('vendors')
                    ->whereColumn('vendors.uuid', 'orders.customer_uuid')
                    ->where('vendors.name', 'LIKE', $like);
            });

            // Địa chỉ nhận/giao hàng — prefix places. để tránh ambiguous
            $builder->orWhereHas('payload', function ($q) use ($like) {
                $q->where(function ($q) use ($like) {
                    $q->orWhereHas('pickup', function ($q) use ($like) {
                        $q->where('places.name', 'LIKE', $like)
                          ->orWhere('places.street1', 'LIKE', $like)
                          ->orWhere('places.street2', 'LIKE', $like)
                          ->orWhere('places.city', 'LIKE', $like)
                          ->orWhere('places.province', 'LIKE', $like)
                          ->orWhere('places.district', 'LIKE', $like)
                          ->orWhere('places.neighborhood', 'LIKE', $like)
                          ->orWhere('places.postal_code', 'LIKE', $like);
                    });
                    $q->orWhereHas('dropoff', function ($q) use ($like) {
                        $q->where('places.name', 'LIKE', $like)
                          ->orWhere('places.street1', 'LIKE', $like)
                          ->orWhere('places.street2', 'LIKE', $like)
                          ->orWhere('places.city', 'LIKE', $like)
                          ->orWhere('places.province', 'LIKE', $like)
                          ->orWhere('places.district', 'LIKE', $like)
                          ->orWhere('places.neighborhood', 'LIKE', $like)
                          ->orWhere('places.postal_code', 'LIKE', $like);
                    });
                    $q->orWhereHas('waypoints', function ($q) use ($like) {
                        $q->where('places.name', 'LIKE', $like)
                          ->orWhere('places.street1', 'LIKE', $like)
                          ->orWhere('places.city', 'LIKE', $like)
                          ->orWhere('places.province', 'LIKE', $like);
                    });
                });
            });

            // Ngày lên lịch dạng text
            $builder->orWhereRaw("DATE_FORMAT(orders.scheduled_at, '%Y-%m-%d') LIKE ?", [$like]);
            $builder->orWhereRaw("DATE_FORMAT(orders.scheduled_at, '%d-%m-%Y') LIKE ?", [$like]);
        });
    }

    /**
     * Filter theo loại thu tiền (Thu tiền mặt / Công nợ).
     * Truyền `1` / `true` để lấy đơn Thu tiền; `0` / `false` để lấy đơn Công nợ.
     */
    public function isReceiveCashFees($value)
    {
        // Bỏ qua nếu không truyền hoặc truyền chuỗi rỗng
        if ($value === null || $value === '' || (is_string($value) && strtolower($value) === 'all')) {
            return;
        }

        // Chuẩn hoá về boolean
        $bool = filter_var($value, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
        if ($bool === null) {
            return;
        }

        if ($bool) {
            // Thu tiền: coi NULL như true (vì default DB là true)
            $this->builder->where(function ($q) {
                $q->where('is_receive_cash_fees', true)
                  ->orWhereNull('is_receive_cash_fees');
            });
        } else {
            $this->builder->where('is_receive_cash_fees', false);
        }
    }

    public function unassigned(bool $unassigned)
    {
        if ($unassigned) {
            $this->builder->where(
                function ($q) {
                    $q->whereDoesntHave('driverAssigned');
                    $q->whereNotIn('status', ['completed', 'canceled', 'expired']);
                }
            );
        }
    }

    public function tracking(string $tracking)
    {
        $this->builder->whereHas(
            'trackingNumber',
            function ($query) use ($tracking) {
                $query->where('tracking_number', $tracking);
            }
        );
    }

    public function active(bool $active = false)
    {
        if ($active) {
            $this->builder->where(
                function ($q) {
                    $q->whereHas('driverAssigned');
                    $q->whereNotIn('status', ['created', 'canceled', 'order_canceled', 'completed']);
                }
            );
        }
    }

    public function status(string $status)
    {
        // handle `active` alias status
        if ($status === 'active') {
            // active status is anything that is not these values
            $this->builder->whereNotIn('status', ['created', 'completed', 'expired', 'order_canceled', 'canceled', 'pending']);
            // remove the searchBuilder where clause
            $this->builder->removeWhereFromQuery('status', 'active');
        } elseif (is_string($status)) {
            $this->builder->where('status', $status);
        }

        // if status is array
        if ($this->request->isArray('status')) {
            $this->builder->whereIn('status', $status);
        }
    }

    public function customer(string $customer)
    {
        $this->builder->where(function ($query) use ($customer) {
            $query->where('customer_uuid', $customer);
            $query->orWhereHas('authenticatableCustomer', function ($query) use ($customer) {
                $query->where('user_uuid', $customer);
            });
        });
    }

    public function authenticatedCustomer(string $authenticatedCustomer)
    {
        $this->builder->whereHas('authenticatableCustomer', function ($query) use ($authenticatedCustomer) {
            $query->where('user_uuid', $authenticatedCustomer);
        });
    }

    public function facilitator(string $facilitator)
    {
        $this->builder->where('facilitator_uuid', $facilitator);
    }

    public function type(string $type)
    {
        $this->builder->where(function ($query) use ($type) {
            $query->where('type', $type);
            $query->orWhereHas('orderConfig', function ($query) use ($type) {
                $query->where('uuid', $type);
                $query->orWhere('public_id', $type);
                $query->orWhere('key', $type);
            });
        });
    }

    public function orderConfig(string $orderConfig)
    {
        $this->builder->whereHas('orderConfig', function ($query) use ($orderConfig) {
            $query->where('uuid', $orderConfig);
            $query->orWhere('public_id', $orderConfig);
            $query->orWhere('key', $orderConfig);
        });
    }

    public function payload(string $payload)
    {
        if (Str::isUuid($payload)) {
            $this->builder->where('payload_uuid', $payload);
        } else {
            $this->builder->whereHas(
                'payload',
                function ($query) use ($payload) {
                    $query->where('public_id', $payload);
                }
            );
        }
    }

    public function pickup(string $pickup)
    {
        $this->builder->whereHas(
            'payload',
            function ($query) use ($pickup) {
                if (Str::isUuid($pickup)) {
                    $query->where('pickup_uuid', $pickup);
                } else {
                    $query->whereHas(
                        'dropoff',
                        function ($query) use ($pickup) {
                            $query->where('public_id', $pickup);
                            $query->orWhere('internal_id', $pickup);
                        }
                    );
                }
            }
        );
    }

    public function dropoff(string $dropoff)
    {
        $this->builder->whereHas(
            'payload',
            function ($query) use ($dropoff) {
                if (Str::isUuid($dropoff)) {
                    $query->where('dropoff_uuid', $dropoff);
                } else {
                    $query->whereHas(
                        'dropoff',
                        function ($query) use ($dropoff) {
                            $query->where('public_id', $dropoff);
                            $query->orWhere('internal_id', $dropoff);
                        }
                    );
                }
            }
        );
    }

    public function return(string $return)
    {
        $this->builder->whereHas(
            'payload',
            function ($query) use ($return) {
                if (Str::isUuid($return)) {
                    $query->where('return_uuid', $return);
                } else {
                    $query->whereHas(
                        'return',
                        function ($query) use ($return) {
                            $query->where('public_id', $return);
                            $query->orWhere('internal_id', $return);
                        }
                    );
                }
            }
        );
    }

    public function driver(string $driver)
    {
        if (Str::isUuid($driver)) {
            $this->builder->where('driver_assigned_uuid', $driver);
        } else {
            $this->builder->where(function () use ($driver) {
                $this->builder->whereHas(
                    'driverAssigned',
                    function ($query) use ($driver) {
                        $query->where('public_id', $driver);
                        $query->orWhere('internal_id', $driver);
                    }
                );
                // REMOVED: include entities which can be assigned drivers
                // $this->builder->orWhereHas('payload.entities', function ($query) use ($driver) {
                //     $query->whereNotNull('driver_assigned_uuid');
                //     $query->whereHas(
                //         'driver',
                //         function ($query) use ($driver) {
                //             $query->where('public_id', $driver);
                //             $query->orWhere('internal_id', $driver);
                //         }
                //     );
                // });
            });
        }
    }

    public function driverAssigned(string $driver)
    {
        $this->driver($driver);
    }

    public function sort(string $sort)
    {
        list($param, $direction) = Http::useSort($sort);

        switch ($param) {
            case 'tracking':
            case 'tracking_number':
                $this->builder->addSelect(['tns.tracking_number as tracking']);
                $this->builder->join('tracking_numbers as tns', 'tns.uuid', '=', 'orders.tracking_number_uuid')->orderBy('tracking', $direction);
                break;

            case 'customer':
                $this->builder->select(['orders.*', 'contacts.name as customer_name']);
                $this->builder->join('contacts', 'contacts.uuid', '=', 'orders.customer_uuid')->orderBy('customer_name', $direction);
                break;

            case 'facilitator':
                $this->builder->select(['orders.*', 'vendors.name as facilitator_name']);
                $this->builder->join('vendors', 'vendors.uuid', '=', 'orders.facilitator_uuid')->orderBy('facilitator_name', $direction);
                break;

            case 'pickup':
                $this->builder->select(['orders.*', 'places.name as pickup_name']);
                $this->builder->join('payloads', 'payloads.uuid', '=', 'orders.payload_uuid');
                $this->builder->join('places', 'places.uuid', '=', 'payloads.pickup_uuid')->orderBy('pickup_name', $direction);
                break;

            case 'dropoff':
                $this->builder->select(['orders.*', 'places.name as dropoff_name']);
                $this->builder->join('payloads', 'payloads.uuid', '=', 'orders.payload_uuid');
                $this->builder->join('places', 'places.uuid', '=', 'payloads.dropoff_uuid')->orderBy('dropoff_name', $direction);
                break;
        }

        return $this->builder;
    }

    public function exclude($exclude)
    {
        $exclude = Utils::arrayFrom($exclude);
        if (is_array($exclude)) {
            $isUuids = Arr::every($exclude, function ($id) {
                return Str::isUuid($id);
            });

            if ($isUuids) {
                $this->builder->whereNotIn('uuid', $exclude);
            } else {
                $this->builder->whereNotIn('public_id', $exclude);
            }
        }
    }
}

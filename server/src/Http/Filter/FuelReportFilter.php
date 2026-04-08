<?php

namespace Fleetbase\FleetOps\Http\Filter;

use Fleetbase\FleetOps\Support\Utils;
use Fleetbase\Http\Filter\Filter;
use Illuminate\Support\Str;

class FuelReportFilter extends Filter
{
    public function queryForInternal()
    {
        $this->builder->where('company_uuid', $this->session->get('company'));
    }

    public function queryForPublic()
    {
        $this->builder->where('company_uuid', $this->session->get('company'));
    }

    public function query(?string $searchQuery)
    {
        if (empty($searchQuery)) {
            return;
        }

        $this->builder->where(function ($q) use ($searchQuery) {
            // Tìm theo ID hoặc Report
            $q->where('report', 'LIKE', '%' . $searchQuery . '%')
              ->orWhere('public_id', 'LIKE', '%' . $searchQuery . '%');

            // Tìm theo ngày đổ dầu (nhập dạng DD/MM/YYYY, DD-MM-YYYY, hoặc YYYY-MM-DD)
            $q->orWhereRaw('DATE_FORMAT(fueled_at, "%d/%m/%Y") LIKE ?', ['%' . $searchQuery . '%'])
              ->orWhereRaw('DATE_FORMAT(fueled_at, "%d-%m-%Y") LIKE ?', ['%' . $searchQuery . '%'])
              ->orWhereRaw('DATE_FORMAT(fueled_at, "%Y-%m-%d") LIKE ?', ['%' . $searchQuery . '%']);

            // Tìm theo tên tài xế (qua user.name vì Driver không có cột name trực tiếp)
            $q->orWhereHas('driver', function ($dq) use ($searchQuery) {
                $dq->whereHas('user', function ($uq) use ($searchQuery) {
                    $uq->where('name', 'LIKE', '%' . $searchQuery . '%');
                });
            });

            // Tìm theo biển số/hãng xe/model (Vehicle không có cột name)
            $q->orWhereHas('vehicle', function ($vq) use ($searchQuery) {
                $vq->where('plate_number', 'LIKE', '%' . $searchQuery . '%')
                   ->orWhere('make', 'LIKE', '%' . $searchQuery . '%')
                   ->orWhere('model', 'LIKE', '%' . $searchQuery . '%')
                   ->orWhere('trim', 'LIKE', '%' . $searchQuery . '%');
            });
        });
    }

    public function publicId(?string $publicId)
    {
        $this->builder->searchWhere('public_id', $publicId);
    }

    public function volume(?string $volume)
    {
        $this->builder->searchWhere('volume', $volume);
    }

    public function odometer(?string $odometer)
    {
        $this->builder->searchWhere('odometer', $odometer);
    }

    public function reporter(?string $reporter)
    {
        $this->builder->whereHas('reportedBy', function ($q) use ($reporter) {
            if (Str::isUuid($reporter)) {
                $q->where('uuid', $reporter);
            } elseif (Utils::isPublicId($reporter)) {
                $q->where('public_id', $reporter);
            } else {
                $q->search($reporter);
            }
        });
    }

    public function createdAt($createdAt)
    {
        $createdAt = Utils::dateRange($createdAt);

        if (is_array($createdAt)) {
            $this->builder->whereBetween('created_at', $createdAt);
        } else {
            $this->builder->whereDate('created_at', $createdAt);
        }
    }

    public function fueledAt($fueledAt)
    {
        $fueledAt = Utils::dateRange($fueledAt);

        if (is_array($fueledAt)) {
            $this->builder->whereBetween('fueled_at', $fueledAt);
        } else {
            $this->builder->whereDate('fueled_at', $fueledAt);
        }
    }

    public function updatedAt($updatedAt)
    {
        $updatedAt = Utils::dateRange($updatedAt);

        if (is_array($updatedAt)) {
            $this->builder->whereBetween('updated_at', $updatedAt);
        } else {
            $this->builder->whereDate('updated_at', $updatedAt);
        }
    }

    public function driver(?string $driver)
    {
        $this->builder->whereHas('driver', function ($q) use ($driver) {
            if (Str::isUuid($driver)) {
                $q->where('uuid', $driver);
            } elseif (Utils::isPublicId($driver)) {
                $q->where('public_id', $driver);
            } else {
                $q->search($driver);
            }
        });
    }

    public function vehicle(?string $vehicle)
    {
        $this->builder->whereHas('vehicle', function ($q) use ($vehicle) {
            if (Str::isUuid($vehicle)) {
                $q->where('uuid', $vehicle);
            } elseif (Utils::isPublicId($vehicle)) {
                $q->where('public_id', $vehicle);
            } else {
                $q->search($vehicle);
            }
        });
    }

    public function status($status)
    {
        if (Str::contains($status, ',')) {
            $status = explode(',', $status);
        }

        if (is_array($status)) {
            $this->builder->whereIn('status', $status);
        } else {
            $this->builder->where('status', $status);
        }
    }
}

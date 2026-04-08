<?php

namespace Fleetbase\FleetOps\Http\Requests;

class UpdateFuelReportRequest extends CreateFuelReportRequest
{
    /**
     * Get the validation rules that apply to the request.
     *
     * @return array
     */
    public function rules()
    {
        return [
            'driver'          => ['nullable'],
            'vehicle'         => ['nullable'],
            'odometer'        => ['required', 'numeric', 'min:0'],
            'volume'          => ['required', 'numeric', 'min:0'],
            'unit_price'      => ['required', 'numeric', 'min:0'],
            'fueled_at'       => ['required', 'date'],
            'metric_unit'     => ['nullable'],
            'location'        => ['nullable'],
            'amount'          => ['nullable'],
            'volume_extra'    => ['nullable', 'numeric', 'min:0'],
            'amount_extra'    => ['nullable', 'numeric', 'min:0'],
        ];
    }

    /**
     * Get custom messages for validator errors.
     *
     * @return array
     */
    public function messages()
    {
        return [
            'odometer.required'   => 'Vui lòng nhập Công tơ mét.',
            'odometer.numeric'    => 'Công tơ mét phải là số.',
            'odometer.min'        => 'Công tơ mét không được là số âm.',
            'volume.required'     => 'Vui lòng nhập Khối lượng.',
            'volume.numeric'      => 'Khối lượng phải là số.',
            'volume.min'          => 'Khối lượng không được là số âm.',
            'unit_price.required' => 'Vui lòng nhập Đơn giá.',
            'unit_price.numeric'  => 'Đơn giá phải là số.',
            'unit_price.min'      => 'Đơn giá không được là số âm.',
            'fueled_at.required'  => 'Vui lòng nhập Ngày đổ dầu.',
            'fueled_at.date'      => 'Ngày đổ dầu không hợp lệ.',
            'volume_extra.min'    => 'Khối lượng cộng thêm không được là số âm.',
            'amount_extra.min'    => 'Chi phí cộng thêm không được là số âm.',
        ];
    }
}

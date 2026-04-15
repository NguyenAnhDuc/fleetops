<?php

namespace Fleetbase\FleetOps\Http\Requests;

use Fleetbase\Http\Requests\FleetbaseRequest;

class CreateIssueRequest extends FleetbaseRequest
{
    /**
     * Determine if the user is authorized to make this request.
     *
     * @return bool
     */
    public function authorize()
    {
        return request()->session()->has('api_credential') || request()->session()->has('is_sanctum_token');
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array
     */
    public function rules()
    {
        return [
            'driver'       => ['nullable'],
            'location'     => ['nullable'],
            'report'       => ['nullable'],
            'category'     => ['nullable'],
            'type'         => ['nullable'],
            'priority'     => ['nullable'],
            'items'        => ['nullable', 'array'],
            'items.*.name' => ['required_with:items', 'string'],
            'items.*.money'=> ['required_with:items', 'numeric', 'min:0'],
        ];
    }
}

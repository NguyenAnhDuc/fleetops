<?php

namespace Fleetbase\FleetOps\Http\Requests;

class UpdateIssueRequest extends CreateIssueRequest
{
    /**
     * Get the validation rules that apply to the request.
     *
     * @return array
     */
    public function rules()
    {
        return [
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

<?php

namespace Fleetbase\FleetOps\Http\Controllers\Api\v1;

use Fleetbase\FleetOps\Http\Requests\ContactDebtRequest;
use Fleetbase\FleetOps\Http\Requests\UpdateContactDebtRequest;
use Fleetbase\FleetOps\Http\Resources\v1\ContactDebt as ContactDebtResource;
use Fleetbase\FleetOps\Models\Contact;
use Fleetbase\FleetOps\Models\ContactDebt;
use Fleetbase\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Fleetbase\FleetOps\Support\Utils;

class ContactDebtController extends Controller
{
    /**
     * Creates a new Fleetbase FuelReport resource.
     *
     * @param \Fleetbase\Http\Requests\ContactDebtRequest $request
     *
     * @return \Fleetbase\Http\Resources\Entity
     */
    public function create(ContactDebtRequest $request)
    {
        // get request input
        $input = $request->only([
            'contact_uuid',
            'amount',
            'received_at',
            'note',
        ]);

        $input['amount'] = Utils::numbersOnly($input['amount']); 

        // Find Contact
        try {
            $driver = Contact::findRecordOrFail($request->input('contact_uuid'));
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $exception) {
            return response()->json(
                [
                    'error' => 'Contact resource not found.',
                ],
                404
            );
        }

        // create the Contact Debt
        $contactDebt = ContactDebt::create($input);

        // response the Contact Debt resource
        return new ContactDebtResource($contactDebt);
    }

    /**
     * Updates new Fleetbase FuelReport resource.
     *
     * @param string                                           $id
     * @param \Fleetbase\Http\Requests\UpdateContactDebtRequest $request
     *
     * @return \Fleetbase\Http\Resources\ContactDebt
     */
    public function update($id, UpdateContactDebtRequest $request)
    {
        // find for the fuel report
        try {
            $contactDebt = ContactDebt::findRecordOrFail($id);
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $exception) {
            return response()->json(
                [
                    'error' => 'ContactDebt resource not found.',
                ],
                404
            );
        }

        $input = $request->only([
            'contact_uuid',
            'amount',
            'received_at',
            'note',
        ]);
        $input['amount'] = Utils::numbersOnly($input['amount']); 

        // update the fuel report
        $contactDebt->update($input);

        // response the fuel report resource
        return new ContactDebtResource($contactDebt);
    }

    /**
     * Query for Fleetbase FuelReport resources.
     *
     * @return \Fleetbase\Http\Resources\FleetCollection
     */
    public function query(Request $request)
    {
        $results = ContactDebt::queryWithRequest($request,  function (&$query, $request) {
            if($request->filled('contact_uuid')){
                $query->where('contact_uuid', $request->input('contact_uuid'));
            }

            if($request->filled('start_date')){
                $query->whereDate('received_at', '>=', $request->input('start_date'));
            }

            if($request->filled('end_date')){
                $query->whereDate('received_at', '<=', $request->input('end_date'));
            }
        });
        return ContactDebtResource::collection($results);
    }

    /**
     * Finds a single Fleetbase FuelReport resources.
     *
     * @return \Fleetbase\Http\Resources\ContactCollection
     */
    public function find($id)
    {
        // find for the fuel report
        try {
            $contactDebt = ContactDebt::findRecordOrFail($id);
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $exception) {
            return response()->json(
                [
                    'error' => 'ContactDebt resource not found.',
                ],
                404
            );
        }

        // response the fuel report resource
        return new ContactDebtResource($contactDebt);
    }

    /**
     * Deletes a Fleetbase ContactDebt resources.
     *
     * @return \Fleetbase\Http\Resources\FleetCollection
     */
    public function delete($id)
    {
        // find for the driver
        try {
            $contactDebt = ContactDebt::findRecordOrFail($id);
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $exception) {
            return response()->json(
                [
                    'error' => 'ContactDebt resource not found.',
                ],
                404
            );
        }

        // delete the fuel report
        $contactDebt->delete();

        // response the fuel report resource
        return new ContactDebtResource($contactDebt);
    }
}

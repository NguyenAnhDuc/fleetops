<?php

namespace Fleetbase\FleetOps\Http\Controllers\Api\v1;

use Dflydev\DotAccessData\Util;
use Fleetbase\FleetOps\Http\Requests\CreateIssueRequest;
use Fleetbase\FleetOps\Http\Requests\UpdateIssueRequest;
use Fleetbase\FleetOps\Http\Resources\v1\Issue as DeletedIssue;
use Fleetbase\FleetOps\Http\Resources\v1\Issue as IssueResource;
use Fleetbase\FleetOps\Models\Driver;
use Fleetbase\FleetOps\Models\Issue;
use Fleetbase\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Fleetbase\FleetOps\Support\Utils;

class IssueController extends Controller
{
    /**
     * Creates a new Fleetbase Issue resource.
     *
     * @param \Fleetbase\Http\Requests\CreateIssueRequest $request
     *
     * @return \Fleetbase\Http\Resources\Entity
     */
    public function create(CreateIssueRequest $request)
    {
        // get request input
        $input = $request->only([
            'driver',
            'location',
            'category',
            'type',
            'report',
            'priority',
            'status',
            'currency',
            'total_money',
            'car_repair_date',
            'image_uuid',
        ]);

        $input['total_money'] = Utils::numbersOnly($input['total_money']); 

        // Find driver who is reporting
        try {
            $driver = Driver::findRecordOrFail($request->input('driver'));
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $exception) {
            return response()->json(
                [
                    'error' => 'Driver reporting issue not found.',
                ],
                404
            );
        }

        // get the user uuid
        $input['company_uuid']      = $driver->company_uuid;
        $input['driver_uuid']       = $driver->uuid;
        $input['reported_by_uuid']  = $driver->user_uuid;
        $input['vehicle_uuid']      = $driver->vehicle_uuid;

        // create the issue
        $issue = Issue::create($input);

        // response the driver resource
        return new IssueResource($issue);
    }

    /**
     * Updates new Fleetbase Issue resource.
     *
     * @param string                                      $id
     * @param \Fleetbase\Http\Requests\UpdateIssueRequest $request
     *
     * @return \Fleetbase\Http\Resources\Issue
     */
    public function update($id, UpdateIssueRequest $request)
    {
        // find for the issue
        try {
            $issue = Issue::findRecordOrFail($id);
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $exception) {
            return response()->json(
                [
                    'error' => 'Issue resource not found.',
                ],
                404
            );
        }

        $input = $request->only([
            'category',
            'type',
            'report',
            'priority',
            'status',
            'currency',
            'total_money',
            'car_repair_date',
            'image_uuid',
        ]);
        $input['total_money'] = Utils::numbersOnly($input['total_money']); 
        // update the issue
        $issue->update($input);

        // response the issue resource
        return new IssueResource($issue);
    }

    /**
     * Query for Fleetbase Issue resources.
     *
     * @return \Fleetbase\Http\Resources\FleetCollection
     */
    public function query(Request $request)
    {
        $results = Issue::queryWithRequest($request,  function (&$query, $request) {
            if($request->filled('vehicle_id')){
                $query->where('vehicle_uuid', $request->input('vehicle_id'));
            }

            if($request->filled('start_date')){
                $query->whereDate('created_at', '>=', $request->input('start_date'));
            }

            if($request->filled('end_date')){
                $query->whereDate('created_at', '>=', $request->input('end_date'));
            }
        });

        return IssueResource::collection($results);
    }

    /**
     * Finds a single Fleetbase Issue resources.
     *
     * @return \Fleetbase\Http\Resources\ContactCollection
     */
    public function find($id)
    {
        // find for the issue
        try {
            $issue = Issue::findRecordOrFail($id);
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $exception) {
            return response()->json(
                [
                    'error' => 'Issue resource not found.',
                ],
                404
            );
        }

        // response the issue resource
        return new IssueResource($issue);
    }

    /**
     * Deletes a Fleetbase Issue resources.
     *
     * @return \Fleetbase\Http\Resources\FleetCollection
     */
    public function delete($id)
    {
        // find for the driver
        try {
            $issue = Issue::findRecordOrFail($id);
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $exception) {
            return response()->json(
                [
                    'error' => 'Issue resource not found.',
                ],
                404
            );
        }

        // delete the issue
        $issue->delete();

        // response the issue resource
        return new DeletedIssue($issue);
    }
}

<?php

namespace Fleetbase\FleetOps\Http\Controllers\Internal\v1;

use Fleetbase\FleetOps\Models\Driver;
use Fleetbase\Models\User;
use Fleetbase\FleetOps\Services\FirebaseService;
use Illuminate\Http\Request;
use Fleetbase\FleetOps\Http\Controllers\FleetOpsController;
use Fleetbase\FleetOps\Http\Controllers\Controller;

class NotiFirebaseController extends Controller
{
    public function send(Request $request, FirebaseService $firebase)
    {
        $data = $request->validate([
            'driver_id' => 'required|string',
            'title'     => 'required|string',
            'body'      => 'required|string',
            'data'      => 'array',
        ]);

        $user = User::where('public_id', $data['driver_id'])->first();
        if (!$user || !$user->notify_token) {
            return response()->json(['error' => 'Driver has no FCM token'], 400);
        }

        $result = $firebase->sendToToken(
            $user->notify_token,
            $data['title'],
            $data['body'],
            $data['data'] ?? []
        );

        return response()->json(['success' => true, 'result' => $result]);
    }
}

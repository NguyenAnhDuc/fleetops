<?php

namespace Fleetbase\FleetOps\Services;

use Google\Client as GoogleClient;
use Illuminate\Support\Facades\Http;

class FirebaseService
{
    protected string $projectId;
    protected string $credentialsPath;

    public function __construct()
    {
        // Lấy từ config services (xem bước 3) và file JSON trong storage
        $this->projectId      = config('services.firebase.project_id');
        $relativeCredentials  = config('services.firebase.credentials', 'firebase/service-account.json');
        $this->credentialsPath = storage_path($relativeCredentials);
    }

    protected function accessToken(): string
    {
        $client = new GoogleClient();
        $client->setAuthConfig($this->credentialsPath);
        $client->addScope('https://www.googleapis.com/auth/firebase.messaging');

        $token = $client->fetchAccessTokenWithAssertion();
        if (empty($token['access_token'])) {
            throw new \RuntimeException('Cannot obtain Google OAuth access token for FCM.');
        }
        return $token['access_token'];
    }

    /** Gửi 1 notify tới 1 device token */
    public function sendToToken(string $token, string $title, string $body, array $data = []): array
    {
        $url = "https://fcm.googleapis.com/v1/projects/{$this->projectId}/messages:send";
        $payload = [
            'message' => [
                'token' => $token,
                'notification' => ['title' => $title, 'body' => $body],
                'data' => $data,
            ],
            // data custom (dùng cho điều hướng, vv.)
            'data' => array_map('strval', $data), // FCM data nên là string

            // ---- iOS (APNs) ----
            'apns' => [
                'headers' => [
                    'apns-push-type' => 'alert',           // 'background' nếu silent
                    'apns-priority'  => '10',              // 10 cho alert; 5 nếu background
                    'apns-topic'     => 'ducna.xyz.navigator',         // *** BẮT BUỘC: bundle id ***
                ],
                'payload' => [
                    'aps' => [
                        'sound' => 'default',
                        'badge' => 1,
                        // nếu muốn hiển thị trong nền, thêm:
                        // 'content-available' => 1,
                        // và khi đó đừng gửi 'notification' nếu muốn pure-silent
                    ],
                ],
            ],

            // ---- Android (không ảnh hưởng iOS, nhưng thêm cho chuẩn) ----
            'android' => [
                'priority' => 'HIGH',
                'notification' => [
                    'sound' => 'default',
                    // 'channel_id' => 'default', // nếu có tạo channel
                ],
            ],

            // Optional: analytics tag
            'fcm_options' => [
                'analytics_label' => 'prod_push',
            ],
        ];

        $res = Http::withToken($this->accessToken())->post($url, $payload);
        if ($res->failed()) {
            // log lỗi chi tiết cho dễ debug
            logger()->error('[FCM] Send failed', ['status' => $res->status(), 'body' => $res->body()]);
        }
        return $res->json() ?? [];
    }
}

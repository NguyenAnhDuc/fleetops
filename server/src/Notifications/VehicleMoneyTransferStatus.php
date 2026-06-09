<?php

namespace Fleetbase\FleetOps\Notifications;

use Fleetbase\FleetOps\Models\VehicleMoneyTransfer;
use Fleetbase\Support\PushNotification;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Notification;
use NotificationChannels\Apn\ApnChannel;
use NotificationChannels\Fcm\FcmChannel;

/**
 * Thông báo cho tài xế về trạng thái lệnh chuyển tiền giữa các xe.
 *
 * - event = 'approved': bắn cho cả người gửi (sender) và người nhận (receiver).
 * - event = 'rejected': bắn cho người gửi (sender).
 *
 * audience = 'sender' | 'receiver' quyết định nội dung hiển thị.
 */
class VehicleMoneyTransferStatus extends Notification implements ShouldQueue
{
    use Queueable;

    public VehicleMoneyTransfer $transfer;
    public string $event;
    public string $audience;

    public string $title;
    public string $message;
    public array $data = [];

    public static string $name        = 'Vehicle Money Transfer Status';
    public static string $description  = 'Thông báo cho tài xế khi lệnh chuyển tiền được duyệt hoặc bị từ chối.';
    public static string $package      = 'fleet-ops';

    /**
     * @param string $event    'approved' | 'rejected'
     * @param string $audience 'sender' | 'receiver'
     */
    public function __construct(VehicleMoneyTransfer $transfer, string $event, string $audience)
    {
        $this->transfer  = $transfer;
        $this->event     = $event;
        $this->audience  = $audience;

        $fromVehicle = $transfer->from_vehicle_name ?: 'xe chuyển';
        $toVehicle   = $transfer->to_vehicle_name ?: 'xe nhận';
        $requested   = self::formatVnd($transfer->amount);
        $approved    = self::formatVnd($transfer->approved_amount);
        $note        = trim((string) $transfer->approval_note);

        if ($event === 'approved') {
            if ($audience === 'receiver') {
                $this->title   = 'Bạn nhận được một khoản chuyển tiền';
                $this->message = 'Xe ' . $fromVehicle . ' đã chuyển cho bạn ' . $approved . ' (đã được duyệt).';
            } else {
                $this->title   = 'Lệnh chuyển tiền đã được duyệt';
                $this->message = 'Lệnh chuyển tới ' . $toVehicle . ' đã được duyệt ' . $approved
                    . ($approved !== $requested ? ' (yêu cầu ' . $requested . ').' : '.');
            }
        } else {
            // rejected → chỉ gửi cho người gửi
            $this->title   = 'Lệnh chuyển tiền bị từ chối';
            $this->message = 'Lệnh chuyển ' . $requested . ' tới ' . $toVehicle . ' đã bị từ chối.'
                . ($note !== '' ? ' Lý do: ' . $note : '');
        }

        $this->data = [
            'id'       => $this->transfer->public_id,
            'type'     => 'vehicle_money_transfer_' . $event,
            'event'    => $event,
            'audience' => $audience,
        ];
    }

    /**
     * Định dạng tiền VND: 1.230.000 ₫.
     */
    protected static function formatVnd($value): string
    {
        return number_format((float) $value, 0, ',', '.') . ' ₫';
    }

    /**
     * Kênh gửi: push FCM + APN cho app tài xế.
     */
    public function via($notifiable)
    {
        return [FcmChannel::class, ApnChannel::class];
    }

    public function toArray()
    {
        return [
            'title' => $this->title,
            'body'  => $this->message,
            'data'  => $this->data,
        ];
    }

    public function toFcm($notifiable)
    {
        return PushNotification::createFcmMessage($this->title, $this->message, $this->data);
    }

    public function toApn($notifiable)
    {
        return PushNotification::createApnMessage($this->title, $this->message, $this->data, 'view_money_transfer');
    }
}

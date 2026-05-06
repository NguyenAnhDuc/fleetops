<?php

namespace Fleetbase\FleetOps\Exports;

use Maatwebsite\Excel\Concerns\WithMultipleSheets;

class DebtReportExport implements WithMultipleSheets
{
    protected $orders;       // debt_estimate rows
    protected $contactDebts; // debt_received rows
    protected $customers;    // contact_uuid => name map

    public function __construct($orders, $contactDebts, array $customers = [])
    {
        $this->orders       = $orders;
        $this->contactDebts = $contactDebts;
        $this->customers    = $customers; // ['uuid' => 'Tên KH']
    }

    public function sheets(): array
    {
        // byCustomer[$customerName][$monthKey] = ['month'=>M,'year'=>Y,'data'=>[...]]
        $byCustomer     = [];
        $sttByCustomerMonth = [];

        // ── Debt estimate (orders) ───────────────────────────────────
        foreach ($this->orders as $order) {
            $customerName = $order->customer?->name ?? 'Chưa_xác_định';
            $date         = $order->started_at;
            if (!$date) continue;

            $month    = (int) $date->format('n');
            $year     = (int) $date->format('Y');
            $monthKey = "{$year}_{$month}";

            $this->initSlot($byCustomer, $customerName, $monthKey, $month, $year);

            if (!isset($sttByCustomerMonth[$customerName][$monthKey])) {
                $sttByCustomerMonth[$customerName][$monthKey] = 0;
            }
            $stt = ++$sttByCustomerMonth[$customerName][$monthKey];

            $qty    = (float) ($order->quantity_fees ?? 0);
            $price  = (float) ($order->unit_price_fees ?? 0);
            $amount = $qty * $price;

            $pickup  = '';
            $dropoff = '';
            if ($order->payload) {
                if ($order->payload->pickup && empty($order->payload->pickup->city)) {
                    $pickup = $order->payload->pickup->address ?? '';
                }
                if ($order->payload->dropoff && empty($order->payload->dropoff->city)) {
                    $dropoff = $order->payload->dropoff->address ?? '';
                }
            }

            $plate   = $order->vehicleAssigned
                ? ($order->vehicleAssigned->plate_number ?: '')
                : '';
            $sku     = optional(optional($order->payload)->entities)->first()?->name ?? '';
            $note    = 'Đơn hàng # ' . str_replace('order_', '', $order->public_id);

            $byCustomer[$customerName][$monthKey]['data'][] = [
                $stt,                  // A: STT
                $date->format('d/m/y'),// B: Ngày
                $plate,                // C: Số xe
                $sku,                  // D: Tên hàng
                $pickup,               // E: Nơi nhận
                $dropoff,              // F: Nơi giao
                $qty   ?: '',          // G: SL
                $price ?: '',          // H: Đơn giá
                $amount ?: '',         // I: Thành tiền
                'Dự thu',              // J: Trạng thái
                $note,                 // K: Ghi chú
            ];
        }

        // ── Debt received (contact-debts) ────────────────────────────
        foreach ($this->contactDebts as $debt) {
            $contactUuid  = $debt->contact_uuid ?? '';
            $customerName = $this->customers[$contactUuid] ?? 'Chưa_xác_định';
            $date         = $debt->received_at;
            if (!$date) continue;

            $month    = (int) $date->format('n');
            $year     = (int) $date->format('Y');
            $monthKey = "{$year}_{$month}";

            $this->initSlot($byCustomer, $customerName, $monthKey, $month, $year);

            $amount = (float) ($debt->amount ?? 0);

            $byCustomer[$customerName][$monthKey]['data'][] = [
                '',                    // A: STT
                $date->format('d/m/y'),// B: Ngày
                '',                    // C: Số xe
                '',                    // D: Tên hàng
                '',                    // E: Nơi nhận
                '',                    // F: Nơi giao
                '', '',                // G,H
                $amount ?: '',         // I: Thành tiền
                'Đã nhận',             // J: Trạng thái
                $debt->note ?? '',     // K: Ghi chú
            ];
        }

        // ── Sort and build sheets ────────────────────────────────────
        $sheets = [];
        foreach ($byCustomer as $customerName => &$months) {
            ksort($months);
            foreach ($months as &$block) {
                usort($block['data'], function ($a, $b) {
                    return strtotime(str_replace('/', '-', $a[1])) <=>
                           strtotime(str_replace('/', '-', $b[1]));
                });
            }
            $sheets[] = new CustomerDebtSheet($customerName, array_values($months));
        }

        return $sheets;
    }

    private function initSlot(array &$byCustomer, string $name, string $monthKey, int $month, int $year): void
    {
        if (!isset($byCustomer[$name])) {
            $byCustomer[$name] = [];
        }
        if (!isset($byCustomer[$name][$monthKey])) {
            $byCustomer[$name][$monthKey] = ['month' => $month, 'year' => $year, 'data' => []];
        }
    }
}

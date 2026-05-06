<?php

namespace Fleetbase\FleetOps\Exports;

use Maatwebsite\Excel\Concerns\WithMultipleSheets;

class FinanceExport implements WithMultipleSheets
{
    protected $orders;
    protected $fuelReports;
    protected $issues;

    public function __construct($orders, $fuelReports, $issues)
    {
        $this->orders      = $orders;
        $this->fuelReports = $fuelReports;
        $this->issues      = $issues;
    }

    public function sheets(): array
    {
        // ── Step 1: group all rows by plate → month_key ─────────────
        // Structure: $byPlate[$plate][$monthKey] = ['month'=>M,'year'=>Y,'data'=>[...]]
        $byPlate = [];

        $sttByPlateMonth = []; // running STT counter per (plate, monthKey)

        foreach ($this->orders as $order) {
            $plate = $this->plateName($order->vehicleAssigned);
            $date  = $order->started_at;
            if (!$date) continue;

            $month    = (int) $date->format('n');
            $year     = (int) $date->format('Y');
            $monthKey = "{$year}_{$month}";

            $this->initSlot($byPlate, $plate, $monthKey, $month, $year);

            if (!isset($sttByPlateMonth[$plate][$monthKey])) {
                $sttByPlateMonth[$plate][$monthKey] = 0;
            }
            $stt = ++$sttByPlateMonth[$plate][$monthKey];

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

            $sku      = optional(optional($order->payload)->entities)->first()?->name ?? '';
            $customer = $order->customer?->name ?? '';

            $byPlate[$plate][$monthKey]['data'][] = [
                $stt,                                           // A: STT
                $date->format('d/m/y'),                        // B: Ngày
                $sku,                                          // C: Hàng
                $customer,                                     // D: nhà xe
                $pickup,                                       // E: Nơi Nhận
                $dropoff,                                      // F: Nơi trả
                $qty   ?: '',                                  // G: SL
                $price ?: '',                                  // H: DG
                $amount ?: '',                                 // I: TT
                '',                                            // J: lái xe chuyển (empty)
                (float)($order->driver_advance_fee ?? 0) ?: '',// K: ứng
                (float)($order->driver_earnings    ?? 0) ?: '',// L: thu cước
                (float)($order->approval_fees      ?? 0) ?: '',// M: duyệt chi
                (float)($order->driver_remittance  ?? 0) ?: '',// N: nộp cty
                '',                                            // O: chuyển xe (empty)
                '',                                            // P: Trừ lương (empty)
                '',                                            // Q: Trừ CP
                '',                                            // R: tồn
                '',                                            // S: lxe kê
                '',                                            // T: chênh CP
                '',                                            // U: tồn lxe
            ];
        }

        foreach ($this->fuelReports as $fuel) {
            $plate = $fuel->vehicle?->plate_number ?? 'Chua_xac_dinh';
            $date  = $fuel->created_at;
            if (!$date) continue;

            $month    = (int) $date->format('n');
            $year     = (int) $date->format('Y');
            $monthKey = "{$year}_{$month}";

            $this->initSlot($byPlate, $plate, $monthKey, $month, $year);

            $doDau = (float)($fuel->amount ?? 0) + (float)($fuel->amount_extra ?? 0);

            $byPlate[$plate][$monthKey]['data'][] = [
                '',                    // A: STT
                $date->format('d/m/y'),// B: Ngày
                '',                    // C: Hàng
                '',                    // D: nhà xe
                '',                    // E: Nơi Nhận
                '',                    // F: Nơi trả
                '', '', '',            // G,H,I
                '', '', '', '', '',    // J,K,L,M,N
                '',                    // O
                '',                    // P
                $doDau ?: '',          // Q: Trừ CP (nhiên liệu)
                '', '', '', '',        // R,S,T,U
            ];
        }

        foreach ($this->issues as $issue) {
            $plate = $issue->vehicle?->plate_number ?? 'Chua_xac_dinh';
            $date  = $issue->created_at;
            if (!$date) continue;

            $month    = (int) $date->format('n');
            $year     = (int) $date->format('Y');
            $monthKey = "{$year}_{$month}";

            $this->initSlot($byPlate, $plate, $monthKey, $month, $year);

            $chiPhi = (float)($issue->total_money ?? 0);

            $byPlate[$plate][$monthKey]['data'][] = [
                '',                    // A: STT
                $date->format('d/m/y'),// B: Ngày
                '',                    // C: Hàng
                '',                    // D: nhà xe
                '',                    // E: Nơi Nhận
                '',                    // F: Nơi trả
                '', '', '',            // G,H,I
                '', '', '',            // J,K,L
                $chiPhi ?: '',         // M: duyệt chi (chi phí sự cố)
                '',                    // N
                '',                    // O
                '',                    // P
                '',                    // Q
                '', '', '', '',        // R,S,T,U
            ];
        }

        // ── Step 2: sort data rows within each month by date ─────────
        foreach ($byPlate as $plate => &$months) {
            // Sort months chronologically
            ksort($months);
            foreach ($months as &$block) {
                usort($block['data'], function ($a, $b) {
                    // B column (index 1) holds 'd/m/y' date string
                    return strtotime(str_replace('/', '-', $a[1])) <=>
                           strtotime(str_replace('/', '-', $b[1]));
                });
            }
        }
        unset($months, $block);

        // ── Step 3: create one sheet per vehicle ─────────────────────
        $sheets = [];
        foreach ($byPlate as $plate => $months) {
            $monthBlocks = array_values($months); // [{month,year,data}, ...]
            $sheets[]    = new VehicleFinanceSheet($plate, $monthBlocks);
        }

        return $sheets;
    }

    private function plateName($vehicle): string
    {
        if (!$vehicle) return 'Chua_xac_dinh';
        return $vehicle->plate_number ?: ($vehicle->display_name ?: 'Chua_xac_dinh');
    }

    private function initSlot(array &$byPlate, string $plate, string $monthKey, int $month, int $year): void
    {
        if (!isset($byPlate[$plate])) {
            $byPlate[$plate] = [];
        }
        if (!isset($byPlate[$plate][$monthKey])) {
            $byPlate[$plate][$monthKey] = [
                'month' => $month,
                'year'  => $year,
                'data'  => [],
            ];
        }
    }
}

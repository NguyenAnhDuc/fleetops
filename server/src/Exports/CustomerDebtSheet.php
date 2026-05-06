<?php

namespace Fleetbase\FleetOps\Exports;

use Maatwebsite\Excel\Concerns\FromArray;
use Maatwebsite\Excel\Concerns\WithStyles;
use Maatwebsite\Excel\Concerns\WithTitle;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Border;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;

class CustomerDebtSheet implements FromArray, WithTitle, WithStyles
{
    const COMPANY_NAME    = 'Công ty CPXD và DVTM Tân Tiến';
    const COMPANY_ADDRESS = 'Địa chỉ : Lô D6-2 KCN TBG-P Đông Thọ-TP Thanh Hóa';
    const NCOLS           = 11;
    const LAST_COL        = 'K';

    protected string $customerName;
    protected array  $monthBlocks;
    protected array  $blockPositions = [];

    public function __construct(string $customerName, array $monthBlocks)
    {
        $this->customerName = $customerName;
        $this->monthBlocks  = $monthBlocks;
    }

    public function title(): string
    {
        $safe = preg_replace('/[\\\\\/\*\?\[\]:]/', '_', $this->customerName);
        return mb_substr($safe, 0, 31);
    }

    public function array(): array
    {
        $rows     = [];
        $rowIndex = 1;

        foreach ($this->monthBlocks as $block) {
            $pos = [];

            // ── Company header ───────────────────────────────────────
            $rows[]          = $this->makeRow(self::COMPANY_NAME);
            $pos['company1'] = $rowIndex++;
            $rows[]          = $this->makeRow(self::COMPANY_ADDRESS);
            $pos['company2'] = $rowIndex++;

            // ── Title ────────────────────────────────────────────────
            $rows[]       = $this->makeRow(
                "BÁO CÁO CÔNG NỢ - KHÁCH HÀNG: {$this->customerName} - THÁNG {$block['month']} NĂM {$block['year']}"
            );
            $pos['title'] = $rowIndex++;

            // ── Blank ────────────────────────────────────────────────
            $rows[] = $this->emptyRow();
            $rowIndex++;

            // ── Headers ──────────────────────────────────────────────
            $rows[]          = $this->makeHeaders();
            $pos['header']   = $rowIndex++;

            // ── Data rows ────────────────────────────────────────────
            $pos['dataStart'] = $rowIndex;
            foreach ($block['data'] as $item) {
                $rows[] = $item;
                $rowIndex++;
            }
            $pos['dataEnd'] = $rowIndex - 1;

            // ── Totals row ───────────────────────────────────────────
            $ds = $pos['dataStart'];
            $de = $pos['dataEnd'];
            $totals = $this->emptyRow();
            $totals[3] = 'Tổng'; // D column
            if ($ds <= $de) {
                // I = index 8 (Thành tiền)
                $totals[8] = "=SUM(I{$ds}:I{$de})";
            }
            $rows[]       = $totals;
            $pos['total'] = $rowIndex++;

            // ── 3 blank spacer rows ──────────────────────────────────
            for ($i = 0; $i < 3; $i++) {
                $rows[] = $this->emptyRow();
                $rowIndex++;
            }

            $this->blockPositions[] = $pos;
        }

        return $rows;
    }

    public function styles(Worksheet $sheet)
    {
        $thinBorder = ['borderStyle' => Border::BORDER_THIN, 'color' => ['rgb' => '000000']];
        $allBorders = ['allBorders' => $thinBorder];

        foreach ($this->blockPositions as $pos) {
            $r1 = $pos['company1'];
            $r2 = $pos['company2'];
            $rt = $pos['title'];
            $rh = $pos['header'];
            $ds = $pos['dataStart'];
            $de = $pos['dataEnd'];
            $rT = $pos['total'];

            // Company rows: bold, no border
            foreach ([$r1, $r2] as $cr) {
                $sheet->getStyle("A{$cr}")->applyFromArray([
                    'font' => ['bold' => true, 'name' => 'Arial', 'size' => 10],
                ]);
            }

            // Title: merged, bold, centered
            $sheet->mergeCells("A{$rt}:" . self::LAST_COL . "{$rt}");
            $sheet->getStyle("A{$rt}")->applyFromArray([
                'font'      => ['bold' => true, 'name' => 'Arial', 'size' => 12],
                'alignment' => [
                    'horizontal' => Alignment::HORIZONTAL_CENTER,
                    'vertical'   => Alignment::VERTICAL_CENTER,
                ],
            ]);
            $sheet->getRowDimension($rt)->setRowHeight(24);

            // Header row
            $sheet->getStyle("A{$rh}:" . self::LAST_COL . "{$rh}")->applyFromArray([
                'font'      => ['bold' => true, 'name' => 'Arial', 'size' => 9],
                'fill'      => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => 'BDD7EE']],
                'alignment' => [
                    'horizontal' => Alignment::HORIZONTAL_CENTER,
                    'vertical'   => Alignment::VERTICAL_CENTER,
                    'wrapText'   => true,
                ],
                'borders' => $allBorders,
            ]);
            $sheet->getRowDimension($rh)->setRowHeight(30);

            // Data rows
            if ($ds <= $de) {
                $sheet->getStyle("A{$ds}:" . self::LAST_COL . "{$de}")->applyFromArray([
                    'font'    => ['name' => 'Arial', 'size' => 9],
                    'borders' => $allBorders,
                ]);

                // Center: STT (A=0), Ngày (B=1), Số xe (C=2), Trạng thái (J=9)
                foreach (['A', 'B', 'C', 'J'] as $col) {
                    $sheet->getStyle("{$col}{$ds}:{$col}{$de}")
                          ->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
                }

                // Right + number format: SL(G=6), Đơn giá(H=7), Thành tiền(I=8)
                foreach (['G', 'H', 'I'] as $col) {
                    $sheet->getStyle("{$col}{$ds}:{$col}{$de}")
                          ->getAlignment()->setHorizontal(Alignment::HORIZONTAL_RIGHT);
                    $sheet->getStyle("{$col}{$ds}:{$col}{$de}")
                          ->getNumberFormat()->setFormatCode('#,##0;(#,##0);-');
                }

                // Color "Đã nhận" rows green, "Dự thu" rows default
                for ($r = $ds; $r <= $de; $r++) {
                    $status = $sheet->getCell("J{$r}")->getValue();
                    if ($status === 'Đã nhận') {
                        $sheet->getStyle("A{$r}:" . self::LAST_COL . "{$r}")
                              ->getFont()->getColor()->setRGB('1F7F4C');
                    }
                }
            }

            // Totals row
            $sheet->mergeCells("A{$rT}:C{$rT}");
            $sheet->getStyle("A{$rT}:" . self::LAST_COL . "{$rT}")->applyFromArray([
                'font'    => ['bold' => true, 'name' => 'Arial', 'size' => 9],
                'fill'    => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => 'FFF2CC']],
                'borders' => $allBorders,
            ]);
            $sheet->getStyle("D{$rT}")->getAlignment()
                  ->setHorizontal(Alignment::HORIZONTAL_CENTER);
            $sheet->getStyle("I{$rT}")
                  ->getAlignment()->setHorizontal(Alignment::HORIZONTAL_RIGHT);
            $sheet->getStyle("I{$rT}")
                  ->getNumberFormat()->setFormatCode('#,##0;(#,##0);-');
        }

        // Column widths
        $widths = [
            'A' => 5,  // STT
            'B' => 10, // Ngày
            'C' => 12, // Số xe
            'D' => 18, // Tên hàng
            'E' => 20, // Nơi nhận
            'F' => 20, // Nơi giao
            'G' => 6,  // SL
            'H' => 12, // Đơn giá
            'I' => 14, // Thành tiền
            'J' => 10, // Trạng thái
            'K' => 28, // Ghi chú
        ];
        foreach ($widths as $col => $w) {
            $sheet->getColumnDimension($col)->setWidth($w);
        }

        return [];
    }

    private function makeHeaders(): array
    {
        return [
            'STT', 'Ngày', 'Số xe', 'Tên hàng',
            'Nơi nhận', 'Nơi giao',
            'SL', 'Đơn giá', 'Thành tiền',
            'Trạng thái', 'Ghi chú',
        ];
    }

    private function makeRow(string $text): array
    {
        $row    = array_fill(0, self::NCOLS, '');
        $row[0] = $text;
        return $row;
    }

    private function emptyRow(): array
    {
        return array_fill(0, self::NCOLS, '');
    }
}

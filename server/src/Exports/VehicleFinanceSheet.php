<?php

namespace Fleetbase\FleetOps\Exports;

use Maatwebsite\Excel\Concerns\FromArray;
use Maatwebsite\Excel\Concerns\WithStyles;
use Maatwebsite\Excel\Concerns\WithTitle;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Border;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;

class VehicleFinanceSheet implements FromArray, WithTitle, WithStyles
{
    const COMPANY_NAME    = 'Công ty CPXD và DVTM Tân Tiến';
    const COMPANY_ADDRESS = 'Địa chỉ : Lô D6-2 KCN TBG-P Đông Thọ-TP Thanh Hóa';
    const NCOLS           = 21; // A–U
    const LAST_COL        = 'U';

    // Column letters for numeric (sum) columns: I, K–Q
    const SUM_COLS = ['I', 'K', 'L', 'M', 'N', 'Q'];

    protected string $plate;
    protected array  $monthBlocks; // [['month'=>1,'year'=>2024,'data'=>[...]], ...]

    /** Positions tracked during array() for use in styles() */
    protected array $blockPositions = [];

    public function __construct(string $plate, array $monthBlocks)
    {
        $this->plate       = $plate;
        $this->monthBlocks = $monthBlocks;
    }

    public function title(): string
    {
        return mb_substr(preg_replace('/[\\\\\/\*\?\[\]:]/', '_', $this->plate), 0, 31);
    }

    // ──────────────────────────────────────────────────────────────────
    //  Build the 2-D array (one element per row)
    // ──────────────────────────────────────────────────────────────────
    public function array(): array
    {
        $rows     = [];
        $rowIndex = 1; // 1-based, tracks current sheet row

        foreach ($this->monthBlocks as $block) {
            $pos = [];

            // ── Company header (2 rows, no border) ──────────────────
            $rows[]            = $this->makeRow(self::COMPANY_NAME);
            $pos['company1']   = $rowIndex++;
            $rows[]            = $this->makeRow(self::COMPANY_ADDRESS);
            $pos['company2']   = $rowIndex++;

            // ── Title row ───────────────────────────────────────────
            $rows[]          = $this->makeRow(
                "BẢNG THANH TOÁN LƯƠNG XE {$this->plate} - THÁNG {$block['month']} NĂM {$block['year']}"
            );
            $pos['title']    = $rowIndex++;

            // ── Blank separator ─────────────────────────────────────
            $rows[]    = $this->emptyRow();
            $rowIndex++;

            // ── Column headers ──────────────────────────────────────
            $rows[]           = $this->makeHeaders();
            $pos['header']    = $rowIndex++;

            // ── Data rows ───────────────────────────────────────────
            $pos['dataStart'] = $rowIndex;
            foreach ($block['data'] as $item) {
                $rows[] = $item;
                $rowIndex++;
            }
            $pos['dataEnd'] = $rowIndex - 1;

            // ── Totals row ──────────────────────────────────────────
            $ds = $pos['dataStart'];
            $de = $pos['dataEnd'];
            $totalsRow = array_fill(0, self::NCOLS, '');
            $totalsRow[4] = 'Tổng'; // column E (index 4)
            if ($ds <= $de) {
                // I=8, K=10, L=11, M=12, N=13, Q=16 (0-based)
                foreach ([8, 10, 11, 12, 13, 16] as $ci) {
                    $col             = chr(65 + $ci);
                    $totalsRow[$ci]  = "=SUM({$col}{$ds}:{$col}{$de})";
                }
            }
            $rows[]         = $totalsRow;
            $pos['total']   = $rowIndex++;

            // ── 3 blank spacer rows ─────────────────────────────────
            for ($i = 0; $i < 3; $i++) {
                $rows[] = $this->emptyRow();
                $rowIndex++;
            }

            $this->blockPositions[] = $pos;
        }

        return $rows;
    }

    // ──────────────────────────────────────────────────────────────────
    //  Apply styles after data is written
    // ──────────────────────────────────────────────────────────────────
    public function styles(Worksheet $sheet)
    {
        $thinBorder = [
            'borderStyle' => Border::BORDER_THIN,
            'color'       => ['rgb' => '000000'],
        ];
        $allBorders = ['allBorders' => $thinBorder];

        foreach ($this->blockPositions as $pos) {
            $r1 = $pos['company1'];
            $r2 = $pos['company2'];
            $rt = $pos['title'];
            $rh = $pos['header'];
            $ds = $pos['dataStart'];
            $de = $pos['dataEnd'];
            $rT = $pos['total'];

            // ── Company rows: bold, no border ───────────────────────
            foreach ([$r1, $r2] as $cr) {
                $sheet->getStyle("A{$cr}")->applyFromArray([
                    'font' => ['bold' => true, 'name' => 'Arial', 'size' => 10],
                ]);
            }

            // ── Title: merged, bold, large, centered ────────────────
            $sheet->mergeCells("A{$rt}:" . self::LAST_COL . $rt);
            $sheet->getStyle("A{$rt}")->applyFromArray([
                'font'      => ['bold' => true, 'name' => 'Arial', 'size' => 12],
                'alignment' => [
                    'horizontal' => Alignment::HORIZONTAL_CENTER,
                    'vertical'   => Alignment::VERTICAL_CENTER,
                ],
            ]);
            $sheet->getRowDimension($rt)->setRowHeight(24);

            // ── Header row: bold, blue bg, centered, border ─────────
            $sheet->getStyle("A{$rh}:" . self::LAST_COL . $rh)->applyFromArray([
                'font'      => ['bold' => true, 'name' => 'Arial', 'size' => 9],
                'fill'      => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => 'BDD7EE']],
                'alignment' => [
                    'horizontal' => Alignment::HORIZONTAL_CENTER,
                    'vertical'   => Alignment::VERTICAL_CENTER,
                    'wrapText'   => true,
                ],
                'borders' => $allBorders,
            ]);
            $sheet->getRowDimension($rh)->setRowHeight(36);

            // ── Data rows: border + font ─────────────────────────────
            if ($ds <= $de) {
                $sheet->getStyle("A{$ds}:" . self::LAST_COL . $de)->applyFromArray([
                    'font'    => ['name' => 'Arial', 'size' => 9],
                    'borders' => $allBorders,
                ]);

                // Right-align + number format for numeric columns
                foreach ([6, 7, 8, 10, 11, 12, 13, 16, 17, 18, 19, 20] as $ci) {
                    $col = chr(65 + $ci);
                    $sheet->getStyle("{$col}{$ds}:{$col}{$de}")
                          ->getAlignment()->setHorizontal(Alignment::HORIZONTAL_RIGHT);
                    $sheet->getStyle("{$col}{$ds}:{$col}{$de}")
                          ->getNumberFormat()->setFormatCode('#,##0;(#,##0);-');
                }

                // Center align: STT (A), Ngày (B)
                $sheet->getStyle("A{$ds}:B{$de}")
                      ->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
            }

            // ── Totals row ───────────────────────────────────────────
            $sheet->mergeCells("A{$rT}:D{$rT}");
            $sheet->getStyle("A{$rT}:" . self::LAST_COL . $rT)->applyFromArray([
                'font'    => ['bold' => true, 'name' => 'Arial', 'size' => 9],
                'fill'    => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => 'FFF2CC']],
                'borders' => $allBorders,
            ]);
            $sheet->getStyle("E{$rT}")->getAlignment()
                  ->setHorizontal(Alignment::HORIZONTAL_CENTER);
            foreach ([8, 10, 11, 12, 13, 16, 17, 18, 19, 20] as $ci) {
                $col = chr(65 + $ci);
                $sheet->getStyle("{$col}{$rT}")
                      ->getAlignment()->setHorizontal(Alignment::HORIZONTAL_RIGHT);
                $sheet->getStyle("{$col}{$rT}")
                      ->getNumberFormat()->setFormatCode('#,##0;(#,##0);-');
            }
        }

        // ── Column widths (set once) ─────────────────────────────────
        $widths = [
            'A' => 4,  // STT
            'B' => 9,  // Ngày
            'C' => 10, // Hàng
            'D' => 11, // nhà xe
            'E' => 16, // Nơi Nhận
            'F' => 16, // Nơi trả
            'G' => 5,  // SL
            'H' => 9,  // DG
            'I' => 11, // TT
            'J' => 9,  // lái xe chuyển
            'K' => 9,  // ứng
            'L' => 9,  // thu cước
            'M' => 9,  // duyệt chi
            'N' => 9,  // nộp cty
            'O' => 9,  // chuyển xe
            'P' => 9,  // Trừ lương
            'Q' => 9,  // Trừ CP
            'R' => 9,  // tồn
            'S' => 9,  // lxe kê
            'T' => 9,  // chênh CP
            'U' => 9,  // tồn lxe
        ];
        foreach ($widths as $col => $w) {
            $sheet->getColumnDimension($col)->setWidth($w);
        }

        return [];
    }

    // ──────────────────────────────────────────────────────────────────
    //  Helpers
    // ──────────────────────────────────────────────────────────────────
    private function makeHeaders(): array
    {
        return [
            'STT', 'Ngày', 'Hàng', 'nhà xe', 'Nơi Nhận', 'Nơi trả',
            'SL', 'DG', 'TT',
            'lái xe chuyển', 'ứng', 'thu cước', 'duyệt chi', 'nộp cty',
            'chuyển xe', 'Trừ lương', 'Trừ CP',
            'tồn', 'lxe kê', 'chênh CP', 'tồn lxe',
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

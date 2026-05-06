const XLSX_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';

function loadXLSX() {
    return new Promise((resolve, reject) => {
        // Kiểm tra đầy đủ API, không chỉ kiểm tra sự tồn tại của window.XLSX
        if (window.XLSX && typeof window.XLSX.write === 'function' && typeof window.XLSX.utils === 'object') {
            resolve(window.XLSX);
            return;
        }
        // Xoá stub cũ nếu có
        delete window.XLSX;
        const s = document.createElement('script');
        s.src = XLSX_CDN;
        s.onload = () => {
            if (window.XLSX && typeof window.XLSX.write === 'function') {
                resolve(window.XLSX);
            } else {
                reject(new Error('Thư viện XLSX tải thành công nhưng API không hợp lệ'));
            }
        };
        s.onerror = () => reject(new Error('Không thể tải thư viện xuất Excel'));
        document.head.appendChild(s);
    });
}

function num(v) {
    const n = parseFloat(v);
    return isNaN(n) ? 0 : n;
}

function cellStyle(bold = false, align = 'center', border = true, numFmt = null) {
    const style = {
        font: { name: 'Arial', sz: 10, bold },
        alignment: { horizontal: align, vertical: 'center', wrapText: true },
    };
    if (border) {
        const b = { style: 'thin', color: { rgb: '000000' } };
        style.border = { top: b, left: b, bottom: b, right: b };
    }
    if (numFmt) style.numFmt = numFmt;
    return style;
}

function setCells(ws, rowIdx, values, styles) {
    const cols = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    values.forEach((val, i) => {
        const addr = `${cols[i]}${rowIdx}`;
        ws[addr] = {
            v: val,
            t: typeof val === 'number' ? 'n' : 's',
            s: styles[i] || styles[0],
        };
    });
}

function setCell(ws, addr, val, style) {
    ws[addr] = {
        v: val,
        t: typeof val === 'number' ? 'n' : 's',
        s: style,
    };
}

export async function exportFinancesToExcel(results, { startDate, endDate, vehicleName } = {}) {
    const XLSX = await loadXLSX();

    // Group by plate_number
    const groups = {};
    for (const r of results) {
        const key = r.plate_number || 'Chưa_xác_định';
        if (!groups[key]) groups[key] = [];
        groups[key].push(r);
    }

    const wb = { SheetNames: [], Sheets: {} };

    const HEADERS = [
        'STT', 'Ngày', 'Hàng', 'Khách hàng', 'Nơi nhận', 'Nơi trả',
        'SL', 'Đơn giá', 'Thành tiền',
        'LX ứng', 'LX thu', 'Chi phí', 'LX nộp', 'Đổ dầu', 'Mô tả',
    ];

    const COL_WIDTHS = [
        { wch: 5 },  // STT
        { wch: 12 }, // Ngày
        { wch: 12 }, // Hàng
        { wch: 18 }, // Khách hàng
        { wch: 20 }, // Nơi nhận
        { wch: 20 }, // Nơi trả
        { wch: 7 },  // SL
        { wch: 13 }, // Đơn giá
        { wch: 14 }, // Thành tiền
        { wch: 12 }, // LX ứng
        { wch: 12 }, // LX thu
        { wch: 12 }, // Chi phí
        { wch: 12 }, // LX nộp
        { wch: 12 }, // Đổ dầu
        { wch: 25 }, // Mô tả
    ];
    const NCOLS = HEADERS.length;
    const lastCol = String.fromCharCode(65 + NCOLS - 1); // 'O'

    const styleTitle = cellStyle(true, 'center', false);
    const styleHeader = cellStyle(true, 'center', true);
    const styleDataLeft = cellStyle(false, 'left', true);
    const styleDataCenter = cellStyle(false, 'center', true);
    const styleDataRight = cellStyle(false, 'right', true, '#,##0');
    const styleTotalLabel = cellStyle(true, 'center', true);
    const styleTotalNum = cellStyle(true, 'right', true, '#,##0');
    const styleDataRed = { ...styleDataRight, font: { name: 'Arial', sz: 10, bold: false, color: { rgb: 'FF0000' } } };

    for (const [plate, rows] of Object.entries(groups)) {
        const ws = {};
        const merges = [];

        // --- Row 1: Tiêu đề ---
        const period = startDate && endDate ? ` - Từ ${startDate} đến ${endDate}` : '';
        const title = `BÁO CÁO THU CHI - XE ${plate}${period}`;
        setCell(ws, 'A1', title, styleTitle);
        merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: NCOLS - 1 } });

        // --- Row 2: Trống ---

        // --- Row 3: Header ---
        HEADERS.forEach((h, i) => {
            const addr = `${String.fromCharCode(65 + i)}3`;
            ws[addr] = { v: h, t: 's', s: styleHeader };
        });

        // --- Rows 4+: Data ---
        let dataRow = 4;
        let stt = 1;

        for (const r of rows) {
            const isOrder = r.type === 'thu_tienmat' || r.type === 'thu_congno';
            const isExpense = r.type === 'chi';

            const rowVals = [
                isOrder ? stt++ : '',
                r.date || '',
                r.sku_name || '',
                r.customerName || '',
                r.pickup || '',
                r.dropoff || '',
                isOrder ? (num(r.quantity_fees) || '') : '',
                isOrder ? (num(r.unit_price_fees) || '') : '',
                isOrder ? num(r.amount) : '',
                num(r.laixe_ung) || '',
                num(r.laixe_thu) || '',
                num(r.chiphi) || '',
                num(r.laixe_nop) || '',
                num(r.do_dau) || '',
                r.note || '',
            ];

            const rowStyles = [
                styleDataCenter,  // STT
                styleDataCenter,  // Ngày
                styleDataLeft,    // Hàng
                styleDataLeft,    // Khách hàng
                styleDataLeft,    // Nơi nhận
                styleDataLeft,    // Nơi trả
                styleDataCenter,  // SL
                styleDataRight,   // Đơn giá
                isExpense ? styleDataLeft : styleDataRight,  // Thành tiền
                styleDataRight,   // LX ứng
                styleDataRight,   // LX thu
                isExpense ? styleDataRed : styleDataRight,   // Chi phí
                styleDataRight,   // LX nộp
                styleDataRight,   // Đổ dầu
                styleDataLeft,    // Mô tả
            ];

            rowVals.forEach((val, i) => {
                const addr = `${String.fromCharCode(65 + i)}${dataRow}`;
                ws[addr] = {
                    v: val === '' ? '' : val,
                    t: typeof val === 'number' ? 'n' : 's',
                    s: rowStyles[i],
                };
            });

            dataRow++;
        }

        // --- Tổng cộng ---
        const totalRow = dataRow;
        const dataStart = 4;
        const dataEnd = totalRow - 1;

        const totalVals = [
            'TỔNG CỘNG', '', '', '', '', '', '', '',
            `=SUM(I${dataStart}:I${dataEnd})`,
            `=SUM(J${dataStart}:J${dataEnd})`,
            `=SUM(K${dataStart}:K${dataEnd})`,
            `=SUM(L${dataStart}:L${dataEnd})`,
            `=SUM(M${dataStart}:M${dataEnd})`,
            `=SUM(N${dataStart}:N${dataEnd})`,
            '',
        ];

        totalVals.forEach((val, i) => {
            const addr = `${String.fromCharCode(65 + i)}${totalRow}`;
            const isFormula = typeof val === 'string' && val.startsWith('=');
            ws[addr] = {
                ...(isFormula ? { f: val.slice(1), t: 'n', v: 0 } : { v: val, t: i === 0 ? 's' : (typeof val === 'number' ? 'n' : 's') }),
                s: i === 0 ? styleTotalLabel : styleTotalNum,
            };
        });
        // Merge "TỔNG CỘNG" label qua cột A-H
        merges.push({ s: { r: totalRow - 1, c: 0 }, e: { r: totalRow - 1, c: 7 } });

        // Set worksheet range
        ws['!ref'] = `A1:${lastCol}${totalRow}`;
        ws['!cols'] = COL_WIDTHS;
        ws['!merges'] = merges;
        ws['!rows'] = [{ hpt: 24 }, {}, { hpt: 22 }]; // row heights

        const sheetName = plate.replace(/[\\/*?[\]:]/g, '_').substring(0, 31);
        wb.SheetNames.push(sheetName);
        wb.Sheets[sheetName] = ws;
    }

    const filename = `Bao_cao_thu_chi_${startDate || ''}_${endDate || ''}.xlsx`;
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array', cellStyles: true });
    const blob = new Blob([wbout], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

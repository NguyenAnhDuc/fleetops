/**
 * Vietnam region detection based on province/city names in address strings.
 * Returns: 'north' | 'central' | 'south' | null
 */

const REGIONS = {
    north: [
        'hà nội', 'ha noi', 'hải phòng', 'hai phong',
        'quảng ninh', 'quang ninh',
        'bắc giang', 'bac giang', 'bắc kạn', 'bac kan',
        'bắc ninh', 'bac ninh', 'cao bằng', 'cao bang',
        'điện biên', 'dien bien', 'hà giang', 'ha giang',
        'hà nam', 'ha nam', 'hải dương', 'hai duong',
        'hòa bình', 'hoa binh', 'hưng yên', 'hung yen',
        'lai châu', 'lai chau', 'lạng sơn', 'lang son',
        'lào cai', 'lao cai', 'nam định', 'nam dinh',
        'ninh bình', 'ninh binh', 'phú thọ', 'phu tho',
        'sơn la', 'son la', 'thái bình', 'thai binh',
        'thái nguyên', 'thai nguyen', 'tuyên quang', 'tuyen quang',
        'vĩnh phúc', 'vinh phuc', 'yên bái', 'yen bai',
    ],
    central: [
        'đà nẵng', 'da nang', 'thanh hóa', 'thanh hoa',
        'nghệ an', 'nghe an', 'hà tĩnh', 'ha tinh',
        'quảng bình', 'quang binh', 'quảng trị', 'quang tri',
        'thừa thiên', 'thua thien', 'huế', 'hue',
        'quảng nam', 'quang nam', 'quảng ngãi', 'quang ngai',
        'bình định', 'binh dinh', 'phú yên', 'phu yen',
        'khánh hòa', 'khanh hoa', 'ninh thuận', 'ninh thuan',
        'bình thuận', 'binh thuan', 'kon tum',
        'gia lai', 'đắk lắk', 'dak lak', 'đắk nông', 'dak nong',
        'lâm đồng', 'lam dong',
    ],
    south: [
        'hồ chí minh', 'ho chi minh', 'hcm', 'sài gòn', 'sai gon',
        'bình dương', 'binh duong', 'bình phước', 'binh phuoc',
        'bà rịa', 'ba ria', 'vũng tàu', 'vung tau',
        'đồng nai', 'dong nai', 'tây ninh', 'tay ninh',
        'long an', 'tiền giang', 'tien giang',
        'bến tre', 'ben tre', 'trà vinh', 'tra vinh',
        'vĩnh long', 'vinh long', 'đồng tháp', 'dong thap',
        'an giang', 'kiên giang', 'kien giang',
        'cần thơ', 'can tho', 'hậu giang', 'hau giang',
        'sóc trăng', 'soc trang', 'bạc liêu', 'bac lieu',
        'cà mau', 'ca mau',
    ],
};

export function detectRegion(address) {
    if (!address) return null;
    const lower = address.toLowerCase();
    for (const [region, keywords] of Object.entries(REGIONS)) {
        if (keywords.some((kw) => lower.includes(kw))) {
            return region;
        }
    }
    return null;
}

export const REGION_STYLE = {
    north:   { color: '#60a5fa', bg: 'rgba(96,165,250,0.12)',  label: 'Bắc' },
    central: { color: '#fbbf24', bg: 'rgba(251,191,36,0.12)',  label: 'Trung' },
    south:   { color: '#4ade80', bg: 'rgba(74,222,128,0.12)',  label: 'Nam' },
};

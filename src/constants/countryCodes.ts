export interface CountryCode {
  code: string
  name: string
  dialCode: string
  flag: string
}

export const countryCodes: CountryCode[] = [
  { code: 'CN', name: '中国大陆', dialCode: '+86', flag: '🇨🇳' },
  { code: 'HK', name: '中国香港', dialCode: '+852', flag: '🇭🇰' },
  { code: 'MO', name: '中国澳门', dialCode: '+853', flag: '🇲🇴' },
  { code: 'TW', name: '中国台湾', dialCode: '+886', flag: '🇹🇼' },
  { code: 'US', name: '美国', dialCode: '+1', flag: '🇺🇸' },
  { code: 'JP', name: '日本', dialCode: '+81', flag: '🇯🇵' },
  { code: 'KR', name: '韩国', dialCode: '+82', flag: '🇰🇷' },
  { code: 'SG', name: '新加坡', dialCode: '+65', flag: '🇸🇬' },
  { code: 'MY', name: '马来西亚', dialCode: '+60', flag: '🇲🇾' },
  { code: 'TH', name: '泰国', dialCode: '+66', flag: '🇹🇭' },
  { code: 'VN', name: '越南', dialCode: '+84', flag: '🇻🇳' },
  { code: 'PH', name: '菲律宾', dialCode: '+63', flag: '🇵🇭' },
  { code: 'ID', name: '印度尼西亚', dialCode: '+62', flag: '🇮🇩' },
  { code: 'IN', name: '印度', dialCode: '+91', flag: '🇮🇳' },
  { code: 'AU', name: '澳大利亚', dialCode: '+61', flag: '🇦🇺' },
  { code: 'NZ', name: '新西兰', dialCode: '+64', flag: '🇳🇿' },
  { code: 'GB', name: '英国', dialCode: '+44', flag: '🇬🇧' },
  { code: 'DE', name: '德国', dialCode: '+49', flag: '🇩🇪' },
  { code: 'FR', name: '法国', dialCode: '+33', flag: '🇫🇷' },
  { code: 'IT', name: '意大利', dialCode: '+39', flag: '🇮🇹' },
  { code: 'ES', name: '西班牙', dialCode: '+34', flag: '🇪🇸' },
  { code: 'RU', name: '俄罗斯', dialCode: '+7', flag: '🇷🇺' },
  { code: 'CA', name: '加拿大', dialCode: '+1', flag: '🇨🇦' },
  { code: 'BR', name: '巴西', dialCode: '+55', flag: '🇧🇷' },
  { code: 'MX', name: '墨西哥', dialCode: '+52', flag: '🇲🇽' },
]


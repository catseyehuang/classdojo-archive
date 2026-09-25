/**
 * 教師個性化色彩系統 (規格書 7.4)
 * 資料驅動，換導師免改程式
 */

export const PALETTE = [
  'gold',
  'rose',
  'sage',
  'sky',
  'lavender',
  'terracotta',
  'teal',
  'plum'
];

export const TEACHER_THEMES = {
  gold: {
    name: '香檳金 (預設中師)',
    solid: '#B8935A',
    soft: '#F6EDDD',
    ink: '#7F6234'
  },
  rose: {
    name: '玫瑰粉',
    solid: '#C7737F',
    soft: '#F8E6E8',
    ink: '#93404C'
  },
  sage: {
    name: '鼠尾草綠',
    solid: '#6E9B86',
    soft: '#E4F0EA',
    ink: '#3E6A55'
  },
  sky: {
    name: '天藍 (預設外師)',
    solid: '#6F98C6',
    soft: '#E5EEF8',
    ink: '#35608F'
  },
  lavender: {
    name: '薰衣草紫',
    solid: '#9A8AC8',
    soft: '#EDE9F7',
    ink: '#62529A'
  },
  terracotta: {
    name: '赤陶橘',
    solid: '#C98462',
    soft: '#F8E9E0',
    ink: '#8F4F30'
  },
  teal: {
    name: '湖水綠',
    solid: '#4E9A9C',
    soft: '#E1F1F1',
    ink: '#266B6D'
  },
  plum: {
    name: '梅紫紅',
    solid: '#A66A93',
    soft: '#F3E6EF',
    ink: '#764263'
  },
  neutral: {
    name: '中性灰暖',
    solid: '#A69C92',
    soft: '#F1ECE6',
    ink: '#5E554D'
  }
};

export const ROLE_DEFAULT = {
  local: 'gold',     // 中師
  foreign: 'sky',    // 外師
  other: 'neutral'   // 其他
};

// 初始預設教師資料（由歷史硬編碼遷移而來）
export const INITIAL_TEACHER_PROFILES = {
  'teacher patty': { role: 'local', theme: 'sage', displayName: 'Teacher Patty' },
  'teacher adam': { role: 'foreign', theme: 'sky', displayName: 'Teacher Adam' },
  'mr. chen': { role: 'local', theme: 'gold', displayName: 'Mr. Chen' },
  'ms. rowena': { role: 'foreign', theme: 'sky', displayName: 'Ms. Rowena' },
  'dir. chen': { role: 'other', theme: 'terracotta', displayName: 'Dir. Chen' },
  '女士 jennifer': { role: 'local', theme: 'rose', displayName: '女士 Jennifer' }
};

export const normalizeName = (name) => {
  return (name || '').trim().toLowerCase().replace(/\s+/g, ' ');
};

// FNV-1a 32-bit 雜湊算法：同名永遠同色、跨裝置一致
export function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

const STORAGE_KEY = 'classdojo_teacher_profiles_v4';

export function getStoredTeacherProfiles() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return INITIAL_TEACHER_PROFILES;
    const parsed = JSON.parse(raw);
    return { ...INITIAL_TEACHER_PROFILES, ...parsed };
  } catch (e) {
    console.error('Failed to load teacher profiles from localStorage:', e);
    return INITIAL_TEACHER_PROFILES;
  }
}

export function saveTeacherProfiles(profiles) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
  } catch (e) {
    console.error('Failed to save teacher profiles to localStorage:', e);
  }
}

/**
 * 依據教師名稱解析個性化主題
 */
export function resolveTeacherTheme(name, customProfiles = null) {
  const profiles = customProfiles || getStoredTeacherProfiles();
  const key = normalizeName(name);
  const profile = profiles[key] || {};

  // 決定順序：
  // 1. 使用者自訂 theme
  // 2. 角色預設 (local: gold, foreign: sky)
  // 3. 自動 FNV-1a 雜湊 (8 色)
  // 4. 無名稱 -> neutral
  let theme = profile.theme;
  if (!theme || theme === 'auto') {
    if (profile.role && ROLE_DEFAULT[profile.role]) {
      theme = ROLE_DEFAULT[profile.role];
    } else if (key) {
      theme = PALETTE[fnv1a(key) % PALETTE.length];
    } else {
      theme = 'neutral';
    }
  }

  const themeTokens = TEACHER_THEMES[theme] || TEACHER_THEMES.neutral;
  const initial = (profile.displayName || name || 'T')
    .replace(/^(Teacher|Mr\.|Ms\.|Mrs\.|Dir\.|女士|老師)\s*/i, '')
    .trim()[0] || 'T';

  return {
    key,
    theme,
    role: profile.role || null, // 'local' | 'foreign' | 'other' | null
    displayName: profile.displayName || name || '未知老師',
    themeTokens,
    initial: initial.toUpperCase()
  };
}

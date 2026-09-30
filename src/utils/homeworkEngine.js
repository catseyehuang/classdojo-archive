/**
 * 智慧聯絡簿引擎：台灣連假/週末感知留存、作業 Checklist 自動全打勾、小考萃取
 */

// 台灣 115 學年度 (2026-2027) 國定連假與補假行事曆
export const TAIWAN_HOLIDAYS_115 = [
  {
    name: '中秋節與教師節連假',
    startDate: '2026-09-25',
    endDate: '2026-09-28',
    lastSchoolDay: '2026-09-24'
  },
  {
    name: '國慶日連假',
    startDate: '2026-10-09',
    endDate: '2026-10-11',
    lastSchoolDay: '2026-10-08'
  },
  {
    name: '光復節補假連假',
    startDate: '2026-10-24',
    endDate: '2026-10-26',
    lastSchoolDay: '2026-10-23'
  },
  {
    name: '行憲紀念日連假',
    startDate: '2026-12-25',
    endDate: '2026-12-27',
    lastSchoolDay: '2026-12-24'
  },
  {
    name: '元旦連假',
    startDate: '2027-01-01',
    endDate: '2027-01-03',
    lastSchoolDay: '2026-12-31'
  },
  {
    name: '2027寒假與春節連假',
    startDate: '2027-01-21',
    endDate: '2027-02-10',
    lastSchoolDay: '2027-01-20'
  }
];

// 育才雙語小學 115 上學期三年級專屬官方行事曆大事件
export const GRADE_3_CALENDAR_EVENTS = [
  { id: 'ev-1', date: '2026-08-31', name: '全校正式開學', type: 'school', target: '三年級' },
  { id: 'ev-2', date: '2026-09-05', name: '二~六年級家長日', type: 'parent', target: '家長代表選舉' },
  { id: 'ev-3', date: '2026-09-09', name: '防災避難預演', type: 'drill', target: '全校' },
  { id: 'ev-4', date: '2026-09-16', name: '防震防災演習', type: 'drill', target: '全校' },
  { id: 'ev-5', date: '2026-09-23', name: '教師節慶祝大會', type: 'celebration', target: '全校' },
  { id: 'ev-6', date: '2026-09-25', name: '中秋節放假', type: 'holiday', target: '放假' },
  { id: 'ev-7', date: '2026-09-28', name: '教師節放假', type: 'holiday', target: '放假' },
  { id: 'ev-8', date: '2026-10-09', name: '國慶日補假', type: 'holiday', target: '放假' },
  { id: 'ev-9', date: '2026-10-26', name: '光復節補假', type: 'holiday', target: '放假' },
  { id: 'ev-10', date: '2026-10-29', name: '第一次英語成績考查', type: 'exam', target: '1~6年級' },
  { id: 'ev-11', date: '2026-10-30', name: '萬聖節活動', type: 'event', target: '雙語活動' },
  { id: 'ev-12', date: '2026-11-02', name: '冬季制服換季', type: 'notice', target: '全校' },
  { id: 'ev-13', date: '2026-11-03', name: '第一次中文成績考查 (段考 D1)', type: 'exam-major', target: '中年級' },
  { id: 'ev-14', date: '2026-11-04', name: '第一次中文成績考查 (段考 D2)', type: 'exam-major', target: '中年級' },
  { id: 'ev-15', date: '2026-11-08', name: '劍橋兒童英檢 (YLE)', type: 'exam', target: '英文檢定' },
  { id: 'ev-16', date: '2026-11-15', name: '劍橋青少年 PET / KET 考試', type: 'exam', target: '英文檢定' },
  { id: 'ev-17', date: '2026-11-23', name: '公開觀課週開始', type: 'school', target: '三年級' },
  { id: 'ev-18', date: '2026-12-04', name: '選拔模範生', type: 'school', target: '班級模範生' },
  { id: 'ev-19', date: '2026-12-23', name: '聖誕&歲末聯歡', type: 'event', target: '全校' },
  { id: 'ev-20', date: '2026-12-25', name: '行憲紀念日放假', type: 'holiday', target: '放假' },
  { id: 'ev-21', date: '2026-12-30', name: '英語期末評量', type: 'exam', target: '1~6年級' },
  { id: 'ev-22', date: '2027-01-01', name: '元旦放假', type: 'holiday', target: '放假' },
  { id: 'ev-23', date: '2027-01-06', name: '第二次中文成績考查 (期末考 D1)', type: 'exam-major', target: '中年級' },
  { id: 'ev-24', date: '2027-01-07', name: '第二次中文成績考查 (期末考 D2)', type: 'exam-major', target: '中年級' },
  { id: 'ev-25', date: '2027-01-12', name: '2~5年級英文讀者劇場比賽', type: 'event', target: '三年級' },
  { id: 'ev-26', date: '2027-01-20', name: '第一學期休業式', type: 'school', target: '全校' },
  { id: 'ev-27', date: '2027-01-21', name: '寒假開始', type: 'holiday', target: '寒假' }
];

/**
 * 格式化 Date 物件為 YYYY-MM-DD
 */
export function formatDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * 計算今日是否處於連假或週末，並回傳應該顯示的作業基準日
 */
export function getActiveHomeworkDate(today = new Date()) {
  const todayStr = formatDateKey(today);
  const dayOfWeek = today.getDay(); // 0 is Sunday, 6 is Saturday, 5 is Friday

  // 1. 檢查是否在國定連假期間
  for (const holiday of TAIWAN_HOLIDAYS_115) {
    if (todayStr >= holiday.startDate && todayStr <= holiday.endDate) {
      return {
        activeDate: holiday.lastSchoolDay,
        isHoliday: true,
        holidayName: holiday.name,
        retainUntil: holiday.endDate,
        note: `連假留存：顯示 ${holiday.lastSchoolDay} 作業（保留至 ${holiday.endDate} 23:59）`
      };
    }
  }

  // 2. 檢查週末留存 (週六與週日顯示週五的作業)
  if (dayOfWeek === 6 || dayOfWeek === 0) {
    // 週六(6): 倒退 1 天到週五; 週日(0): 倒退 2 天到週五
    const diff = dayOfWeek === 6 ? 1 : 2;
    const friday = new Date(today);
    friday.setDate(today.getDate() - diff);
    const fridayStr = formatDateKey(friday);

    const sunday = new Date(today);
    if (dayOfWeek === 6) sunday.setDate(today.getDate() + 1);
    const sundayStr = formatDateKey(sunday);

    return {
      activeDate: fridayStr,
      isWeekend: true,
      retainUntil: sundayStr,
      note: `週末留存：顯示週五 (${fridayStr}) 作業（保留至週日 23:59）`
    };
  }

  // 3. 一般平日：顯示當天
  return {
    activeDate: todayStr,
    isNormalDay: true,
    note: '今日聯絡簿'
  };
}

/**
 * 預設基準範例聯絡簿資料（若尚無當日貼文或辨識，以此為優質展示）
 */
export const DEFAULT_DEMO_HOMEWORK = {
  date: '2026-09-30',
  dateTaiwanStr: '115 年 9 月 30 日 (星期三)',
  photoUrl: '',
  chineseTasks: [
    { id: 'c-1', text: '1. 甲本 p21~23', completed: false, isExam: false },
    { id: 'c-2', text: '2. 數習 p36~37', completed: false, isExam: false },
    { id: 'c-3', text: '3. 社卷 (100) 分訂簽', completed: false, isExam: false },
    { id: 'c-4', text: '4. 明考國卷 L4', completed: false, isExam: true },
    { id: 'c-5', text: '5. 明考社課 p24~25 標題默寫', completed: false, isExam: true }
  ],
  englishTasks: [
    { id: 'e-1', text: '1. Correct, published, sign S2 Writing', completed: false, isExam: false },
    { id: 'e-2', text: '2. Correct, review, sign PW', completed: false, isExam: false },
    { id: 'e-3', text: '3. Correct, review, sign GB p10', completed: false, isExam: false },
    { id: 'e-4', text: '4. Review S3 story', completed: false, isExam: false }
  ],
  notices: [
    { id: 'n-1', text: '✍️ 社卷 (100) 分訂簽', type: 'sign' },
    { id: 'n-2', text: '✍️ 英文 S2 Writing 訂簽', type: 'sign' },
    { id: 'n-3', text: '✍️ 英文 PW 訂簽', type: 'sign' },
    { id: 'n-4', text: '✍️ 英文 GB p10 訂簽', type: 'sign' }
  ],
  upcomingExams: [
    { id: 'ex-1', subject: '國語', scope: '明考國卷 L4', date: '2026-10-01', urgent: true },
    { id: 'ex-2', subject: '社會', scope: '明考社課 p24~25 標題默寫', date: '2026-10-01', urgent: true }
  ]
};

/**
 * 本地 Storage Key 定義
 */
const STORAGE_KEY_HOMEWORK_STATE = 'dojo_homework_state_v5_2';
const STORAGE_KEY_EXAM_RADAR = 'dojo_exam_radar_v5_2';

/**
 * 載入並整合自動全打勾規則之聯絡簿狀態
 */
export function getSavedHomeworkState(currentActiveDate) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_HOMEWORK_STATE);
    let state = raw ? JSON.parse(raw) : { ...DEFAULT_DEMO_HOMEWORK };

    // 若本地記錄的日期早於 currentActiveDate（即到了隔天）
    // 規則：隔天自動將所有作業項目都打勾！
    if (state.date && state.date < currentActiveDate) {
      if (Array.isArray(state.chineseTasks)) {
        state.chineseTasks = state.chineseTasks.map(t => ({ ...t, completed: true }));
      }
      if (Array.isArray(state.englishTasks)) {
        state.englishTasks = state.englishTasks.map(t => ({ ...t, completed: true }));
      }
    }

    return state;
  } catch (err) {
    console.error('讀取聯絡簿狀態失敗:', err);
    return { ...DEFAULT_DEMO_HOMEWORK };
  }
}

/**
 * 儲存聯絡簿狀態至 localStorage
 */
export function saveHomeworkState(state) {
  try {
    localStorage.setItem(STORAGE_KEY_HOMEWORK_STATE, JSON.stringify(state));
  } catch (err) {
    console.error('儲存聯絡簿狀態失敗:', err);
  }
}

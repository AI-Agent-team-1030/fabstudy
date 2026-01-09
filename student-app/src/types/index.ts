import { Timestamp } from "firebase/firestore";

// ユーザー
export interface User {
  id: string;
  name: string;
  password: string; // ハッシュ化
  grade: number; // 学年（1-12）
  role: "student" | "teacher";
  isElementary: boolean; // 小学生フラグ
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// 科目
export type Subject = string;

// 学年区分を取得
export const getSchoolLevel = (grade: number): "elementary" | "junior" | "high" => {
  if (grade <= 6) return "elementary";
  if (grade <= 9) return "junior";
  return "high";
};

// 全科目（学年別フラグ付き）
export const SUBJECTS: { key: string; label: string; category?: string; levels: ("elementary" | "junior" | "high")[] }[] = [
  // 小学生向け
  { key: "kokugo", label: "国語", category: "国語", levels: ["elementary"] },
  { key: "sansu", label: "算数", category: "算数", levels: ["elementary"] },
  { key: "rika_elem", label: "理科", category: "理科", levels: ["elementary"] },
  { key: "shakai_elem", label: "社会", category: "社会", levels: ["elementary"] },
  { key: "eigo_elem", label: "英語", category: "英語", levels: ["elementary"] },

  // 中学生向け
  { key: "japanese_jr", label: "国語", category: "国語", levels: ["junior"] },
  { key: "math_jr", label: "数学", category: "数学", levels: ["junior"] },
  { key: "english_jr", label: "英語", category: "英語", levels: ["junior"] },
  { key: "rika_jr", label: "理科", category: "理科", levels: ["junior"] },
  { key: "shakai_jr", label: "社会", category: "社会", levels: ["junior"] },

  // 高校生向け - 英語
  { key: "english", label: "英語", category: "英語", levels: ["high"] },
  { key: "english_r", label: "英語R", category: "英語", levels: ["high"] },
  { key: "english_l", label: "英語L", category: "英語", levels: ["high"] },

  // 高校生向け - 数学
  { key: "math", label: "数学", category: "数学", levels: ["high"] },
  { key: "math_1a", label: "数学I・A", category: "数学", levels: ["high"] },
  { key: "math_2bc", label: "数学II・B・C", category: "数学", levels: ["high"] },
  { key: "math_3", label: "数学III", category: "数学", levels: ["high"] },

  // 高校生向け - 国語
  { key: "japanese", label: "国語", category: "国語", levels: ["high"] },
  { key: "modern_japanese", label: "現代文", category: "国語", levels: ["high"] },
  { key: "classics", label: "古典", category: "国語", levels: ["high"] },
  { key: "kanbun", label: "漢文", category: "国語", levels: ["high"] },

  // 高校生向け - 理科
  { key: "physics", label: "物理", category: "理科", levels: ["high"] },
  { key: "chemistry", label: "化学", category: "理科", levels: ["high"] },
  { key: "biology", label: "生物", category: "理科", levels: ["high"] },
  { key: "earth_science", label: "地学", category: "理科", levels: ["high"] },

  // 高校生向け - 地歴公民
  { key: "world_history", label: "世界史", category: "地歴", levels: ["high"] },
  { key: "japanese_history", label: "日本史", category: "地歴", levels: ["high"] },
  { key: "geography", label: "地理", category: "地歴", levels: ["high"] },
  { key: "civics", label: "公共", category: "公民", levels: ["high"] },
  { key: "politics_economics", label: "政治・経済", category: "公民", levels: ["high"] },
  { key: "ethics", label: "倫理", category: "公民", levels: ["high"] },

  // 高校生向け - 情報
  { key: "information", label: "情報", category: "情報", levels: ["high"] },
];

// 学年に応じた科目をフィルタリング
export const getSubjectsByGrade = (grade: number) => {
  const level = getSchoolLevel(grade);
  return SUBJECTS.filter(s => s.levels.includes(level));
};

// 勉強ログ
export interface StudyLog {
  id: string;
  userId: string;
  subject: Subject;
  duration: number; // 分単位
  date: Timestamp;
  createdAt: Timestamp;
}

// タスクレベル
export type TaskLevel = "goal" | "project" | "milestone" | "task";

export const TASK_LEVELS: { key: TaskLevel; label: string; color: string }[] = [
  { key: "goal", label: "Goal", color: "#FF6B6B" },
  { key: "project", label: "Project", color: "#4ECDC4" },
  { key: "milestone", label: "Milestone", color: "#FFE66D" },
  { key: "task", label: "Task", color: "#95E1D3" },
];

// タスクステータス
export type TaskStatus = "pending" | "in_progress" | "completed";

// タスク
export interface Task {
  id: string;
  userId: string;
  level: TaskLevel;
  parentId: string | null;
  title: string;
  startDate: Timestamp | null;
  endDate: Timestamp | null;
  status: TaskStatus;
  progress: number; // 0-100
  actualTime: number; // 分単位
  memo: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// AIコメント
export interface AIComment {
  id: string;
  userId: string;
  weekKey: string; // YYYY-Wnn形式
  praise: string;
  advice: string;
  createdAt: Timestamp;
}

// テスト種類
export type ExamType = "mock" | "regular";

// テスト記録
export interface ExamRecord {
  id: string;
  userId: string;
  examType: ExamType;
  examName: string;
  examDate: Timestamp;
  subject: Subject;
  score: number;
  maxScore: number;
  deviation?: number; // 偏差値（模試のみ）
  note?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// 志望校・目標
export interface TargetSchool {
  id: string;
  userId: string;
  schoolName: string;
  targetTotalScore: number;
  targetScores: {
    english?: number;
    math?: number;
    japanese?: number;
    science?: number;
    social?: number;
  };
  priority: number; // 優先順位（第1志望=1）
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// メッセージ
export type RecipientType = "individual" | "all";
export type MessagePriority = "normal" | "important";

export interface Message {
  id: string;
  senderId: string;
  recipientType: RecipientType;
  recipientId?: string;
  title: string;
  body: string;
  priority: MessagePriority;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// 簡易返信タイプ
export type ReplyType = "confirmed" | "understood" | "will_do";

export const REPLY_TYPES: { key: ReplyType; label: string }[] = [
  { key: "confirmed", label: "確認しました" },
  { key: "understood", label: "わかりました" },
  { key: "will_do", label: "がんばります" },
];

// メッセージ既読・返信
export interface MessageReceipt {
  id: string;
  messageId: string;
  userId: string;
  isRead: boolean;
  readAt?: Timestamp;
  reply?: ReplyType;
  repliedAt?: Timestamp;
  createdAt: Timestamp;
}

// セッション情報（LocalStorage用）
export interface SessionUser {
  id: string;
  name: string;
  role: "student" | "teacher";
  grade: number;
  isElementary: boolean;
}

// ゲーミフィケーション（小学生向け）

// レベル設定
export const LEVEL_CONFIG = {
  expPerMinute: 2,        // 1分 = 2経験値
  expPerRecord: 10,       // 1記録 = 10経験値
  baseExpForLevel: 100,   // レベル1→2に必要な経験値
  expMultiplier: 1.2,     // レベルごとの必要経験値倍率
};

// レベルに必要な累計経験値を計算
export const getExpForLevel = (level: number): number => {
  if (level <= 1) return 0;
  let totalExp = 0;
  for (let i = 1; i < level; i++) {
    totalExp += Math.floor(LEVEL_CONFIG.baseExpForLevel * Math.pow(LEVEL_CONFIG.expMultiplier, i - 1));
  }
  return totalExp;
};

// 経験値からレベルを計算
export const getLevelFromExp = (exp: number): { level: number; currentExp: number; nextLevelExp: number } => {
  let level = 1;
  let accumulatedExp = 0;

  while (true) {
    const expNeeded = Math.floor(LEVEL_CONFIG.baseExpForLevel * Math.pow(LEVEL_CONFIG.expMultiplier, level - 1));
    if (accumulatedExp + expNeeded > exp) {
      return {
        level,
        currentExp: exp - accumulatedExp,
        nextLevelExp: expNeeded,
      };
    }
    accumulatedExp += expNeeded;
    level++;
    if (level > 100) break; // 安全のため上限
  }
  return { level: 100, currentExp: 0, nextLevelExp: 0 };
};

// バッジ定義
export interface BadgeDefinition {
  id: string;
  name: string;
  description: string;
  icon: string;
  condition: "streak" | "total_time" | "total_records";
  threshold: number;
}

export const BADGES: BadgeDefinition[] = [
  // 連続記録バッジ
  { id: "streak_3", name: "3日連続", description: "3日連続で勉強を記録した！", icon: "🔥", condition: "streak", threshold: 3 },
  { id: "streak_7", name: "1週間連続", description: "1週間連続で勉強を記録した！", icon: "⭐", condition: "streak", threshold: 7 },
  { id: "streak_14", name: "2週間連続", description: "2週間連続で勉強を記録した！", icon: "🌟", condition: "streak", threshold: 14 },
  { id: "streak_30", name: "1ヶ月連続", description: "1ヶ月連続で勉強を記録した！", icon: "👑", condition: "streak", threshold: 30 },
  // 累計時間バッジ
  { id: "time_60", name: "1時間達成", description: "累計1時間勉強した！", icon: "📚", condition: "total_time", threshold: 60 },
  { id: "time_300", name: "5時間達成", description: "累計5時間勉強した！", icon: "📖", condition: "total_time", threshold: 300 },
  { id: "time_600", name: "10時間達成", description: "累計10時間勉強した！", icon: "🎯", condition: "total_time", threshold: 600 },
  { id: "time_1800", name: "30時間達成", description: "累計30時間勉強した！", icon: "🏆", condition: "total_time", threshold: 1800 },
  { id: "time_6000", name: "100時間達成", description: "累計100時間勉強した！", icon: "💎", condition: "total_time", threshold: 6000 },
];

// ユーザーのゲーミフィケーションデータ
export interface UserGameData {
  id: string;
  userId: string;
  totalExp: number;
  earnedBadges: string[]; // バッジIDの配列
  currentStreak: number;
  longestStreak: number;
  lastRecordDate: string; // YYYY-MM-DD形式
  updatedAt: Timestamp;
}

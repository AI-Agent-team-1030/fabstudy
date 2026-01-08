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

export const SUBJECTS: { key: string; label: string; category?: string }[] = [
  // 英語
  { key: "english", label: "英語", category: "英語" },
  { key: "english_r", label: "英語R", category: "英語" },
  { key: "english_l", label: "英語L", category: "英語" },

  // 数学
  { key: "math", label: "数学", category: "数学" },
  { key: "math_1a", label: "数学I・A", category: "数学" },
  { key: "math_2bc", label: "数学II・B・C", category: "数学" },
  { key: "math_3", label: "数学III", category: "数学" },

  // 国語
  { key: "japanese", label: "国語", category: "国語" },

  // 理科
  { key: "physics", label: "物理", category: "理科" },
  { key: "chemistry", label: "化学", category: "理科" },
  { key: "biology", label: "生物", category: "理科" },
  { key: "earth_science", label: "地学", category: "理科" },

  // 地歴公民
  { key: "world_history", label: "世界史", category: "地歴" },
  { key: "japanese_history", label: "日本史", category: "地歴" },
  { key: "geography", label: "地理", category: "地歴" },
  { key: "civics", label: "公共", category: "公民" },
  { key: "politics_economics", label: "政治・経済", category: "公民" },
  { key: "ethics", label: "倫理", category: "公民" },

  // 情報
  { key: "information", label: "情報", category: "情報" },
];

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

"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Header } from "@/components/common/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { db } from "@/lib/firebase";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  Timestamp,
} from "firebase/firestore";
import { SUBJECTS } from "@/types";
import { toast } from "sonner";

interface Student {
  id: string;
  name: string;
  grade: number;
  isElementary: boolean;
}

interface StudyLog {
  id: string;
  subject: string;
  duration: number;
  date: Timestamp;
}

interface Task {
  id: string;
  userId: string;
  title: string;
  level: string;
  parentId: string | null;
  status: string;
  progress: number;
  endDate: Timestamp | null;
  createdAt: Timestamp;
}

interface WishItem {
  id: string;
  userId: string;
  title: string;
  completed: boolean;
  createdAt: Timestamp;
}

type TaskLevel = "goal" | "large" | "medium" | "small";

const LEVEL_CONFIG: Record<TaskLevel, { label: string; color: string; bgColor: string; childLevel: TaskLevel | null }> = {
  goal: { label: "GOAL", color: "bg-indigo-900", bgColor: "bg-indigo-50", childLevel: "large" },
  large: { label: "TASK(大)", color: "bg-blue-600", bgColor: "bg-blue-50", childLevel: "medium" },
  medium: { label: "TASK(中)", color: "bg-blue-400", bgColor: "bg-blue-50", childLevel: "small" },
  small: { label: "TASK(小)", color: "bg-gray-400", bgColor: "bg-gray-50", childLevel: null },
};

// 科目ごとの色
const SUBJECT_COLORS: Record<string, string> = {
  english: "#EF4444",
  english_r: "#DC2626",
  english_l: "#F87171",
  math: "#3B82F6",
  math_1a: "#2563EB",
  math_2bc: "#60A5FA",
  math_3: "#1D4ED8",
  japanese: "#F97316",
  modern_japanese: "#F97316",
  classics: "#EA580C",
  kanbun: "#C2410C",
  physics: "#8B5CF6",
  chemistry: "#22C55E",
  biology: "#EC4899",
  earth_science: "#06B6D4",
  world_history: "#92400E",
  japanese_history: "#B45309",
  geography: "#65A30D",
  civics: "#0891B2",
  politics_economics: "#7C3AED",
  ethics: "#DB2777",
  information: "#6366F1",
  kokugo: "#F97316",
  sansu: "#3B82F6",
  rika: "#22C55E",
  shakai: "#92400E",
  japanese_jr: "#F97316",
  math_jr: "#3B82F6",
  science_jr: "#22C55E",
  social_jr: "#92400E",
  english_jr: "#EF4444",
};

const getSubjectColor = (subject: string): string => {
  return SUBJECT_COLORS[subject] || "#6B7280";
};

export default function StudentDetailPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const studentId = params.id as string;

  const [student, setStudent] = useState<Student | null>(null);
  const [studyLogs, setStudyLogs] = useState<StudyLog[]>([]);
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [wishlistItems, setWishlistItems] = useState<WishItem[]>([]);
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [loadingData, setLoadingData] = useState(true);
  const [addingTo, setAddingTo] = useState<{ parentId: string | null; level: TaskLevel } | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskEndDate, setNewTaskEndDate] = useState("");
  const [newWishItem, setNewWishItem] = useState("");

  useEffect(() => {
    if (!loading && (!user || user.role !== "teacher")) {
      router.push("/login");
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user && user.role === "teacher" && studentId) {
      loadStudentData();
    }
  }, [user, studentId]);

  const loadStudentData = async () => {
    try {
      // 生徒情報を取得
      const studentRef = doc(db, "users", studentId);
      const studentSnap = await getDoc(studentRef);

      if (!studentSnap.exists()) {
        router.push("/students");
        return;
      }

      const studentData = {
        id: studentSnap.id,
        ...studentSnap.data(),
      } as Student;
      setStudent(studentData);

      // 勉強ログを取得
      const logsRef = collection(db, "studyLogs");
      const logsQuery = query(logsRef, where("userId", "==", studentId));
      const logsSnap = await getDocs(logsQuery);

      const logsData = logsSnap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as StudyLog[];
      logsData.sort((a, b) => b.date.toDate().getTime() - a.date.toDate().getTime());
      setStudyLogs(logsData);

      // 小学生の場合はwishlistを取得、それ以外はtasksを取得
      if (studentData.isElementary) {
        const wishlistRef = collection(db, "wishlist");
        const wishlistQuery = query(wishlistRef, where("userId", "==", studentId));
        const wishlistSnap = await getDocs(wishlistQuery);

        const wishlistData = wishlistSnap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as WishItem[];
        wishlistData.sort((a, b) => {
          if (a.completed !== b.completed) {
            return a.completed ? 1 : -1;
          }
          const dateA = a.createdAt?.toDate?.() || new Date(0);
          const dateB = b.createdAt?.toDate?.() || new Date(0);
          return dateB.getTime() - dateA.getTime();
        });
        setWishlistItems(wishlistData);
      } else {
        // 全タスクを取得
        const tasksRef = collection(db, "tasks");
        const tasksQuery = query(tasksRef, where("userId", "==", studentId));
        const tasksSnap = await getDocs(tasksQuery);

        const tasksData = tasksSnap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Task[];

        setAllTasks(tasksData);
      }
    } catch (error) {
      console.error("Failed to load student data:", error);
    } finally {
      setLoadingData(false);
    }
  };

  const toggleExpand = (taskId: string) => {
    setExpandedTasks((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  };

  const getChildren = (parentId: string | null, level?: TaskLevel) => {
    if (level) {
      return allTasks.filter((t) => t.parentId === parentId && t.level === level);
    }
    return allTasks.filter((t) => t.parentId === parentId);
  };

  const getGoals = () => {
    return allTasks.filter((t) => t.level === "goal");
  };

  // 子タスクの進捗の平均を計算
  const calculateProgress = (taskId: string, level: TaskLevel): number => {
    const childLevel = LEVEL_CONFIG[level].childLevel;
    if (!childLevel) return 0;

    const children = allTasks.filter((t) => t.parentId === taskId);
    if (children.length === 0) return 0;

    const totalProgress = children.reduce((sum, child) => {
      const childProgress = child.status === "completed"
        ? 100
        : (child.progress || calculateProgress(child.id, child.level as TaskLevel));
      return sum + childProgress;
    }, 0);
    return Math.round(totalProgress / children.length);
  };

  // タスク追加
  const handleAddTask = async () => {
    if (!addingTo || !newTaskTitle) return;

    try {
      const tasksRef = collection(db, "tasks");
      await addDoc(tasksRef, {
        userId: studentId,
        level: addingTo.level,
        parentId: addingTo.parentId,
        title: newTaskTitle,
        startDate: null,
        endDate: newTaskEndDate ? Timestamp.fromDate(new Date(newTaskEndDate)) : null,
        status: "pending",
        progress: 0,
        createdAt: Timestamp.now(),
      });

      toast.success("タスクを追加しました！");
      setAddingTo(null);
      setNewTaskTitle("");
      setNewTaskEndDate("");
      loadStudentData();
    } catch (error) {
      console.error("Failed to add task:", error);
      toast.error("追加に失敗しました");
    }
  };

  // 親タスクの進捗を再計算して更新
  const updateParentProgress = async (parentId: string | null, tasksList: Task[]) => {
    if (!parentId) return;

    const parent = tasksList.find((t) => t.id === parentId);
    if (!parent) return;

    const children = tasksList.filter((t) => t.parentId === parentId);
    if (children.length === 0) return;

    const totalProgress = children.reduce((sum, child) => sum + (child.progress || 0), 0);
    const progress = Math.round(totalProgress / children.length);
    const newStatus = progress === 100 ? "completed" : "pending";

    const parentRef = doc(db, "tasks", parentId);
    await updateDoc(parentRef, {
      status: newStatus,
      progress: progress,
    });

    if (parent.parentId) {
      const updatedTasks = tasksList.map((t) =>
        t.id === parentId ? { ...t, status: newStatus, progress } : t
      );
      await updateParentProgress(parent.parentId, updatedTasks);
    }
  };

  // 子孫タスクを全て取得
  const getAllDescendants = (parentId: string, tasksList: Task[]): Task[] => {
    const children = tasksList.filter((t) => t.parentId === parentId);
    let descendants = [...children];
    for (const child of children) {
      descendants = [...descendants, ...getAllDescendants(child.id, tasksList)];
    }
    return descendants;
  };

  // タスク削除
  const handleDelete = async (taskId: string) => {
    if (!confirm("このタスクを削除しますか？子タスクも全て削除されます。")) return;

    try {
      const task = allTasks.find((t) => t.id === taskId);
      const parentId = task?.parentId;

      const descendants = getAllDescendants(taskId, allTasks);
      for (const desc of descendants) {
        await deleteDoc(doc(db, "tasks", desc.id));
      }
      await deleteDoc(doc(db, "tasks", taskId));

      if (parentId) {
        const remainingTasks = allTasks.filter(
          (t) => t.id !== taskId && !descendants.some((d) => d.id === t.id)
        );
        await updateParentProgress(parentId, remainingTasks);
      }

      toast.success("タスクを削除しました");
      loadStudentData();
    } catch (error) {
      console.error("Failed to delete task:", error);
      toast.error("削除に失敗しました");
    }
  };

  // タスク完了
  const handleComplete = async (taskId: string) => {
    try {
      const taskRef = doc(db, "tasks", taskId);
      await updateDoc(taskRef, {
        status: "completed",
        progress: 100,
      });

      const task = allTasks.find((t) => t.id === taskId);
      if (task?.parentId) {
        const updatedTasks = allTasks.map((t) =>
          t.id === taskId ? { ...t, status: "completed", progress: 100 } : t
        );
        await updateParentProgress(task.parentId, updatedTasks);
      }

      toast.success("タスクを完了しました！");
      loadStudentData();
    } catch (error) {
      console.error("Failed to complete task:", error);
      toast.error("更新に失敗しました");
    }
  };

  // タスク未完了に戻す
  const handleUncomplete = async (taskId: string) => {
    try {
      const taskRef = doc(db, "tasks", taskId);
      await updateDoc(taskRef, {
        status: "pending",
        progress: 0,
      });

      const task = allTasks.find((t) => t.id === taskId);
      if (task?.parentId) {
        const updatedTasks = allTasks.map((t) =>
          t.id === taskId ? { ...t, status: "pending", progress: 0 } : t
        );
        await updateParentProgress(task.parentId, updatedTasks);
      }

      loadStudentData();
    } catch (error) {
      console.error("Failed to uncomplete task:", error);
      toast.error("更新に失敗しました");
    }
  };

  // やりたいことリスト追加（小学生用）
  const handleAddWishItem = async () => {
    if (!newWishItem.trim()) return;

    try {
      const wishlistRef = collection(db, "wishlist");
      await addDoc(wishlistRef, {
        userId: studentId,
        title: newWishItem.trim(),
        completed: false,
        createdAt: Timestamp.now(),
      });
      toast.success("追加しました");
      setNewWishItem("");
      loadStudentData();
    } catch (error) {
      console.error("Failed to add wish item:", error);
      toast.error("追加に失敗しました");
    }
  };

  // やりたいことリスト完了切り替え（小学生用）
  const handleToggleWishItem = async (item: WishItem) => {
    try {
      const itemRef = doc(db, "wishlist", item.id);
      await updateDoc(itemRef, {
        completed: !item.completed,
      });
      if (!item.completed) {
        toast.success("完了しました！");
      }
      loadStudentData();
    } catch (error) {
      console.error("Failed to toggle wish item:", error);
    }
  };

  // やりたいことリスト削除（小学生用）
  const handleDeleteWishItem = async (itemId: string) => {
    if (!confirm("削除しますか？")) return;

    try {
      await deleteDoc(doc(db, "wishlist", itemId));
      toast.success("削除しました");
      loadStudentData();
    } catch (error) {
      console.error("Failed to delete wish item:", error);
      toast.error("削除に失敗しました");
    }
  };

  const formatEndDate = (end: Timestamp | null) => {
    if (!end) return null;
    const d = end.toDate();
    return `達成日: ${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
  };

  const renderTask = (task: Task, depth: number = 0) => {
    const config = LEVEL_CONFIG[task.level as TaskLevel];
    if (!config) return null;

    const childLevel = config.childLevel;
    const children = childLevel ? getChildren(task.id, childLevel) : [];
    const isExpanded = expandedTasks.has(task.id);
    const hasChildren = children.length > 0;
    const progress = task.status === "completed" ? 100 : calculateProgress(task.id, task.level as TaskLevel);
    const endDateDisplay = formatEndDate(task.endDate);

    return (
      <div key={task.id} className={`${depth > 0 ? "ml-6 border-l-2 border-gray-200 pl-4" : ""}`}>
        <div
          className={`border rounded-lg overflow-hidden mb-2 ${config.bgColor}`}
        >
          <div
            className={`${config.color} text-white px-3 py-1 flex items-center gap-2 cursor-pointer`}
            onClick={() => toggleExpand(task.id)}
          >
            <span className="text-sm">{isExpanded ? "▼" : "▶"}</span>
            <span className="text-sm font-medium">{config.label}</span>
          </div>
          <div className="p-3">
            <div className="flex justify-between items-start mb-2">
              <div>
                <h4 className="font-medium">{task.title}</h4>
                {endDateDisplay && (
                  <p className="text-xs text-gray-500">{endDateDisplay}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {task.level === "small" || !hasChildren ? (
                  <Badge variant={task.status === "completed" ? "default" : "secondary"}>
                    {task.status === "completed" ? "完了" : "未完了"}
                  </Badge>
                ) : (
                  <Badge variant={task.status === "completed" ? "default" : "secondary"}>
                    {task.status === "completed" ? "完了" : "進行中"}
                  </Badge>
                )}
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(task.id);
                  }}
                >
                  削除
                </Button>
              </div>
            </div>

            {/* 子タスクがない場合はチェックボックス */}
            {!hasChildren ? (
              <div className="mt-2 flex items-center gap-3">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    task.status === "completed" ? handleUncomplete(task.id) : handleComplete(task.id);
                  }}
                  className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all ${
                    task.status === "completed"
                      ? "bg-green-500 border-green-500 text-white"
                      : "bg-white border-gray-300 hover:border-blue-500"
                  }`}
                >
                  {task.status === "completed" && (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
                <span className={`text-sm ${task.status === "completed" ? "text-green-600 font-medium" : "text-gray-500"}`}>
                  クリックで完了/未完了を切り替え
                </span>
              </div>
            ) : (
              <>
                <Progress value={progress} className="h-2" />
                <p className="text-sm text-gray-500 mt-1">進捗: {progress}%</p>
              </>
            )}
          </div>
        </div>

        {/* 子タスク */}
        {isExpanded && hasChildren && (
          <div className="mt-2">
            {children.map((child) => renderTask(child, depth + 1))}
          </div>
        )}

        {/* 子タスク追加ボタン */}
        {isExpanded && childLevel && (
          <div className="mt-2 ml-6">
            <Button
              variant="outline"
              size="sm"
              className="border-dashed border-2 w-full"
              onClick={(e) => {
                e.stopPropagation();
                setAddingTo({ parentId: task.id, level: childLevel });
              }}
            >
              + {LEVEL_CONFIG[childLevel].label}を追加
            </Button>
          </div>
        )}
      </div>
    );
  };

  const getGradeLabel = (grade: number, isElementary: boolean) => {
    if (isElementary) {
      return `小学${grade}年生`;
    }
    if (grade <= 9) {
      return `中学${grade - 6}年生`;
    }
    return `高校${grade - 9}年生`;
  };

  const formatDate = (timestamp: Timestamp) => {
    const date = timestamp.toDate();
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  const getSubjectLabel = (key: string) => {
    return SUBJECTS.find((s) => s.key === key)?.label || key;
  };

  const getSubjectBadgeColor = (subject: string) => {
    const subjectData = SUBJECTS.find((s) => s.key === subject);
    const category = subjectData?.category || subject;

    const colors: Record<string, string> = {
      英語: "bg-blue-100 text-blue-800",
      数学: "bg-red-100 text-red-800",
      国語: "bg-green-100 text-green-800",
      理科: "bg-purple-100 text-purple-800",
      地歴: "bg-yellow-100 text-yellow-800",
      公民: "bg-orange-100 text-orange-800",
      情報: "bg-violet-100 text-violet-800",
    };
    return colors[category] || "bg-gray-100 text-gray-800";
  };

  const getWeeklyStudyTime = () => {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(now);
    monday.setDate(now.getDate() + mondayOffset);
    monday.setHours(0, 0, 0, 0);

    return studyLogs
      .filter((log) => log.date.toDate() >= monday)
      .reduce((sum, log) => sum + log.duration, 0);
  };

  const formatStudyTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins}分`;
    if (mins === 0) return `${hours}時間`;
    return `${hours}時間${mins}分`;
  };

  // 週間データ（棒グラフ用）
  const getWeeklyData = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const days: { dateKey: string; label: string; subjects: Record<string, number> }[] = [];

    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateKey = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      days.push({
        dateKey,
        label: `${d.getMonth() + 1}/${d.getDate()}`,
        subjects: {},
      });
    }

    studyLogs.forEach((log) => {
      const logDate = log.date.toDate();
      const logDateKey = `${logDate.getFullYear()}-${logDate.getMonth()}-${logDate.getDate()}`;

      const day = days.find((d) => d.dateKey === logDateKey);
      if (day) {
        const subj = log.subject || "other";
        day.subjects[subj] = (day.subjects[subj] || 0) + (log.duration || 0);
      }
    });

    return days;
  };

  const getWeeklySubjects = (weeklyData: typeof getWeeklyData extends () => infer R ? R : never) => {
    const subjects = new Set<string>();
    weeklyData.forEach((day) => {
      Object.keys(day.subjects).forEach((subj) => subjects.add(subj));
    });
    return Array.from(subjects);
  };

  // 今日の合計
  const getTodayTotal = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return studyLogs
      .filter((log) => {
        const logDate = log.date.toDate();
        const logDateOnly = new Date(logDate);
        logDateOnly.setHours(0, 0, 0, 0);
        return logDateOnly.getTime() === today.getTime();
      })
      .reduce((sum, log) => sum + log.duration, 0);
  };

  // 総計
  const getAllTimeTotal = () => {
    return studyLogs.reduce((sum, log) => sum + (log.duration || 0), 0);
  };

  if (loading || !user || loadingData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>読み込み中...</p>
      </div>
    );
  }

  if (!student) {
    return null;
  }

  const weeklyTime = getWeeklyStudyTime();
  const goals = getGoals();
  const weeklyData = getWeeklyData();
  const maxDailyMinutes = Math.max(
    ...weeklyData.map((d) =>
      Object.values(d.subjects).reduce((sum, v) => sum + v, 0)
    ),
    60
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="max-w-4xl mx-auto px-4 py-6">
        <Button
          variant="ghost"
          className="mb-4"
          onClick={() => router.push("/students")}
        >
          ← 生徒一覧に戻る
        </Button>

        {/* 生徒情報 */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle className="text-2xl">{student.name}</CardTitle>
              <Badge variant="secondary" className="text-lg px-4 py-1">
                {getGradeLabel(student.grade, student.isElementary)}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="bg-blue-50 rounded-lg p-4 text-center">
              <p className="text-sm text-gray-500">今週の勉強時間</p>
              <p className="text-2xl font-bold text-blue-600">
                {formatStudyTime(weeklyTime)}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* 目標・タスク一覧 or やりたいことリスト */}
        {student.isElementary ? (
          // 小学生用: やりたいことリスト
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>やりたいことリスト</CardTitle>
            </CardHeader>
            <CardContent>
              {/* 追加フォーム */}
              <div className="flex gap-2 mb-4">
                <Input
                  placeholder="やりたいことを入力"
                  value={newWishItem}
                  onChange={(e) => setNewWishItem(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddWishItem()}
                  className="flex-1"
                />
                <Button
                  onClick={handleAddWishItem}
                  disabled={!newWishItem.trim()}
                >
                  追加
                </Button>
              </div>

              {/* 進捗 */}
              {wishlistItems.length > 0 && (
                <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-gray-600">達成状況</span>
                    <span className="font-bold">
                      {wishlistItems.filter((i) => i.completed).length} / {wishlistItems.length}
                    </span>
                  </div>
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 transition-all"
                      style={{ width: `${wishlistItems.length > 0 ? (wishlistItems.filter((i) => i.completed).length / wishlistItems.length) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              )}

              {/* リスト */}
              {wishlistItems.length === 0 ? (
                <p className="text-gray-500 text-center py-4">
                  やりたいことを追加してみよう
                </p>
              ) : (
                <div className="space-y-2">
                  {wishlistItems.map((item) => (
                    <div
                      key={item.id}
                      className={`flex items-center gap-3 p-3 rounded-lg ${
                        item.completed ? "bg-green-50" : "bg-gray-50"
                      }`}
                    >
                      <button
                        onClick={() => handleToggleWishItem(item)}
                        className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-all ${
                          item.completed
                            ? "bg-green-500 border-green-500 text-white"
                            : "bg-white border-gray-300 hover:border-blue-500"
                        }`}
                      >
                        {item.completed && (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </button>
                      <span
                        className={`flex-1 ${
                          item.completed ? "text-gray-400 line-through" : "text-gray-700"
                        }`}
                      >
                        {item.title}
                      </span>
                      <button
                        onClick={() => handleDeleteWishItem(item.id)}
                        className="text-gray-400 hover:text-red-500"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          // 中学生・高校生用: 目標とタスク階層構造
          <Card className="mb-6">
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>目標とタスク</CardTitle>
                  <p className="text-sm text-gray-500">クリックで展開・編集できます</p>
                </div>
                <Button
                  onClick={() => setAddingTo({ parentId: null, level: "goal" })}
                >
                  + GOALを追加
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {goals.length === 0 ? (
                <p className="text-gray-500 text-center py-4">
                  まだ目標が設定されていません
                </p>
              ) : (
                <div className="space-y-4">
                  {goals.map((goal) => renderTask(goal))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* 週間棒グラフ */}
        <Card className="mb-6">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">学習時間（1週間）</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {/* 今日・今週・総計 */}
            <div className="grid grid-cols-3 border-y bg-gray-100">
              <div className="text-center py-2 border-r">
                <div className="text-sm text-gray-500">今日</div>
              </div>
              <div className="text-center py-2 border-r">
                <div className="text-sm text-gray-500">今週</div>
              </div>
              <div className="text-center py-2">
                <div className="text-sm text-gray-500">総計</div>
              </div>
            </div>
            <div className="grid grid-cols-3 border-b">
              <div className="text-center py-3 border-r">
                <span className="text-xl font-bold">{formatStudyTime(getTodayTotal())}</span>
              </div>
              <div className="text-center py-3 border-r">
                <span className="text-xl font-bold">{formatStudyTime(weeklyTime)}</span>
              </div>
              <div className="text-center py-3">
                <span className="text-xl font-bold">{formatStudyTime(getAllTimeTotal())}</span>
              </div>
            </div>

            {/* 棒グラフ */}
            <div className="p-4">
              <div className="flex gap-2 h-48">
                <div className="flex flex-col justify-between text-xs text-gray-500 pr-2 pb-6">
                  <span>{Math.ceil(maxDailyMinutes / 60)}時間</span>
                  <span>{Math.ceil(maxDailyMinutes / 120)}時間</span>
                  <span>0</span>
                </div>
                <div className="flex-1 flex items-end gap-2">
                  {weeklyData.map((day, index) => {
                    const dayTotal = Object.values(day.subjects).reduce((sum, v) => sum + v, 0);
                    const maxHeight = 160;
                    const barHeight = maxDailyMinutes > 0 ? (dayTotal / maxDailyMinutes) * maxHeight : 0;

                    return (
                      <div key={index} className="flex-1 flex flex-col items-center">
                        <div className="w-full flex flex-col justify-end" style={{ height: `${maxHeight}px` }}>
                          <div
                            className="w-full flex flex-col-reverse rounded-t overflow-hidden"
                            style={{ height: `${barHeight}px` }}
                          >
                            {Object.entries(day.subjects).map(([subj, minutes]) => {
                              const segmentHeight = dayTotal > 0 ? (minutes / dayTotal) * barHeight : 0;
                              return (
                                <div
                                  key={subj}
                                  style={{
                                    height: `${segmentHeight}px`,
                                    backgroundColor: getSubjectColor(subj),
                                  }}
                                />
                              );
                            })}
                          </div>
                        </div>
                        <span className="text-xs text-gray-500 mt-2">{day.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 科目凡例 */}
              {getWeeklySubjects(weeklyData).length > 0 && (
                <div className="flex flex-wrap gap-3 mt-4 pt-4 border-t">
                  {getWeeklySubjects(weeklyData).map((subj) => (
                    <div key={subj} className="flex items-center gap-1">
                      <span
                        className="w-3 h-3 rounded-sm"
                        style={{ backgroundColor: getSubjectColor(subj) }}
                      />
                      <span className="text-xs text-gray-600">{getSubjectLabel(subj)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 最近の勉強ログ */}
        <Card>
          <CardHeader>
            <CardTitle>最近の勉強ログ</CardTitle>
          </CardHeader>
          <CardContent>
            {studyLogs.length === 0 ? (
              <p className="text-gray-500 text-center py-4">
                まだ勉強ログがありません
              </p>
            ) : (
              <div className="space-y-2">
                {studyLogs.slice(0, 10).map((log) => (
                  <div
                    key={log.id}
                    className="flex items-center justify-between py-2 border-b last:border-b-0"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-gray-500">
                        {formatDate(log.date)}
                      </span>
                      <Badge className={getSubjectBadgeColor(log.subject)}>
                        {getSubjectLabel(log.subject)}
                      </Badge>
                    </div>
                    <span className="font-medium">{log.duration}分</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 追加ダイアログ */}
        <Dialog open={!!addingTo} onOpenChange={(open) => !open && setAddingTo(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {addingTo && LEVEL_CONFIG[addingTo.level].label}を追加
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>タイトル</Label>
                <Input
                  placeholder="例: 国立理系に合格する"
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>達成日</Label>
                <Input
                  type="date"
                  value={newTaskEndDate}
                  onChange={(e) => setNewTaskEndDate(e.target.value)}
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setAddingTo(null)}>
                  キャンセル
                </Button>
                <Button onClick={handleAddTask} disabled={!newTaskTitle}>
                  追加
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}

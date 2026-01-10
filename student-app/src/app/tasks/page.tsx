"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Header } from "@/components/common/Header";
import { BottomNav } from "@/components/common/BottomNav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { db } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  Timestamp,
} from "firebase/firestore";
import { toast } from "sonner";

type TaskLevel = "goal" | "large" | "medium" | "small";

interface Task {
  id: string;
  userId: string;
  level: TaskLevel;
  parentId: string | null;
  title: string;
  startDate: Timestamp | null;
  endDate: Timestamp | null;
  status: string;
  progress: number;
  memo?: string;
  createdAt: Timestamp;
}

const LEVEL_CONFIG: Record<TaskLevel, { label: string; color: string; bgColor: string; childLevel: TaskLevel | null }> = {
  goal: { label: "GOAL", color: "bg-indigo-900", bgColor: "bg-indigo-50", childLevel: "large" },
  large: { label: "TASK(大)", color: "bg-blue-600", bgColor: "bg-blue-50", childLevel: "medium" },
  medium: { label: "TASK(中)", color: "bg-blue-400", bgColor: "bg-blue-50", childLevel: "small" },
  small: { label: "TASK(小)", color: "bg-gray-400", bgColor: "bg-gray-50", childLevel: null },
};

export default function TasksPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(() => {
    // localStorageから前回の状態を復元
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("expandedTasks");
      if (saved) {
        try {
          return new Set(JSON.parse(saved));
        } catch {
          return new Set();
        }
      }
    }
    return new Set();
  });
  const [addingTo, setAddingTo] = useState<{ parentId: string | null; level: TaskLevel } | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskEndDate, setNewTaskEndDate] = useState("");
  const [newTaskMemo, setNewTaskMemo] = useState("");
  const [editingMemo, setEditingMemo] = useState<{ taskId: string; memo: string } | null>(null);
  const [collapsedMemos, setCollapsedMemos] = useState<Set<string>>(new Set());

  const toggleMemoCollapse = (taskId: string) => {
    setCollapsedMemos((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  };

  // 展開状態をlocalStorageに保存
  useEffect(() => {
    localStorage.setItem("expandedTasks", JSON.stringify([...expandedTasks]));
  }, [expandedTasks]);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user) {
      loadTasks();
    }
  }, [user]);

  const loadTasks = async () => {
    if (!user) return;
    try {
      const tasksRef = collection(db, "tasks");
      const q = query(tasksRef, where("userId", "==", user.id));
      const snapshot = await getDocs(q);
      const tasksData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Task[];
      setTasks(tasksData);
    } catch (error) {
      console.error("Failed to load tasks:", error);
    } finally {
      setLoadingTasks(false);
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

  const getChildren = (parentId: string | null, level: TaskLevel) => {
    return tasks.filter((t) => t.parentId === parentId && t.level === level);
  };

  // 子タスクの進捗の平均を計算（表示用）
  const calculateProgress = (taskId: string, level: TaskLevel): number => {
    const childLevel = LEVEL_CONFIG[level].childLevel;
    if (!childLevel) return 0;

    const children = tasks.filter((t) => t.parentId === taskId);
    if (children.length === 0) return 0;

    // 子タスクの進捗の平均
    const totalProgress = children.reduce((sum, child) => {
      // 子の進捗を再帰的に計算
      const childProgress = child.status === "completed"
        ? 100
        : (child.progress || calculateProgress(child.id, child.level));
      return sum + childProgress;
    }, 0);
    return Math.round(totalProgress / children.length);
  };

  const handleAddTask = async () => {
    if (!user || !addingTo || !newTaskTitle) return;

    try {
      const tasksRef = collection(db, "tasks");
      await addDoc(tasksRef, {
        userId: user.id,
        level: addingTo.level,
        parentId: addingTo.parentId,
        title: newTaskTitle,
        startDate: null,
        endDate: newTaskEndDate ? Timestamp.fromDate(new Date(newTaskEndDate)) : null,
        status: "pending",
        progress: 0,
        memo: newTaskMemo || "",
        createdAt: Timestamp.now(),
      });

      toast.success("タスクを追加しました！");
      setAddingTo(null);
      setNewTaskTitle("");
      setNewTaskEndDate("");
      setNewTaskMemo("");
      loadTasks();
    } catch (error) {
      console.error("Failed to add task:", error);
      toast.error("追加に失敗しました");
    }
  };

  const handleUpdateMemo = async (taskId: string, memo: string) => {
    try {
      const taskRef = doc(db, "tasks", taskId);
      await updateDoc(taskRef, { memo });
      toast.success("メモを更新しました");
      setEditingMemo(null);
      loadTasks();
    } catch (error) {
      console.error("Failed to update memo:", error);
      toast.error("メモの更新に失敗しました");
    }
  };

  // 親タスクの進捗を再計算して更新（再帰的に上位まで）
  const updateParentProgress = async (parentId: string | null, allTasks: Task[]) => {
    if (!parentId) return;

    const parent = allTasks.find((t) => t.id === parentId);
    if (!parent) return;

    // 親の子タスクを取得
    const children = allTasks.filter((t) => t.parentId === parentId);
    if (children.length === 0) return;

    // 子タスクの進捗の平均を計算
    const totalProgress = children.reduce((sum, child) => sum + (child.progress || 0), 0);
    const progress = Math.round(totalProgress / children.length);

    // 100%なら完了に
    const newStatus = progress === 100 ? "completed" : "pending";

    // 親を更新
    const parentRef = doc(db, "tasks", parentId);
    await updateDoc(parentRef, {
      status: newStatus,
      progress: progress,
    });

    // さらに上の親も更新（常に再帰）
    if (parent.parentId) {
      const updatedTasks = allTasks.map((t) =>
        t.id === parentId ? { ...t, status: newStatus, progress } : t
      );
      await updateParentProgress(parent.parentId, updatedTasks);
    }
  };

  const handleComplete = async (taskId: string) => {
    try {
      // タスクを完了にする
      const taskRef = doc(db, "tasks", taskId);
      await updateDoc(taskRef, {
        status: "completed",
        progress: 100,
      });

      // 現在のタスクを取得して親を更新
      const task = tasks.find((t) => t.id === taskId);
      if (task?.parentId) {
        // tasksを更新した状態で親の進捗を計算
        const updatedTasks = tasks.map((t) =>
          t.id === taskId ? { ...t, status: "completed", progress: 100 } : t
        );
        await updateParentProgress(task.parentId, updatedTasks);
      }

      toast.success("タスクを完了しました！");
      loadTasks();
    } catch (error) {
      console.error("Failed to complete task:", error);
      toast.error("更新に失敗しました");
    }
  };

  const handleUncomplete = async (taskId: string) => {
    try {
      // タスクを未完了に戻す
      const taskRef = doc(db, "tasks", taskId);
      await updateDoc(taskRef, {
        status: "pending",
        progress: 0,
      });

      // 現在のタスクを取得して親を更新
      const task = tasks.find((t) => t.id === taskId);
      if (task?.parentId) {
        const updatedTasks = tasks.map((t) =>
          t.id === taskId ? { ...t, status: "pending", progress: 0 } : t
        );
        await updateParentProgress(task.parentId, updatedTasks);
      }

      loadTasks();
    } catch (error) {
      console.error("Failed to uncomplete task:", error);
      toast.error("更新に失敗しました");
    }
  };

  // 子孫タスクを全て取得（再帰）
  const getAllDescendants = (parentId: string, allTasks: Task[]): Task[] => {
    const children = allTasks.filter((t) => t.parentId === parentId);
    let descendants = [...children];
    for (const child of children) {
      descendants = [...descendants, ...getAllDescendants(child.id, allTasks)];
    }
    return descendants;
  };

  const handleDelete = async (taskId: string) => {
    if (!confirm("このタスクを削除しますか？")) return;

    try {
      const task = tasks.find((t) => t.id === taskId);
      const parentId = task?.parentId;

      // 子孫タスクを全て削除
      const descendants = getAllDescendants(taskId, tasks);
      for (const desc of descendants) {
        await deleteDoc(doc(db, "tasks", desc.id));
      }
      await deleteDoc(doc(db, "tasks", taskId));

      // 親の進捗を更新
      if (parentId) {
        const remainingTasks = tasks.filter(
          (t) => t.id !== taskId && !descendants.some((d) => d.id === t.id)
        );
        await updateParentProgress(parentId, remainingTasks);
      }

      toast.success("タスクを削除しました");
      loadTasks();
    } catch (error) {
      console.error("Failed to delete task:", error);
      toast.error("削除に失敗しました");
    }
  };

  const formatEndDate = (end: Timestamp | null) => {
    if (!end) return null;
    const d = end.toDate();
    return `達成日: ${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
  };

  const renderTask = (task: Task, depth: number = 0) => {
    const config = LEVEL_CONFIG[task.level];
    const childLevel = config.childLevel;
    const children = childLevel ? getChildren(task.id, childLevel) : [];
    const isExpanded = expandedTasks.has(task.id);
    const progress = task.status === "completed" ? 100 : calculateProgress(task.id, task.level);
    const endDateDisplay = formatEndDate(task.endDate);

    return (
      <div key={task.id} className={`${depth > 0 ? "ml-8" : ""} mb-4`}>
        <div className={`border rounded-lg overflow-hidden ${config.bgColor}`}>
          {/* ヘッダー */}
          <div
            className={`${config.color} text-white px-4 py-2 flex items-center gap-2 cursor-pointer`}
            onClick={() => toggleExpand(task.id)}
          >
            <span className="text-lg">{isExpanded ? "▼" : "▶"}</span>
            <span className="font-medium">{config.label}</span>
          </div>

          {/* コンテンツ */}
          <div className="p-4">
            <div className="flex justify-between items-start mb-2">
              <div>
                <h3 className="font-bold text-lg">{task.title}</h3>
                {endDateDisplay && (
                  <p className="text-sm text-gray-500">{endDateDisplay}</p>
                )}
              </div>
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

            {/* 子タスクがない場合はチェックボックス、ある場合はプログレスバー */}
            {children.length === 0 ? (
              <div className="mt-3 flex items-center gap-3">
                <button
                  onClick={() => task.status === "completed" ? handleUncomplete(task.id) : handleComplete(task.id)}
                  className={`w-8 h-8 rounded-md border-2 flex items-center justify-center transition-all ${
                    task.status === "completed"
                      ? "bg-green-500 border-green-500 text-white"
                      : "bg-white border-gray-300 hover:border-blue-500"
                  }`}
                >
                  {task.status === "completed" && (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
                <span className={`text-sm ${task.status === "completed" ? "text-green-600 font-medium" : "text-gray-500"}`}>
                  {task.status === "completed" ? "完了" : "未完了"}
                </span>
              </div>
            ) : (
              <div className="mt-3">
                <div className="h-6 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${task.status === "completed" ? "bg-green-500" : "bg-blue-500"} flex items-center justify-center text-white text-sm font-medium transition-all`}
                    style={{ width: `${Math.max(progress, 10)}%` }}
                  >
                    {progress}%
                  </div>
                </div>
              </div>
            )}

            {/* 一言メモ */}
            <div className="mt-3 pt-3 border-t border-gray-200">
              {editingMemo?.taskId === task.id ? (
                <div className="flex gap-2">
                  <Input
                    value={editingMemo.memo}
                    onChange={(e) => setEditingMemo({ ...editingMemo, memo: e.target.value })}
                    placeholder="一言メモを入力..."
                    className="flex-1 text-sm"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleUpdateMemo(task.id, editingMemo.memo);
                      } else if (e.key === "Escape") {
                        setEditingMemo(null);
                      }
                    }}
                    autoFocus
                  />
                  <Button
                    size="sm"
                    onClick={() => handleUpdateMemo(task.id, editingMemo.memo)}
                  >
                    保存
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setEditingMemo(null)}
                  >
                    取消
                  </Button>
                </div>
              ) : (
                <div className="flex items-start gap-2">
                  <button
                    className="text-gray-400 text-sm hover:text-gray-600 transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleMemoCollapse(task.id);
                    }}
                    title={collapsedMemos.has(task.id) ? "メモを開く" : "メモを閉じる"}
                  >
                    📝
                  </button>
                  {!collapsedMemos.has(task.id) && (
                    <div
                      className="flex-1 cursor-pointer hover:bg-gray-100 rounded p-1 -m-1 transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingMemo({ taskId: task.id, memo: task.memo || "" });
                      }}
                    >
                      {task.memo ? (
                        <p className="text-sm text-gray-600">{task.memo}</p>
                      ) : (
                        <p className="text-sm text-gray-400 italic">クリックしてメモを追加...</p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 子タスク */}
        {isExpanded && children.length > 0 && (
          <div className="mt-2">
            {children.map((child) => renderTask(child, depth + 1))}
          </div>
        )}

        {/* 子タスク追加ボタン */}
        {isExpanded && childLevel && (
          <div className={`${depth > 0 ? "" : ""} mt-2 ml-8`}>
            <Button
              variant="outline"
              className="w-full border-dashed border-2"
              onClick={() => setAddingTo({ parentId: task.id, level: childLevel })}
            >
              + {LEVEL_CONFIG[childLevel].label}を追加
            </Button>
          </div>
        )}
      </div>
    );
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>読み込み中...</p>
      </div>
    );
  }

  const goals = getChildren(null, "goal");

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <Header variant="student" />
      <main className="max-w-4xl mx-auto px-4 py-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">目標とタスク</h2>

        {loadingTasks ? (
          <Card>
            <CardContent className="py-8">
              <p className="text-center">読み込み中...</p>
            </CardContent>
          </Card>
        ) : goals.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-gray-500 mb-4">まだ目標がありません</p>
              <Button onClick={() => setAddingTo({ parentId: null, level: "goal" })}>
                + GOALを追加
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {goals.map((goal) => renderTask(goal))}

            {/* GOAL追加ボタン */}
            <Button
              variant="outline"
              className="w-full border-dashed border-2 mt-4"
              onClick={() => setAddingTo({ parentId: null, level: "goal" })}
            >
              + GOALを追加
            </Button>
          </>
        )}

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
              <div className="space-y-2">
                <Label>一言メモ（任意）</Label>
                <Input
                  placeholder="例: 毎日30分は英単語をやる"
                  value={newTaskMemo}
                  onChange={(e) => setNewTaskMemo(e.target.value)}
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
      <BottomNav />
    </div>
  );
}

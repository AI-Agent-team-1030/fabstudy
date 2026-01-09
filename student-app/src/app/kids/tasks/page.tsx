"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import { KidsBottomNav } from "@/components/common/KidsBottomNav";

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
  createdAt: Timestamp;
}

const LEVEL_CONFIG: Record<TaskLevel, { label: string; rubyLabel: string; color: string; bgColor: string; childLevel: TaskLevel | null }> = {
  goal: { label: "やりたいこと", rubyLabel: "やりたいこと", color: "bg-indigo-600", bgColor: "bg-indigo-50", childLevel: "large" },
  large: { label: "おおきなタスク", rubyLabel: "大タスク", color: "bg-blue-500", bgColor: "bg-blue-50", childLevel: "medium" },
  medium: { label: "ちゅうくらいタスク", rubyLabel: "中タスク", color: "bg-blue-400", bgColor: "bg-blue-50", childLevel: "small" },
  small: { label: "ちいさなタスク", rubyLabel: "小タスク", color: "bg-gray-400", bgColor: "bg-gray-50", childLevel: null },
};

export default function KidsTasksPage() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("kidsExpandedTasks");
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

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  useEffect(() => {
    localStorage.setItem("kidsExpandedTasks", JSON.stringify([...expandedTasks]));
  }, [expandedTasks]);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
    if (!loading && user && !user.isElementary) {
      router.push("/tasks");
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

  const calculateProgress = (taskId: string, level: TaskLevel): number => {
    const childLevel = LEVEL_CONFIG[level].childLevel;
    if (!childLevel) return 0;

    const children = tasks.filter((t) => t.parentId === taskId);
    if (children.length === 0) return 0;

    const totalProgress = children.reduce((sum, child) => {
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
        endDate: null,
        status: "pending",
        progress: 0,
        createdAt: Timestamp.now(),
      });

      toast.success("ついかしました！");
      setAddingTo(null);
      setNewTaskTitle("");
      loadTasks();
    } catch (error) {
      console.error("Failed to add task:", error);
      toast.error("ついかできませんでした");
    }
  };

  const updateParentProgress = async (parentId: string | null, allTasks: Task[]) => {
    if (!parentId) return;

    const parent = allTasks.find((t) => t.id === parentId);
    if (!parent) return;

    const children = allTasks.filter((t) => t.parentId === parentId);
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
      const updatedTasks = allTasks.map((t) =>
        t.id === parentId ? { ...t, status: newStatus, progress } : t
      );
      await updateParentProgress(parent.parentId, updatedTasks);
    }
  };

  const handleComplete = async (taskId: string) => {
    try {
      const taskRef = doc(db, "tasks", taskId);
      await updateDoc(taskRef, {
        status: "completed",
        progress: 100,
      });

      const task = tasks.find((t) => t.id === taskId);
      if (task?.parentId) {
        const updatedTasks = tasks.map((t) =>
          t.id === taskId ? { ...t, status: "completed", progress: 100 } : t
        );
        await updateParentProgress(task.parentId, updatedTasks);
      }

      toast.success("かんりょう！すごい！");
      loadTasks();
    } catch (error) {
      console.error("Failed to complete task:", error);
      toast.error("できませんでした");
    }
  };

  const handleUncomplete = async (taskId: string) => {
    try {
      const taskRef = doc(db, "tasks", taskId);
      await updateDoc(taskRef, {
        status: "pending",
        progress: 0,
      });

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
    }
  };

  const getAllDescendants = (parentId: string, allTasks: Task[]): Task[] => {
    const children = allTasks.filter((t) => t.parentId === parentId);
    let descendants = [...children];
    for (const child of children) {
      descendants = [...descendants, ...getAllDescendants(child.id, allTasks)];
    }
    return descendants;
  };

  const handleDelete = async (taskId: string) => {
    if (!confirm("けしてもいい？")) return;

    try {
      const task = tasks.find((t) => t.id === taskId);
      const parentId = task?.parentId;

      const descendants = getAllDescendants(taskId, tasks);
      for (const desc of descendants) {
        await deleteDoc(doc(db, "tasks", desc.id));
      }
      await deleteDoc(doc(db, "tasks", taskId));

      if (parentId) {
        const remainingTasks = tasks.filter(
          (t) => t.id !== taskId && !descendants.some((d) => d.id === t.id)
        );
        await updateParentProgress(parentId, remainingTasks);
      }

      toast.success("けしました");
      loadTasks();
    } catch (error) {
      console.error("Failed to delete task:", error);
      toast.error("けせませんでした");
    }
  };

  const renderTask = (task: Task, depth: number = 0) => {
    const config = LEVEL_CONFIG[task.level];
    const childLevel = config.childLevel;
    const children = childLevel ? getChildren(task.id, childLevel) : [];
    const isExpanded = expandedTasks.has(task.id);
    const progress = task.status === "completed" ? 100 : calculateProgress(task.id, task.level);

    return (
      <div key={task.id} className={`${depth > 0 ? "ml-6" : ""} mb-4`}>
        <div className={`border-2 rounded-xl overflow-hidden ${config.bgColor}`}>
          {/* ヘッダー */}
          <div
            className={`${config.color} text-white px-4 py-3 flex items-center gap-3 cursor-pointer`}
            onClick={() => toggleExpand(task.id)}
          >
            <span className="text-2xl">{isExpanded ? "▼" : "▶"}</span>
            <span className="font-bold text-lg">{config.label}</span>
          </div>

          {/* コンテンツ */}
          <div className="p-4">
            <div className="flex justify-between items-start mb-3">
              <h3 className="font-bold text-xl">{task.title}</h3>
              <Button
                variant="destructive"
                size="sm"
                className="text-base px-4 py-2"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(task.id);
                }}
              >
                けす
              </Button>
            </div>

            {/* チェックボックスまたはプログレスバー */}
            {children.length === 0 ? (
              <div className="mt-4 flex items-center gap-4">
                <button
                  onClick={() => task.status === "completed" ? handleUncomplete(task.id) : handleComplete(task.id)}
                  className={`w-12 h-12 rounded-lg border-3 flex items-center justify-center transition-all ${
                    task.status === "completed"
                      ? "bg-green-500 border-green-500 text-white"
                      : "bg-white border-gray-300 hover:border-blue-500"
                  }`}
                >
                  {task.status === "completed" && (
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
                <span className={`text-lg font-bold ${task.status === "completed" ? "text-green-600" : "text-gray-500"}`}>
                  {task.status === "completed" ? "できた！" : "まだ"}
                </span>
              </div>
            ) : (
              <div className="mt-4">
                <div className="h-8 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${task.status === "completed" ? "bg-green-500" : "bg-blue-500"} flex items-center justify-center text-white text-lg font-bold transition-all`}
                    style={{ width: `${Math.max(progress, 15)}%` }}
                  >
                    {progress}%
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 子タスク */}
        {isExpanded && children.length > 0 && (
          <div className="mt-3">
            {children.map((child) => renderTask(child, depth + 1))}
          </div>
        )}

        {/* 子タスク追加ボタン */}
        {isExpanded && childLevel && (
          <div className="mt-3 ml-6">
            <Button
              variant="outline"
              className="w-full border-dashed border-2 py-4 text-lg"
              onClick={() => setAddingTo({ parentId: task.id, level: childLevel })}
            >
              + {LEVEL_CONFIG[childLevel].label}をついか
            </Button>
          </div>
        )}
      </div>
    );
  };

  if (loading || loadingTasks) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-xl">よみこみちゅう...</p>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const goals = getChildren(null, "goal");

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* ヘッダー */}
      <header className="bg-blue-700 text-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <h1 className="font-bold text-lg">
                <ruby>学習<rt>がくしゅう</rt></ruby>
                <ruby>進捗<rt>しんちょく</rt></ruby>
                <ruby>管理<rt>かんり</rt></ruby>
              </h1>
              {user && (
                <Badge variant="secondary" className="ml-2">
                  {user.name}
                </Badge>
              )}
            </div>
            <Button
              variant="ghost"
              onClick={handleLogout}
              className="text-white hover:bg-white/20"
            >
              ログアウト
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">
          やりたいことリスト
        </h2>

        {goals.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-gray-500 text-xl mb-4">
                まだやりたいことがないよ
              </p>
              <Button
                className="text-lg py-6 px-8"
                onClick={() => setAddingTo({ parentId: null, level: "goal" })}
              >
                + やりたいことをついか
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {goals.map((goal) => renderTask(goal))}

            <Button
              variant="outline"
              className="w-full border-dashed border-2 mt-4 py-6 text-lg"
              onClick={() => setAddingTo({ parentId: null, level: "goal" })}
            >
              + やりたいことをついか
            </Button>
          </>
        )}

        {/* 追加ダイアログ */}
        <Dialog open={!!addingTo} onOpenChange={(open) => !open && setAddingTo(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="text-xl">
                {addingTo && LEVEL_CONFIG[addingTo.level].label}をついか
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-lg">なまえ</Label>
                <Input
                  className="text-lg py-6"
                  placeholder="れい: さんすうのテストで100てんをとる"
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                />
              </div>
              <div className="flex gap-3 justify-end">
                <Button
                  variant="outline"
                  className="text-lg py-6 px-6"
                  onClick={() => setAddingTo(null)}
                >
                  やめる
                </Button>
                <Button
                  className="text-lg py-6 px-6"
                  onClick={handleAddTask}
                  disabled={!newTaskTitle}
                >
                  ついか
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </main>

      <KidsBottomNav />
    </div>
  );
}

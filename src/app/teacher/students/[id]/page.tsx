"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Header } from "@/components/common/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { db } from "@/lib/firebase";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  Timestamp,
} from "firebase/firestore";
import { SUBJECTS } from "@/types";

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
  title: string;
  level: string;
  parentId: string | null;
  status: string;
  progress: number;
}

type TaskLevel = "goal" | "large" | "medium" | "small";

const LEVEL_CONFIG: Record<TaskLevel, { label: string; color: string; bgColor: string; childLevel: TaskLevel | null }> = {
  goal: { label: "GOAL", color: "bg-indigo-900", bgColor: "bg-indigo-50", childLevel: "large" },
  large: { label: "TASK(大)", color: "bg-blue-600", bgColor: "bg-blue-50", childLevel: "medium" },
  medium: { label: "TASK(中)", color: "bg-blue-400", bgColor: "bg-blue-50", childLevel: "small" },
  small: { label: "TASK(小)", color: "bg-gray-400", bgColor: "bg-gray-50", childLevel: null },
};

export default function StudentDetailPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const studentId = params.id as string;

  const [student, setStudent] = useState<Student | null>(null);
  const [studyLogs, setStudyLogs] = useState<StudyLog[]>([]);
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (!loading && (!user || user.role !== "teacher")) {
      router.push("/teacher/login");
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
        router.push("/teacher/students");
        return;
      }

      setStudent({
        id: studentSnap.id,
        ...studentSnap.data(),
      } as Student);

      // 勉強ログを取得
      const logsRef = collection(db, "studyLogs");
      const logsQuery = query(logsRef, where("userId", "==", studentId));
      const logsSnap = await getDocs(logsQuery);

      const logsData = logsSnap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as StudyLog[];
      logsData.sort((a, b) => b.date.toDate().getTime() - a.date.toDate().getTime());
      setStudyLogs(logsData.slice(0, 10));

      // 全タスクを取得
      const tasksRef = collection(db, "tasks");
      const tasksQuery = query(tasksRef, where("userId", "==", studentId));
      const tasksSnap = await getDocs(tasksQuery);

      const tasksData = tasksSnap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Task[];

      setAllTasks(tasksData);
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

  const getChildren = (parentId: string) => {
    return allTasks.filter((t) => t.parentId === parentId);
  };

  const getGoals = () => {
    return allTasks.filter((t) => t.level === "goal");
  };

  const renderTask = (task: Task, depth: number = 0) => {
    const config = LEVEL_CONFIG[task.level as TaskLevel];
    if (!config) return null;

    const children = getChildren(task.id);
    const isExpanded = expandedTasks.has(task.id);
    const hasChildren = children.length > 0;

    return (
      <div key={task.id} className={`${depth > 0 ? "ml-6 border-l-2 border-gray-200 pl-4" : ""}`}>
        <div
          className={`border rounded-lg overflow-hidden mb-2 ${config.bgColor}`}
          onClick={() => hasChildren && toggleExpand(task.id)}
        >
          <div className={`${config.color} text-white px-3 py-1 flex items-center gap-2 ${hasChildren ? "cursor-pointer" : ""}`}>
            {hasChildren && (
              <span className="text-sm">{isExpanded ? "▼" : "▶"}</span>
            )}
            <span className="text-sm font-medium">{config.label}</span>
          </div>
          <div className="p-3">
            <div className="flex justify-between items-center mb-2">
              <h4 className="font-medium">{task.title}</h4>
              {task.level === "small" ? (
                <Badge variant={task.status === "completed" ? "default" : "secondary"}>
                  {task.status === "completed" ? "完了" : "未完了"}
                </Badge>
              ) : (
                <Badge variant={task.status === "completed" ? "default" : "secondary"}>
                  {task.status === "completed" ? "完了" : "進行中"}
                </Badge>
              )}
            </div>
            {task.level !== "small" && (
              <>
                <Progress value={task.progress} className="h-2" />
                <p className="text-sm text-gray-500 mt-1">進捗: {task.progress}%</p>
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

  const getSubjectColor = (subject: string) => {
    // キーからカテゴリを取得
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

  return (
    <div className="min-h-screen bg-gray-50">
      <Header variant="teacher" />
      <main className="max-w-4xl mx-auto px-4 py-6">
        <Button
          variant="ghost"
          className="mb-4"
          onClick={() => router.push("/teacher/students")}
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

        {/* 目標・タスク一覧 */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>目標とタスク</CardTitle>
            <p className="text-sm text-gray-500">クリックで展開できます</p>
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
                {studyLogs.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-center justify-between py-2 border-b last:border-b-0"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-gray-500">
                        {formatDate(log.date)}
                      </span>
                      <Badge className={getSubjectColor(log.subject)}>
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
      </main>
    </div>
  );
}

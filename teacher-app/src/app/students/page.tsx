"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Header } from "@/components/common/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { db } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  Timestamp,
} from "firebase/firestore";

interface Student {
  id: string;
  name: string;
  grade: number;
  isElementary: boolean;
  createdAt: Timestamp;
}

interface StudyLog {
  userId: string;
  duration: number;
  date: Timestamp;
}

interface StudentMessage {
  id: string;
  studentId: string;
  mood?: number;
  reaction?: string;
  message?: string;
  createdAt: Timestamp;
}

interface StudentWithStats extends Student {
  weeklyStudyTime: number;
  lastStudyDate: string | null;
  latestMessage?: StudentMessage;
}

const MOOD_EMOJIS: { [key: number]: string } = {
  1: "😢",
  2: "😕",
  3: "😐",
  4: "🙂",
  5: "😄",
};

export default function TeacherStudentsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [students, setStudents] = useState<StudentWithStats[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(true);

  useEffect(() => {
    if (!loading && (!user || user.role !== "teacher")) {
      router.push("/login");
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user && user.role === "teacher") {
      loadStudents();
    }
  }, [user]);

  const loadStudents = async () => {
    try {
      // 生徒を取得
      const usersRef = collection(db, "users");
      const q = query(usersRef, where("role", "==", "student"));
      const snapshot = await getDocs(q);

      const studentsData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Student[];

      // 今週の開始日（月曜日）
      const now = new Date();
      const dayOfWeek = now.getDay();
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const monday = new Date(now);
      monday.setDate(now.getDate() + mondayOffset);
      monday.setHours(0, 0, 0, 0);

      // 全生徒の勉強ログを取得
      const logsRef = collection(db, "studyLogs");
      const logsSnapshot = await getDocs(logsRef);
      const allLogs = logsSnapshot.docs.map((doc) => doc.data()) as StudyLog[];

      // 全生徒のメッセージを取得
      const messagesRef = collection(db, "studentMessages");
      const messagesSnapshot = await getDocs(messagesRef);
      const allMessages = messagesSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as StudentMessage[];

      // 各生徒のスタッツを計算
      const studentsWithStats: StudentWithStats[] = studentsData.map((student) => {
        const studentLogs = allLogs.filter((log) => log.userId === student.id);

        // 今週の勉強時間
        const weeklyLogs = studentLogs.filter((log) => {
          const logDate = log.date.toDate();
          return logDate >= monday;
        });
        const weeklyStudyTime = weeklyLogs.reduce((sum, log) => sum + log.duration, 0);

        // 最後の勉強日
        let lastStudyDate: string | null = null;
        if (studentLogs.length > 0) {
          const sortedLogs = studentLogs.sort(
            (a, b) => b.date.toDate().getTime() - a.date.toDate().getTime()
          );
          const lastDate = sortedLogs[0].date.toDate();
          lastStudyDate = `${lastDate.getMonth() + 1}/${lastDate.getDate()}`;
        }

        // 最新のメッセージ
        const studentMessages = allMessages.filter((msg) => msg.studentId === student.id);
        let latestMessage: StudentMessage | undefined;
        if (studentMessages.length > 0) {
          const sortedMessages = studentMessages.sort(
            (a, b) => b.createdAt.toDate().getTime() - a.createdAt.toDate().getTime()
          );
          latestMessage = sortedMessages[0];
        }

        return {
          ...student,
          weeklyStudyTime,
          lastStudyDate,
          latestMessage,
        };
      });

      // 学年順にソート
      studentsWithStats.sort((a, b) => a.grade - b.grade);
      setStudents(studentsWithStats);
    } catch (error) {
      console.error("Failed to load students:", error);
    } finally {
      setLoadingStudents(false);
    }
  };

  const formatStudyTime = (minutes: number) => {
    if (minutes === 0) return "0分";
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins}分`;
    if (mins === 0) return `${hours}時間`;
    return `${hours}時間${mins}分`;
  };

  const getGradeLabel = (grade: number, isElementary: boolean) => {
    if (isElementary) {
      return `小${grade}`;
    }
    if (grade <= 9) {
      return `中${grade - 6}`;
    }
    return `高${grade - 9}`;
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800">生徒一覧</h2>
          <Badge variant="outline" className="text-lg px-4 py-1">
            {students.length}名
          </Badge>
        </div>

        {loadingStudents ? (
          <Card>
            <CardContent className="py-8">
              <p className="text-center">読み込み中...</p>
            </CardContent>
          </Card>
        ) : students.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-gray-500">まだ生徒が登録されていません</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {students.map((student) => (
              <Card key={student.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-lg">{student.name}</CardTitle>
                    <Badge variant="secondary">
                      {getGradeLabel(student.grade, student.isElementary)}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">今週の勉強時間</span>
                      <span className="font-medium">
                        {formatStudyTime(student.weeklyStudyTime)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">最終勉強日</span>
                      <span className="font-medium">
                        {student.lastStudyDate || "-"}
                      </span>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    className="w-full mt-4"
                    onClick={() => router.push(`/students/${student.id}`)}
                  >
                    詳細を見る
                  </Button>

                  {/* 最新メッセージ */}
                  {student.latestMessage && (
                    <div className="mt-3 pt-3 border-t text-sm">
                      <div className="flex items-center gap-1 text-gray-500 mb-1">
                        <span>📨 最新メッセージ</span>
                        <span className="text-xs">
                          ({student.latestMessage.createdAt.toDate().getMonth() + 1}/{student.latestMessage.createdAt.toDate().getDate()})
                        </span>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {student.latestMessage.mood && (
                          <span className="text-lg">{MOOD_EMOJIS[student.latestMessage.mood]}</span>
                        )}
                        {student.latestMessage.reaction && (
                          <span className="text-lg">{student.latestMessage.reaction}</span>
                        )}
                        {student.latestMessage.message && (
                          <span className="text-gray-600 text-xs truncate max-w-[150px]">
                            {student.latestMessage.message}
                          </span>
                        )}
                        {!student.latestMessage.mood && !student.latestMessage.reaction && !student.latestMessage.message && (
                          <span className="text-gray-400 text-xs">（内容なし）</span>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

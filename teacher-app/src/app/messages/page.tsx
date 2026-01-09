"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Header } from "@/components/common/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  addDoc,
  deleteDoc,
  doc,
  Timestamp,
} from "firebase/firestore";
import { toast } from "sonner";

interface Student {
  id: string;
  name: string;
}

interface Message {
  id: string;
  toUserId: string;
  toUserName: string;
  fromUserId: string;
  fromUserName: string;
  content: string;
  createdAt: Timestamp;
  read: boolean;
  reaction?: string;
}

export default function TeacherMessagesPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [students, setStudents] = useState<Student[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState("");
  const [messageContent, setMessageContent] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!loading && (!user || user.role !== "teacher")) {
      router.push("/login");
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user && user.role === "teacher") {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    try {
      // 生徒一覧を取得
      const usersRef = collection(db, "users");
      const studentsQuery = query(usersRef, where("role", "==", "student"));
      const studentsSnap = await getDocs(studentsQuery);
      const studentsData = studentsSnap.docs.map((doc) => ({
        id: doc.id,
        name: doc.data().name,
      }));
      setStudents(studentsData);

      // 送信済みメッセージを取得
      const messagesRef = collection(db, "messages");
      const messagesQuery = query(
        messagesRef,
        where("fromUserId", "==", user!.id)
      );
      const messagesSnap = await getDocs(messagesQuery);
      const messagesData = messagesSnap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Message[];
      messagesData.sort((a, b) => b.createdAt.toDate().getTime() - a.createdAt.toDate().getTime());
      setMessages(messagesData);
    } catch (error) {
      console.error("Failed to load data:", error);
    } finally {
      setLoadingData(false);
    }
  };

  const handleSendMessage = async () => {
    if (!selectedStudent || !messageContent.trim() || !user) return;

    setSending(true);
    try {
      const student = students.find((s) => s.id === selectedStudent);
      if (!student) return;

      await addDoc(collection(db, "messages"), {
        toUserId: selectedStudent,
        toUserName: student.name,
        fromUserId: user.id,
        fromUserName: user.name,
        content: messageContent.trim(),
        createdAt: Timestamp.now(),
        read: false,
      });

      toast.success("メッセージを送信しました");
      setShowDialog(false);
      setSelectedStudent("");
      setMessageContent("");
      loadData();
    } catch (error) {
      console.error("Failed to send message:", error);
      toast.error("送信に失敗しました");
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (messageId: string) => {
    if (!confirm("このメッセージを削除しますか？")) return;

    try {
      await deleteDoc(doc(db, "messages", messageId));
      toast.success("メッセージを削除しました");
      loadData();
    } catch (error) {
      console.error("Failed to delete message:", error);
      toast.error("削除に失敗しました");
    }
  };

  const formatDate = (timestamp: Timestamp) => {
    const date = timestamp.toDate();
    return `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
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
      <main className="max-w-4xl mx-auto px-4 py-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800">メッセージ</h2>
          <Button onClick={() => setShowDialog(true)}>
            + 新しいメッセージ
          </Button>
        </div>

        {loadingData ? (
          <Card>
            <CardContent className="py-8">
              <p className="text-center">読み込み中...</p>
            </CardContent>
          </Card>
        ) : messages.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-gray-500 mb-4">まだメッセージがありません</p>
              <Button onClick={() => setShowDialog(true)}>
                メッセージを送る
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {messages.map((message) => (
              <Card key={message.id}>
                <CardContent className="pt-4">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-purple-600">
                        To: {message.toUserName}
                      </span>
                      {message.read ? (
                        <span className="text-xs text-green-600 bg-green-100 px-2 py-0.5 rounded">既読</span>
                      ) : (
                        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">未読</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-500">
                        {formatDate(message.createdAt)}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-500 hover:text-red-700 hover:bg-red-50 h-8 px-2"
                        onClick={() => handleDelete(message.id)}
                      >
                        削除
                      </Button>
                    </div>
                  </div>
                  <p className="text-gray-700 whitespace-pre-wrap">
                    {message.content}
                  </p>
                  {message.reaction && (
                    <div className="mt-3 pt-3 border-t flex items-center gap-2">
                      <span className="text-sm text-gray-500">リアクション:</span>
                      <span className="text-2xl">{message.reaction}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* 新規メッセージダイアログ */}
        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>新しいメッセージ</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>送信先</Label>
                <Select value={selectedStudent} onValueChange={setSelectedStudent}>
                  <SelectTrigger>
                    <SelectValue placeholder="生徒を選択" />
                  </SelectTrigger>
                  <SelectContent>
                    {students.map((student) => (
                      <SelectItem key={student.id} value={student.id}>
                        {student.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>メッセージ</Label>
                <textarea
                  className="w-full min-h-[120px] p-3 border rounded-md resize-none"
                  placeholder="メッセージを入力..."
                  value={messageContent}
                  onChange={(e) => setMessageContent(e.target.value)}
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setShowDialog(false)}>
                  キャンセル
                </Button>
                <Button
                  onClick={handleSendMessage}
                  disabled={!selectedStudent || !messageContent.trim() || sending}
                >
                  {sending ? "送信中..." : "送信"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}

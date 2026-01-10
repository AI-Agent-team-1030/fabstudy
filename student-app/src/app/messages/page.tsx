"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Header } from "@/components/common/Header";
import { BottomNav } from "@/components/common/BottomNav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { db } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
  addDoc,
  deleteDoc,
  Timestamp,
} from "firebase/firestore";
import { toast } from "sonner";

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

interface StudentMessage {
  id: string;
  studentId: string;
  studentName: string;
  mood?: number;
  reaction?: string;
  message?: string;
  createdAt: Timestamp;
}

const REACTIONS = [
  { emoji: "👍", label: "了解" },
  { emoji: "❤️", label: "ありがとう" },
  { emoji: "😊", label: "がんばる" },
  { emoji: "🔥", label: "やる気" },
];

const MOOD_EMOJIS = [
  { value: 1, emoji: "😢", label: "つらい" },
  { value: 2, emoji: "😕", label: "いまいち" },
  { value: 3, emoji: "😐", label: "ふつう" },
  { value: 4, emoji: "🙂", label: "いい感じ" },
  { value: 5, emoji: "😄", label: "最高" },
];

const SEND_REACTIONS = [
  { emoji: "👍", label: "グッド" },
  { emoji: "✅", label: "了解" },
  { emoji: "🙏", label: "ありがとう" },
  { emoji: "🔥", label: "やる気" },
];

export default function MessagesPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loadingMessages, setLoadingMessages] = useState(true);

  // 先生に送信用のstate
  const [selectedMood, setSelectedMood] = useState<number | null>(null);
  const [selectedReaction, setSelectedReaction] = useState<string | null>(null);
  const [messageText, setMessageText] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [myMessages, setMyMessages] = useState<StudentMessage[]>([]);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user) {
      loadMessages();
      loadMyMessages();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const loadMyMessages = async () => {
    if (!user) return;
    try {
      const studentMessagesRef = collection(db, "studentMessages");
      const q = query(studentMessagesRef, where("studentId", "==", user.id));
      const snapshot = await getDocs(q);

      const messagesData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as StudentMessage[];

      messagesData.sort((a, b) => {
        const dateA = a.createdAt?.toDate?.() || new Date(0);
        const dateB = b.createdAt?.toDate?.() || new Date(0);
        return dateB.getTime() - dateA.getTime();
      });

      setMyMessages(messagesData);
    } catch (error) {
      console.error("Failed to load my messages:", error);
    }
  };

  const handleSendToTeacher = async () => {
    if (!user) return;
    if (!selectedMood && !selectedReaction && !messageText.trim()) {
      toast.error("きもち、リアクション、またはメッセージを入力してください");
      return;
    }

    setSendingMessage(true);
    try {
      const studentMessagesRef = collection(db, "studentMessages");
      await addDoc(studentMessagesRef, {
        studentId: user.id,
        studentName: user.name,
        mood: selectedMood || null,
        reaction: selectedReaction || null,
        message: messageText.trim() || null,
        createdAt: Timestamp.now(),
      });

      toast.success("先生に送信しました！");
      setSelectedMood(null);
      setSelectedReaction(null);
      setMessageText("");
      loadMyMessages();
    } catch (error) {
      console.error("Failed to send message:", error);
      toast.error("送信に失敗しました");
    } finally {
      setSendingMessage(false);
    }
  };

  const handleDeleteMyMessage = async (messageId: string) => {
    if (!confirm("このメッセージを削除しますか？")) return;

    try {
      await deleteDoc(doc(db, "studentMessages", messageId));
      toast.success("削除しました");
      loadMyMessages();
    } catch (error) {
      console.error("Failed to delete message:", error);
      toast.error("削除に失敗しました");
    }
  };

  const loadMessages = async () => {
    if (!user) return;
    try {
      const messagesRef = collection(db, "messages");
      const q = query(messagesRef, where("toUserId", "==", user.id));
      const snapshot = await getDocs(q);

      const messagesData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Message[];

      messagesData.sort((a, b) => {
        const dateA = a.createdAt?.toDate?.() || new Date(0);
        const dateB = b.createdAt?.toDate?.() || new Date(0);
        return dateB.getTime() - dateA.getTime();
      });

      setMessages(messagesData);
    } catch (error) {
      console.error("Failed to load messages:", error);
    } finally {
      setLoadingMessages(false);
    }
  };

  const handleExpand = async (message: Message) => {
    if (expandedId === message.id) {
      setExpandedId(null);
    } else {
      setExpandedId(message.id);
      if (!message.read) {
        await markAsRead(message.id);
      }
    }
  };

  const markAsRead = async (messageId: string) => {
    try {
      const messageRef = doc(db, "messages", messageId);
      await updateDoc(messageRef, { read: true });
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, read: true } : m))
      );
    } catch (error) {
      console.error("Failed to mark as read:", error);
    }
  };

  const sendReaction = async (messageId: string, emoji: string) => {
    try {
      const messageRef = doc(db, "messages", messageId);
      const currentMessage = messages.find((m) => m.id === messageId);

      // 同じリアクションなら取り消し、違うなら更新
      const newReaction = currentMessage?.reaction === emoji ? null : emoji;

      await updateDoc(messageRef, { reaction: newReaction });
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId ? { ...m, reaction: newReaction || undefined } : m
        )
      );

      if (newReaction) {
        toast.success("リアクションを送信しました！");
      }
    } catch (error) {
      console.error("Failed to send reaction:", error);
      toast.error("リアクションの送信に失敗しました");
    }
  };

  const formatDate = (timestamp: Timestamp) => {
    if (!timestamp) return "";
    const date = timestamp.toDate();
    return `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  };

  const unreadCount = messages.filter((m) => !m.read).length;

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <Header variant="student" />
      <main className="max-w-2xl mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-6">
          <h2 className="text-2xl font-bold text-gray-800">メッセージ</h2>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>受信トレイ</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingMessages ? (
              <p className="text-center py-4">読み込み中...</p>
            ) : messages.length === 0 ? (
              <p className="text-gray-500 text-center py-8">
                メッセージはありません
              </p>
            ) : (
              <div className="space-y-3">
                {messages.map((message) => {
                  const isExpanded = expandedId === message.id;

                  return (
                    <div
                      key={message.id}
                      className={`border rounded-lg overflow-hidden transition-all ${
                        !message.read ? "border-blue-400 bg-blue-50" : "bg-white"
                      }`}
                    >
                      {/* ヘッダー部分（クリックで展開） */}
                      <div
                        onClick={() => handleExpand(message)}
                        className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{isExpanded ? "▼" : "▶"}</span>
                            <div>
                              <p className={`font-medium ${!message.read ? "text-blue-700" : ""}`}>
                                {message.fromUserName}先生から
                              </p>
                              {!isExpanded && (
                                <p className="text-sm text-gray-500 truncate max-w-[200px]">
                                  {message.content.substring(0, 20)}
                                  {message.content.length > 20 ? "..." : ""}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {message.reaction && (
                              <span className="text-2xl">{message.reaction}</span>
                            )}
                            <div className="text-right">
                              <span className="text-xs text-gray-400">
                                {formatDate(message.createdAt)}
                              </span>
                              {!message.read && (
                                <Badge variant="default" className="ml-2 text-xs">
                                  NEW
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* 展開時のコンテンツ */}
                      {isExpanded && (
                        <div className="px-4 pb-4 border-t bg-gray-50">
                          <div className="py-4 whitespace-pre-wrap text-gray-700">
                            {message.content}
                          </div>

                          {/* リアクションボタン */}
                          <div className="flex flex-wrap gap-2 pt-3 border-t">
                            <span className="text-sm text-gray-500 mr-2">リアクション:</span>
                            {REACTIONS.map((reaction) => (
                              <Button
                                key={reaction.emoji}
                                variant={message.reaction === reaction.emoji ? "default" : "outline"}
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  sendReaction(message.id, reaction.emoji);
                                }}
                                className="text-lg px-3"
                              >
                                {reaction.emoji}
                                <span className="text-xs ml-1">{reaction.label}</span>
                              </Button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 先生に送信 */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>📨 先生に送信</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* きもち（5段階） */}
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">今のきもち</p>
              <div className="flex gap-2 flex-wrap">
                {MOOD_EMOJIS.map((mood) => (
                  <Button
                    key={mood.value}
                    variant={selectedMood === mood.value ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedMood(selectedMood === mood.value ? null : mood.value)}
                    className="text-2xl px-3 py-2 h-auto"
                  >
                    {mood.emoji}
                    <span className="text-xs ml-1">{mood.label}</span>
                  </Button>
                ))}
              </div>
            </div>

            {/* リアクション（4種類） */}
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">リアクション</p>
              <div className="flex gap-2 flex-wrap">
                {SEND_REACTIONS.map((reaction) => (
                  <Button
                    key={reaction.emoji}
                    variant={selectedReaction === reaction.emoji ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedReaction(selectedReaction === reaction.emoji ? null : reaction.emoji)}
                    className="text-xl px-3 py-2 h-auto"
                  >
                    {reaction.emoji}
                    <span className="text-xs ml-1">{reaction.label}</span>
                  </Button>
                ))}
              </div>
            </div>

            {/* メッセージ入力 */}
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">メッセージ</p>
              <Textarea
                placeholder="先生に伝えたいことを書いてください..."
                value={messageText}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setMessageText(e.target.value)}
                rows={3}
              />
            </div>

            {/* 送信ボタン */}
            <Button
              onClick={handleSendToTeacher}
              disabled={sendingMessage || (!selectedMood && !selectedReaction && !messageText.trim())}
              className="w-full"
            >
              {sendingMessage ? "送信中..." : "先生に送信"}
            </Button>
          </CardContent>
        </Card>

        {/* 送信履歴 */}
        {myMessages.length > 0 && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>📤 送信履歴</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {myMessages.slice(0, 5).map((msg) => (
                  <div key={msg.id} className="border rounded-lg p-3 bg-white">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2">
                        {msg.mood && (
                          <span className="text-2xl">
                            {MOOD_EMOJIS.find((m) => m.value === msg.mood)?.emoji}
                          </span>
                        )}
                        {msg.reaction && <span className="text-xl">{msg.reaction}</span>}
                      </div>
                    </div>
                    {msg.message && (
                      <p className="text-sm text-gray-700 mt-2">{msg.message}</p>
                    )}
                    <div className="flex justify-between items-center mt-2 pt-2 border-t">
                      <span className="text-xs text-gray-400">
                        {formatDate(msg.createdAt)}
                      </span>
                      <button
                        onClick={() => handleDeleteMyMessage(msg.id)}
                        className="text-xs text-gray-400 hover:text-red-500 transition-colors"
                      >
                        削除
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </main>
      <BottomNav />
    </div>
  );
}

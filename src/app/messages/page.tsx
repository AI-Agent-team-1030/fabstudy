"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Header } from "@/components/common/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
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

const REACTIONS = [
  { emoji: "👍", label: "了解" },
  { emoji: "❤️", label: "ありがとう" },
  { emoji: "😊", label: "がんばる" },
  { emoji: "🔥", label: "やる気" },
];

export default function MessagesPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loadingMessages, setLoadingMessages] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user) {
      loadMessages();
    }
  }, [user]);

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
    <div className="min-h-screen bg-gray-50">
      <Header variant="student" />
      <main className="max-w-2xl mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-6">
          <h2 className="text-2xl font-bold text-gray-800">メッセージ</h2>
          {unreadCount > 0 && (
            <Badge variant="destructive">{unreadCount}件の未読</Badge>
          )}
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
      </main>
    </div>
  );
}

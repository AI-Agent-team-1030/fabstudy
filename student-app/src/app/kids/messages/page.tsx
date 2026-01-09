"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
  addDoc,
  Timestamp,
  or,
} from "firebase/firestore";
import { REPLY_TYPES } from "@/types";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface Message {
  id: string;
  senderId: string;
  senderName?: string;
  title: string;
  body: string;
  priority: string;
  createdAt: Timestamp;
}

interface MessageReceipt {
  id: string;
  messageId: string;
  isRead: boolean;
  reply?: string;
}

export default function KidsMessagesPage() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [messages, setMessages] = useState<(Message & { receipt?: MessageReceipt })[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [selectedMessage, setSelectedMessage] = useState<(Message & { receipt?: MessageReceipt }) | null>(null);

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
    if (!loading && user && !user.isElementary) {
      router.push("/messages");
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
      const q = query(
        messagesRef,
        or(
          where("recipientId", "==", user.id),
          where("recipientType", "==", "all")
        )
      );
      const snapshot = await getDocs(q);
      const messagesData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Message[];

      const receiptsRef = collection(db, "messageReceipts");
      const receiptsQuery = query(receiptsRef, where("userId", "==", user.id));
      const receiptsSnapshot = await getDocs(receiptsQuery);
      const receiptsMap = new Map<string, MessageReceipt>();
      receiptsSnapshot.docs.forEach((doc) => {
        const data = doc.data();
        receiptsMap.set(data.messageId, {
          id: doc.id,
          messageId: data.messageId,
          isRead: data.isRead,
          reply: data.reply,
        });
      });

      const messagesWithReceipts = messagesData.map((msg) => ({
        ...msg,
        receipt: receiptsMap.get(msg.id),
      }));

      messagesWithReceipts.sort((a, b) => {
        const dateA = a.createdAt?.toDate?.() || new Date(0);
        const dateB = b.createdAt?.toDate?.() || new Date(0);
        return dateB.getTime() - dateA.getTime();
      });

      setMessages(messagesWithReceipts);
    } catch (error) {
      console.error("Failed to load messages:", error);
    } finally {
      setLoadingMessages(false);
    }
  };

  const handleReply = async (replyType: string) => {
    if (!user || !selectedMessage) return;

    try {
      const receiptsRef = collection(db, "messageReceipts");

      if (selectedMessage.receipt) {
        const receiptRef = doc(db, "messageReceipts", selectedMessage.receipt.id);
        await updateDoc(receiptRef, {
          isRead: true,
          readAt: Timestamp.now(),
          reply: replyType,
          repliedAt: Timestamp.now(),
        });
      } else {
        await addDoc(receiptsRef, {
          messageId: selectedMessage.id,
          userId: user.id,
          isRead: true,
          readAt: Timestamp.now(),
          reply: replyType,
          repliedAt: Timestamp.now(),
          createdAt: Timestamp.now(),
        });
      }

      toast.success("返信しました");
      setSelectedMessage(null);
      loadMessages();
    } catch (error) {
      console.error("Failed to reply:", error);
      toast.error("返信に失敗しました");
    }
  };

  const formatDate = (timestamp: Timestamp) => {
    if (!timestamp) return "";
    const date = timestamp.toDate();
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  const getReplyLabel = (replyKey: string) => {
    return REPLY_TYPES.find((r) => r.key === replyKey)?.label || replyKey;
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p>読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
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
        {loadingMessages ? (
          <p className="text-center text-gray-500">よみこみちゅう...</p>
        ) : messages.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-gray-500">メッセージはまだないよ</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {messages.map((message) => (
              <Card
                key={message.id}
                className={`cursor-pointer transition-all hover:shadow-md ${
                  message.receipt?.reply ? "border-green-200" : ""
                }`}
                onClick={() => setSelectedMessage(message)}
              >
                <CardContent className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                      {message.priority === "important" && (
                        <span className="text-red-500 text-sm font-bold">重要</span>
                      )}
                      <span className="font-bold">{message.title}</span>
                    </div>
                    <span className="text-sm text-gray-500">{formatDate(message.createdAt)}</span>
                  </div>
                  <p className="text-gray-600 text-sm line-clamp-2">{message.body}</p>
                  {message.receipt?.reply && (
                    <div className="mt-2 text-sm text-green-600">
                      返信済み: {getReplyLabel(message.receipt.reply)}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* メッセージ詳細モーダル */}
      {selectedMessage && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md max-h-[80vh] overflow-y-auto">
            <CardHeader>
              <div className="flex justify-between items-start">
                <CardTitle className="text-lg">{selectedMessage.title}</CardTitle>
                <button
                  onClick={() => setSelectedMessage(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 whitespace-pre-wrap mb-6">{selectedMessage.body}</p>

              {!selectedMessage.receipt?.reply && (
                <div className="space-y-2">
                  <p className="text-sm text-gray-500 mb-3">返信を選択:</p>
                  {REPLY_TYPES.map((reply) => (
                    <Button
                      key={reply.key}
                      onClick={() => handleReply(reply.key)}
                      variant="outline"
                      className="w-full"
                    >
                      {reply.label}
                    </Button>
                  ))}
                </div>
              )}

              {selectedMessage.receipt?.reply && (
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <p className="text-green-600">
                    「{getReplyLabel(selectedMessage.receipt.reply)}」と返信済み
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* 下部ナビゲーション */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-40">
        <div className="flex justify-around items-center h-16 max-w-lg mx-auto">
          <Link href="/kids/dashboard" className={`flex items-center justify-center w-full h-full transition-colors ${pathname === "/kids/dashboard" ? "text-blue-600 font-bold" : "text-gray-500"}`}>
            <span className="text-sm">つみあげひょう</span>
          </Link>
          <Link href="/kids/wishlist" className={`flex items-center justify-center w-full h-full transition-colors ${pathname === "/kids/wishlist" ? "text-blue-600 font-bold" : "text-gray-500"}`}>
            <span className="text-sm">やりたいことリスト</span>
          </Link>
          <Link href="/kids/messages" className={`flex items-center justify-center w-full h-full transition-colors ${pathname === "/kids/messages" ? "text-blue-600 font-bold" : "text-gray-500"}`}>
            <span className="text-sm">メッセージ</span>
          </Link>
        </div>
      </nav>
    </div>
  );
}

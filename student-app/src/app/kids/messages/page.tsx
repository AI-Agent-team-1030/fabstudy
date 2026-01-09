"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
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
  or,
} from "firebase/firestore";
import { REPLY_TYPES } from "@/types";
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
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [messages, setMessages] = useState<(Message & { receipt?: MessageReceipt })[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [selectedMessage, setSelectedMessage] = useState<(Message & { receipt?: MessageReceipt }) | null>(null);

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
      // 自分宛てのメッセージを取得
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

      // 既読・返信状態を取得
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

      // メッセージにreceipt情報を付与
      const messagesWithReceipts = messagesData.map((msg) => ({
        ...msg,
        receipt: receiptsMap.get(msg.id),
      }));

      // 日付順にソート
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
        // 既存の receipt を更新
        const receiptRef = doc(db, "messageReceipts", selectedMessage.receipt.id);
        await updateDoc(receiptRef, {
          isRead: true,
          readAt: Timestamp.now(),
          reply: replyType,
          repliedAt: Timestamp.now(),
        });
      } else {
        // 新しい receipt を作成
        const { addDoc } = await import("firebase/firestore");
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

      toast.success("へんしんしたよ！");
      setSelectedMessage(null);
      loadMessages();
    } catch (error) {
      console.error("Failed to reply:", error);
      toast.error("へんしんできなかった...");
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
      <div className="min-h-screen bg-gradient-to-b from-cyan-100 to-blue-100 flex items-center justify-center">
        <p className="text-2xl">よみこみちゅう...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-cyan-100 to-blue-100 pb-24">
      {/* ヘッダー */}
      <div className="bg-gradient-to-r from-cyan-400 to-blue-400 p-4 shadow-lg">
        <h1 className="text-2xl font-bold text-white text-center">
          メッセージ
        </h1>
      </div>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-4">
        {loadingMessages ? (
          <p className="text-center text-gray-500">よみこみちゅう...</p>
        ) : messages.length === 0 ? (
          <Card className="bg-white/90 border-4 border-cyan-400 shadow-xl">
            <CardContent className="p-8 text-center">
              <div className="text-4xl mb-4">📭</div>
              <p className="text-gray-500">メッセージはまだないよ</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {messages.map((message) => (
              <Card
                key={message.id}
                className={`bg-white/90 border-4 shadow-xl cursor-pointer transition-all hover:scale-[1.02] ${
                  message.receipt?.reply
                    ? "border-green-400"
                    : message.priority === "important"
                    ? "border-red-400"
                    : "border-cyan-400"
                }`}
                onClick={() => setSelectedMessage(message)}
              >
                <CardContent className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                      {message.priority === "important" && (
                        <span className="text-xl">⭐</span>
                      )}
                      <span className="font-bold text-lg">{message.title}</span>
                    </div>
                    <span className="text-sm text-gray-500">{formatDate(message.createdAt)}</span>
                  </div>
                  <p className="text-gray-600 line-clamp-2">{message.body}</p>
                  {message.receipt?.reply && (
                    <div className="mt-2 text-sm text-green-600 font-bold">
                      ✓ 「{getReplyLabel(message.receipt.reply)}」とへんしんずみ
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
          <Card className="bg-white w-full max-w-md border-4 border-cyan-400 shadow-2xl max-h-[80vh] overflow-y-auto">
            <CardContent className="p-6">
              <div className="flex justify-between items-start mb-4">
                <h2 className="text-xl font-bold">{selectedMessage.title}</h2>
                <button
                  onClick={() => setSelectedMessage(null)}
                  className="text-2xl text-gray-400 hover:text-gray-600"
                >
                  ×
                </button>
              </div>
              <p className="text-gray-600 whitespace-pre-wrap mb-6">{selectedMessage.body}</p>

              {!selectedMessage.receipt?.reply && (
                <div className="space-y-2">
                  <p className="text-center text-gray-500 mb-3">へんしんしよう！</p>
                  {REPLY_TYPES.map((reply) => (
                    <Button
                      key={reply.key}
                      onClick={() => handleReply(reply.key)}
                      className="w-full h-12 text-lg bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600"
                    >
                      {reply.label}
                    </Button>
                  ))}
                </div>
              )}

              {selectedMessage.receipt?.reply && (
                <div className="text-center p-4 bg-green-100 rounded-xl">
                  <p className="text-green-600 font-bold">
                    「{getReplyLabel(selectedMessage.receipt.reply)}」とへんしんしたよ！
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* 下部ナビゲーション */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t-4 border-yellow-400 z-40">
        <div className="flex justify-around items-center h-20 max-w-lg mx-auto">
          <Link href="/kids/dashboard" className={`flex flex-col items-center ${pathname === "/kids/dashboard" ? "text-yellow-600 font-bold" : "text-gray-500"}`}>
            <span className="text-2xl">🏠</span>
            <span className="text-xs">ホーム</span>
          </Link>
          <Link href="/kids/study" className={`flex flex-col items-center ${pathname === "/kids/study" ? "text-yellow-600 font-bold" : "text-gray-500"}`}>
            <span className="text-2xl">📝</span>
            <span className="text-xs">きろく</span>
          </Link>
          <Link href="/kids/wishlist" className={`flex flex-col items-center ${pathname === "/kids/wishlist" ? "text-yellow-600 font-bold" : "text-gray-500"}`}>
            <span className="text-2xl">📋</span>
            <span className="text-xs">やりたいこと</span>
          </Link>
          <Link href="/kids/messages" className={`flex flex-col items-center ${pathname === "/kids/messages" ? "text-yellow-600 font-bold" : "text-gray-500"}`}>
            <span className="text-2xl">💬</span>
            <span className="text-xs">メッセージ</span>
          </Link>
        </div>
      </nav>
    </div>
  );
}

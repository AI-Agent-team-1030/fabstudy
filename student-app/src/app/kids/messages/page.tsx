"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  or,
} from "firebase/firestore";
import { REPLY_TYPES } from "@/types";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { KidsBottomNav } from "@/components/common/KidsBottomNav";

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

interface StudentMessage {
  id: string;
  studentId: string;
  studentName: string;
  mood?: number;
  reaction?: string;
  message?: string;
  createdAt: Timestamp;
}

const MOOD_EMOJIS = [
  { value: 1, emoji: "😢", label: "つらい" },
  { value: 2, emoji: "😕", label: "いまいち" },
  { value: 3, emoji: "😐", label: "ふつう" },
  { value: 4, emoji: "🙂", label: "いいかんじ" },
  { value: 5, emoji: "😄", label: "さいこう" },
];

const SEND_REACTIONS = [
  { emoji: "👍", label: "グッド" },
  { emoji: "✅", label: "りょうかい" },
  { emoji: "🙏", label: "ありがとう" },
  { emoji: "🔥", label: "やるき" },
];

export default function KidsMessagesPage() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const [messages, setMessages] = useState<(Message & { receipt?: MessageReceipt })[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [selectedMessage, setSelectedMessage] = useState<(Message & { receipt?: MessageReceipt }) | null>(null);

  // 先生に送信用のstate
  const [selectedMood, setSelectedMood] = useState<number | null>(null);
  const [selectedReaction, setSelectedReaction] = useState<string | null>(null);
  const [messageText, setMessageText] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [myMessages, setMyMessages] = useState<StudentMessage[]>([]);

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
      toast.error("きもち、リアクション、またはメッセージをえらんでね");
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

      toast.success("せんせいにおくりました！");
      setSelectedMood(null);
      setSelectedReaction(null);
      setMessageText("");
      loadMyMessages();
    } catch (error) {
      console.error("Failed to send message:", error);
      toast.error("おくれませんでした");
    } finally {
      setSendingMessage(false);
    }
  };

  const handleDeleteMyMessage = async (messageId: string) => {
    if (!confirm("このメッセージをけしますか？")) return;

    try {
      await deleteDoc(doc(db, "studentMessages", messageId));
      toast.success("けしました");
      loadMyMessages();
    } catch (error) {
      console.error("Failed to delete message:", error);
      toast.error("けせませんでした");
    }
  };

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

        {/* せんせいに送信 */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>
              📨 <ruby>先生<rt>せんせい</rt></ruby>に<ruby>送<rt>おく</rt></ruby>る
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* きもち（5段階） */}
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">
                <ruby>今<rt>いま</rt></ruby>の<ruby>気持<rt>きも</rt></ruby>ち
              </p>
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
              <p className="text-sm font-medium text-gray-700 mb-2">
                メッセージ（<ruby>書<rt>か</rt></ruby>かなくてもOK）
              </p>
              <Textarea
                placeholder="せんせいにつたえたいことをかいてね..."
                value={messageText}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setMessageText(e.target.value)}
                rows={3}
              />
            </div>

            {/* 送信ボタン */}
            <Button
              onClick={handleSendToTeacher}
              disabled={sendingMessage || (!selectedMood && !selectedReaction && !messageText.trim())}
              className="w-full text-lg py-3"
            >
              {sendingMessage ? "おくりちゅう..." : "📤 せんせいにおくる"}
            </Button>
          </CardContent>
        </Card>

        {/* 送信履歴 */}
        {myMessages.length > 0 && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>
                📤 <ruby>送<rt>おく</rt></ruby>った<ruby>記録<rt>きろく</rt></ruby>
              </CardTitle>
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
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400">
                          {formatDate(msg.createdAt)}
                        </span>
                        <button
                          onClick={() => handleDeleteMyMessage(msg.id)}
                          className="text-gray-400 hover:text-red-500 transition-colors"
                          title="けす"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                    {msg.message && (
                      <p className="text-sm text-gray-700 mt-2">{msg.message}</p>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
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

      <KidsBottomNav />
    </div>
  );
}

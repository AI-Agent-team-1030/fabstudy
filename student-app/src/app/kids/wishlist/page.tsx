"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { db } from "@/lib/firebase";
import { collection, addDoc, query, where, getDocs, doc, updateDoc, deleteDoc, Timestamp } from "firebase/firestore";
import { toast } from "sonner";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface WishItem {
  id: string;
  userId: string;
  title: string;
  completed: boolean;
  createdAt: Timestamp;
}

export default function KidsWishlistPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [items, setItems] = useState<WishItem[]>([]);
  const [newItem, setNewItem] = useState("");
  const [adding, setAdding] = useState(false);

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
      loadItems();
    }
  }, [user]);

  const loadItems = async () => {
    if (!user) return;
    try {
      const itemsRef = collection(db, "wishlist");
      const q = query(itemsRef, where("userId", "==", user.id));
      const snapshot = await getDocs(q);
      const itemsData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as WishItem[];
      // 未完了を先に、完了を後に
      itemsData.sort((a, b) => {
        if (a.completed !== b.completed) {
          return a.completed ? 1 : -1;
        }
        const dateA = a.createdAt?.toDate?.() || new Date(0);
        const dateB = b.createdAt?.toDate?.() || new Date(0);
        return dateB.getTime() - dateA.getTime();
      });
      setItems(itemsData);
    } catch (error) {
      console.error("Failed to load items:", error);
    }
  };

  const handleAdd = async () => {
    if (!user || !newItem.trim()) return;

    setAdding(true);
    try {
      const itemsRef = collection(db, "wishlist");
      await addDoc(itemsRef, {
        userId: user.id,
        title: newItem.trim(),
        completed: false,
        createdAt: Timestamp.now(),
      });
      toast.success("ついかしたよ！");
      setNewItem("");
      loadItems();
    } catch (error) {
      console.error("Failed to add item:", error);
      toast.error("ついかできなかった...");
    } finally {
      setAdding(false);
    }
  };

  const handleToggle = async (item: WishItem) => {
    try {
      const itemRef = doc(db, "wishlist", item.id);
      await updateDoc(itemRef, {
        completed: !item.completed,
      });
      if (!item.completed) {
        toast.success("やったね！できたね！");
      }
      loadItems();
    } catch (error) {
      console.error("Failed to toggle item:", error);
    }
  };

  const handleDelete = async (itemId: string) => {
    if (!confirm("ほんとうにけす？")) return;

    try {
      await deleteDoc(doc(db, "wishlist", itemId));
      toast.success("けしたよ");
      loadItems();
    } catch (error) {
      console.error("Failed to delete item:", error);
    }
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-100 to-pink-100 flex items-center justify-center">
        <p className="text-2xl">よみこみちゅう...</p>
      </div>
    );
  }

  const completedCount = items.filter((i) => i.completed).length;

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-100 to-pink-100 pb-24">
      {/* ヘッダー */}
      <div className="bg-gradient-to-r from-purple-400 to-pink-400 p-4 shadow-lg">
        <h1 className="text-2xl font-bold text-white text-center">
          やりたいことリスト
        </h1>
      </div>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-4">
        {/* 追加フォーム */}
        <Card className="bg-white/90 border-4 border-purple-400 shadow-xl">
          <CardContent className="p-4">
            <div className="flex gap-2">
              <Input
                placeholder="やりたいことをかこう！"
                value={newItem}
                onChange={(e) => setNewItem(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                className="flex-1 text-lg"
              />
              <Button
                onClick={handleAdd}
                disabled={adding || !newItem.trim()}
                className="bg-purple-500 hover:bg-purple-600 text-xl px-6"
              >
                +
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* 進捗 */}
        {items.length > 0 && (
          <Card className="bg-white/90 border-4 border-pink-400 shadow-xl">
            <CardContent className="p-4">
              <div className="text-center mb-2">
                <span className="text-lg">できたこと: </span>
                <span className="text-2xl font-bold text-pink-600">
                  {completedCount} / {items.length}
                </span>
              </div>
              <div className="h-4 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-purple-400 to-pink-400 transition-all"
                  style={{ width: `${items.length > 0 ? (completedCount / items.length) * 100 : 0}%` }}
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* リスト */}
        <Card className="bg-white/90 border-4 border-purple-400 shadow-xl">
          <CardContent className="p-4">
            {items.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-4xl mb-4">📝</div>
                <p className="text-gray-500">やりたいことをかいてみよう！</p>
              </div>
            ) : (
              <div className="space-y-2">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className={`flex items-center gap-3 p-3 rounded-xl transition-all ${
                      item.completed ? "bg-green-100" : "bg-purple-50"
                    }`}
                  >
                    <button
                      onClick={() => handleToggle(item)}
                      className={`w-10 h-10 rounded-full border-4 flex items-center justify-center transition-all ${
                        item.completed
                          ? "bg-green-500 border-green-500 text-white"
                          : "bg-white border-purple-300 hover:border-purple-500"
                      }`}
                    >
                      {item.completed && (
                        <span className="text-xl">✓</span>
                      )}
                    </button>
                    <span
                      className={`flex-1 text-lg ${
                        item.completed ? "text-gray-400 line-through" : "text-gray-700"
                      }`}
                    >
                      {item.title}
                    </span>
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="text-gray-400 hover:text-red-500 text-xl"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {/* 下部ナビゲーション */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t-4 border-yellow-400 z-50">
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

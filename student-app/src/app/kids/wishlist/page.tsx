"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { db } from "@/lib/firebase";
import { collection, addDoc, query, where, getDocs, doc, updateDoc, deleteDoc, Timestamp } from "firebase/firestore";
import { Badge } from "@/components/ui/badge";
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
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [items, setItems] = useState<WishItem[]>([]);
  const [newItem, setNewItem] = useState("");
  const [adding, setAdding] = useState(false);

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

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
      toast.success("追加しました");
      setNewItem("");
      loadItems();
    } catch (error) {
      console.error("Failed to add item:", error);
      toast.error("追加に失敗しました");
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
        toast.success("完了しました！");
      }
      loadItems();
    } catch (error) {
      console.error("Failed to toggle item:", error);
    }
  };

  const handleDelete = async (itemId: string) => {
    if (!confirm("削除しますか？")) return;

    try {
      await deleteDoc(doc(db, "wishlist", itemId));
      toast.success("削除しました");
      loadItems();
    } catch (error) {
      console.error("Failed to delete item:", error);
    }
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p>読み込み中...</p>
      </div>
    );
  }

  const completedCount = items.filter((i) => i.completed).length;

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

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-4">
        {/* 追加フォーム */}
        <Card>
          <CardContent className="p-4">
            <div className="flex gap-2">
              <Input
                placeholder="やりたいことを入力してね"
                value={newItem}
                onChange={(e) => setNewItem(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                className="flex-1"
              />
              <Button
                onClick={handleAdd}
                disabled={adding || !newItem.trim()}
              >
                <ruby>追加<rt>ついか</rt></ruby>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* 進捗 */}
        {items.length > 0 && (
          <Card>
            <CardContent className="p-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-600"><ruby>達成<rt>たっせい</rt></ruby><ruby>状況<rt>じょうきょう</rt></ruby></span>
                <span className="font-bold">
                  {completedCount} / {items.length}
                </span>
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 transition-all"
                  style={{ width: `${items.length > 0 ? (completedCount / items.length) * 100 : 0}%` }}
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* リスト */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">リスト</CardTitle>
          </CardHeader>
          <CardContent>
            {items.length === 0 ? (
              <p className="text-gray-500 text-center py-4">やりたいことを<ruby>追加<rt>ついか</rt></ruby>してみよう！</p>
            ) : (
              <div className="space-y-2">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className={`flex items-center gap-3 p-3 rounded-lg ${
                      item.completed ? "bg-green-50" : "bg-gray-50"
                    }`}
                  >
                    <button
                      onClick={() => handleToggle(item)}
                      className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-all ${
                        item.completed
                          ? "bg-green-500 border-green-500 text-white"
                          : "bg-white border-gray-300 hover:border-blue-500"
                      }`}
                    >
                      {item.completed && (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                    <span
                      className={`flex-1 ${
                        item.completed ? "text-gray-400 line-through" : "text-gray-700"
                      }`}
                    >
                      {item.title}
                    </span>
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="text-gray-400 hover:text-red-500"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {/* 下部ナビゲーション */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50">
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

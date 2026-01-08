"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Header } from "@/components/common/Header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { db } from "@/lib/firebase";
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  getDocs,
  Timestamp,
  orderBy,
} from "firebase/firestore";
import { toast } from "sonner";

interface Note {
  id: string;
  title: string;
  content: string;
  updatedAt: Timestamp;
  createdAt: Timestamp;
}

export default function NotesPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loadingNotes, setLoadingNotes] = useState(true);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user) {
      loadNotes();
    }
  }, [user]);

  const loadNotes = async () => {
    if (!user) return;
    try {
      const notesRef = collection(db, "notes");
      const q = query(
        notesRef,
        where("userId", "==", user.id)
      );
      const snapshot = await getDocs(q);
      const notesData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Note[];

      // 更新日時で降順ソート
      notesData.sort((a, b) => {
        const dateA = a.updatedAt?.toDate?.() || new Date(0);
        const dateB = b.updatedAt?.toDate?.() || new Date(0);
        return dateB.getTime() - dateA.getTime();
      });

      setNotes(notesData);
    } catch (error) {
      console.error("Failed to load notes:", error);
    } finally {
      setLoadingNotes(false);
    }
  };

  const createNewNote = async () => {
    if (!user) return;
    try {
      const notesRef = collection(db, "notes");
      const newNote = await addDoc(notesRef, {
        userId: user.id,
        title: "新規メモ",
        content: "",
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });

      const createdNote: Note = {
        id: newNote.id,
        title: "新規メモ",
        content: "",
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      setNotes([createdNote, ...notes]);
      setSelectedNote(createdNote);
      setEditContent("");
      setIsEditing(true);
    } catch (error) {
      console.error("Failed to create note:", error);
      toast.error("メモの作成に失敗しました");
    }
  };

  const saveNote = async () => {
    if (!selectedNote) return;

    try {
      const lines = editContent.split("\n");
      const title = lines[0] || "無題";

      await updateDoc(doc(db, "notes", selectedNote.id), {
        title: title.slice(0, 50),
        content: editContent,
        updatedAt: Timestamp.now(),
      });

      setNotes(notes.map(n =>
        n.id === selectedNote.id
          ? { ...n, title: title.slice(0, 50), content: editContent, updatedAt: Timestamp.now() }
          : n
      ));

      setSelectedNote({ ...selectedNote, title: title.slice(0, 50), content: editContent });
      setIsEditing(false);
      toast.success("保存しました");
    } catch (error) {
      console.error("Failed to save note:", error);
      toast.error("保存に失敗しました");
    }
  };

  const deleteNote = async (noteId: string) => {
    if (!confirm("このメモを削除しますか？")) return;

    try {
      await deleteDoc(doc(db, "notes", noteId));
      setNotes(notes.filter(n => n.id !== noteId));
      if (selectedNote?.id === noteId) {
        setSelectedNote(null);
        setIsEditing(false);
      }
      toast.success("削除しました");
    } catch (error) {
      console.error("Failed to delete note:", error);
      toast.error("削除に失敗しました");
    }
  };

  const formatDate = (timestamp: Timestamp) => {
    if (!timestamp?.toDate) return "";
    const date = timestamp.toDate();
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const dayDiff = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (dayDiff === 0) {
      return `${date.getHours()}:${String(date.getMinutes()).padStart(2, "0")}`;
    } else if (dayDiff === 1) {
      return "昨日";
    } else if (dayDiff < 7) {
      const days = ["日", "月", "火", "水", "木", "金", "土"];
      return days[date.getDay()] + "曜日";
    } else {
      return `${date.getMonth() + 1}/${date.getDate()}`;
    }
  };

  const getPreview = (content: string) => {
    const lines = content.split("\n").filter(l => l.trim());
    if (lines.length <= 1) return "追加テキストなし";
    return lines.slice(1).join(" ").slice(0, 50) || "追加テキストなし";
  };

  const filteredNotes = notes.filter(note =>
    note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    note.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>読み込み中...</p>
      </div>
    );
  }

  // メモ編集画面
  if (selectedNote) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header variant="student" />
        <main className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between mb-4">
            <Button
              variant="ghost"
              onClick={() => {
                if (isEditing && editContent !== selectedNote.content) {
                  if (confirm("変更を保存しますか？")) {
                    saveNote();
                  }
                }
                setSelectedNote(null);
                setIsEditing(false);
              }}
            >
              ← メモ一覧
            </Button>
            <div className="flex gap-2">
              {isEditing ? (
                <Button onClick={saveNote}>完了</Button>
              ) : (
                <>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setEditContent(selectedNote.content);
                      setIsEditing(true);
                    }}
                  >
                    編集
                  </Button>
                  <Button
                    variant="ghost"
                    className="text-red-500"
                    onClick={() => deleteNote(selectedNote.id)}
                  >
                    削除
                  </Button>
                </>
              )}
            </div>
          </div>

          <Card>
            <CardContent className="p-4">
              {isEditing ? (
                <textarea
                  className="w-full min-h-[60vh] p-2 text-lg border-0 focus:outline-none resize-none"
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  placeholder="メモを入力..."
                  autoFocus
                />
              ) : (
                <div className="min-h-[60vh]">
                  <h2 className="text-2xl font-bold mb-4">{selectedNote.title}</h2>
                  <p className="text-sm text-gray-500 mb-4">
                    {formatDate(selectedNote.updatedAt)}
                  </p>
                  <div className="whitespace-pre-wrap text-gray-700">
                    {selectedNote.content.split("\n").slice(1).join("\n") || ""}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  // メモ一覧画面
  return (
    <div className="min-h-screen bg-gray-50">
      <Header variant="student" />
      <main className="max-w-4xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-800">メモ</h2>
          <Button onClick={createNewNote}>
            + 新規メモ
          </Button>
        </div>

        {/* 検索 */}
        <div className="mb-4">
          <Input
            placeholder="検索..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-white"
          />
        </div>

        {loadingNotes ? (
          <Card>
            <CardContent className="py-8">
              <p className="text-center text-gray-500">読み込み中...</p>
            </CardContent>
          </Card>
        ) : filteredNotes.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-gray-500 mb-4">
                {searchQuery ? "検索結果がありません" : "メモがありません"}
              </p>
              {!searchQuery && (
                <Button onClick={createNewNote}>
                  最初のメモを作成
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="bg-white rounded-lg overflow-hidden shadow">
            {filteredNotes.map((note, index) => (
              <div
                key={note.id}
                className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${
                  index !== filteredNotes.length - 1 ? "border-b" : ""
                }`}
                onClick={() => {
                  setSelectedNote(note);
                  setEditContent(note.content);
                }}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 truncate">
                      {note.title || "無題"}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-sm text-gray-500">
                        {formatDate(note.updatedAt)}
                      </span>
                      <span className="text-sm text-gray-400 truncate">
                        {getPreview(note.content)}
                      </span>
                    </div>
                  </div>
                  <span className="text-gray-300 ml-2">›</span>
                </div>
              </div>
            ))}
          </div>
        )}

        <p className="text-center text-sm text-gray-400 mt-4">
          {filteredNotes.length}件のメモ
        </p>
      </main>
    </div>
  );
}

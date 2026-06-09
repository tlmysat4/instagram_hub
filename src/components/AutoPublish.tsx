import React, { useState, useEffect, useRef } from "react";
import {
  Calendar,
  Clock,
  Settings,
  AlertTriangle,
  CheckCircle2,
  Instagram,
  Youtube,
  Radio,
  Tv,
  Share2,
  FileText,
  Tag,
  PlusCircle,
  Trash2,
  Edit3,
  Copy,
  RotateCcw,
  Power,
  RefreshCw,
  Play,
  Check,
  ExternalLink,
  Film,
  Search,
  Grid,
  ChevronRight,
  ChevronLeft,
  BookOpen,
  Heart,
  MessageSquare,
  Eye,
  Bookmark,
  TrendingUp,
  Send,
  Bell,
  Globe,
  Sparkles,
  ArrowLeft,
  ArrowRight,
  Paperclip,
  Loader2,
  FileVideo,
  X,
  History
} from "lucide-react";
import { Video } from "../types";

export interface ConnectedAccount {
  id: string;
  platform: "instagram" | "tiktok" | "youtube" | "facebook";
  type: "business" | "creator";
  username: string;
  displayName: string;
  profilePicture: string;
  connectionHealth: "healthy" | "error" | "warning";
  followers: number;
  connectedAt: string;
}

export interface QueuedPost {
  id: string;
  videoId?: string;
  title: string;
  caption: string;
  category: string;
  hashtags: string[];
  notes?: string;
  contentType: "reel" | "feed" | "story";
  scheduledTime: string;
  timezone: string;
  status: "draft" | "scheduled" | "processing" | "publishing" | "published" | "failed";
  errorDetails?: string;
  instagramUrl?: string;
  instagramMediaId?: string;
  publishedAt?: string;
  publishCount: number;
  analytics?: {
    views: number;
    likes: number;
    comments: number;
    shares: number;
    saves: number;
  };
  versions?: {
    timestamp: string;
    caption: string;
    title: string;
  }[];
}

interface CaptionTemplate {
  id: string;
  title: string;
  text: string;
  tags: string[];
  createdAt: string;
}

interface HashtagItem {
  tag: string;
  count: number;
  category?: string;
}

interface AppNotification {
  id: string;
  type: "scheduled" | "started" | "success" | "failed" | "duplicate";
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
}

interface AutoPublishProps {
  libraryVideos: Video[];
  onNavigate: (tab: string) => void;
}

export default function AutoPublish({ libraryVideos, onNavigate }: AutoPublishProps) {
  // Primary database states
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [queue, setQueue] = useState<QueuedPost[]>([]);
  const [templates, setTemplates] = useState<CaptionTemplate[]>([]);
  const [hashtags, setHashtags] = useState<HashtagItem[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  
  // Loading & Action states
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  
  // New Post Form State
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [category, setCategory] = useState("عام");
  const [notes, setNotes] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [newTagInput, setNewTagInput] = useState("");
  const [contentType, setContentType] = useState<"reel" | "feed" | "story">("reel");
  const [publishTimeOpt, setPublishTimeOpt] = useState<"now" | "later">("later");
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [timezone, setTimezone] = useState("Asia/Riyadh");
  const [selectedLibraryVideoId, setSelectedLibraryVideoId] = useState("");
  const [bypassCheck, setBypassCheck] = useState(false);
  
  // Local File Upload inside publishers
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadedUrl, setUploadedUrl] = useState("");
  const [uploadedName, setUploadedName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Duplicate warning state
  const [duplicateWarning, setDuplicateWarning] = useState<{
    detected: boolean;
    matches: Array<{ type: string; score: number; matchedTitle: string; message: string }>;
    payloadToRetry?: any;
  } | null>(null);

  // Quick edit modal states
  const [editingPost, setEditingPost] = useState<QueuedPost | null>(null);
  const [editCaption, setEditCaption] = useState("");
  const [editTime, setEditTime] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  // View versions logs modal
  const [viewingVersionHistoryPost, setViewingVersionHistoryPost] = useState<QueuedPost | null>(null);

  // Calendar Date selectors
  const [currentDate, setCurrentDate] = useState(new Date());
  
  // New Caption Template Form
  const [newCapTitle, setNewCapTitle] = useState("");
  const [newCapText, setNewCapText] = useState("");
  const [newCapTags, setNewCapTags] = useState("");
  const [savingTemplate, setSavingTemplate] = useState(false);

  const token = localStorage.getItem("ig_hub_token");

  // Fetch initial publish system dataset
  const fetchPublishData = async () => {
    if (!token) return;
    setRefreshing(true);
    try {
      const [accRes, qRes, capRes, hashRes, notifRes] = await Promise.all([
        fetch("/api/publish/accounts", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/publish/queue", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/publish/captions", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/publish/hashtags", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/publish/notifications", { headers: { Authorization: `Bearer ${token}` } })
      ]);

      if (accRes.ok) setAccounts(await accRes.json());
      if (qRes.ok) setQueue(await qRes.json());
      if (capRes.ok) setTemplates(await capRes.json());
      if (hashRes.ok) setHashtags(await hashRes.json());
      if (notifRes.ok) setNotifications(await notifRes.json());
    } catch (err) {
      console.error("Error reading auto publish credentials:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchPublishData();
    // Poll queue to show live published status updates and stats tickers
    const timer = setInterval(() => {
      fetchPublishData();
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  // Popup-based Simulated OAuth Handshake
  const handleConnectAccount = async () => {
    try {
      const res = await fetch("/api/publish/oauth-url", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error();
      const { url } = await res.json();

      // Open Meta simulated OAuth frame centering the browser
      const width = 600;
      const height = 700;
      const left = window.screen.width / 2 - width / 2;
      const top = window.screen.height / 2 - height / 2;

      const authWindow = window.open(
        url,
        "instagram_oauth_popup",
        `width=${width},height=${height},left=${left},top=${top}`
      );

      if (!authWindow) {
        alert("يرجى فك حظر النوافذ المنبثقة (Popups) للسماح بربط حساب إنستغرام عبر الـ API!");
      }
    } catch (err) {
      alert("فشل الحصول على رابط المصادقة من السيرفر.");
    }
  };

  // Listen to postMessage callbacks from the popup
  useEffect(() => {
    const handleOauthMessage = async (e: MessageEvent) => {
      const origin = e.origin;
      if (!origin.endsWith(".run.app") && !origin.includes("localhost")) {
        return;
      }

      if (e.data?.type === "OAUTH_AUTH_SUCCESS" && e.data?.account) {
        try {
          const res = await fetch("/api/publish/accounts/connect", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token || ""}`
            },
            body: JSON.stringify(e.data.account)
          });
          if (res.ok) {
            const data = await res.json();
            setAccounts((prev) => {
              const filtered = prev.filter((a) => a.id !== data.account.id);
              return [...filtered, data.account];
            });
            
            // Add schedule notification
            setNotifications(prev => [
              {
                id: "notif_conn_" + Date.now(),
                type: "scheduled",
                title: "ربط حساب إنستغرام جديد",
                message: `تم ترخيص وحفظ الحساب @${data.account.username} بنجاح عبر Meta OAuth API.`,
                timestamp: new Date().toISOString(),
                read: false
              },
              ...prev
            ]);
            alert(`تم ربط حساب إنستغرام الاحترافي @${data.account.username} بنجاح وثقة!`);
          }
        } catch (error) {
          console.error("Failed to commit connected accounts:", error);
        }
      }
    };

    window.addEventListener("message", handleOauthMessage);
    return () => window.removeEventListener("message", handleOauthMessage);
  }, []);

  // Disconnect Channel
  const handleDisconnect = async (id: string) => {
    if (!confirm("هل تريد بالتأكيد قطع الاتصال وتعطيل خدمات النشر التلقائي لهذا الحساب؟")) {
      return;
    }
    try {
      const res = await fetch(`/api/publish/accounts/disconnect/${id}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token || ""}` }
      });
      if (res.ok) {
        setAccounts((prev) => prev.filter((a) => a.id !== id));
      }
    } catch (error) {
      console.error(error);
    }
  };

  // Handle direct file uploads inside schedule drawer
  const handleLocalFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    setUploadingFile(true);

    try {
      // Read as base64 chunk
      const reader = new FileReader();
      reader.onload = async (event) => {
        const fileData = event.target?.result as string;
        try {
          const response = await fetch("/api/upload", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              filename: file.name,
              fileData: fileData
            })
          });

          const resData = await response.json();
          if (response.ok) {
            setUploadedUrl(resData.videoPath);
            setUploadedName(resData.filename);
          } else {
            alert("فشل تحميل الفيديو: " + resData.error);
          }
        } catch (ex) {
          alert("خطأ أثناء إرسال ملف المقطع للسيرفر.");
        } finally {
          setUploadingFile(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error(err);
      setUploadingFile(false);
    }
  };

  // Submit new scheduled plan
  const handleQueueSubmission = async (e: React.FormEvent, isBypassedForce = false) => {
    e.preventDefault();
    if (!title.trim()) return alert("يرجى كتابة عنوان للمنشور.");
    if (!caption.trim()) return alert("الشرح المكتوب (الكابشن) مطلوب للنشر.");

    // Determine target schedule date ISO representation
    let targetTime = new Date().toISOString();
    if (publishTimeOpt === "later") {
      if (!scheduledDate || !scheduledTime) {
        return alert("يرجى تحديد تاريخ ووقت الجدولة المستقبلية.");
      }
      targetTime = `${scheduledDate}T${scheduledTime}`;
    }

    const payload = {
      videoId: selectedLibraryVideoId || undefined,
      title: title.trim(),
      caption: caption.trim(),
      category,
      hashtags: selectedTags,
      notes: notes.trim(),
      contentType,
      scheduledTime: targetTime,
      timezone,
      status: publishTimeOpt === "now" ? "draft" : "scheduled",
      bypassDuplicate: isBypassedForce
    };

    try {
      const res = await fetch("/api/publish/queue", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token || ""}`
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (res.ok) {
        if (!data.success && data.duplicateDetected) {
          // Open duplicate warning modal to require user confirmation!
          setDuplicateWarning({
            detected: true,
            matches: data.matches,
            payloadToRetry: payload
          });
        } else {
          // Success
          setTitle("");
          setCaption("");
          setCategory("عام");
          setNotes("");
          setSelectedTags([]);
          setSelectedLibraryVideoId("");
          setUploadedUrl("");
          setUploadedName("");
          setPublishTimeOpt("later");
          setScheduledDate("");
          setScheduledTime("");
          
          setDuplicateWarning(null);
          fetchPublishData();

          if (publishTimeOpt === "now") {
            // Instantly publish it!
            handlePublishImmediately(data.post.id);
          } else {
            alert(data.message || "تمت جدولة المنشور بنجاح.");
          }
        }
      } else {
        alert(data.error || "فشل إرسال الجدولة.");
      }
    } catch (err) {
      alert("حدث خطأ غير متوقع أثناء ترحيل الجدولة.");
    }
  };

  // Publish immediate bypass scheduler
  const handlePublishImmediately = async (postId: string) => {
    try {
      const res = await fetch(`/api/publish/queue/${postId}/publish-now`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token || ""}` }
      });
      if (res.ok) {
        const data = await res.json();
        alert(data.message || "بدأت عملية الرفع والتشغيل على إنستغرام!");
        fetchPublishData();
      }
    } catch (err) {
      alert("خطأ في تشغيل النشر المتزامن.");
    }
  };

  // Duplicate entire publishing plan
  const handleDuplicatePlan = async (postId: string) => {
    try {
      const res = await fetch(`/api/publish/queue/${postId}/duplicate`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token || ""}` }
      });
      if (res.ok) {
        const data = await res.json();
        alert(data.message || "تم استنساخ خطة النشر وحفظها ليوم الغد في المسودات!");
        fetchPublishData();
      }
    } catch (err) {
      alert("خطأ في تكرار الخطة.");
    }
  };

  // Cancel/Delete publishing Queue Item
  const handleCancelPost = async (id: string) => {
    if (!confirm("هل أنت متأكد من رغبتك في إلغاء وحذف خطة نشر هذا المقطع؟")) return;
    try {
      const res = await fetch(`/api/publish/queue/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token || ""}` }
      });
      if (res.ok) {
        setQueue((prev) => prev.filter((p) => p.id !== id));
      }
    } catch (error) {
      console.error(error);
    }
  };

  // Retry a failed publication
  const handleRetryFailedPost = async (id: string) => {
    try {
      const res = await fetch(`/api/publish/queue/${id}/retry`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token || ""}` }
      });
      if (res.ok) {
        const data = await res.json();
        alert(data.message || "جاري إعادة المحاولة للنشر...");
        fetchPublishData();
      }
    } catch (error) {
      console.error(error);
    }
  };

  // Apply caption templates to active composer
  const handleApplyTemplate = (temp: CaptionTemplate) => {
    setCaption(temp.text);
    if (temp.tags && temp.tags.length > 0) {
      setSelectedTags((prev) => {
        const merged = [...prev, ...temp.tags];
        return Array.from(new Set(merged));
      });
    }
  };

  // Create caption template
  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCapTitle.trim() || !newCapText.trim()) return alert("يرجى إكمال عنوان ومحتوى القالب.");
    setSavingTemplate(true);

    const parsedTags = newCapTags
      .split(/[,\s]+/)
      .map((t) => t.replace("#", "").trim())
      .filter((t) => t.length > 0);

    try {
      const res = await fetch("/api/publish/captions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token || ""}`
        },
        body: JSON.stringify({
          title: newCapTitle.trim(),
          text: newCapText.trim(),
          tags: parsedTags
        })
      });

      if (res.ok) {
        const data = await res.json();
        setTemplates((prev) => [data.caption, ...prev]);
        setNewCapTitle("");
        setNewCapText("");
        setNewCapTags("");
        alert("تم حفظ قالب الكابشن بنجاح للاستكشاف والتحميل السريع!");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSavingTemplate(false);
    }
  };

  const handleDeleteTemplate = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("هل تريد حذف هذا القالب؟")) return;
    try {
      const res = await fetch(`/api/publish/captions/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token || ""}` }
      });
      if (res.ok) {
        setTemplates((prev) => prev.filter((t) => t.id !== id));
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Add tag to the helper tags list inside form
  const handleAddTag = () => {
    const clean = newTagInput.replace("#", "").trim();
    if (clean && !selectedTags.includes(clean)) {
      setSelectedTags((prev) => [...prev, clean]);
      setNewTagInput("");
    }
  };

  const handleRemoveTag = (tag: string) => {
    setSelectedTags((prev) => prev.filter((t) => t !== tag));
  };

  // Clear notifications read state
  const handleClearNotifications = async () => {
    try {
      await fetch("/api/publish/notifications/clear", {
        method: "POST",
        headers: { Authorization: `Bearer ${token || ""}` }
      });
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch (err) {
      console.error(err);
    }
  };

  // Open Edit post modal
  const handleOpenEdit = (post: QueuedPost) => {
    setEditingPost(post);
    setEditCaption(post.caption);
    setEditTime(post.scheduledTime.substring(0, 16));
  };

  // Save edited queued post
  const handleSaveEdit = async () => {
    if (!editingPost) return;
    setSavingEdit(true);
    try {
      const res = await fetch(`/api/publish/queue/${editingPost.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token || ""}`
        },
        body: JSON.stringify({
          caption: editCaption.trim(),
          scheduledTime: editTime,
          status: editingPost.status === "failed" ? "scheduled" : editingPost.status
        })
      });

      if (res.ok) {
        alert("تم تحديث وجدولة التعديلات بنجاح ودمج مسار المراجعة للأرشيف.");
        setEditingPost(null);
        fetchPublishData();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSavingEdit(false);
    }
  };

  // Generate Calendar Squares
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    // Days array
    const days: Date[] = [];
    
    // Fill previous days overflow to start on the correct week offset
    const dayOfWeek = firstDay.getDay(); // 0 is Sunday, 6 is Saturday
    // Adjust week offset for Arabian/rtl calendar looking if preferred, let's keep simple grid starting with Sunday
    for (let i = dayOfWeek - 1; i >= 0; i--) {
      days.push(new Date(year, month, -i));
    }

    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push(new Date(year, month, i));
    }

    // Fill remaining grids to complete full 6 weeks matrix grid (42 blocks)
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      days.push(new Date(year, month + 1, i));
    }

    return days;
  };

  // Group queue events allocated to specific days for quick indexing
  const getPostEventsForDay = (day: Date) => {
    const dayStr = day.toISOString().split("T")[0];
    return queue.filter((p) => {
      const postDayStr = p.scheduledTime.split("T")[0];
      return postDayStr === dayStr;
    });
  };

  // Date handlers for the monthly visual picker
  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };


  const calendarDays = getDaysInMonth(currentDate);
  const arabicMonthNames = [
    "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
    "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"
  ];

  // Filters for displaying queue
  const [queueSearch, setQueueSearch] = useState("");
  const [queueStatusFilter, setQueueStatusFilter] = useState("all");

  const filteredQueue = queue
    .filter((item) => {
      const matchesSearch = item.title.toLowerCase().includes(queueSearch.toLowerCase()) || 
                            item.caption.toLowerCase().includes(queueSearch.toLowerCase());
      const matchesStatus = queueStatusFilter === "all" || item.status === queueStatusFilter;
      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => new Date(a.scheduledTime).getTime() - new Date(b.scheduledTime).getTime());

  // Split published history versus active schedule queue
  const publishedHistory = queue
    .filter((p) => p.status === "published")
    .sort((a, b) => new Date(b.publishedAt || "").getTime() - new Date(a.publishedAt || "").getTime());

  const activeQueue = queue.filter((p) => p.status !== "published");

  return (
    <div className="space-y-8 animate-fade-in" id="auto-publish-module">
      
      {/* SECTION 1: HEADER & CONNECTION PANELS */}
      <div className="flex flex-col xl:flex-row gap-6 justify-between items-start xl:items-center">
        <div>
          <h2 className="text-xl font-extrabold text-white flex items-center gap-2.5">
            <Share2 className="w-6 h-6 text-[#fd1d1d] animate-pulse" />
            <span>النشر والجدولة التلقائية</span>
          </h2>
          <p className="text-xs text-gray-400 mt-1.5">
            قنوات الربط الذكي، النشر المباشر عبر Meta Graph API، طوابير الانتظار وتحليل التكرار.
          </p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          {/* Notifications Trigger */}
          <div className="relative">
            <button
              onClick={() => {
                setNotifOpen(!notifOpen);
                handleClearNotifications();
              }}
              className="p-3 bg-[#111] hover:bg-[#1a1a1a] border border-[#222] rounded-2xl text-gray-400 hover:text-white transition relative cursor-pointer"
              title="تنبيهات حالة المهام وجدولة النشر"
            >
              <Bell className="w-4.5 h-4.5" />
              {notifications.some((n) => !n.read) && (
                <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full animate-ping"></span>
              )}
            </button>

            {/* Dropdown notification cards */}
            {notifOpen && (
              <div className="absolute left-0 mt-3 w-80 bg-black border border-[#222] rounded-2xl shadow-2xl z-50 p-4 space-y-3 shadow-red-500/5">
                <div className="flex items-center justify-between border-b border-[#222] pb-2">
                  <span className="text-xs font-bold text-white">إشعارات عمليات النشر 🔔</span>
                  <button
                    onClick={() => setNotifOpen(false)}
                    className="text-[10px] text-gray-500 hover:text-white"
                  >
                    إغلاق
                  </button>
                </div>
                <div className="max-h-60 overflow-y-auto space-y-2">
                  {notifications.length === 0 ? (
                    <p className="text-[10px] text-gray-500 py-4 text-center">لا توجد إشعارات حالياً</p>
                  ) : (
                    notifications.map((n) => (
                      <div
                        key={n.id}
                        className={`p-2.5 rounded-xl border text-right space-y-1 ${
                          n.type === "success"
                            ? "bg-emerald-500/5 border-emerald-500/10 text-emerald-400"
                            : n.type === "duplicate"
                            ? "bg-amber-500/5 border-amber-500/10 text-amber-400"
                            : "bg-red-500/5 border-red-500/10 text-red-400"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black">{n.title}</span>
                          <span className="text-[8px] text-gray-500">
                            {new Date(n.timestamp).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                        <p className="text-[9px] text-gray-300 leading-relaxed font-light">{n.message}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <button
            onClick={fetchPublishData}
            disabled={refreshing}
            className="px-4 py-2 bg-[#111] hover:bg-[#1a1a1a] border border-[#222] rounded-2xl text-xs font-bold text-gray-300 flex items-center gap-2 transition disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin text-[#fd1d1d]" : ""}`} />
            <span>{refreshing ? "جاري التحديث..." : "تحديث فوري"}</span>
          </button>
        </div>
      </div>

      {/* SECTION 2: CHANNELS PERSISTENCE BOARD */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Connection Box for Active channels */}
        <div className="col-span-1 lg:col-span-2 bg-[#0a0a0a] border border-[#161616] rounded-[32px] p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                <Globe className="w-4 h-4 text-[#fd1d1d]" />
                <span>قنوات التواصل المتصلة (Meta SDK)</span>
              </h3>
              <p className="text-[10px] text-gray-500 mt-1">تراخيص النشر التلقائي ومصادقة الوصول الآمن بمعدل حماية كامل.</p>
            </div>

            <button
              onClick={handleConnectAccount}
              className="px-3.5 py-1.5 bg-gradient-to-tr from-[#833ab4] via-[#fd1d1d] to-[#fcb045] text-white text-[11px] font-bold rounded-xl shadow-lg shadow-red-500/10 hover:opacity-90 flex items-center gap-1.5 cursor-pointer select-none transition-all"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>ربط حساب جديد</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {accounts.length === 0 ? (
              <div className="col-span-full border-2 border-dashed border-[#1f1f1f] rounded-[24px] p-8 text-center text-gray-500 text-xs flex flex-col items-center justify-center space-y-2">
                <Instagram className="w-8 h-8 text-gray-600 animate-pulse" />
                <p className="font-bold">لا يوجد أي حساب إنستغرام متصل حالياً</p>
                <p className="text-[10px] text-gray-650">انقر على ربط حساب لتوليد رمز Meta OAuth الآمن وبدء النشر التلقائي.</p>
              </div>
            ) : (
              accounts.map((acc) => (
                <div
                  key={acc.id}
                  className="bg-[#121212]/50 border border-[#222] hover:border-[#333] transition rounded-2xl p-4 flex items-center justify-between gap-3 relative overflow-hidden group"
                >
                  <div className="flex items-center gap-3">
                    {/* Visual Avatar frame with platform logo */}
                    <div className="relative">
                      <div className="w-12 h-12 rounded-full p-0.5 bg-gradient-to-tr from-[#833ab4] via-[#fd1d1d] to-[#fcb045]">
                        <img
                          src={acc.profilePicture}
                          alt={acc.displayName}
                          className="w-full h-full object-cover rounded-full"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                      <span className="absolute bottom-0 right-0 p-0.5 rounded-full bg-gradient-to-tr from-[#833ab4] to-[#fd1d1d] text-white border border-[#121212]">
                        <Instagram className="w-3 h-3" />
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-xs font-extrabold text-white block">{acc.displayName}</span>
                      <span className="text-[9px] text-[#fd1d1d] block font-mono" dir="ltr">@{acc.username}</span>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="text-[8px] bg-white/5 text-gray-450 px-1.5 py-0.5 rounded font-bold uppercase">
                          {acc.type === "business" ? "تجاري Business" : "منشئ محتوى Creator"}
                        </span>
                        <span className="text-[8px] font-bold text-gray-500 flex items-center gap-1">
                          <TrendingUp className="w-2.5 h-2.5" />
                          <span>{acc.followers?.toLocaleString("ar-EG") || "0"} متابع</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2 shrink-0">
                    {/* Health indicator */}
                    <div className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                      <span className="text-[9px] font-bold text-emerald-400">آمن ومتصل</span>
                    </div>
                    
                    <button
                      onClick={() => handleDisconnect(acc.id)}
                      className="p-1 px-2 text-[8px] text-red-400 hover:text-white bg-red-500/5 hover:bg-red-500 bg-opacity-10 rounded-lg hover:bg-opacity-100 transition duration-150 cursor-pointer"
                      title="فصل وإلغاء صلاحية القناة"
                    >
                      قطع الاتصال
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Channels Expansion Architect future proofing */}
        <div className="bg-[#0a0a0a] border border-[#161616] rounded-[32px] p-6 space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 bg-[#fcb045]/5 border border-[#fcb045]/10 rounded-xl p-2 px-3 w-fit text-[9px] font-black text-[#fcb045]">
              <Sparkles className="w-3.5 h-3.5" />
              <span>هيكلة التمدد والنمو المستقبلي</span>
            </div>
            <h3 className="text-sm font-extrabold text-white mt-3.5">تكاملات التواصل الشاملة</h3>
            <p className="text-[10px] text-gray-400 leading-relaxed mt-1.5">
              تم تصميم هيكل النظام التلقائي ليدعم استضافة قنوات وسائط التواصل الأخرى فور تفعيل المفاتيح الرسمية الخاصة بها دون حاجة لإعادة بناء الواجهة.
            </p>
          </div>

          <div className="space-y-2 pt-2">
            <div className="p-3 bg-white/2 bg-opacity-3 border border-white/5 rounded-2xl flex items-center justify-between opacity-50">
              <div className="flex items-center gap-2">
                <Youtube className="w-4 h-4 text-[#ff0000]" />
                <span className="text-xs text-gray-300 font-bold">YouTube Shorts</span>
              </div>
              <span className="text-[8px] font-bold bg-[#ff0000]/10 text-[#ff0000] border border-[#ff0000]/20 px-1.5 py-0.5 rounded-full">قريباً جداً</span>
            </div>

            <div className="p-3 bg-white/2 bg-opacity-3 border border-white/5 rounded-2xl flex items-center justify-between opacity-50">
              <div className="flex items-center gap-2">
                <Tv className="w-4 h-4 text-sky-400" />
                <span className="text-xs text-gray-300 font-bold">TikTok Video Publisher</span>
              </div>
              <span className="text-[8px] font-bold bg-sky-455/10 text-sky-400 border border-sky-400/20 px-1.5 py-0.5 rounded-full">جاهز للهيكلة</span>
            </div>

            <div className="p-3 bg-white/2 bg-opacity-3 border border-white/5 rounded-2xl flex items-center justify-between opacity-50">
              <div className="flex items-center gap-2">
                <Radio className="w-4 h-4 text-blue-500" />
                <span className="text-xs text-gray-300 font-bold">Facebook Reels</span>
              </div>
              <span className="text-[8px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20 px-1.5 py-0.5 rounded-full">مخطط له</span>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 3: SCHEDULING COMPOSER & LIVE QUEUE */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        
        {/* Form composer Column (5 grids) */}
        <div className="xl:col-span-5 bg-[#0a0a0a] border border-[#161616] rounded-[36px] p-6 lg:p-8 space-y-6">
          <div>
            <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
              <PlusCircle className="w-4 h-4 text-[#fd1d1d]" />
              <span>مؤلف الجدولة والنشر الفوري</span>
            </h3>
            <p className="text-[10px] text-gray-500 mt-1">قم بملء البيانات لادخال المقطع في جدول النشر والتقويم مباشرة.</p>
          </div>

          <form onSubmit={(e) => handleQueueSubmission(e, false)} className="space-y-4">
            
            {/* Step 1: Video File selector from library or upload */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-gray-400 flex items-center justify-between">
                <span>1. حدد مقطع الفيديو المراد نشره:</span>
                <span className="text-[10px] text-[#fd1d1d] font-bold">مطلوب</span>
              </label>

              {/* Source tabs */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedLibraryVideoId("local_direct")}
                  className={`py-2 px-3 rounded-xl border text-[11px] font-bold transition flex items-center justify-center gap-1.5 ${
                    selectedLibraryVideoId === "local_direct"
                      ? "bg-[#fd1d1d]/10 border-[#fd1d1d] text-white"
                      : "bg-[#121212]/60 border-[#222] text-gray-400 hover:text-white"
                  }`}
                >
                  <Paperclip className="w-3.5 h-3.5" />
                  <span>تحميل ملف محلي</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedLibraryVideoId("")}
                  className={`py-2 px-3 rounded-xl border text-[11px] font-bold transition flex items-center justify-center gap-1.5 ${
                    selectedLibraryVideoId !== "local_direct"
                      ? "bg-[#fd1d1d]/10 border-[#fd1d1d] text-white"
                      : "bg-[#121212]/60 border-[#222] text-gray-400 hover:text-white"
                  }`}
                >
                  <Film className="w-3.5 h-3.5" />
                  <span>اختيار من المكتبة ({libraryVideos.length})</span>
                </button>
              </div>

              {/* Render local file uploaded input or list picker */}
              {selectedLibraryVideoId === "local_direct" ? (
                <div className="pt-2">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleLocalFileChange}
                    accept="video/*"
                    className="hidden"
                  />
                  {!uploadedUrl ? (
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed border-[#222] bg-[#121212]/20 hover:border-[#fd1d1d]/30 hover:bg-[#121212]/50 p-6 rounded-2xl text-center cursor-pointer transition-all"
                    >
                      {uploadingFile ? (
                        <div className="space-y-2 flex flex-col items-center">
                          <Loader2 className="w-6 h-6 text-[#fd1d1d] animate-spin" />
                          <p className="text-[10px] text-white font-bold">جاري رفع ومعالجة ملف المقطع التلقائي...</p>
                        </div>
                      ) : (
                        <div className="space-y-1 flex flex-col items-center">
                          <PlusCircle className="w-5 h-5 text-gray-500" />
                          <p className="text-xs text-gray-300 font-bold">انقر لتحديد ملف الفيديو للرفع</p>
                          <p className="text-[9px] text-gray-550">الحجم الأقصى 150 ميغابايت</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="bg-[#121212] border border-[#222] p-3 rounded-xl flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileVideo className="w-4 h-4 text-[#fd1d1d] shrink-0" />
                        <span className="text-[10px] text-white font-mono truncate" dir="ltr">{uploadedName}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => { setUploadedUrl(""); setUploadedName(""); }}
                        className="text-[9px] text-red-400 hover:text-red-500 font-bold"
                      >
                        إزالة
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="pt-2">
                  <select
                    value={selectedLibraryVideoId}
                    onChange={(e) => setSelectedLibraryVideoId(e.target.value)}
                    className="w-full bg-[#121212] border border-[#222] hover:border-[#333] rounded-xl px-3 py-2 text-xs font-medium text-white focus:outline-none"
                  >
                    <option value="">-- اختر مقطع مجهز من المكتبة --</option>
                    {libraryVideos.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.title} ({v.duration || "غير محدد"}) - {v.status === "ready" ? "جاهز" : "مسودة"}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Title Block */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-gray-400">العنوان وموضوع المقطع:</label>
              <input
                type="text"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  // Auto sync with library video title if matching record selected!
                  if (selectedLibraryVideoId && selectedLibraryVideoId !== "local_direct") {
                    const match = libraryVideos.find((v) => v.id === selectedLibraryVideoId);
                    if (match && title === "") {
                      setCaption(match.description);
                      if (match.tags) setSelectedTags(match.tags);
                    }
                  }
                }}
                placeholder="مثال: أهم نصائح النجاح لصناعة محتوى مؤثر..."
                className="w-full bg-[#121212] border border-[#222] focus:border-[#333] rounded-xl px-4.5 py-2.5 text-xs text-white focus:outline-none"
              />
            </div>

            {/* Caption Body with Template Helper */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-gray-400">الشرح المكتوب والهاشتاج (الكابشن):</label>
                <div className="flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-[#fd1d1d]" />
                  <span className="text-[10px] text-[#fd1d1d] font-bold">يدعم العربية</span>
                </div>
              </div>
              <textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                rows={4}
                placeholder="أكتب النص التفاعلي والهاشتاجات هنا... سيتم نشر هذا النص مباشرة أسفل المقطع."
                className="w-full bg-[#121212] border border-[#222] focus:border-[#333] rounded-xl px-4.5 py-2.5 text-xs text-white focus:outline-none resize-none leading-relaxed"
              ></textarea>
            </div>

            {/* Tags Assistant */}
            <div className="space-y-1.5 bg-[#121212]/30 p-3 rounded-2xl border border-white/2">
              <label className="block text-[10px] font-bold text-gray-400">الهاشتاجات النشطة للمنشور:</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newTagInput}
                  onChange={(e) => setNewTagInput(e.target.value)}
                  placeholder="أكتب الوسم وانقر إضافة..."
                  className="flex-1 bg-[#121212] border border-[#222] rounded-xl px-3 py-1.5 text-[10px] text-white focus:outline-none"
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddTag(); } }}
                />
                <button
                  type="button"
                  onClick={handleAddTag}
                  className="px-3 py-1.5 bg-[#fd1d1d]/10 hover:bg-[#fd1d1d] text-[#fd1d1d] hover:text-white border border-[#fd1d1d]/20 hover:border-transparent text-[10px] font-bold rounded-xl transition cursor-pointer"
                >
                  إضافة
                </button>
              </div>

              {/* Tag badges */}
              {selectedTags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-2">
                  {selectedTags.map((t) => (
                    <span
                      key={t}
                      className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-red-500/5 text-[#fd1d1d] border border-red-500/10 flex items-center gap-1"
                    >
                      <span>#{t}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(t)}
                        className="text-red-400 hover:text-white"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Categories & Notes Grid */}
            <div className="grid grid-cols-2 gap-3.5">
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-gray-400">الفئة والنوعية:</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-[#121212] border border-[#222] rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                >
                  <option value="عام">عام / ريادة</option>
                  <option value="تقنية">تقنية ومراجعات</option>
                  <option value="تطوير ذاتي">تنمية وتطوير</option>
                  <option value="قصص">قصص وتجارب</option>
                  <option value="مؤشرات">إحصاءات وتريند</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-gray-400">شكل وطراز العرض:</label>
                <select
                  value={contentType}
                  onChange={(e) => setContentType(e.target.value as any)}
                  className="w-full bg-[#121212] border border-[#222] rounded-xl px-2 py-2 text-xs text-white focus:outline-none"
                >
                  <option value="reel">مقطع ريلز محترف (Reel)</option>
                  <option value="feed">منشور عادي (Feed Post)</option>
                  <option value="story">قصة هادفة (Story)</option>
                </select>
              </div>
            </div>

            {/* Note block */}
            <div className="space-y-1">
              <label className="block text-[10px] font-semibold text-gray-400">ملاحظات داخلية (أرشيف الهوية):</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="أرشيف سري للفريق..."
                className="w-full bg-[#121212] border border-[#222] rounded-xl px-3.5 py-1.5 text-xs text-white focus:outline-none"
              />
            </div>

            {/* STEP 3 & 4: Select Publish Mode */}
            <div className="space-y-2 bg-[#121212]/40 rounded-2xl border border-white/5 p-4 mt-2">
              <label className="block text-xs font-bold text-white">توقيت وجدولة النشر التلقائي:</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPublishTimeOpt("now")}
                  className={`py-2 px-3 rounded-xl border text-[11px] font-bold transition flex items-center justify-center gap-1.5 ${
                    publishTimeOpt === "now"
                      ? "bg-[#fd1d1d]/10 border-[#fd1d1d] text-white"
                      : "bg-[#121212]/60 border-[#222] text-gray-450 hover:text-white"
                  }`}
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>انشر فوراً الآن ⚡</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPublishTimeOpt("later")}
                  className={`py-2 px-3 rounded-xl border text-[11px] font-bold transition flex items-center justify-center gap-1.5 ${
                    publishTimeOpt === "later"
                      ? "bg-[#fd1d1d]/10 border-[#fd1d1d] text-white"
                      : "bg-[#121212]/60 border-[#222] text-gray-450 hover:text-white"
                  }`}
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>جدولة لوقت لاحق 📅</span>
                </button>
              </div>

              {publishTimeOpt === "later" && (
                <div className="space-y-3 pt-3 animate-fade-in">
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="space-y-1">
                      <span className="text-[9px] text-gray-400 block font-bold">تاريخ النشر:</span>
                      <input
                        type="date"
                        value={scheduledDate}
                        onChange={(e) => setScheduledDate(e.target.value)}
                        className="w-full bg-[#121212] border border-[#222] rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <span className="text-[9px] text-gray-400 block font-bold">وقت النشر:</span>
                      <input
                        type="time"
                        value={scheduledTime}
                        onChange={(e) => setScheduledTime(e.target.value)}
                        className="w-full bg-[#121212] border border-[#222] rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="space-y-1 border-t border-[#222] pt-2">
                    <span className="text-[9px] text-gray-500 block font-bold">المنطقة الزمنية المرجعية:</span>
                    <select
                      value={timezone}
                      onChange={(e) => setTimezone(e.target.value)}
                      className="w-full bg-[#121212]/50 border border-transparent rounded-xl px-2 py-1 text-[10px] text-gray-400 focus:outline-none font-sans"
                    >
                      <option value="Asia/Riyadh">توقيت الرياض والشرق الأوسط (GMT+3)</option>
                      <option value="Asia/Dubai">توقيت دبي وأبو ظبي (GMT+4)</option>
                      <option value="UTC">التوقيت العالمي الموحد (UTC/GMT)</option>
                    </select>
                  </div>
                </div>
              )}
            </div>

            {/* Submit block */}
            <button
              type="submit"
              disabled={accounts.length === 0}
              className="w-full py-3 rounded-2xl bg-[#fd1d1d] hover:bg-[#fcb045] disabled:bg-gray-800 disabled:text-gray-500 text-white font-extrabold text-xs transition duration-150 shadow-lg shadow-red-500/10 cursor-pointer text-center"
            >
              {accounts.length === 0
                ? "اربط حساب إنستغرام أولاً لتفعيل الجدولة"
                : publishTimeOpt === "now"
                ? "ابدأ النشر الفوري الذكي ⚡"
                : "أضف لجدول النشر والانتظار 📅"}
            </button>
          </form>
        </div>

        {/* Calendar and List Grid column (7 grids) */}
        <div className="xl:col-span-7 space-y-8">
          
          {/* Calendar view */}
          <div className="bg-[#0a0a0a] border border-[#161616] rounded-[36px] p-6 lg:p-7 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-[#fd1d1d]" />
                  <span>خط زمني وتقويم المنشورات الشهري</span>
                </h3>
                <p className="text-[10px] text-gray-550">توزيع مرئي للريلز والمسودات على مدار أيام الشهر الجاري.</p>
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  onClick={handlePrevMonth}
                  className="p-1 px-2 bg-[#121212] hover:bg-[#222] border border-white/5 rounded-lg text-gray-400 hover:text-white cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <span className="text-xs font-black text-white px-2">
                  {arabicMonthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
                </span>
                <button
                  onClick={handleNextMonth}
                  className="p-1 px-2 bg-[#121212] hover:bg-[#222] border border-white/5 rounded-lg text-gray-400 hover:text-white cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Calendar grid headers */}
            <div className="grid grid-cols-7 gap-1 text-center font-bold text-[9px] text-[#fd1d1d] border-b border-white/5 pb-2">
              <div>الأحد</div>
              <div>الأثنين</div>
              <div>الثلاثاء</div>
              <div>الأربعاء</div>
              <div>الخميس</div>
              <div>الجمعة</div>
              <div>السبت</div>
            </div>

            {/* Days generator */}
            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map((day, idx) => {
                const isCurrentMonth = day.getMonth() === currentDate.getMonth();
                const isToday = day.toDateString() === new Date().toDateString();
                const dayPosts = getPostEventsForDay(day);

                return (
                  <div
                    key={idx}
                    className={`min-h-[64px] border border-[#141414] rounded-xl p-1 text-right flex flex-col justify-between transition-all ${
                      isCurrentMonth ? "bg-[#0c0c0c]" : "bg-[#060606] opacity-35"
                    } ${isToday ? "border-[#fd1d1d]/40 ring-1 ring-[#fd1d1d]/25 bg-[#fd1d1d]/2" : ""}`}
                  >
                    <span className={`text-[9px] font-extrabold ${isToday ? "text-[#fd1d1d]" : "text-gray-500"}`}>
                      {day.getDate()}
                    </span>

                    {/* render posts allocated to this day */}
                    <div className="space-y-1 overflow-hidden max-h-[44px]">
                      {dayPosts.slice(0, 2).map((post) => (
                        <div
                          key={post.id}
                          onClick={() => handleOpenEdit(post)}
                          className={`text-[8px] font-bold p-0.5 rounded truncate select-none hover:opacity-80 transition cursor-pointer ${
                            post.status === "published"
                              ? "bg-red-500/10 text-[#fd1d1d] border border-red-500/10"
                              : post.status === "failed"
                              ? "bg-pink-500/10 text-pink-400 border border-pink-500/10"
                              : "bg-sky-500/10 text-sky-400 border border-sky-500/10"
                          }`}
                          title={`[${post.status}] ${post.title}`}
                        >
                          🎬 {post.title}
                        </div>
                      ))}
                      {dayPosts.length > 2 && (
                        <span className="text-[7px] text-gray-600 block text-center font-bold">
                          +{dayPosts.length - 2} مقاطع أخرى
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Connected Queue elements */}
          <div className="bg-[#0a0a0a] border border-[#161616] rounded-[36px] p-6 lg:p-7 space-y-4">
            <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
              <div>
                <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#fd1d1d]" />
                  <span>طابور النشر الحالي وقائمة المهام</span>
                </h3>
                <p className="text-[10px] text-gray-550">المنشورات القادمة المسجلة والمسودات قبل الإطلاق.</p>
              </div>

              {/* Status selectors filter */}
              <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
                <select
                  value={queueStatusFilter}
                  onChange={(e) => setQueueStatusFilter(e.target.value)}
                  className="bg-[#121212] border border-[#222] rounded-xl px-2.5 py-1.5 text-[10px] text-gray-300 focus:outline-none"
                >
                  <option value="all">كل الحالات</option>
                  <option value="scheduled">المجدول Scheduled</option>
                  <option value="draft">المسودات Draft</option>
                  <option value="processing">جاري النشر Processing</option>
                  <option value="failed">الفاشل Failed</option>
                </select>
              </div>
            </div>

            {/* List entries */}
            <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
              {filteredQueue.filter(p => p.status !== "published").length === 0 ? (
                <p className="text-center text-xs text-gray-550 py-10 font-bold">لا يوجد منشورات قادمة مطابقة للفلاتر النشطة.</p>
              ) : (
                filteredQueue.filter(p => p.status !== "published").map((post) => (
                  <div
                    key={post.id}
                    className="bg-[#121212]/40 border border-[#222] rounded-2xl p-4.5 space-y-3.5 relative overflow-hidden group"
                  >
                    <div className="flex items-start justify-between flex-wrap gap-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-extrabold text-white leading-tight">{post.title}</span>
                          <span className={`text-[8px] font-bold px-2 py-0.5 rounded-full ${
                            post.status === "scheduled" ? "bg-sky-500/15 text-sky-450 border border-sky-500/10" :
                            post.status === "processing" || post.status === "publishing" ? "bg-amber-500/15 text-amber-400 border border-amber-500/10 animate-pulse" :
                            post.status === "failed" ? "bg-red-500/15 text-red-400 border border-red-500/10" :
                            "bg-white/5 text-gray-400 border border-white/5"
                          }`}>
                            {post.status === "scheduled" ? "مجدول للنشر" :
                             post.status === "processing" || post.status === "publishing" ? "جاري معالجة النشر..." :
                             post.status === "failed" ? "عطل أثناء النشر" : "مسودة خطة"}
                          </span>
                        </div>
                        <p className="text-[10px] text-gray-400 font-light line-clamp-2 leading-relaxed max-w-[420px]">{post.caption}</p>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => handleOpenEdit(post)}
                          className="p-1 px-2.5 bg-white/5 hover:bg-white/10 rounded-lg text-gray-300 hover:text-white text-[10px] font-bold transition cursor-pointer"
                          title="تعديل المنشور ووقت النشر"
                        >
                          تعديل
                        </button>
                        <button
                          onClick={() => handleDuplicatePlan(post.id)}
                          className="p-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-gray-300 hover:text-white transition cursor-pointer"
                          title="طرح خطة مكررة للغد"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => handleCancelPost(post.id)}
                          className="p-1.5 bg-red-500/5 hover:bg-red-500 hover:text-white rounded-lg text-red-400 transition cursor-pointer"
                          title="إلغاء وحذف كلي"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2.5 pt-3 border-t border-white/2 text-[9px] text-gray-500 font-mono">
                      <div className="flex items-center gap-2">
                        <span className="flex items-center gap-1 text-sky-400">
                          <Calendar className="w-3 h-3" />
                          <span>تاريخ الجدولة: {new Date(post.scheduledTime).toLocaleDateString("ar-EG")} ({new Date(post.scheduledTime).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })})</span>
                        </span>
                        <span className="bg-[#fd1d1d]/5 text-[#fd1d1d] px-1.5 py-0.5 rounded uppercase">
                          {post.contentType}
                        </span>
                      </div>

                      {post.status === "failed" ? (
                        <button
                          onClick={() => handleRetryFailedPost(post.id)}
                          className="text-[#fd1d1d] font-bold hover:underline block flex items-center gap-1 cursor-pointer"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>إعادة المحاولة الفورية الفورية</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => handlePublishImmediately(post.id)}
                          className="text-emerald-400 font-bold hover:underline block flex items-center gap-1 cursor-pointer"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>تحفيز وجلب النشر الآن ⚡</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>
      </div>

      {/* SECTION 4: SMART HASHTAGS ASSISTANT & CAPTION REUSE */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Recommended hashtags */}
        <div className="lg:col-span-4 bg-[#0a0a0a] border border-[#161616] rounded-[36px] p-6 space-y-4 max-h-[440px] overflow-y-auto">
          <div>
            <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
              <Tag className="w-4 h-4 text-[#fd1d1d]" />
              <span>مساعد وماركر الهاشتاجات الذكية</span>
            </h3>
            <p className="text-[10px] text-gray-550">تراص الهاشتاجات الأكثر تفاعلاً بحسب تصنيف المحتوى المسجل تاريخياً.</p>
          </div>

          <div className="space-y-4 pt-2">
            <div>
              <span className="text-[10px] font-extrabold text-[#fd1d1d] block mb-2">الأكثر استخداماً (نظام التكرار والمزامنة):</span>
              <div className="flex flex-wrap gap-2">
                {hashtags.slice(0, 6).map((h) => (
                  <button
                    key={h.tag}
                    onClick={() => {
                      if (!selectedTags.includes(h.tag)) {
                        setSelectedTags((p) => [...p, h.tag]);
                      }
                    }}
                    className="text-[10px] font-bold px-2.5 py-1 rounded-xl bg-[#121212] hover:bg-[#fd1d1d] text-gray-300 hover:text-white border border-[#222] transition-colors flex items-center gap-1.5 cursor-pointer"
                    title="اضغط للإضافة الفورية إلى مسودة المنشور"
                  >
                    <span>#{h.tag}</span>
                    <span className="text-[8px] bg-white/5 text-gray-500 px-1 rounded">{h.count} منشور</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <span className="text-[10px] font-extrabold text-[#fcb045] block mb-2">الهاشتاجات المقترحة (التريند السعودي):</span>
              <div className="flex flex-wrap gap-2">
                {["رؤية_المملكة_2030", "الرياض_الآن", "تقنية_المستقبل", "ريلز_سعودي", "بدون_حقوق", "صناعة_المحتوى"].map((tag) => (
                  <button
                    key={tag}
                    onClick={() => {
                      if (!selectedTags.includes(tag)) {
                        setSelectedTags((p) => [...p, tag]);
                      }
                    }}
                    className="text-[10px] font-bold px-2.5 py-1 rounded-xl bg-orange-500/5 hover:bg-orange-500 text-orange-450 hover:text-white border border-orange-500/10 transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <span>#{tag}</span>
                    <span className="text-[8px] text-orange-400">★ مقترح</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Caption template library (8 grids) */}
        <div className="lg:col-span-8 bg-[#0a0a0a] border border-[#161616] rounded-[36px] p-6 lg:p-7 space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-white/5 pb-4">
            <div>
              <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#fd1d1d]" />
                <span>مستودع وقوالب الكابشن الجاهزة</span>
              </h3>
              <p className="text-[10px] text-gray-500">احفظ نصوصك المتكررة والترحيبية والهاشتاجات لاستيرادها بنقرة واحدة.</p>
            </div>

            {/* Template Directory list inline accordion */}
            <div className="flex-1 w-full max-w-sm">
              <form onSubmit={handleCreateTemplate} className="flex gap-2">
                <div className="flex-1 flex flex-col gap-1.5">
                  <input
                    type="text"
                    value={newCapTitle}
                    onChange={(e) => setNewCapTitle(e.target.value)}
                    placeholder="اسم القالب (مثال: نهاية المقطع)"
                    className="bg-[#121212] border border-[#222] rounded-xl px-2.5 py-1 text-[10px] text-white focus:outline-none"
                  />
                  <input
                    type="text"
                    value={newCapText}
                    onChange={(e) => setNewCapText(e.target.value)}
                    placeholder="محتوى ووصف الكابشن..."
                    className="bg-[#121212] border border-[#222] rounded-xl px-2.5 py-1 text-[10px] text-white focus:outline-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={savingTemplate}
                  className="px-3 bg-[#fd1d1d] text-white rounded-xl text-[10px] font-bold self-end py-2 flex items-center gap-1 hover:bg-[#fcb045] transition shrink-0 cursor-pointer"
                >
                  {savingTemplate ? "جاري الحفظ..." : "حفظ جديد"}
                </button>
              </form>
            </div>
          </div>

          {/* Render Templates Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[300px] overflow-y-auto">
            {templates.length === 0 ? (
              <p className="col-span-full text-center text-xs text-gray-500 py-6">لا يوجد قوالب كابشن مسجلة حالياً.</p>
            ) : (
              templates.map((temp) => (
                <div
                  key={temp.id}
                  onClick={() => handleApplyTemplate(temp)}
                  className="bg-[#121212]/50 hover:bg-[#121212] border border-[#222] hover:border-[#333] p-4 rounded-2xl text-right transition-all cursor-pointer relative group flex flex-col justify-between h-40"
                  title="انقر للاستيراد وتعبئة Composer الفورية"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold text-white group-hover:text-[#fd1d1d] transition-colors">{temp.title}</span>
                      <button
                        onClick={(e) => handleDeleteTemplate(temp.id, e)}
                        className="p-1 opacity-0 group-hover:opacity-100 text-gray-550 hover:text-red-400 rounded transition cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <p className="text-[10px] text-gray-450 line-clamp-3 leading-relaxed font-light">{temp.text}</p>
                  </div>

                  <div className="flex flex-wrap gap-1 pt-2 border-t border-white/2">
                    {temp.tags && temp.tags.map(t => (
                      <span key={t} className="text-[8px] bg-red-500/5 text-[#fd1d1d] px-1.5 py-0.2 rounded">
                        #{t}
                      </span>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* SECTION 5: PUBLISHED ARCHIVE TIMELINE & LIVE METRIC TRACKER */}
      <div className="bg-[#0a0a0a] border border-[#161616] rounded-[36px] p-6 lg:p-8 space-y-6">
        <div>
          <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
            <History className="w-4 h-4 text-[#fd1d1d]" />
            <span>أرشيف وسجل كشوفات النشر (سجل التاريخ)</span>
          </h3>
          <p className="text-[10px] text-gray-500 mt-1">
            كافة المقاطع التي تم إطلاقها تلقائياً على إنستغرام مع أرشفة معرفات الميديا وروابط التضمين والتحليلات المتزامنة.
          </p>
        </div>

        {publishedHistory.length === 0 ? (
          <div className="border border-[#1a1a1a] p-10 text-center rounded-[24px] text-xs text-gray-500">
            لم يتم ترحيل أو نشر أي مقاطع حتى الآن. فور نضوج عداد مهام الجدولة، سيظهر سجل التاريخ هنا تلقائياً.
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-h-[500px] overflow-y-auto">
            {publishedHistory.map((post) => (
              <div
                key={post.id}
                className="bg-[#121212]/30 border border-[#222] hover:border-[#333] transition-all p-5 rounded-[24px] flex flex-col justify-between space-y-4"
              >
                <div className="flex justify-between items-start gap-4">
                  <div className="space-y-1">
                    <span className="text-xs font-extrabold text-white block">{post.title}</span>
                    <p className="text-[10px] text-gray-450 leading-relaxed font-light">{post.caption}</p>
                  </div>

                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className="text-[8px] font-bold px-2 py-0.5 rounded bg-red-400/5 text-[#fd1d1d] border border-red-500/10">
                      منشور بنجاح ✅
                    </span>
                    <span className="text-[8px] text-gray-500 mt-1 font-mono">ID: {post.instagramMediaId}</span>
                  </div>
                </div>

                {/* Simulated live analytics counters dashboard */}
                {post.analytics && (
                  <div className="bg-[#121212]/50 rounded-xl px-4 py-2.5 grid grid-cols-5 gap-2 text-center text-[9px] font-bold border border-white/2">
                    <div className="space-y-1 text-gray-300">
                      <div className="flex items-center justify-center gap-1">
                        <Eye className="w-3.5 h-3.5 text-sky-400" />
                        <span>مشاهدة</span>
                      </div>
                      <span className="block text-xs font-black font-mono text-white">
                        {post.analytics.views?.toLocaleString("ar-EG") || "0"}
                      </span>
                    </div>

                    <div className="space-y-1 text-gray-300 border-r border-[#1a1a1a]">
                      <div className="flex items-center justify-center gap-1">
                        <Heart className="w-3.5 h-3.5 text-[#fd1d1d]" />
                        <span>إعجاب</span>
                      </div>
                      <span className="block text-xs font-black font-mono text-white">
                        {post.analytics.likes?.toLocaleString("ar-EG") || "0"}
                      </span>
                    </div>

                    <div className="space-y-1 text-gray-300 border-r border-[#1a1a1a]">
                      <div className="flex items-center justify-center gap-1">
                        <MessageSquare className="w-3.5 h-3.5 text-[#fcb045]" />
                        <span>تعليق</span>
                      </div>
                      <span className="block text-xs font-black font-mono text-white">
                        {post.analytics.comments?.toLocaleString("ar-EG") || "0"}
                      </span>
                    </div>

                    <div className="space-y-1 text-gray-300 border-r border-[#1a1a1a]">
                      <div className="flex items-center justify-center gap-1">
                        <Share2 className="w-3.5 h-3.5 text-purple-400" />
                        <span>مشاركة</span>
                      </div>
                      <span className="block text-xs font-black font-mono text-white">
                        {post.analytics.shares?.toLocaleString("ar-EG") || "0"}
                      </span>
                    </div>

                    <div className="space-y-1 text-gray-300 border-r border-[#1a1a1a]">
                      <div className="flex items-center justify-center gap-1">
                        <Bookmark className="w-3.5 h-3.5 text-emerald-400" />
                        <span>حفظ</span>
                      </div>
                      <span className="block text-xs font-black font-mono text-white">
                        {post.analytics.saves?.toLocaleString("ar-EG") || "0"}
                      </span>
                    </div>
                  </div>
                )}

                {/* Subfooter archive timeline */}
                <div className="flex items-center justify-between pt-3 border-t border-white/2 text-[9px] text-gray-550 font-mono">
                  <div className="flex items-center gap-2">
                    <span>تاريخ النشر بالأرشيف:</span>
                    <span className="text-gray-300 font-bold">
                      {new Date(post.publishedAt || "").toLocaleDateString("ar-EG")}{" "}
                      {new Date(post.publishedAt || "").toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>

                  <div className="flex items-center gap-2.5">
                    {post.versions && post.versions.length > 0 && (
                      <button
                        onClick={() => setViewingVersionHistoryPost(post)}
                        className="text-gray-450 hover:text-white flex items-center gap-1 cursor-pointer"
                        title="عرض مسار تدقيق وتعديل النصوص التاريخية للمنشور"
                      >
                        <History className="w-3 h-3" />
                        <span>المراجعات ({post.versions.length})</span>
                      </button>
                    )}

                    <a
                      href={post.instagramUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#fd1d1d] hover:text-[#fcb045] font-black flex items-center gap-1"
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span>رابط إنستغرام التلقائي 🔗</span>
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* MODAL WINDOWS & WARNINGS */}

      {/* 1. DUPLICATE PROTECTION WARNING POPUP (REQUIRED MANDATE) */}
      {duplicateWarning && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center p-4 z-55 backdrop-blur-sm">
          <div className="bg-[#0b0b0b] border border-[#222] rounded-[36px] w-full max-w-lg p-7 text-right space-y-6 relative animate-zoom-in">
            <div className="flex items-center gap-3 border-b border-[#222] pb-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500 shrink-0">
                <AlertTriangle className="w-6 h-6 animate-bounce" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-extrabold text-white">كاشف تكرار وحماية الملكية 🛡️</h3>
                <span className="text-[10px] text-amber-400 font-bold block">تنبيه حماية خوارزميات النشر الفوري لإنستغرام</span>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-xs text-red-400 font-bold">
                "تم اكتشاف أن هذا المحتوى يبدو أنه قد تم نشره من قبل!"
              </p>
              <p className="text-[11px] text-gray-400 leading-relaxed font-light">
                تنص خوارزميات إنستغرام لعام 2026 على عقاب الحسابات التي تعيد رفع مواد مكررة بنفس العناوين أو نصوص الكابشن تماماً. يرجى مراجعة مؤشرات التكرار أدناه:
              </p>

              <div className="space-y-2 max-h-32 overflow-y-auto">
                {duplicateWarning.matches.map((match, idx) => (
                  <div key={idx} className="p-2 bg-white/3 rounded-xl border border-white/5 text-[10px] space-y-0.5 text-gray-300 font-light leading-relaxed">
                    <span className="font-extrabold text-[#fd1d1d]">
                      [تطابق في {match.type === "title" ? "العنوان" : "الكابشن Shorthand"}] ({match.score}%):
                    </span>
                    <p>{match.message} (العنوان المتطابق: "{match.matchedTitle}")</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-3 justify-end pt-4 border-t border-white/5">
              <button
                onClick={() => setDuplicateWarning(null)}
                className="px-4 py-2 text-xs font-bold text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition cursor-pointer"
              >
                إلغاء وتعديل المنشور
              </button>
              
              <button
                onClick={() => {
                  if (duplicateWarning.payloadToRetry) {
                    handleQueueSubmission(
                      { preventDefault: () => {} } as any,
                      true // Pass bypassDuplicate: true to force save layout
                    );
                  }
                }}
                className="px-5 py-2 text-xs font-extrabold text-white bg-amber-500 hover:bg-amber-600 rounded-xl transition shadow-lg shadow-amber-500/10 cursor-pointer"
              >
                تخطي التنبيه وتأكيد المتابعة على أية حال
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. CHROMA EDIT ACTIVE SCHEDULE POST */}
      {editingPost && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center p-4 z-55 backdrop-blur-sm">
          <div className="bg-[#0b0b0b] border border-[#222] rounded-[36px] w-full max-w-lg p-6 text-right space-y-5 animate-zoom-in">
            <div className="flex items-center justify-between border-b border-[#222] pb-3">
              <div>
                <h3 className="text-xs font-black text-white">تعديل كراسة النشر المجدول</h3>
                <p className="text-[9px] text-gray-500 mt-0.5">تعديل الشروحات أو تغيير توقيت إطلاق المقطع.</p>
              </div>
              <button
                onClick={() => setEditingPost(null)}
                className="text-gray-500 hover:text-white"
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-gray-400">العنوان:</span>
                <span className="block text-xs font-black text-white px-2 mt-0.5">{editingPost.title}</span>
              </div>

              <div className="space-y-1.5">
                <span className="text-[10px] font-bold text-gray-400">تعديل الشرح (الكابشن):</span>
                <textarea
                  value={editCaption}
                  onChange={(e) => setEditCaption(e.target.value)}
                  rows={4}
                  className="w-full bg-[#121212] border border-[#222] rounded-xl px-3 py-2 text-xs text-white focus:outline-none resize-none leading-relaxed"
                ></textarea>
              </div>

              <div className="space-y-1.5 animate-fade-in">
                <span className="text-[10px] font-bold text-gray-400">تعديل التاريخ والوقت (تنسيق الآليات):</span>
                <input
                  type="datetime-local"
                  value={editTime}
                  onChange={(e) => setEditTime(e.target.value)}
                  className="w-full bg-[#121212] border border-[#222] rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-[#222]">
              <button
                onClick={() => setEditingPost(null)}
                className="px-4 py-2 text-[10px] font-bold text-gray-400 hover:text-white bg-white/5 rounded-lg"
              >
                إلغاء التعديل
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={savingEdit}
                className="px-5 py-2 text-[10px] font-black text-white bg-[#fd1d1d] hover:bg-[#fcb045] rounded-lg transition"
              >
                {savingEdit ? "جاري الحفظ..." : "حفظ التحديث والجدولة"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. SHOW VERSIONS HISTORY AUDIT LOGS */}
      {viewingVersionHistoryPost && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center p-4 z-55 backdrop-blur-sm">
          <div className="bg-[#0b0b0b] border border-[#222] rounded-[36px] w-full max-w-lg p-6 text-right space-y-4 animate-zoom-in">
            <div className="flex items-center justify-between border-b border-[#222] pb-3">
              <div>
                <h3 className="text-xs font-black text-white">مسار مراجعة وتعديل نصوص الأرشيف</h3>
                <p className="text-[9px] text-gray-550 mt-0.5">تطابق ومقارنة التعديلات التاريخية لكابشن المنشور.</p>
              </div>
              <button
                onClick={() => setViewingVersionHistoryPost(null)}
                className="p-1 text-gray-500 hover:text-white cursor-pointer"
              >
                🗙
              </button>
            </div>

            <div className="space-y-3.5 max-h-80 overflow-y-auto pr-1">
              {viewingVersionHistoryPost.versions && viewingVersionHistoryPost.versions.map((v, idx) => (
                <div key={idx} className="p-3 bg-[#121212]/50 border border-[#222] rounded-xl space-y-2">
                  <div className="flex justify-between items-center text-[8px] font-mono text-gray-500">
                    <span className="font-bold">الإصدار رقم {idx + 1}</span>
                    <span>{new Date(v.timestamp).toLocaleString("ar-EG")}</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-gray-400 block font-bold">العنوان: {v.title}</span>
                    <p className="text-[10px] text-gray-300 font-light leading-relaxed mt-1">{v.caption}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-3 border-t border-[#222] flex justify-end">
              <button
                onClick={() => setViewingVersionHistoryPost(null)}
                className="px-4 py-1.5 text-[10px] font-bold text-gray-300 bg-white/5 hover:bg-white/10 rounded-lg cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

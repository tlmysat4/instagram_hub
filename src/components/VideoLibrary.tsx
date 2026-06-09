import React, { useState, FormEvent, useRef } from "react";
import { Video } from "../types";
import { Search, Filter, ExternalLink, Trash2, Edit3, Film, Hash, AlertTriangle, Eye, ThumbsUp, MessageSquare, Tag, Calendar, X, Save, Paperclip, Upload, Loader2 } from "lucide-react";
import { supabaseService } from "../lib/supabase";

interface VideoLibraryProps {
  videos: Video[];
  onVideoDeleted: (id: string) => void;
  onVideoUpdated: (video: Video) => void;
}

export default function VideoLibrary({ videos, onVideoDeleted, onVideoUpdated }: VideoLibraryProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedTagFilter, setSelectedTagFilter] = useState<string>("all");
  
  // Video player preview overlay
  const [playingVideo, setPlayingVideo] = useState<Video | null>(null);

  // Edit State
  const [editingVideo, setEditingVideo] = useState<Video | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editUrl, setEditUrl] = useState("");
  const [editTags, setEditTags] = useState("");
  const [editStatus, setEditStatus] = useState<"draft" | "ready" | "published">("draft");
  const [editPublishDate, setEditPublishDate] = useState("");
  const [editDuration, setEditDuration] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editViews, setEditViews] = useState(0);
  const [editLikes, setEditLikes] = useState(0);
  const [editComments, setEditComments] = useState(0);
  const [editError, setEditError] = useState("");
  const [saving, setSaving] = useState(false);

  // Edit Video file attachment upload states
  const [editAttachedVideoUrl, setEditAttachedVideoUrl] = useState("");
  const [editAttachedVideoName, setEditAttachedVideoName] = useState("");
  const [uploadingEditFile, setUploadingEditFile] = useState(false);
  const [uploadEditProgress, setUploadEditProgress] = useState(0);
  const editFileInputRef = useRef<HTMLInputElement>(null);

  // Extract all unique hash tags from all videos for the filter
  const allTagsSet = new Set<string>();
  videos.forEach((v) => {
    if (v.tags) {
      v.tags.forEach((tag) => {
        if (tag.trim()) allTagsSet.add(tag.trim());
      });
    }
  });
  const allUniqueTags = Array.from(allTagsSet);

  // Filter logic
  const filteredVideos = videos.filter((vid) => {
    const matchesSearch =
      vid.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (vid.description && vid.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
      vid.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus = statusFilter === "all" || vid.status === statusFilter;
    const matchesTag = selectedTagFilter === "all" || vid.tags.includes(selectedTagFilter);

    return matchesSearch && matchesStatus && matchesTag;
  });

  // Handle Delete record
  async function handleDelete(id: string) {
    if (!confirm("هل أنت متأكد من رغبتك في حذف هذا الفيديو نهائياً من المكتبة؟ لا يمكن التراجع عن هذا الإجراء.")) {
      return;
    }
    try {
      await supabaseService.deleteVideo(id);
      onVideoDeleted(id);
    } catch (err: any) {
      alert(err.message || "فشل حذف الفيديو من قاعدة البيانات.");
    }
  }

  // Open Edit Form Modal
  function openEditModal(video: Video) {
    setEditingVideo(video);
    setEditTitle(video.title);
    setEditDescription(video.description || "");
    setEditUrl(video.instagramUrl);
    setEditTags(video.tags.join(", "));
    setEditStatus(video.status);
    setEditPublishDate(video.publishDate || "");
    setEditDuration(video.duration || "");
    setEditNotes(video.notes || "");
    setEditViews(video.stats?.views || 0);
    setEditLikes(video.stats?.likes || 0);
    setEditComments(video.stats?.comments || 0);
    setEditAttachedVideoUrl(video.attachedVideoUrl || "");
    setEditAttachedVideoName(video.attachedVideoName || "");
    setEditError("");
  }

  // Handle uploading replacement video within the edit modal
  async function handleEditFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (!file.type.startsWith("video/")) {
        setEditError("يرجى اختيار ملف فيديو صالح فقط.");
        return;
      }

      // Automatically set duration if metadata is readable
      try {
        const videoElement = document.createElement("video");
        videoElement.preload = "metadata";
        videoElement.src = URL.createObjectURL(file);
        videoElement.onloadedmetadata = () => {
          URL.revokeObjectURL(videoElement.src);
          const secs = Math.round(videoElement.duration);
          if (!isNaN(secs) && secs > 0) {
            const minutes = Math.floor(secs / 60);
            const seconds = secs % 60;
            const fmtSecs = seconds < 10 ? `0${seconds}` : seconds;
            setEditDuration(`${minutes}:${fmtSecs}`);
          }
        };
      } catch (err) {
        console.warn(err);
      }

      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64Data = event.target?.result as string;
        if (!base64Data) return;

        try {
          setUploadingEditFile(true);
          setUploadEditProgress(20);
          setEditError("");

          const interval = setInterval(() => {
            setUploadEditProgress((current) => {
              if (current >= 85) {
                clearInterval(interval);
                return 85;
              }
              return current + 10;
            });
          }, 200);

          const response = await fetch("/api/upload", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${localStorage.getItem("ig_hub_token") || ""}`
            },
            body: JSON.stringify({
              filename: file.name,
              fileData: base64Data
            })
          });

          clearInterval(interval);

          if (!response.ok) {
            const dat = await response.json();
            throw new Error(dat.error || "فشل رفع الملف.");
          }

          const data = await response.json();
          setUploadEditProgress(100);
          setEditAttachedVideoUrl(data.videoPath);
          setEditAttachedVideoName(data.filename);
        } catch (err: any) {
          setEditError(err.message || "حدث خطأ أثناء تحميل الملف.");
        } finally {
          setTimeout(() => {
            setUploadingEditFile(false);
            setUploadEditProgress(0);
          }, 400);
        }
      };
      reader.readAsDataURL(file);
    }
  }

  // Save Video changes
  async function handleUpdateSubmit(e: FormEvent) {
    e.preventDefault();
    if (!editingVideo) return;

    if (!editTitle || !editUrl) {
      setEditError("العنوان ورابط الفيديو مطلوبان!");
      return;
    }

    setSaving(true);
    setEditError("");

    try {
      const parsedTags = editTags
        .split(",")
        .map((t) => t.trim().replace(/#/g, ""))
        .filter((t) => t.length > 0);

      const updated = await supabaseService.updateVideo({
        id: editingVideo.id,
        title: editTitle,
        description: editDescription,
        instagramUrl: editUrl,
        tags: parsedTags,
        status: editStatus,
        publishDate: editPublishDate,
        duration: editDuration,
        notes: editNotes,
        stats: {
          views: Number(editViews) || 0,
          likes: Number(editLikes) || 0,
          comments: Number(editComments) || 0,
        },
        attachedVideoUrl: editAttachedVideoUrl || undefined,
        attachedVideoName: editAttachedVideoName || undefined,
        createdAt: editingVideo.createdAt
      });

      onVideoUpdated(updated);
      setEditingVideo(null); // Close modal
    } catch (err: any) {
      setEditError(err.message || "فشل تحديث البيانات.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6" id="video-library-tab">
      {/* Page Header */}
      <div>
        <h2 className="text-2xl font-bold text-white tracking-tight">مكتبة فيديوهات إنستغرام</h2>
        <p className="text-slate-400 text-sm mt-1">تصفح، ابحث، فلتر الفيديوهات المسجلة وامنع نشر المحتوى المتكرر للمحطات</p>
      </div>

      {/* Advanced Filter and Search Bar */}
      <div className="bg-[#0d0d0d] border border-[#1a1a1a] p-4 rounded-3xl space-y-4" id="library-filters">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          {/* Quick Search */}
          <div className="relative md:col-span-6">
            <span className="absolute inset-y-0 right-0 p-3 flex items-center text-gray-500">
              <Search className="w-4 h-4" />
            </span>
            <input
              id="library-search-input"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث بالعنوان، الشرح، أو الوسم..."
              className="w-full bg-[#121212] border border-[#222] focus:border-[#fd1d1d] rounded-xl py-2.5 pr-10 pl-4 text-xs text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-[#fd1d1d]"
            />
          </div>

          {/* Status filter selection */}
          <div className="relative md:col-span-3">
            <div className="relative">
              <span className="absolute inset-y-0 right-0 p-3 flex items-center text-gray-500 pointer-events-none">
                <Filter className="w-3.5 h-3.5" />
              </span>
              <select
                id="library-status-filter"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full bg-[#121212] border border-[#222] focus:border-[#fd1d1d] rounded-xl py-2.5 pr-9 pl-4 text-xs text-white appearance-none focus:outline-none"
              >
                <option value="all">كل الحالات</option>
                <option value="draft">مسودة محتوى</option>
                <option value="ready">جاهز للنشر</option>
                <option value="published">تم النشر بالفعل</option>
              </select>
            </div>
          </div>

          {/* Tag filter selection */}
          <div className="relative md:col-span-3">
            <div className="relative">
              <span className="absolute inset-y-0 right-0 p-3 flex items-center text-gray-500 pointer-events-none">
                <Tag className="w-3.5 h-3.5" />
              </span>
              <select
                id="library-tag-filter"
                value={selectedTagFilter}
                onChange={(e) => setSelectedTagFilter(e.target.value)}
                className="w-full bg-[#121212] border border-[#222] focus:border-[#fd1d1d] rounded-xl py-2.5 pr-9 pl-4 text-xs text-white appearance-none focus:outline-none"
              >
                <option value="all">كل الوسوم المطلقة</option>
                {allUniqueTags.map((tag) => (
                  <option key={tag} value={tag}>
                    #{tag}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid View */}
      {videos.length === 0 ? (
        /* Empty database case */
        <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-3xl p-16 text-center" id="empty-library-state">
          <div className="inline-flex items-center justify-center p-4 bg-[#121212] rounded-2xl mb-4 text-[#fd1d1d]">
            <Film className="w-12 h-12" />
          </div>
          <h3 className="text-lg font-bold text-white">No Data Available</h3>
          <p className="text-gray-400 text-sm mt-2 max-w-sm mx-auto leading-relaxed">
            لا توجد فيديوهات مسجلة في قاعدة البيانات حالياً. يرجى التوجه لعلامة تبويب "إضافة فيديو" للبدء بالبناء والأرشفة.
          </p>
        </div>
      ) : filteredVideos.length === 0 ? (
        /* No results case */
        <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-3xl p-12 text-center">
          <div className="inline-flex items-center justify-center p-3 bg-red-500/5 border border-red-500/10 rounded-xl mb-4 text-red-400">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h3 className="text-md font-bold text-white">لم يتم العثور على نتائج</h3>
          <p className="text-gray-500 text-xs mt-1">تأكد من مطابقة شروط البحث والفلترة التي حددتها.</p>
        </div>
      ) : (
        /* Content rendering */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6" id="video-grid">
          {filteredVideos.map((vid) => (
            <div
              key={vid.id}
              className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-[32px] hover:border-white/10 hover:shadow-2xl transition-all duration-300 flex flex-col justify-between overflow-hidden group"
              id={`video-card-${vid.id}`}
            >
              {/* Card Upper Body */}
              <div className="p-5 space-y-4">
                {/* Meta details header */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {/* Publishing Status badge */}
                    {vid.status === "published" ? (
                      <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-red-500/5 text-[#fd1d1d] border border-red-500/10">
                        تم النشر
                      </span>
                    ) : vid.status === "ready" ? (
                      <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20">
                        جاهز للنشر
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-white/5 text-gray-400 border border-white/10">
                        مسودة محتوى
                      </span>
                    )}

                    {vid.attachedVideoUrl && (
                      <span 
                        onClick={() => setPlayingVideo(vid)}
                        className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-500/10 text-[#fd1d1d] border border-[#fd1d1d]/20 flex items-center gap-1 cursor-pointer hover:bg-[#fd1d1d] hover:text-white transition-all shrink-0 select-none"
                        title="المقطع مرفق - اضغط للتشغيل الفوري"
                      >
                        <Film className="w-3 h-3" />
                        <span>مشاهدة المرفق 🎬</span>
                      </span>
                    )}
                  </div>

                  {/* Video Duration */}
                  {vid.duration && (
                    <span className="text-[10px] font-mono font-medium text-gray-500 bg-[#121212] border border-[#222] px-2 py-0.5 rounded">
                      مدة: {vid.duration}
                    </span>
                  )}
                </div>

                {/* Primary Card Title */}
                <div>
                  <h4 className="font-bold text-white leading-snug group-hover:text-[#fd1d1d] transition-colors text-base break-words">
                    {vid.title}
                  </h4>
                  <span className="text-[10px] text-gray-600 font-mono block mt-1">
                    المُعرّف: {vid.id}
                  </span>
                </div>

                {/* Description Text */}
                {vid.description ? (
                  <p className="text-xs text-gray-405 leading-relaxed break-words whitespace-pre-wrap text-gray-400 line-clamp-3">
                    {vid.description}
                  </p>
                ) : (
                  <p className="text-xs text-gray-600 italic">بدون وصف تفصيلي...</p>
                )}

                {/* Video tags */}
                {vid.tags && vid.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {vid.tags.map((tag) => (
                      <span
                        key={tag}
                        onClick={() => setSearchQuery(tag)}
                        className="inline-flex items-center gap-0.5 text-[10px] bg-[#121212] hover:bg-white/5 text-gray-400 hover:text-white px-2 py-0.5 rounded-lg font-medium cursor-pointer transition-colors border border-[#222]"
                        dir="ltr"
                      >
                        <Hash className="w-2.5 h-2.5 text-[#fd1d1d]" />
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* Personal Notes */}
                {vid.notes && (
                  <div className="bg-[#121212] border border-[#1a1a1a] p-3 rounded-2xl text-xs leading-relaxed text-gray-400">
                    <span className="font-semibold block text-gray-300 text-[11px] mb-1">ملاحظات مضافة:</span>
                    <span className="break-words font-light">{vid.notes}</span>
                  </div>
                )}
              </div>

              {/* Real Statistics Display (if entered/published) */}
              <div className="px-5 py-3 bg-[#121212]/50 border-t border-b border-[#1a1a1a] flex items-center justify-around text-xs text-gray-400 font-mono">
                <div className="flex items-center gap-1.5" title="مشاهدات">
                  <Eye className="w-3.5 h-3.5 text-gray-600" />
                  <span>{vid.stats?.views || 0}</span>
                </div>
                <div className="flex items-center gap-1.5" title="إعجابات">
                  <ThumbsUp className="w-3.5 h-3.5 text-gray-600" />
                  <span>{vid.stats?.likes || 0}</span>
                </div>
                <div className="flex items-center gap-1.5" title="تعليقات">
                  <MessageSquare className="w-3.5 h-3.5 text-gray-600" />
                  <span>{vid.stats?.comments || 0}</span>
                </div>
              </div>

              {/* Action Buttons Panel */}
              <div className="bg-[#121212]/80 px-5 py-3.5 flex items-center justify-between border-t border-[#1a1a1a] gap-2">
                <div className="flex items-center gap-2">
                  {/* External Instagram Anchor Link */}
                  <a
                    href={vid.instagramUrl}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="flex items-center gap-1.5 text-xs text-[#fd1d1d] hover:text-[#fcb045] font-bold shrink-0 transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>فتح في إنستغرام</span>
                  </a>

                  {vid.attachedVideoUrl && (
                    <button
                      onClick={() => setPlayingVideo(vid)}
                      className="flex items-center gap-1 bg-[#fd1d1d]/10 hover:bg-[#fd1d1d] text-[#fd1d1d] hover:text-white text-[10px] font-bold px-2 py-1.5 rounded-xl border border-[#fd1d1d]/20 transition-all cursor-pointer"
                      title="مشاهدة ملف الفيديو الأصلي المرفق بالمكتبة"
                    >
                      <Eye className="w-3 h-3" />
                      <span>عرض المرفق</span>
                    </button>
                  )}
                </div>

                {/* Library administrative tools */}
                <div className="flex items-center gap-1">
                  {/* Edit metadata */}
                  <button
                    onClick={() => openEditModal(vid)}
                    className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-all cursor-pointer"
                    title="تعديل الفيديو"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>

                  {/* Delete video */}
                  <button
                    onClick={() => handleDelete(vid.id)}
                    className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all cursor-pointer"
                    title="حذف الفيديو"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Inline Modal Edit Form */}
      {editingVideo && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center p-4 z-50 overflow-y-auto backdrop-blur-md" id="edit-video-modal">
          <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-[40px] w-full max-w-2xl p-6 md:p-8 space-y-6 shadow-2xl relative my-8">
            {/* Modal Closer Header */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-white">تعديل بيانات الفيديو وأرشفته</h3>
                <p className="text-xs text-gray-500 mt-1">تحديث تفاصيل الرابط، الوسوم والأرقام الإحصائية الحقيقية</p>
              </div>
              <button
                onClick={() => setEditingVideo(null)}
                className="p-1.5 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Error in modal */}
            {editError && (
              <div className="bg-rose-500/5 border border-rose-500/10 text-rose-400 rounded-2xl px-4 py-3 text-xs text-right flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{editError}</span>
              </div>
            )}

            {/* Edit fields form */}
            <form onSubmit={handleUpdateSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Title */}
                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1.5">عنوان الفيديو</label>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full bg-[#121212] border border-[#222] focus:border-[#fd1d1d] rounded-xl py-2.5 px-4 text-xs text-white focus:outline-none"
                    required
                  />
                </div>

                {/* Instagram URL */}
                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1.5">رابط إنستغرام (Instagram URL)</label>
                  <input
                    type="url"
                    value={editUrl}
                    onChange={(e) => setEditUrl(e.target.value)}
                    className="w-full bg-[#121212] border border-[#222] focus:border-[#fd1d1d] rounded-xl py-2.5 px-4 text-xs text-white focus:outline-none"
                    required
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1.5">شرح الفيديو أو التعليق (Caption)</label>
                <textarea
                  rows={3}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full bg-[#121212] border border-[#222] focus:border-[#fd1d1d] rounded-xl py-2.5 px-4 text-xs text-white focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Tags (comma separated) */}
                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1.5">الوسوم (مفصولة بفاصلة)</label>
                  <input
                    type="text"
                    value={editTags}
                    onChange={(e) => setEditTags(e.target.value)}
                    placeholder="تقنية, لايف_ستايل, رمضان"
                    className="w-full bg-[#121212] border border-[#222] focus:border-[#fd1d1d] rounded-xl py-2.5 px-4 text-xs text-white focus:outline-none"
                  />
                </div>

                {/* Status selection */}
                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1.5">حالة النشر</label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as any)}
                    className="w-full bg-[#121212] border border-[#222] focus:border-[#fd1d1d] rounded-xl py-2.5 px-4 text-xs text-white focus:outline-none"
                  >
                    <option value="draft">مسودة</option>
                    <option value="ready">جاهز للنشر</option>
                    <option value="published">تم النشر</option>
                  </select>
                </div>

                {/* Duration */}
                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1.5">مدة المقطع (مثال: 0:45)</label>
                  <input
                    type="text"
                    value={editDuration}
                    onChange={(e) => setEditDuration(e.target.value)}
                    className="w-full bg-[#121212] border border-[#222] focus:border-[#fd1d1d] rounded-xl py-2.5 px-4 text-xs text-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Publish Date */}
                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1.5">تاريخ النشر المجدول</label>
                  <input
                    type="datetime-local"
                    value={editPublishDate}
                    onChange={(e) => setEditPublishDate(e.target.value)}
                    className="w-full bg-[#121212] border border-[#222] focus:border-[#fd1d1d] rounded-xl py-2.5 px-4 text-xs text-white focus:outline-none"
                  />
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1.5">ملاحظات ومهام مرافقة</label>
                  <input
                    type="text"
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    className="w-full bg-[#121212] border border-[#222] focus:border-[#fd1d1d] rounded-xl py-2.5 px-4 text-xs text-white focus:outline-none"
                  />
                </div>
              </div>

              {/* Numeric real statistics edits */}
              <div className="bg-[#121212] p-4 rounded-2xl border border-[#222] space-y-3">
                <span className="block text-xs font-bold text-gray-300">إحصاءات أداء الفيديو (أرقام حقيقية):</span>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] text-gray-500 mb-1">المشاهدات</label>
                    <input
                      type="number"
                      min={0}
                      value={editViews}
                      onChange={(e) => setEditViews(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full bg-[#0d0d0d] border border-[#222] focus:border-[#fd1d1d] rounded-lg py-2 px-3 text-xs text-white focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-500 mb-1">الإعجابات</label>
                    <input
                      type="number"
                      min={0}
                      value={editLikes}
                      onChange={(e) => setEditLikes(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full bg-[#0d0d0d] border border-[#222] focus:border-[#fd1d1d] rounded-lg py-2 px-3 text-xs text-white focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-500 mb-1">التعليقات</label>
                    <input
                      type="number"
                      min={0}
                      value={editComments}
                      onChange={(e) => setEditComments(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full bg-[#0d0d0d] border border-[#222] focus:border-[#fd1d1d] rounded-lg py-2 px-3 text-xs text-white focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Attached Video Section inside Edit Modal */}
              <div className="pt-2 space-y-3">
                <label className="block text-xs font-semibold text-gray-400 flex items-center gap-1.5">
                  <Paperclip className="w-3.5 h-3.5 text-[#fd1d1d]" />
                  <span>تعديل ملف الفيديو المرفق</span>
                </label>

                <input
                  type="file"
                  ref={editFileInputRef}
                  onChange={handleEditFileChange}
                  accept="video/*"
                  className="hidden"
                />

                {!editAttachedVideoUrl ? (
                  <div
                    onClick={() => editFileInputRef.current?.click()}
                    className="border-2 border-dashed border-[#222] bg-[#121212]/30 hover:border-[#fd1d1d]/30 hover:bg-[#121212]/50 rounded-[24px] p-6 text-center cursor-pointer transition-all"
                  >
                    {uploadingEditFile ? (
                      <div className="space-y-2 flex flex-col items-center">
                        <Loader2 className="w-6 h-6 text-[#fd1d1d] animate-spin" />
                        <p className="text-[11px] text-white font-bold">جاري رفع ومعالجة ملف المقطع...</p>
                        <div className="w-40 bg-[#121212] h-1 rounded-full overflow-hidden border border-[#222]">
                          <div
                            className="bg-[#fd1d1d] h-full transition-all duration-300"
                            style={{ width: `${uploadEditProgress}%` }}
                          ></div>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-1.5 flex flex-col items-center">
                        <Upload className="w-6 h-6 text-gray-500" />
                        <p className="text-xs text-gray-300 font-bold">انقر لارفاق/تغيير ملف المقطع المرفق</p>
                        <p className="text-[10px] text-gray-500">يدعم أي صيغ فيديو (حتى 150 ميغابايت)</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-[#121212]/80 border border-[#222] rounded-[24px] p-4 flex flex-col sm:flex-row items-center gap-4 justify-between">
                    <div className="flex items-center gap-3 w-full sm:w-auto">
                      <div className="p-2.5 bg-red-500/5 rounded-lg border border-red-500/10 text-[#fd1d1d] shrink-0">
                        <Film className="w-5 h-5" />
                      </div>
                      <div className="text-right min-w-0 flex-1">
                        <p className="text-[11px] font-bold text-white truncate max-w-[200px]" dir="ltr">
                          {editAttachedVideoName}
                        </p>
                        <span className="text-[10px] text-gray-500 block mt-0.5">تم التحميل والارتباط بنجاح</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
                      <video
                        src={editAttachedVideoUrl}
                        controls
                        className="w-24 h-16 bg-black border border-[#222] rounded-lg object-cover"
                      />
                      
                      <div className="flex flex-col gap-1.5">
                        <button
                          type="button"
                          onClick={() => editFileInputRef.current?.click()}
                          className="px-2 py-1 text-[10px] font-bold text-gray-300 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition"
                        >
                          تغيير الملف
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm("هل تريد بالتأكيد إزالة الملف المرفق؟")) {
                              setEditAttachedVideoUrl("");
                              setEditAttachedVideoName("");
                            }
                          }}
                          className="px-2 py-1 text-[10px] font-bold text-red-400 hover:text-red-500 bg-red-500/5 hover:bg-red-500/10 rounded-lg transition"
                        >
                          إزالة الملف
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Saving actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#1a1a1a]">
                <button
                  type="button"
                  onClick={() => setEditingVideo(null)}
                  className="bg-transparent hover:bg-white/5 text-gray-400 hover:text-white font-semibold px-4 py-2.5 rounded-full text-xs transition border border-[#222]"
                >
                  إلغاء الأمر
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-1.5 bg-white hover:bg-gray-200 text-black font-extrabold px-6 py-2.5 rounded-full text-xs transition cursor-pointer shadow-lg"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{saving ? "جاري الحفظ..." : "حفظ التغييرات"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Attached Video Player Overlay Modal */}
      {playingVideo && (
        <div 
          className="fixed inset-0 bg-black/95 flex items-center justify-center p-4 z-55 backdrop-blur-md" 
          onClick={() => setPlayingVideo(null)}
        >
          <div 
            className="bg-[#0b0b0b] border border-[#1a1a1a] rounded-[36px] w-full max-w-2xl overflow-hidden shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header controls */}
            <div className="p-5 border-b border-[#1a1a1a] flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-white text-sm select-all">{playingVideo.title}</h3>
                <p className="text-[10px] text-gray-400 mt-0.5">مشاهدة ملف الفيديو المرفق مباشرة من السيرفر الخاص بك</p>
              </div>
              <button
                onClick={() => setPlayingVideo(null)}
                className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-xl transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Video Player content canvas */}
            <div className="bg-black flex justify-center items-center relative aspect-video p-1">
              <video
                src={playingVideo.attachedVideoUrl}
                controls
                autoPlay
                className="w-full h-full max-h-[60vh] object-contain rounded-2xl"
              />
            </div>

            {/* Info footer metadata summary representation */}
            <div className="p-5 bg-[#0d0d0d] border-t border-[#1a1a1a] space-y-2">
              <span className="text-[10px] text-red-500 font-extrabold block rounded bg-red-400/5 px-2 py-1 w-fit border border-red-500/10">
                اسم الملف: {playingVideo.attachedVideoName || "غير محدد"}
              </span>
              {playingVideo.description && (
                <div>
                  <span className="text-[10px] text-gray-500 font-bold block mb-0.5">شرح المقطع والكابشن:</span>
                  <p className="text-xs text-gray-450 line-clamp-3 leading-relaxed break-words">{playingVideo.description}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

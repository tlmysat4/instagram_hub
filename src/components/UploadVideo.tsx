import React, { useState, FormEvent, DragEvent, useRef } from "react";
import { Film, Link, Tag, Calendar, Clock, Sparkles, FileText, CheckCircle2, AlertTriangle, Plus, ChevronLeft, Upload, FileVideo, Trash2, Loader2, Paperclip } from "lucide-react";
import { Video } from "../types";
import { supabaseService } from "../lib/supabase";

interface UploadVideoProps {
  onVideoAdded: (video: Video) => void;
  onNavigate: (tab: string) => void;
}

export default function UploadVideo({ onVideoAdded, onNavigate }: UploadVideoProps) {
  const [title, setTitle] = useState("");
  const [instagramUrl, setInstagramUrl] = useState("");
  const [description, setDescription] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [status, setStatus] = useState<"draft" | "ready" | "published">("draft");
  const [publishDate, setPublishDate] = useState("");
  const [duration, setDuration] = useState("");
  const [notes, setNotes] = useState("");
  
  // Statistics if already published
  const [views, setViews] = useState("");
  const [likes, setLikes] = useState("");
  const [comments, setComments] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [successWarning, setSuccessWarning] = useState("");

  // Attachment states
  const [attachedVideoUrl, setAttachedVideoUrl] = useState("");
  const [attachedVideoName, setAttachedVideoName] = useState("");
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-extract video duration & initiate upload
  async function handleVideoFile(file: File) {
    if (!file) return;

    if (!file.type.startsWith("video/")) {
      setError("يرجى اختيار ملف فيديو صالح فقط (مثل MP4, MOV, WebM).");
      return;
    }

    // Initialize HTML5 Video to extract duration automatically
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
          const fmtPrice = seconds < 10 ? `0${seconds}` : seconds;
          setDuration(`${minutes}:${fmtPrice}`);
        }
      };
    } catch (e) {
      console.warn("Failed to auto-extract duration", e);
    }

    // Auto-populate Title if empty
    if (!title.trim()) {
      const nameWithoutExt = file.name.substring(0, file.name.lastIndexOf(".")) || file.name;
      setTitle(nameWithoutExt.replace(/[_\-]/g, " "));
    }

    // Start uploading via Base64 serialization
    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64Data = e.target?.result as string;
      if (!base64Data) return;

      try {
        setUploadingFile(true);
        setUploadProgress(15);
        setError("");

        // Simulating progressive indicator for smooth UX
        const interval = setInterval(() => {
          setUploadProgress((current) => {
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
          throw new Error(dat.error || "فشل رفع ملف المقطع إلى الخادم.");
        }

        const data = await response.json();
        setUploadProgress(100);
        setAttachedVideoUrl(data.videoPath);
        setAttachedVideoName(data.filename);
      } catch (err: any) {
        setError(err.message || "حدث خطأ غير متوقع أثناء معالجة وحفظ المقطع المرفق.");
        setAttachedVideoUrl("");
        setAttachedVideoName("");
      } finally {
        setTimeout(() => {
          setUploadingFile(false);
          setUploadProgress(0);
        }, 500);
      }
    };
    reader.readAsDataURL(file);
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave() {
    setIsDragging(false);
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleVideoFile(e.dataTransfer.files[0]);
    }
  }

  function triggerFileSelect() {
    fileInputRef.current?.click();
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files[0]) {
      handleVideoFile(e.target.files[0]);
    }
  }

  function handleDeleteAttachment() {
    if (confirm("هل تريد إزالة ملف الفيديو المرفق؟")) {
      setAttachedVideoUrl("");
      setAttachedVideoName("");
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSuccessWarning("");
    setSuccess(false);

    if (!title.trim() || !instagramUrl.trim()) {
      setError("يرجى ملء الحقول الإلزامية: العنوان ورابط الفيديو.");
      return;
    }

    setLoading(true);

    try {
      // Process comma-separated tags
      const cleanedTags = tagsInput
        .split(",")
        .map((tag) => tag.trim().replace(/#/g, ""))
        .filter((tag) => tag.length > 0);

      const payload = {
        title: title.trim(),
        description: description.trim(),
        instagramUrl: instagramUrl.trim(),
        tags: cleanedTags,
        status,
        publishDate: publishDate || "",
        duration: duration.trim(),
        notes: notes.trim(),
        stats: {
          views: Number(views) || 0,
          likes: Number(likes) || 0,
          comments: Number(comments) || 0,
        },
        attachedVideoUrl: attachedVideoUrl || undefined,
        attachedVideoName: attachedVideoName || undefined,
      };

      // Check duplicates first to warn details
      let titleWarning = "";
      try {
        const check = await supabaseService.checkDuplicates({
          title: payload.title,
          description: payload.description,
          instagramUrl: payload.instagramUrl,
          videoName: payload.attachedVideoName
        });
        if (check && !check.safe) {
          titleWarning = check.message || "تنبيه: تم رصد محتوى مشابه جداً قد يعتبره إنستغرام مكرراً!";
        }
      } catch (e) {
        // fail silently for validation check to keep user flow error-free
      }

      const savedVideo = await supabaseService.insertVideo(payload);

      // Success
      setSuccess(true);
      if (titleWarning) {
        setSuccessWarning(titleWarning);
      }
      onVideoAdded(savedVideo);

      // Clear state
      setTitle("");
      setInstagramUrl("");
      setDescription("");
      setTagsInput("");
      setStatus("draft");
      setPublishDate("");
      setDuration("");
      setNotes("");
      setViews("");
      setLikes("");
      setComments("");
      setAttachedVideoUrl("");
      setAttachedVideoName("");
    } catch (err: any) {
      setError(err.message || "خطأ غير متوقع.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6" id="upload-video-tab">
      {/* Tab Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">إضافة فيديو جديد للمستودع</h2>
          <p className="text-gray-400 text-sm mt-1">سجل تفاصيل المقطع، الوسوم والتاريخ لمنع تكرار المحتوى لاحقاً</p>
        </div>
        <button
          onClick={() => onNavigate("library")}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-white transition-colors cursor-pointer"
        >
          <span>العودة للمكتبة</span>
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>

      {/* Success Notification Panel */}
      {success && (
        <div className="bg-[#0b0b0b] border border-[#1a1a1a] rounded-[32px] p-6 text-right space-y-4">
          <div className="flex items-center gap-3 text-[#fd1d1d]">
            <CheckCircle2 className="w-6 h-6 shrink-0" />
            <span className="font-extrabold text-sm">تم تسجيل الفيديو في قاعدة البيانات بنجاح!</span>
          </div>
          <p className="text-xs text-gray-400 leading-relaxed">
            تمت أرشفة مقطع الفيديو ومنحه رقماً تعريفياً فريداً. لن يتمكن أي مستخدم لاحقاً من تسجيل نفس هذا الرابط، مما يحميك من تقديم محتوى مكرر على صفحاتك.
          </p>
          {successWarning && (
            <div className="flex items-center gap-2 bg-yellow-500/5 border border-yellow-500/10 text-yellow-400 rounded-2xl px-4 py-3 text-xs leading-relaxed">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <span>{successWarning}</span>
            </div>
          )}
          <div className="flex gap-2 pt-2">
            <button
              onClick={() => setSuccess(false)}
              className="bg-white hover:bg-gray-200 text-black text-xs font-bold px-5 py-2.5 rounded-full cursor-pointer transition-colors"
            >
              إضافة فيديو آخر
            </button>
            <button
              onClick={() => onNavigate("library")}
              className="bg-transparent hover:bg-white/5 text-gray-300 border border-[#222] text-xs font-semibold px-5 py-2.5 rounded-full cursor-pointer transition-colors"
            >
              عرض الفيديوهات المضافة بالمكتبة
            </button>
          </div>
        </div>
      )}

      {/* Error alert */}
      {error && (
        <div className="bg-red-500/5 border border-red-500/10 text-red-400 rounded-[32px] p-5 text-right flex flex-col gap-2">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
            <span className="font-bold text-sm">فشل في تسجيل الفيديو!</span>
          </div>
          <p className="text-xs text-red-300/80 leading-relaxed pr-7">{error}</p>
        </div>
      )}

      {/* Uploading Form Content */}
      <form onSubmit={handleSubmit} className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-[36px] p-6 md:p-8 space-y-6">
        {/* Core details */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-white border-b border-[#1a1a1a] pb-2">تفاصيل الفيديو الأساسية</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Title */}
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1.5 mr-1">عنوان الفيديو <span className="text-red-500">*</span></label>
              <div className="relative">
                <span className="absolute inset-y-0 right-0 p-3 flex items-center text-gray-500">
                  <Film className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="أدخل عنواناً واضحاً للفيديو (مثال: طريقة عمل القهوة الممتازة)"
                  className="w-full bg-[#121212] border border-[#222] focus:border-[#fd1d1d] rounded-xl py-2.5 pr-10 pl-4 text-xs text-white placeholder-gray-600 focus:outline-none"
                  required
                />
              </div>
            </div>

            {/* Instagram Link URL */}
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1.5 mr-1">رابط الفيديو في إنستغرام <span className="text-red-500">*</span></label>
              <div className="relative">
                <span className="absolute inset-y-0 right-0 p-3 flex items-center text-gray-500">
                  <Link className="w-4 h-4" />
                </span>
                <input
                  type="url"
                  value={instagramUrl}
                  onChange={(e) => setInstagramUrl(e.target.value)}
                  placeholder="https://www.instagram.com/reel/..."
                  className="w-full bg-[#121212] border border-[#222] focus:border-[#fd1d1d] rounded-xl py-2.5 pr-10 pl-4 text-xs text-white placeholder-gray-600 focus:outline-none"
                  required
                  dir="ltr"
                />
              </div>
              <span className="text-[10px] text-gray-500 mt-1 block mr-1">يقوم النظام تلقائياً بتنظيف الرابط وفحص تكراره بالمعرف الخاص به.</span>
            </div>
          </div>

          {/* Description caption */}
          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-1.5 mr-1">وصف الفيديو / الكابشن (Caption)</label>
            <div className="relative">
              <span className="absolute top-2.5 right-0 p-3 flex text-gray-500">
                <FileText className="w-4 h-4" />
              </span>
              <textarea
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="أدخل نصوص الكابشن والهاشتاغات المرافقة لمنشور الإنستغرام..."
                className="w-full bg-[#121212] border border-[#222] focus:border-[#fd1d1d] rounded-xl py-2.5 pr-10 pl-4 text-xs text-white placeholder-gray-600 focus:outline-none leading-relaxed"
              />
            </div>
          </div>

          {/* Attached Video Section */}
          <div className="space-y-3 pt-2">
            <label className="block text-xs font-semibold text-gray-400 mr-1 flex items-center gap-1.5">
              <Paperclip className="w-3.5 h-3.5 text-[#fd1d1d]" />
              <span>إرفاق ملف الفيديو الأصلي (اختياري)</span>
            </label>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="video/*"
              className="hidden"
            />

            {!attachedVideoUrl ? (
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={triggerFileSelect}
                className={`border-2 border-dashed rounded-[24px] p-8 text-center cursor-pointer transition-all ${
                  isDragging
                    ? "border-[#fd1d1d] bg-[#fd1d1d]/5"
                    : "border-[#222] bg-[#121212]/30 hover:border-white/15 hover:bg-[#121212]/50"
                }`}
              >
                {uploadingFile ? (
                  <div className="space-y-3 flex flex-col items-center">
                    <Loader2 className="w-8 h-8 text-[#fd1d1d] animate-spin" />
                    <p className="text-xs text-white font-bold">جاري رفع ومعالجة ملف المقطع...</p>
                    <div className="w-48 bg-[#121212] h-1.5 rounded-full overflow-hidden border border-[#222]">
                      <div
                        className="bg-[#fd1d1d] h-full transition-all duration-300"
                        style={{ width: `${uploadProgress}%` }}
                      ></div>
                    </div>
                    <span className="text-[10px] text-gray-400 font-mono">{uploadProgress}%</span>
                  </div>
                ) : (
                  <div className="space-y-2 flex flex-col items-center">
                    <Upload className="w-8 h-8 text-gray-500 group-hover:text-white transition-colors" />
                    <p className="text-xs text-gray-300 font-bold">قم بسحب وإفلات مقطع الفيديو هنا، أو انقر للتصفح</p>
                    <p className="text-[10px] text-gray-500">يدعم صيغ MP4, MOV, WebM (تصل إلى 150 ميغابايت)</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-[#121212]/80 border border-[#222] rounded-[24px] p-4 flex flex-col md:flex-row items-center gap-4 justify-between">
                <div className="flex items-center gap-3 w-full md:w-auto">
                  <div className="p-3 bg-red-500/5 rounded-xl border border-red-500/10 text-[#fd1d1d] shrink-0">
                    <FileVideo className="w-6 h-6" />
                  </div>
                  <div className="text-right min-w-0 flex-1">
                    <p className="text-xs font-bold text-white truncate" dir="ltr" title={attachedVideoName}>
                      {attachedVideoName}
                    </p>
                    <span className="text-[10px] text-[#fd1d1d] font-semibold mt-0.5 block flex items-center gap-1.5">
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500"></span>
                      <span>تم إرفاق الفيديو وحفظه بسلام</span>
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto justify-end">
                  {/* Inline preview standard video element */}
                  <video
                    src={attachedVideoUrl}
                    controls
                    className="w-32 h-20 rounded-xl bg-black border border-[#222] object-cover"
                  />
                  
                  <button
                    type="button"
                    onClick={handleDeleteAttachment}
                    className="p-2.5 text-gray-500 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all cursor-pointer"
                    title="حذف الملف المرفق"
                  >
                    <Trash2 className="w-4.5 h-4.5" />
                  </button>
                </div>
              </div>
            )}
            <p className="text-[10px] text-gray-500 mr-1">
              * إرفاق مقطع الفيديو يقوم تلقائياً بقراءة مدته الزمنية وتعبئة حقل المدة بالأسفل لمساعدتك في التخطيط.
            </p>
          </div>
        </div>

        {/* Tags and Scheduling */}
        <div className="space-y-4 pt-4 border-t border-[#1a1a1a]/60">
          <h3 className="text-sm font-bold text-white border-b border-[#1a1a1a] pb-2">التصنيف والجدولة الزمنية</h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Tags Input */}
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1.5 mr-1">الوسوم (مفصولة بفاصلة)</label>
              <div className="relative">
                <span className="absolute inset-y-0 right-0 p-3 flex items-center text-gray-500">
                  <Tag className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  placeholder="تقنية, رمضانيات, ثقافة"
                  className="w-full bg-[#121212] border border-[#222] focus:border-[#fd1d1d] rounded-xl py-2.5 pr-10 pl-4 text-xs text-white placeholder-gray-600 focus:outline-none"
                />
              </div>
            </div>

            {/* Publishing Status selection */}
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1.5 mr-1">حالة نشر الفيديو</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full bg-[#121212] border border-[#222] focus:border-[#fd1d1d] rounded-xl py-2.5 px-4 text-xs text-white focus:outline-none appearance-none"
              >
                <option value="draft">مسودة محتوى (Draft)</option>
                <option value="ready">جاهز للنشر ومجدول (Ready)</option>
                <option value="published">تم النشر بالفعل عالي السحاب (Published)</option>
              </select>
            </div>

            {/* Duration */}
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1.5 mr-1">مدة الفيديو (دقيقة:ثانية)</label>
              <div className="relative">
                <span className="absolute inset-y-0 right-0 p-3 flex items-center text-gray-500">
                  <Clock className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  placeholder="مثال: 0:59 أو 1:24"
                  className="w-full bg-[#121212] border border-[#222] focus:border-[#fd1d1d] rounded-xl py-2.5 pr-10 pl-4 text-xs text-white placeholder-gray-600 focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Scheduled Publish Date */}
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1.5 mr-1">تاريخ النشر المجدول</label>
              <div className="relative">
                <span className="absolute inset-y-0 right-0 p-3 flex items-center text-gray-500">
                  <Calendar className="w-4 h-4" />
                </span>
                <input
                  type="datetime-local"
                  value={publishDate}
                  onChange={(e) => setPublishDate(e.target.value)}
                  className="w-full bg-[#121212] border border-[#222] focus:border-[#fd1d1d] rounded-xl py-2.5 pr-10 pl-4 text-xs text-white focus:outline-none"
                />
              </div>
            </div>

            {/* Personal Notes / Action list */}
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1.5 mr-1">ملاحظات ومهام مرافقة</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="مثال: بحاجة لتعديل الملحق الموسيقي / إضافة صوت معلق"
                className="w-full bg-[#121212] border border-[#222] focus:border-[#fd1d1d] rounded-xl py-2.5 px-4 text-xs text-white placeholder-gray-600 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Real Performance Metrics (Show fields in nice container) */}
        <div className="space-y-4 pt-4 border-t border-[#1a1a1a]/60 bg-[#121212]/30 p-5 rounded-3xl border border-[#222]">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-4 h-4 text-[#fd1d1d]" />
            <h3 className="text-xs font-bold text-gray-300">إحصاءات أداء المقطع (أرقام حقيقية بعد النشر)</h3>
          </div>
          
          <div className="grid grid-cols-3 gap-4">
            {/* Views counter */}
            <div>
              <label className="block text-[11px] text-gray-500 mb-1">عدد المشاهدات الحقيقي</label>
              <input
                type="number"
                min="0"
                value={views}
                onChange={(e) => setViews(e.target.value)}
                placeholder="0"
                className="w-full bg-[#0d0d0d] border border-[#222] rounded-xl py-2 px-3 text-xs text-white focus:outline-none"
              />
            </div>

            {/* Likes counter */}
            <div>
              <label className="block text-[11px] text-gray-500 mb-1">عدد الإعجابات الحقيقي</label>
              <input
                type="number"
                min="0"
                value={likes}
                onChange={(e) => setLikes(e.target.value)}
                placeholder="0"
                className="w-full bg-[#0d0d0d] border border-[#222] rounded-xl py-2 px-3 text-xs text-white focus:outline-none"
              />
            </div>

            {/* Comments counter */}
            <div>
              <label className="block text-[11px] text-gray-500 mb-1">عدد التعليقات الحقيقي</label>
              <input
                type="number"
                min="0"
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                placeholder="0"
                className="w-full bg-[#0d0d0d] border border-[#222] rounded-xl py-2 px-3 text-xs text-white focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Form Submission Button */}
        <div className="flex items-center justify-end pt-4 border-t border-[#1a1a1a]/60">
          <button
            id="upload-video-submit"
            type="submit"
            disabled={loading}
            className="flex items-center justify-center gap-2 bg-white hover:bg-gray-200 disabled:bg-gray-800 text-black font-extrabold px-8 py-3.5 rounded-full text-xs shadow-lg transition-all cursor-pointer w-full md:w-auto"
          >
            {loading ? (
              <span>جاري حفظ وتحليل صحة الفيديو...</span>
            ) : (
              <>
                <Plus className="w-4 h-4 text-black" />
                <span>أرشفة وحفظ الفيديو بسلام</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

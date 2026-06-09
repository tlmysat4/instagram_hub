import React, { useState, useEffect, FormEvent } from "react";
import { Shield, Key, Database, RefreshCw, Download, Upload, AlertTriangle, CheckCircle2, UserCheck } from "lucide-react";
import { DbStats } from "../types";

interface SettingsProps {
  videos: any[];
  onDbReset: () => void;
}

export default function Settings({ videos, onDbReset }: SettingsProps) {
  // Credentials state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  
  const [credentialsSaving, setCredentialsSaving] = useState(false);
  const [credentialsError, setCredentialsError] = useState("");
  const [credentialsSuccess, setCredentialsSuccess] = useState("");

  // DB stats state
  const [dbStats, setDbStats] = useState<DbStats | null>(null);
  const [dbStatsLoading, setDbStatsLoading] = useState(false);
  const [dbResetSuccess, setDbResetSuccess] = useState("");
  const [dbResetError, setDbResetError] = useState("");

  async function fetchDbStats() {
    setDbStatsLoading(true);
    try {
      const response = await fetch("/api/settings/db-stats", {
        headers: {
          "Authorization": `Bearer ${localStorage.getItem("ig_hub_token") || ""}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setDbStats(data);
      }
    } catch (err) {
      console.error("Failed to fetch database statistics:", err);
    } finally {
      setDbStatsLoading(false);
    }
  }

  useEffect(() => {
    fetchDbStats();
  }, [videos]);

  // Handle credentials updates
  async function handleCredentialsSubmit(e: FormEvent) {
    e.preventDefault();
    setCredentialsError("");
    setCredentialsSuccess("");

    if (!currentPassword) {
      setCredentialsError("يجب إدخال كلمة المرور الحالية لتأكيد الهوية وتطبيق التحديثات.");
      return;
    }

    if (!newUsername.trim() && !newPassword.trim()) {
      setCredentialsError("يرجى إدخال اسم مستخدم جديد أو كلمة مرور جديدة لتعديل البيانات.");
      return;
    }

    setCredentialsSaving(true);

    try {
      const response = await fetch("/api/auth/settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("ig_hub_token") || ""}`,
        },
        body: JSON.stringify({
          currentPassword,
          newUsername: newUsername.trim() || undefined,
          newPassword: newPassword.trim() || undefined,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "خطأ في تعديل الإعدادات");
      }

      setCredentialsSuccess("تم تحديث بيانات الدخول وحفظها بنجاح!");
      setCurrentPassword("");
      setNewUsername("");
      setNewPassword("");
    } catch (err: any) {
      setCredentialsError(err.message || "فشل الاتصال بالخادم.");
    } finally {
      setCredentialsSaving(false);
    }
  }

  // Handle DB Restructuring (starts empty)
  async function handleResetDb() {
    if (!confirm("تحذير أمني هام! هل أنت متأكد من رغبتك في مسح قاعدة البيانات بالكامل؟ سيتم مسح جميع الفيديوهات المؤرشفة نهائياً وبدء المستودع فارغاً. هذا القرار لا رجعة فيه.")) {
      return;
    }

    setDbResetError("");
    setDbResetSuccess("");

    try {
      const response = await fetch("/api/settings/reset-db", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${localStorage.getItem("ig_hub_token") || ""}`,
        },
      });

      const data = await response.json();
      if (response.ok) {
        setDbResetSuccess("تمت إعادة تهيين قاعدة البيانات وبدء المستودع فارغاً تماماً!");
        onDbReset();
        fetchDbStats();
      } else {
        setDbResetError(data.error || "فشل إعادة تهيئة قاعدة البيانات.");
      }
    } catch (err) {
      setDbResetError("حدث خطأ أثناء الاتصال بالخادم لإعادة تعيين قاعدة البيانات.");
    }
  }

  // Handle Exporting Video Metadata & History Only to JSON
  function handleExportVideoMetadata() {
    try {
      if (videos.length === 0) {
        alert("المكتبة فارغة حالياً. لا توجد بيانات فيديوهات أو تاريخ نشر للأرشفة.");
        return;
      }
      
      const videoBackup = videos.map(v => ({
        id: v.id,
        title: v.title,
        description: v.description,
        instagramUrl: v.instagramUrl || "",
        tags: v.tags || [],
        status: v.status,
        publishDate: v.publishDate || "",
        createdAt: v.createdAt,
        duration: v.duration || "",
        notes: v.notes || "",
        stats: v.stats || {},
        attachedVideoName: v.attachedVideoName || ""
      }));

      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(videoBackup, null, 2));
      const downloadAnchor = document.createElement("a");
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `instagram_videos_metadata_${new Date().toISOString().split("T")[0]}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    } catch (err) {
      alert("فشل في استخراج نسخة احتياطية لبيانات وتاريخ الفيديوهات.");
    }
  }

  const [backupLoading, setBackupLoading] = useState(false);
  const [backupSuccess, setBackupSuccess] = useState("");
  const [backupError, setBackupError] = useState("");

  // Handle Full System JSON Backup Export
  async function handleExportSystemBackup() {
    setBackupLoading(true);
    setBackupSuccess("");
    setBackupError("");
    try {
      const response = await fetch("/api/settings/backup/export", {
        headers: {
          "Authorization": `Bearer ${localStorage.getItem("ig_hub_token") || ""}`,
        },
      });
      if (!response.ok) {
        throw new Error("فشل الخادم في إنشاء نسخة احتياطية للنظام.");
      }
      const data = await response.json();
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data, null, 2));
      const downloadAnchor = document.createElement("a");
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `ig_hub_full_backup_${new Date().toISOString().split("T")[0]}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      setBackupSuccess("تم تصدير نسخة احتياطية كاملة للنظام بنجاح!");
    } catch (err: any) {
      setBackupError(err.message || "حدث خطأ أثناء تصدير البيانات.");
    } finally {
      setBackupLoading(false);
    }
  }

  // Handle Full System JSON Backup Import
  async function handleImportSystemBackup(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setBackupLoading(true);
    setBackupSuccess("");
    setBackupError("");

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);

        if (!parsed.db && !parsed.publish_db) {
          throw new Error("تنسيق ملف النسخة الاحتياطية غير صالح.");
        }

        const response = await fetch("/api/settings/backup/import", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${localStorage.getItem("ig_hub_token") || ""}`,
          },
          body: JSON.stringify(parsed),
        });

        const resData = await response.json();
        if (!response.ok) {
          throw new Error(resData.error || "فشل استيراد النسخة الاحتياطية على الخادم.");
        }

        setBackupSuccess(resData.message || "تمت استعادة النسخة الاحتياطية للنظام بنجاح!");
        onDbReset(); // Trigger App refreshing
        fetchDbStats();
      } catch (err: any) {
        setBackupError(`فشل استيراد النسخة: ${err.message}`);
      } finally {
        setBackupLoading(false);
        e.target.value = "";
      }
    };
    reader.onerror = () => {
      setBackupError("فشل قراءة الملف المحلي.");
      setBackupLoading(false);
    };
    reader.readAsText(file);
  }

  // Helper bytes converter
  function formatBytes(bytes: number) {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6" id="settings-tab">
      {/* Tab Header */}
      <div>
        <h2 className="text-2xl font-bold text-white tracking-tight">إعدادات النظام والأرشفة</h2>
        <p className="text-gray-400 text-sm mt-1">تعديل بيانات الدخول وإدارة نسخ قاعدة البيانات والتهيئة للمستقبل</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        
        {/* Security Settings Area */}
        <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-[36px] p-6 md:col-span-7 space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2 border-b border-[#1a1a1a] pb-2">
            <Key className="w-4 h-4 text-red-500" />
            <span>بيانات الحساب وتغيير المرور</span>
          </h3>

          {credentialsSuccess && (
            <div className="bg-green-500/5 border border-green-500/10 text-green-400 rounded-xl px-4 py-3 text-xs flex items-center gap-2 text-right">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{credentialsSuccess}</span>
            </div>
          )}

          {credentialsError && (
            <div className="bg-red-500/5 border border-red-500/10 text-red-400 rounded-xl px-4 py-3 text-xs flex items-center gap-2 text-right">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{credentialsError}</span>
            </div>
          )}

          <form onSubmit={handleCredentialsSubmit} className="space-y-4">
            {/* New Username */}
            <div>
              <label className="block text-xs text-gray-400 mb-1.5 mr-1">اسم مستخدم جديد (اتركه فارغاً للإبقاء على الحالي)</label>
              <input
                type="text"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                placeholder="مثال: custom_admin"
                className="w-full bg-[#121212] border border-[#222] focus:border-[#fd1d1d] rounded-xl py-2.5 px-4 text-xs text-white focus:outline-none"
              />
            </div>

            {/* New Password */}
            <div>
              <label className="block text-xs text-gray-400 mb-1.5 mr-1">كلمة مرور جديدة (اتركه فارغاً للإبقاء على الحالية)</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="أدخل كلمة مرور قوية"
                className="w-full bg-[#121212] border border-[#222] focus:border-[#fd1d1d] rounded-xl py-2.5 px-4 text-xs text-white focus:outline-none"
              />
            </div>

            {/* Current Password validation */}
            <div className="pt-2">
              <label className="block text-xs font-bold text-yellow-500 mb-1.5 mr-1 flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-yellow-500" />
                <span>كلمة المرور الحالية (مطلوبة لتأكيد الهوية)</span>
              </label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="أدخل كلمة المرور الحالية لتطبيق التعديلات"
                className="w-full bg-[#121212] border border-yellow-500/20 focus:border-yellow-400 rounded-xl py-2.5 px-4 text-xs text-white focus:outline-none"
                required
              />
            </div>

            <button
              id="settings-credentials-submit"
              type="submit"
              disabled={credentialsSaving}
              className="w-full bg-white hover:bg-gray-200 disabled:bg-gray-800 text-black text-xs font-bold py-3 rounded-full transition cursor-pointer shadow-lg"
            >
              {credentialsSaving ? "جاري التحقق وحفظ البيانات..." : "تطبيق وحفظ بيانات الدخول"}
            </button>
          </form>
        </div>

        {/* Database Maintenance Area */}
        <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-[36px] p-6 md:col-span-5 space-y-5 flex flex-col justify-between">
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2 border-b border-[#1a1a1a] pb-2">
              <Database className="w-4 h-4 text-red-500" />
              <span>قاعدة البيانات والأرشفة الحية</span>
            </h3>

            {/* Micro database statistics */}
            {dbStatsLoading ? (
              <div className="text-gray-500 text-xs text-center py-4">جاري تحميل إحصائيات التخزين...</div>
            ) : dbStats ? (
              <div className="grid grid-cols-2 gap-3" id="db-technical-stats">
                <div className="bg-[#121212] p-4 rounded-xl border border-[#222]">
                  <span className="text-[10px] text-gray-500 block">حجم ملف التخزين</span>
                  <span className="text-sm font-bold text-white mt-1 block font-mono">{formatBytes(dbStats.fileSize)}</span>
                </div>
                <div className="bg-[#121212] p-4 rounded-xl border border-[#222]">
                  <span className="text-[10px] text-gray-500 block">مجموع السجلات المسجلة</span>
                  <span className="text-sm font-bold text-white mt-1 block">{dbStats.totalCount} فيديو</span>
                </div>
              </div>
            ) : null}

            {dbResetSuccess && (
              <div className="bg-green-500/5 border border-green-500/10 text-green-400 rounded-xl px-4 py-2 text-xs flex items-center gap-1.5 text-right">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{dbResetSuccess}</span>
              </div>
            )}

            {dbResetError && (
              <div className="bg-red-500/5 border border-red-500/10 text-red-400 rounded-xl px-4 py-2 text-xs flex items-center gap-1.5 text-right">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{dbResetError}</span>
              </div>
            )}

            <div className="space-y-2.5">
              {/* Reset database button */}
              <button
                onClick={handleResetDb}
                className="w-full bg-[#121212] hover:bg-red-500/5 hover:text-red-400 text-gray-300 text-xs font-semibold py-3 rounded-full transition border border-[#222] hover:border-red-500/30 cursor-pointer flex items-center justify-center gap-2"
                title="مسح قاعدة البيانات وتفريرها"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>تفريغ وبدء قاعدة البيانات فارغة</span>
              </button>

              {/* Reset database warning subtext */}
              <p className="text-[10px] text-gray-500 leading-normal block mr-1">
                * تفريغ قاعدة البيانات يسفر عنه مسح كافة الفيديوهات المحفوظة والتحليلات وبدء المكتبة فارغة بالكامل.
              </p>
            </div>
          </div>

          <div className="pt-4 border-t border-[#1a1a1a]/60 text-right space-y-3">
            <h4 className="text-xs font-bold text-gray-350">النسخ الاحتياطي والاستعادة الفورية</h4>
            
            {backupSuccess && (
              <div className="bg-green-500/5 border border-green-500/10 text-green-400 rounded-xl px-4 py-2 text-xs flex items-center gap-1.5 text-right">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{backupSuccess}</span>
              </div>
            )}

            {backupError && (
              <div className="bg-red-500/5 border border-red-500/10 text-red-400 rounded-xl px-4 py-2 text-xs flex items-center gap-1.5 text-right">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{backupError}</span>
              </div>
            )}

            <div className="flex flex-col gap-2">
              {/* Local video metadata & history backup */}
              <button
                id="export-video-metadata-btn"
                onClick={handleExportVideoMetadata}
                className="w-full bg-[#121212] hover:bg-white/5 text-gray-200 text-xs font-bold py-3 rounded-full transition cursor-pointer flex items-center justify-center gap-2 border border-[#222]"
              >
                <Download className="w-3.5 h-3.5 text-green-500" />
                <span>تصدير بيانات وتاريخ الفيديوهات فقط (JSON)</span>
              </button>

              <button
                onClick={handleExportSystemBackup}
                disabled={backupLoading}
                className="w-full bg-[#121212] hover:bg-white/5 disabled:opacity-40 text-gray-200 text-xs font-bold py-3 rounded-full transition cursor-pointer flex items-center justify-center gap-2 border border-[#222]"
              >
                <Download className="w-3.5 h-3.5 text-blue-500" />
                <span>{backupLoading ? "جاري المعالجة..." : "تصدير نسخة احتياطية كاملة (JSON)"}</span>
              </button>

              <button
                onClick={() => document.getElementById("system-restore-input")?.click()}
                disabled={backupLoading}
                className="w-full bg-blue-600/5 hover:bg-blue-600/10 disabled:opacity-40 text-blue-400 text-xs font-bold py-3 rounded-full transition cursor-pointer flex items-center justify-center gap-2 border border-blue-500/20"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>{backupLoading ? "جاري الاستيراد..." : "استعادة نسخة احتياطية كاملة"}</span>
              </button>
              <input
                type="file"
                id="system-restore-input"
                accept=".json"
                onChange={handleImportSystemBackup}
                style={{ display: "none" }}
              />
            </div>
            <span className="text-[10px] text-gray-500 block leading-normal pt-1">
              * النسخة الاحتياطية الشاملة تحتوي على مكتبة الفيديوهات، التفضيلات، جدولة النشر، قوالب الكابشنات والإحصائيات.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

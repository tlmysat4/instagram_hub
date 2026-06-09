import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from "recharts";
import { Video } from "../types";
import { Film, CheckCircle2, Clock, FileEdit, BarChart3, AlertCircle, Plus, Eye } from "lucide-react";

interface DashboardProps {
  videos: Video[];
  onNavigate: (tab: string) => void;
}

export default function Dashboard({ videos, onNavigate }: DashboardProps) {
  const totalCount = videos.length;
  const draftsCount = videos.filter((v) => v.status === "draft").length;
  const readyCount = videos.filter((v) => v.status === "ready").length;
  const publishedCount = videos.filter((v) => v.status === "published").length;

  // Real data only configuration
  const noData = totalCount === 0;

  // Compute status chart data
  const statusData = [
    { name: "مسودة", count: draftsCount, color: "#94a3b8" },
    { name: "جاهز للنشر", count: readyCount, color: "#38bdf8" },
    { name: "تم النشر", count: publishedCount, color: "#10b981" },
  ];

  // Compute tags frequency from real videos only
  const tagCounts: { [key: string]: number } = {};
  videos.forEach((v) => {
    if (v.tags && Array.isArray(v.tags)) {
      v.tags.forEach((tag) => {
        const t = tag.trim();
        if (t) {
          tagCounts[t] = (tagCounts[t] || 0) + 1;
        }
      });
    }
  });

  const tagData = Object.entries(tagCounts)
    .map(([name, value]) => ({ name: `#${name}`, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5); // top 5 tags

  const COLORS = ["#10b981", "#3b82f6", "#8b5cf6", "#ec4899", "#f59e0b"];

  // Compute total real performance metrics
  const totalViews = videos.reduce((acc, curr) => acc + (curr.stats?.views || 0), 0);
  const totalLikes = videos.reduce((acc, curr) => acc + (curr.stats?.likes || 0), 0);
  const totalComments = videos.reduce((acc, curr) => acc + (curr.stats?.comments || 0), 0);

  return (
    <div className="space-y-8" id="dashboard-tab">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">لوحة التحكم الرئيسية</h2>
          <p className="text-gray-400 text-sm mt-1">نظرة عامة على إحصائيات مكتبة فيديوهات إنستغرام وحالة النشر الحالية</p>
        </div>
        <button
          onClick={() => onNavigate("upload")}
          className="flex items-center justify-center gap-2 bg-white hover:bg-gray-200 text-black font-extrabold px-6 py-2.5 rounded-full text-xs shadow-lg transition-all cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4 text-black" />
          <span>إضافة فيديو جديد</span>
        </button>
      </div>

      {/* KPI Cards Grid - Always computed from real data */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" id="kpi-grid">
        {/* Total videos */}
        <div className="bg-[#0d0d0d] border border-[#1a1a1a] p-6 rounded-3xl flex items-center justify-between shadow-sm relative overflow-hidden group">
          <div>
            <span className="block text-xs font-medium text-gray-500">إجمالي الفيديوهات</span>
            <span className="block text-2xl font-bold text-white mt-1.5">{totalCount}</span>
          </div>
          <div className="p-3 bg-[#121212] text-gray-400 rounded-2xl border border-[#222]">
            <Film className="w-5 h-5" />
          </div>
        </div>

        {/* Published status */}
        <div className="bg-[#0d0d0d] border border-[#1a1a1a] p-6 rounded-3xl flex items-center justify-between shadow-sm relative overflow-hidden group">
          <div>
            <span className="block text-xs font-medium text-gray-500">فيديوهات نُشرت</span>
            <span className="block text-2xl font-bold text-[#fd1d1d] mt-1.5">{publishedCount}</span>
          </div>
          <div className="p-3 bg-red-500/5 text-[#fd1d1d] rounded-2xl border border-red-500/10">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        {/* Ready to publish */}
        <div className="bg-[#0d0d0d] border border-[#1a1a1a] p-6 rounded-3xl flex items-center justify-between shadow-sm relative overflow-hidden group">
          <div>
            <span className="block text-xs font-medium text-gray-500">جاهزة للنشر</span>
            <span className="block text-2xl font-bold text-sky-400 mt-1.5">{readyCount}</span>
          </div>
          <div className="p-3 bg-sky-500/5 text-sky-400 rounded-2xl border border-sky-500/10">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        {/* Drafts count */}
        <div className="bg-[#0d0d0d] border border-[#1a1a1a] p-6 rounded-3xl flex items-center justify-between shadow-sm relative overflow-hidden group">
          <div>
            <span className="block text-xs font-medium text-gray-500">مسودات المحتوى</span>
            <span className="block text-2xl font-bold text-gray-400 mt-1.5">{draftsCount}</span>
          </div>
          <div className="p-3 bg-white/5 text-gray-400 rounded-2xl border border-white/10">
            <FileEdit className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Main Content Layout */}
      {noData ? (
        /* Strict No Data Available State */
        <div className="flex-1 h-[400px] border border-dashed border-[#222] rounded-[40px] flex flex-col items-center justify-center text-center p-12 bg-gradient-to-b from-[#080808] to-transparent" id="empty-dashboard-state">
          <div className="w-24 h-24 bg-[#121212] rounded-full flex items-center justify-center text-4xl mb-6 shadow-inner">
            📁
          </div>
          <h3 className="text-2xl font-bold text-white mb-2">لا توجد بيانات متاحة</h3>
          <p className="text-gray-500 max-w-sm mb-8 text-sm leading-relaxed">
            قاعدة البيانات فارغة حالياً. ابدأ برفع أول فيديو خاص بك لتتبع تاريخ النشر ومنع التكرار.
          </p>
          <button
            onClick={() => onNavigate("upload")}
            className="px-8 py-3 bg-white text-black font-bold rounded-full hover:bg-gray-200 transition-colors flex items-center gap-2"
          >
            <span>➕</span>
            <span>إضافة فيديو جديد</span>
          </button>
        </div>
      ) : (
        /* Real Stats Visualization */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Status Breakdown Chart */}
          <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-3xl p-6 lg:col-span-2">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-md font-bold text-white flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-red-500" />
                <span>فرز الفيديوهات حسب حالة النشر</span>
              </h3>
              <p className="text-xs text-gray-500">مستخلص حقيقي من قاعدة البيانات</p>
            </div>
            
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={statusData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#161616" vertical={false} />
                  <XAxis dataKey="name" stroke="#4b5563" tick={{ style: { fontFamily: 'Cairo, sans-serif', fontSize: 11 } }} />
                  <YAxis stroke="#4b5563" allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#0d0d0d", borderColor: "#1a1a1a", borderRadius: "16px", fontFamily: "Cairo", direction: "rtl" }}
                    itemStyle={{ color: "#e0e0e0" }}
                    labelClassName="text-white text-xs font-bold"
                  />
                  <Bar dataKey="count" radius={[8, 8, 0, 0]} maxBarSize={60}>
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Tag Frequency Distribution Chart */}
          <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-3xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-md font-bold text-white">الوسوم الأكثر استخداماً</h3>
              <span className="text-[10px] bg-red-500/10 text-[#fd1d1d] border border-red-500/20 px-2.5 py-0.5 rounded-full font-bold">Top tags</span>
            </div>
            
            {tagData.length === 0 ? (
              <div className="h-60 flex flex-col items-center justify-center text-gray-500 text-xs">
                <span>لا توجد وسوم معرفة في الفيديوهات حتى الآن.</span>
              </div>
            ) : (
              <div className="h-60 flex flex-col justify-center">
                <div className="h-44 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={tagData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={75}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {tagData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ backgroundColor: "#0d0d0d", borderColor: "#1a1a1a", borderRadius: "12px", fontFamily: "Cairo" }}
                        itemStyle={{ color: "#e0e0e0" }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                
                {/* Custom Legend */}
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {tagData.map((entry, index) => (
                    <div key={entry.name} className="flex items-center gap-1.5 text-xs truncate">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }}></span>
                      <span className="text-gray-300 truncate font-mono" dir="ltr">{entry.name}</span>
                      <span className="text-gray-500 font-bold">({entry.value})</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Performance Summary - Accumulated Views, Likes & Comments */}
          <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-3xl p-6">
            <h3 className="text-md font-bold text-white mb-5">إجمالي أداء المحتوى المنشور</h3>
            <div className="space-y-4">
              {/* Total Views */}
              <div className="p-4 bg-[#121212] border border-[#1a1a1a] rounded-2xl">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">إجمالي المشاهدات</span>
                  <span className="text-[10px] text-red-400 bg-red-400/5 border border-red-400/10 px-2 py-0.5 rounded-full font-bold">VIEWS</span>
                </div>
                <div className="text-xl font-black text-white mt-1.5">{totalViews.toLocaleString("ar-EG")}</div>
              </div>

              {/* Total Likes */}
              <div className="p-4 bg-[#121212] border border-[#1a1a1a] rounded-2xl">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">إجمالي الإعجابات</span>
                  <span className="text-[10px] text-pink-400 bg-pink-400/5 border border-pink-400/10 px-2 py-0.5 rounded-full font-bold">LIKES</span>
                </div>
                <div className="text-xl font-black text-white mt-1.5">{totalLikes.toLocaleString("ar-EG")}</div>
              </div>

              {/* Total Comments */}
              <div className="p-4 bg-[#121212] border border-[#1a1a1a] rounded-2xl">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">إجمالي التعليقات</span>
                  <span className="text-[10px] text-yellow-400 bg-yellow-400/5 border border-yellow-400/10 px-2 py-0.5 rounded-full font-bold">COMMENTS</span>
                </div>
                <div className="text-xl font-black text-white mt-1.5">{totalComments.toLocaleString("ar-EG")}</div>
              </div>
            </div>
          </div>

          {/* Quick List for Latest Registered Videos */}
          <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-3xl p-6 lg:col-span-2">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-md font-bold text-white">آخر الفيديوهات المضافة</h3>
              <button
                onClick={() => onNavigate("library")}
                className="text-xs text-[#fd1d1d] hover:text-[#fcb045] transition-colors font-semibold"
              >
                عرض كل المكتبة ←
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-sm">
                <thead>
                  <tr className="border-b border-[#1a1a1a] text-gray-500">
                    <th className="pb-3 font-semibold">عنوان الفيديو</th>
                    <th className="pb-3 font-semibold">حالة النشر</th>
                    <th className="pb-3 font-semibold">تاريخ التسجيل</th>
                    <th className="pb-3 font-semibold text-left">العمليات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1a1a1a]/40">
                  {videos.slice(-3).reverse().map((vid) => (
                    <tr key={vid.id} className="text-gray-300 hover:bg-white/5 transition-colors">
                      <td className="py-3.5 font-medium max-w-xs truncate">{vid.title}</td>
                      <td className="py-3.5">
                        {vid.status === "published" ? (
                          <span className="inline-flex px-2 px-2.5 py-1 rounded-full text-xs font-medium bg-[#121212] text-white border border-[#222]">تم النشر</span>
                        ) : vid.status === "ready" ? (
                          <span className="inline-flex px-2 px-2.5 py-1 rounded-full text-xs font-medium bg-sky-500/10 text-sky-400 border border-sky-500/20">جاهز للرفع</span>
                        ) : (
                          <span className="inline-flex px-2 px-2.5 py-1 rounded-full text-xs font-medium bg-white/5 text-gray-400 border border-white/10">مسودة</span>
                        )}
                      </td>
                      <td className="py-3.5 text-xs text-gray-500 font-mono">
                        {new Date(vid.createdAt).toLocaleDateString("ar-EG")}
                      </td>
                      <td className="py-3.5 text-left">
                        <button
                          onClick={() => onNavigate("library")}
                          className="p-1 text-gray-400 hover:text-white transition-colors cursor-pointer"
                          title="عرض في المكتبة"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

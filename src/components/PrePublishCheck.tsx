import { useState, FormEvent } from "react";
import { SearchCode, HelpCircle, CheckCircle2, AlertTriangle, AlertCircle, Sparkles, ExternalLink, RefreshCw, Clipboard } from "lucide-react";
import { DuplicateMatch, PrePublishResult } from "../types";

export default function PrePublishCheck() {
  const [urlInput, setUrlInput] = useState("");
  const [titleInput, setTitleInput] = useState("");
  const [descInput, setDescInput] = useState("");

  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<PrePublishResult | null>(null);
  const [error, setError] = useState("");

  async function handleCheck(e: FormEvent) {
    e.preventDefault();
    setError("");
    setResult(null);

    if (!urlInput.trim() && !titleInput.trim() && !descInput.trim()) {
      setError("يرجى إدخال معلومة واحدة على الأقل لإجراء فحص تطابق المحتوى (الرابط، العنوان، أو الشرح).");
      return;
    }

    setChecking(true);

    try {
      const response = await fetch("/api/videos/check", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("ig_hub_token") || ""}`,
        },
        body: JSON.stringify({
          url: urlInput.trim(),
          title: titleInput.trim(),
          description: descInput.trim(),
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "فشل إجراء فحص التكرار من الخادم.");
      }

      setResult(data);
    } catch (err: any) {
      setError(err.message || "فشل الاتصال بالخادم.");
    } finally {
      setChecking(false);
    }
  }

  function handleClear() {
    setUrlInput("");
    setTitleInput("");
    setDescInput("");
    setResult(null);
    setError("");
  }

  // Paste helper from clipboard
  async function handlePasteUrl() {
    try {
      const text = await navigator.clipboard.readText();
      if (text && text.startsWith("http")) {
        setUrlInput(text.trim());
      }
    } catch (err) {
      // ignore clipboard blocking errors in sandboxes
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6" id="pre-publish-check-tab">
      {/* Tab Header */}
      <div>
        <h2 className="text-2xl font-bold text-white tracking-tight">فحص ما قبل النشر (منع التكرار)</h2>
        <p className="text-slate-400 text-sm mt-1">تأكد من سلامة المحتوى الجديد وعدم تكرار نشره على شبكة حساباتك</p>
      </div>

      {/* Interactive check form and analyzer */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Form Inputs */}
        <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-3xl p-6 space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2 border-b border-[#1a1a1a] pb-2">
            <SearchCode className="w-4 h-4 text-red-500" />
            <span>بيانات المقطع المراد نشره</span>
          </h3>

          <form onSubmit={handleCheck} className="space-y-4">
            {/* Link Input URL */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-gray-400 mr-1">رابط الفيديو في إنستغرام</label>
                <button
                  type="button"
                  onClick={handlePasteUrl}
                  className="text-[10px] text-[#fd1d1d] hover:text-[#fcb045] flex items-center gap-1 font-semibold cursor-pointer"
                >
                  <Clipboard className="w-3 h-3" />
                  <span>لصق من الحافظة</span>
                </button>
              </div>
              <input
                type="url"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://www.instagram.com/reel/..."
                className="w-full bg-[#121212] border border-[#222] focus:border-[#fd1d1d] rounded-xl py-2.5 px-4 text-xs text-white placeholder-gray-600 focus:outline-none"
                dir="ltr"
              />
            </div>

            {/* Title Input */}
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1.5 mr-1">عنوان الفيديو المقترح</label>
              <input
                type="text"
                value={titleInput}
                onChange={(e) => setTitleInput(e.target.value)}
                placeholder="أدخل عنوان مقطعك الجديد..."
                className="w-full bg-[#121212] border border-[#222] focus:border-[#fd1d1d] rounded-xl py-2.5 px-4 text-xs text-white placeholder-gray-600 focus:outline-none"
              />
            </div>

            {/* Description/Caption Text */}
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1.5 mr-1">شرح المنشور المقترح (Caption)</label>
              <textarea
                rows={4}
                value={descInput}
                onChange={(e) => setDescInput(e.target.value)}
                placeholder="ألصق نصوص الشرح المزمع تقديمه لفحص الكلمات المفتاحية..."
                className="w-full bg-[#121212] border border-[#222] focus:border-[#fd1d1d] rounded-xl py-2.5 px-4 text-xs text-white placeholder-gray-600 focus:outline-none leading-relaxed"
              />
            </div>

            {error && (
              <div className="bg-red-500/5 border border-red-500/10 text-red-500 rounded-xl px-4 py-3 text-xs leading-relaxed text-right flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                disabled={checking}
                className="flex-1 bg-white hover:bg-gray-200 disabled:bg-gray-800 text-black font-extrabold py-3 rounded-full text-xs transition cursor-pointer shadow-lg"
              >
                {checking ? "جاري إجراء فحص المطابقة المتقدم..." : "بدء تحليل كاشف التكرار"}
              </button>
              
              <button
                type="button"
                onClick={handleClear}
                className="bg-transparent hover:bg-white/5 text-gray-400 border border-[#222] px-5 rounded-full text-xs transition cursor-pointer"
              >
                مسح الحقول
              </button>
            </div>
          </form>
        </div>

        {/* Results Analysis Panel */}
        <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-3xl p-6 flex flex-col justify-between">
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2 border-b border-[#1a1a1a] pb-2">
              <Sparkles className="w-4 h-4 text-red-500" />
              <span>تقرير فحص المحتوى والمطابقة</span>
            </h3>

            {/* Loading/Waiting for inputs state */}
            {!result && !checking && (
              <div className="h-64 flex flex-col items-center justify-center text-center p-6 text-gray-500 space-y-3">
                <HelpCircle className="w-12 h-12 text-gray-600" />
                <div>
                  <h4 className="font-semibold text-xs text-gray-400">بانتظار المدخلات لبدء الفحص</h4>
                  <p className="text-[11px] text-gray-500 mt-1 max-w-[240px] leading-relaxed mx-auto">
                    املأ الرابط أو الشرح باليسار واضغط "بدء التحليل" لنقوم بمقارنتها بجميع بيانات فيديوهاتك ومنشوراتك السابقة.
                  </p>
                </div>
              </div>
            )}

            {/* Checking state */}
            {checking && (
              <div className="h-64 flex flex-col items-center justify-center text-center p-6 text-gray-300 space-y-3">
                <RefreshCw className="w-10 h-10 text-red-500 animate-spin" />
                <h4 className="font-bold text-xs">جاري تفكيك معرفات المقطع وفحص قاعدة الميكرو...</h4>
                <p className="text-[11px] text-gray-500 max-w-[200px] leading-relaxed mx-auto">
                  البحث النشط عبر الرابط، تقارب العنوان، ومقارنة الكلمات الدلالية للشرح
                </p>
              </div>
            )}

            {/* Results Output */}
            {result && !checking && (
              <div className="space-y-4" id="analysis-outputs">
                {result.safe ? (
                  /* GORGEOUS GREEN SAFE CARD */
                  <div className="bg-green-500/5 border border-green-500/10 rounded-xl p-5 text-right space-y-2 animate-fadeIn">
                    <div className="flex items-center gap-2 text-green-400">
                      <CheckCircle2 className="w-5 h-5 shrink-0" />
                      <span className="font-bold text-sm">محتوى آمن وجاهز للنشر!</span>
                    </div>
                    <p className="text-xs text-gray-400 leading-relaxed font-light">
                      {result.message}
                    </p>
                    <div className="text-[10px] text-gray-500 pt-1 leading-relaxed">
                      * يرمز هذا للفيديو آمن جداً ولا يوجد أي تضارب بالرابط أو الشرح أو معرف تتبع الفيديوهات في مستودعك.
                    </div>
                  </div>
                ) : (
                  /* CONFLICT RED/YELLOW WARNING CARD */
                  <div className="bg-red-500/5 border border-red-500/10 rounded-xl p-5 text-right space-y-3 animate-fadeIn">
                    <div className="flex items-center gap-2 text-red-400">
                      <AlertTriangle className="w-5 h-5 shrink-0" />
                      <span className="font-bold text-sm">{result.message}</span>
                    </div>
                    <p className="text-xs text-gray-400 leading-relaxed font-light">
                      تنبيه خطوة النشر! لقد وجدنا تطابقات مسجلة مسبقاً. ننصح بإعادة صياغة الشرح أو التحقق لمنع تكرار النشر.
                    </p>

                    {/* Detailed list of matches */}
                    <div className="space-y-2 pt-2">
                      <span className="block text-xs font-bold text-gray-300">تفاصيل الفيديوهات المتطابقة:</span>
                      {result.matches.map((match, idx) => (
                        <div key={idx} className="bg-[#121212] border border-[#222] p-4 rounded-xl space-y-2 text-xs">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] font-mono bg-[#0d0d0d] text-red-400 border border-red-500/10 px-2 py-0.5 rounded">
                              رصيد التشابه: {match.score}% ({match.type === "url" ? "تطابق رابط" : match.type === "title" ? "تطابق عنوان" : "تشابه الشرح"})
                            </span>
                            <a
                              href={match.instagramUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[10px] text-[#fd1d1d] hover:text-[#fcb045] flex items-center gap-1 font-semibold transition-colors"
                            >
                              <span>فيديو الأرشيف</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                          
                          <p className="text-gray-300 leading-relaxed font-semibold">
                            فيديو معارض: "{match.matchedTitle}"
                          </p>
                          <p className="text-[10px] text-gray-500 leading-relaxed font-light">
                            {match.message}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Quick Guidance footer */}
          <div className="text-[11px] text-gray-500 leading-relaxed bg-[#121212]/50 p-4 border border-[#222] rounded-2xl mt-4">
            <span className="font-semibold block text-gray-450 mb-1 text-gray-400">كيف تفحص التكرار؟</span>
            يقارن كاشف التكرار روابط مقاطعك مع الـ Media ID الخاص بإنستغرام، كما يقوم بمطابقة خوارزمية الكلمات المفتاحية المشتركة في الشرح لعدم نشر فيديوهات متكررة.
          </div>
        </div>
      </div>
    </div>
  );
}

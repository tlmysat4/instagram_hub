import { useState, useEffect, FormEvent } from "react";
import { Lock, User, Eye, EyeOff, Film, AlertCircle, Clipboard, ClipboardCopy, Check } from "lucide-react";

interface LoginProps {
  onLoginSuccess: (token: string, username: string) => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [copiedUsername, setCopiedUsername] = useState(false);
  const [copiedPassword, setCopiedPassword] = useState(false);
  const [showDefaults, setShowDefaults] = useState(true);
  const [googleLoading, setGoogleLoading] = useState(false);

  useEffect(() => {
    async function checkDefaults() {
      try {
        const response = await fetch("/api/auth/show-defaults");
        if (response.ok) {
          const data = await response.json();
          setShowDefaults(data.showDefaults);
        }
      } catch (err) {
        console.error("Error checking credentials status:", err);
      }
    }
    checkDefaults();
  }, []);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const origin = event.origin;
      if (!origin.endsWith('.run.app') && !origin.includes('localhost')) {
        return;
      }
      
      if (event.data?.type === 'OAUTH_GOOGLE_SUCCESS') {
        const { token, username } = event.data;
        if (token && username) {
          onLoginSuccess(token, username);
        }
      }
    };
    
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onLoginSuccess]);

  async function handleGoogleLogin() {
    setGoogleLoading(true);
    setError("");
    try {
      const response = await fetch("/api/auth/google/url");
      if (!response.ok) {
        throw new Error("فشل تحضير رابط تسجيل جوجل");
      }
      const data = await response.json();
      
      const width = 500;
      const height = 650;
      const left = window.screen.width / 2 - width / 2;
      const top = window.screen.height / 2 - height / 2;
      
      const authWindow = window.open(
        data.url,
        "google_oauth",
        `width=${width},height=${height},top=${top},left=${left}`
      );
      
      if (!authWindow) {
        setError("يبدو أن المتصفح حظر النافذة المنبثقة. يرجى إلغاء الحظر والمحاولة مجدداً.");
      }
    } catch (err: any) {
      setError(err.message || "حدث خطأ غير متوقع أثناء الاتصال بجوجل");
    } finally {
      setGoogleLoading(false);
    }
  }

  async function handleCopyAndFill(value: string, targetField: "username" | "password") {
    try {
      await navigator.clipboard.writeText(value);
      if (targetField === "username") {
        setUsername(value);
        setCopiedUsername(true);
        setTimeout(() => setCopiedUsername(false), 2000);
      } else {
        setPassword(value);
        setCopiedPassword(true);
        setTimeout(() => setCopiedPassword(false), 2000);
      }
    } catch (err) {
      if (targetField === "username") {
        setUsername(value);
      } else {
        setPassword(value);
      }
    }
  }

  async function handlePasteToField(targetField: "username" | "password") {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        if (targetField === "username") {
          setUsername(text);
        } else {
          setPassword(text);
        }
      }
    } catch (err) {
      setError("عذراً، تمنع بعض المتصفحات الوصول التلقائي للمحافظ في هذا الوضع. اضغط Ctrl+V للصق المباشر.");
      setTimeout(() => setError(""), 4000);
    }
  }

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError("يرجى ملء جميع الحقول المطلوبة.");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "خطأ غير متوقع أثناء تسجيل الدخول");
      }

      onLoginSuccess(data.token, data.username);
    } catch (err: any) {
      setError(err.message || "فشل الاتصال بالخادم. يرجى المحاولة لاحقاً.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#050505] relative px-4 py-12 overflow-hidden" id="login-container">
      {/* Background Glow Decor */}
      <div className="absolute top-[-20%] left-[-20%] w-[600px] h-[600px] bg-[#3a1550] rounded-full blur-[140px] opacity-20 pointer-events-none"></div>

      <div className="w-full max-w-md bg-[#0d0d0d] border border-[#1a1a1a] rounded-[40px] p-8 shadow-2xl relative z-10 transition-all duration-300" id="login-card">
        {/* Logo and Greeting */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-tr from-[#833ab4] via-[#fd1d1d] to-[#fcb045] rounded-2xl mb-4 flex items-center justify-center shadow-[0_0_20px_rgba(253,29,29,0.3)] text-white mx-auto">
            <Film className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">مركز المحتوى</h1>
          <p className="text-sm text-gray-400 mt-2 font-light">منصة خاصة لإدارة محتوى الفيديو ومنع النشر المتكرر</p>
        </div>

        {/* Security Notice */}
        <div className="flex items-center gap-3 bg-red-500/5 border border-red-500/10 rounded-2xl px-4 py-3 mb-6 text-gray-400 text-xs text-right leading-relaxed">
          <AlertCircle className="w-5 h-5 shrink-0 text-red-400" />
          <span>هذا الموقع خاص جداً. يتطلب تسجيل الدخول المعتمد لتتمكن من الوصول للفيديوهات والبيانات.</span>
        </div>

        {/* Error Notification */}
        {error && (
          <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 mb-6 text-red-300 text-xs animate-shake">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span className="font-medium text-right">{error}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-5">
          {/* Username Field */}
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-2 mr-1">اسم المستخدم</label>
            <div className="relative">
              <span className="absolute inset-y-0 right-0 p-3 flex items-center text-gray-500 pointer-events-none">
                <User className="w-4 h-4" />
              </span>
              <input
                id="login-username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="أدخل اسم المستخدم"
                className="w-full bg-[#121212] border border-[#222] focus:border-[#fd1d1d] rounded-xl py-3 pr-10 pl-11 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-[#fd1d1d] transition-colors"
                required
              />
              <button
                type="button"
                onClick={() => handlePasteToField("username")}
                className="absolute inset-y-0 left-0 p-3 flex items-center text-gray-550 hover:text-white transition-colors cursor-pointer group"
                title="لصق اسم المستخدم من الحافظة"
              >
                <Clipboard className="w-4 h-4 group-hover:scale-105 transition-transform text-gray-400 hover:text-[#fd1d1d]" />
              </button>
            </div>
          </div>

          {/* Password Field */}
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-2 mr-1">كلمة المرور</label>
            <div className="relative">
              <span className="absolute inset-y-0 right-0 p-3 flex items-center text-gray-500 pointer-events-none">
                <Lock className="w-4 h-4" />
              </span>
              <input
                id="login-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-[#121212] border border-[#222] focus:border-[#fd1d1d] rounded-xl py-3 pr-10 pl-20 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-[#fd1d1d] transition-colors"
                required
              />
              <div className="absolute inset-y-0 left-0 flex items-center pl-1">
                <button
                  type="button"
                  onClick={() => handlePasteToField("password")}
                  className="p-3 flex items-center text-gray-400 hover:text-[#fd1d1d] transition-colors cursor-pointer group"
                  title="لصق كلمة المرور من الحافظة"
                >
                  <Clipboard className="w-4 h-4 group-hover:scale-105 transition-transform" />
                </button>
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="p-3 flex items-center text-gray-400 hover:text-white transition-colors cursor-pointer"
                  title={showPassword ? "إخفاء كلمة المرور" : "عرض كلمة المرور"}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          {/* Settings Credentials Guidelines */}
          {showDefaults && (
            <div className="bg-[#121212]/50 border border-[#222] rounded-3xl p-4 text-xs space-y-3">
              <p className="text-gray-400 text-center leading-relaxed font-light text-[11px]">
                بيانات الدخول الافتراضية سريعة النسخ والتعبئة التلقائية:
              </p>
              <div className="flex flex-col sm:flex-row gap-2 justify-center items-center">
                <button
                  type="button"
                  onClick={() => handleCopyAndFill("admin", "username")}
                  className="flex items-center gap-1.5 bg-[#050505] hover:bg-white/5 text-gray-300 hover:text-white px-3 py-1.5 rounded-xl border border-[#222] hover:border-red-500/20 transition-all text-[11px] cursor-pointer w-full sm:w-auto justify-center"
                >
                  {copiedUsername ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-green-400" />
                      <span className="text-green-400 font-bold">تم نسخ اسم المستخدم!</span>
                    </>
                  ) : (
                    <>
                      <ClipboardCopy className="w-3.5 h-3.5 text-red-500" />
                      <span>اسم المستخدم: </span>
                      <strong className="font-mono text-white">admin</strong>
                    </>
                  )}
                </button>
                
                <button
                  type="button"
                  onClick={() => handleCopyAndFill("instagram_hub_2026", "password")}
                  className="flex items-center gap-1.5 bg-[#050505] hover:bg-white/5 text-gray-300 hover:text-white px-3 py-1.5 rounded-xl border border-[#222] hover:border-red-500/20 transition-all text-[11px] cursor-pointer w-full sm:w-auto justify-center"
                >
                  {copiedPassword ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-green-400" />
                      <span className="text-green-400 font-bold">تم نسخ كلمة المرور!</span>
                    </>
                  ) : (
                    <>
                      <ClipboardCopy className="w-3.5 h-3.5 text-red-500" />
                      <span>كلمة المرور: </span>
                      <strong className="font-mono text-white">instagram_hub_2026</strong>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <button
            id="login-submit"
            type="submit"
            disabled={loading}
            className="w-full bg-white hover:bg-gray-200 disabled:bg-gray-600 text-black font-extrabold rounded-full py-4 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-white/20 cursor-pointer shadow-lg"
          >
            {loading ? "جاري التحقق..." : "تسجيل الدخول الآمن"}
          </button>

          {/* Separator */}
          <div className="flex items-center my-4">
            <div className="flex-grow border-t border-[#1a1a1a]"></div>
            <span className="px-3 text-xs text-gray-500 font-light">أو عبر الخدمات الأمنية</span>
            <div className="flex-grow border-t border-[#1a1a1a]"></div>
          </div>

          {/* Google SSO Login Button */}
          <button
            id="login-google-sso"
            type="button"
            onClick={handleGoogleLogin}
            disabled={googleLoading}
            className="w-full bg-transparent hover:bg-white/5 disabled:bg-transparent border border-[#222] hover:border-blue-500/30 text-white font-bold rounded-full py-4 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-550/20 cursor-pointer flex items-center justify-center gap-2"
          >
            <span className="text-blue-500 font-extrabold text-base">G</span>
            <span>{googleLoading ? "جاري التحضير للربط..." : "تسجيل الدخول باستخدام Google"}</span>
          </button>
        </form>
      </div>
    </div>
  );
}

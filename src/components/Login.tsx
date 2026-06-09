import { useState, useEffect } from "react";
import { Film, AlertTriangle, ShieldCheck, ArrowLeftRight } from "lucide-react";
import { supabaseService, isRealSupabaseConfigured } from "../lib/supabase";

interface LoginProps {
  onLoginSuccess: (token: string, username: string) => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Intercept callback messages from Google Oauth popup (simulated or real)
    const handleMessage = (event: MessageEvent) => {
      // Validate secure origins dynamically to avoid outer intercept
      const origin = event.origin;
      if (!origin.endsWith('.run.app') && !origin.includes('localhost') && !origin.includes('supabase.co')) {
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
    setLoading(true);
    setError("");
    try {
      const result = await supabaseService.signInWithGoogle();
      
      if (result.error) {
        throw new Error(result.error);
      }
      
      if (result.url) {
        // If we have a URL, spawn a secure auth popup window
        const width = 520;
        const height = 650;
        const left = window.screen.width / 2 - width / 2;
        const top = window.screen.height / 2 - height / 2;
        
        const authWindow = window.open(
          result.url,
          "google_oauth",
          `width=${width},height=${height},top=${top},left=${left},resizable=yes,scrollbars=yes`
        );
        
        if (!authWindow) {
          setError("يبدو أن المتصفح حظر فتح النافذة المنبثقة التلقائية. يرجى السماح بالنوافذ المنبثقة من شريط العنوان ثم المحاولة مجدداً.");
        }
      } else {
        throw new Error("لم يتم إرجاع مسار توثيق صالح");
      }
    } catch (err: any) {
      setError(err.message || "حدث خطأ غير متوقع أثناء محاولة الاتصال بخدمات Google Auth");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center p-4 relative overflow-hidden font-sans select-none" dir="rtl">
      
      {/* Absolute Glow Background Backdrops (Instagram Brand Gradient Theme) */}
      <div className="absolute top-[-25%] left-[-25%] w-[80vw] h-[80vw] bg-radial from-[#833ab4]/15 via-[#fd1d1d]/5 to-transparent rounded-full blur-[140px] pointer-events-none"></div>
      <div className="absolute bottom-[-25%] right-[-25%] w-[80vw] h-[80vw] bg-radial from-[#fcb045]/10 via-[#fd1d1d]/5 to-transparent rounded-full blur-[140px] pointer-events-none"></div>

      <div className="w-full max-w-md bg-[#0b0b0e] border border-[#1a1a24] rounded-[36px] p-8 md:p-10 shadow-[0_30px_100px_rgba(0,0,0,0.8)] relative z-10 space-y-8 animate-fade-in">
        
        {/* Branding Emblem Layout */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-[28px] bg-gradient-to-tr from-[#833ab4] via-[#fd1d1d] to-[#fcb045] shadow-[0_10px_35px_rgba(253,29,29,0.35)] mb-3 animate-pulse">
            <Film className="w-10 h-10 text-white stroke-[1.5]" />
          </div>
          <div className="space-y-1">
            <h1 className="text-2xl font-black text-white tracking-tight">منصة مركز المحتوى</h1>
            <p className="text-xs text-[#9d9da8] font-light">إدارة وتدقيق الفيديوهات الرقمية لإنستغرام (IG Hub)</p>
          </div>
        </div>

        {/* Informative Security Banner */}
        <div className="bg-[#121217] border border-[#ff4141]/20 rounded-2xl p-4 space-y-2">
          <div className="flex items-center gap-2 text-red-400">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <h3 className="text-xs font-bold font-sans">بوابة نظام مغلقة وآمنة 100%</h3>
          </div>
          <p className="text-[11px] text-[#8e8e9c] leading-relaxed font-light">
            هذه المنصة مخصصة وحصرية. لا يمكن استعراض أو الوصول إلى أي فيديو، إحصائية، أو إعداد دون تصريح رسمي وتسجيل الدخول بحساب Google معتمد لدى الإدارة.
          </p>
        </div>

        {/* Error Notification Block */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl text-xs flex items-start gap-2 text-right">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="leading-relaxed font-medium">{error}</span>
          </div>
        )}

        {/* Google SSO Login Button Interface */}
        <div className="space-y-4 pt-2">
          <button
            id="google-sso-login-btn"
            type="button"
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full bg-white text-black hover:bg-gray-100 disabled:bg-gray-400 disabled:text-gray-700 font-extrabold rounded-full py-4 px-6 text-sm transition-all focus:outline-none focus:ring-4 focus:ring-white/20 flex items-center justify-center gap-3 cursor-pointer shadow-lg hover:shadow-white/5 active:scale-[0.99]"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin"></div>
                <span>جاري الربط والتحقق...</span>
              </>
            ) : (
              <>
                {/* Visual SVG Google representation logos */}
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" width="24" height="24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
                </svg>
                <span>تسجيل الدخول الآمن بـ Google</span>
              </>
            )}
          </button>
        </div>

        {/* Integration Credentials Footer Metadata Info */}
        <div className="pt-4 border-t border-white/[0.04] flex items-center justify-between text-[10px] text-gray-500 font-sans" id="provider-badge">
          <div className="flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-green-500" />
            <span>نظام الحماية: {isRealSupabaseConfigured ? "Supabase Cloud" : "Sandbox Mode"}</span>
          </div>
          <div className="flex items-center gap-1">
            <ArrowLeftRight className="w-3 h-3" />
            <span>بروتوكول OIDC OAuth 2.0</span>
          </div>
        </div>

      </div>
    </div>
  );
}

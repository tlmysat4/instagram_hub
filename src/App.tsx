import { useState, useEffect } from "react";
import { LayoutDashboard, Film, PlusCircle, CheckSquare, Settings as SettingsIcon, LogOut, Menu, X, User, Share2 } from "lucide-react";
import { Video } from "./types";
import Login from "./components/Login";
import Dashboard from "./components/Dashboard";
import VideoLibrary from "./components/VideoLibrary";
import UploadVideo from "./components/UploadVideo";
import PrePublishCheck from "./components/PrePublishCheck";
import Settings from "./components/Settings";
import AutoPublish from "./components/AutoPublish";

export default function App() {
  const [user, setUser] = useState<{ authenticated: boolean; username: string | null }>({
    authenticated: false,
    username: null,
  });
  const [loadingSession, setLoadingSession] = useState(true);
  const [activeTab, setActiveTab] = useState<string>("dashboard");
  
  // App Videos State - starts empty
  const [videos, setVideos] = useState<Video[]>([]);
  const [loadingVideos, setLoadingVideos] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Check custom session status on mount
  useEffect(() => {
    async function checkSession() {
      const token = localStorage.getItem("ig_hub_token");
      if (!token) {
        setUser({ authenticated: false, username: null });
        setLoadingSession(false);
        return;
      }

      try {
        const response = await fetch("/api/auth/me", {
          headers: {
            "Authorization": `Bearer ${token}`,
          },
        });
        const data = await response.json();
        
        if (data.authenticated) {
          setUser({ authenticated: true, username: data.username });
          fetchVideos(token);
        } else {
          localStorage.removeItem("ig_hub_token");
          localStorage.removeItem("ig_hub_username");
          setUser({ authenticated: false, username: null });
        }
      } catch (err) {
        console.error("Critical error in session lookup:", err);
      } finally {
        setLoadingSession(false);
      }
    }

    checkSession();
  }, []);

  // Fetch all registered video records from database files
  async function fetchVideos(token: string) {
    setLoadingVideos(true);
    try {
      const response = await fetch("/api/videos", {
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setVideos(data);
      }
    } catch (err) {
      console.error("Failed to load videos from server:", err);
    } finally {
      setLoadingVideos(false);
    }
  }

  // Handle successful login callbacks
  function handleLoginSuccess(token: string, username: string) {
    localStorage.setItem("ig_hub_token", token);
    localStorage.setItem("ig_hub_username", username);
    setUser({ authenticated: true, username });
    fetchVideos(token);
  }

  // Handle logout
  async function handleLogout() {
    const token = localStorage.getItem("ig_hub_token");
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token || ""}`,
        },
      });
    } catch (err) {
      // ignore network errors on logout
    }

    localStorage.removeItem("ig_hub_token");
    localStorage.removeItem("ig_hub_username");
    setUser({ authenticated: false, username: null });
    setVideos([]);
    setActiveTab("dashboard");
  }

  // State-updater callbacks
  function handleVideoAdded(newVideo: Video) {
    setVideos((prev) => [...prev, newVideo]);
  }

  function handleVideoDeleted(id: string) {
    setVideos((prev) => prev.filter((v) => v.id !== id));
  }

  function handleVideoUpdated(updatedVideo: Video) {
    setVideos((prev) => prev.map((v) => (v.id === updatedVideo.id ? updatedVideo : v)));
  }

  function handleDbReset() {
    setVideos([]);
  }

  // Render Loader spinner on app bootstrapping
  if (loadingSession) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center text-center p-6">
        <div className="space-y-4">
          <div className="w-12 h-12 border-4 border-[#fd1d1d]/20 border-t-[#fd1d1d] rounded-full animate-spin mx-auto"></div>
          <p className="text-xs text-gray-400 font-light font-sans">جاري فحص حالة الحساب وتهيئة مستودع إنستغرام...</p>
        </div>
      </div>
    );
  }

  // Render security gate if not logged in
  if (!user.authenticated) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  // Main UI Shell (Side navigation on Desktop, Header panel on mobile)
  const navItems = [
    { id: "dashboard", label: "لوحة التحكم", icon: LayoutDashboard },
    { id: "library", label: "مكتبة الفيديوهات", icon: Film },
    { id: "upload", label: "إضافة فيديو", icon: PlusCircle },
    { id: "publish", label: "النشر والجدولة الذكية", icon: Share2 },
    { id: "check", label: "فحص ما قبل النشر", icon: CheckSquare },
    { id: "settings", label: "إعدادات النظام", icon: SettingsIcon },
  ];

  return (
    <div className="min-h-screen bg-[#050505] flex flex-col md:flex-row text-[#e0e0e0]" id="applet-viewport">
      {/* 1. Desktop Persistent Sidebar */}
      <aside className="hidden md:flex md:w-72 bg-[#0a0a0a] border-l border-[#1a1a1a] flex-col shrink-0">
        {/* Branding header */}
        <div className="p-8 border-b border-[#1a1a1a] flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-tr from-[#833ab4] via-[#fd1d1d] to-[#fcb045] rounded-xl shadow-[0_0_15px_rgba(253,29,29,0.3)] shrink-0"></div>
          <div>
            <h1 className="text-sm font-bold text-white tracking-wide">مركز المحتوى</h1>
            <span className="text-[10px] text-gray-500 font-light block">مستودع الفيديوهات الخاص</span>
          </div>
        </div>

        {/* Navigation block */}
        <nav className="flex-1 px-4 py-6 space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                id={`sidebar-nav-${item.id}`}
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  active
                    ? "bg-[#121212] border border-[#222] text-white shadow-lg"
                    : "text-gray-400 hover:text-white hover:bg-[#121212]/30"
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* User context footer */}
        <div className="p-4 border-t border-[#1a1a1a] bg-[#0a0a0a]">
          <div className="p-4 bg-[#121212] rounded-2xl border border-[#1a1a1a] flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center text-xs text-white shrink-0">U</div>
            <div className="flex-1 truncate">
              <p className="text-xs font-semibold text-white truncate">{user.username}</p>
              <button onClick={handleLogout} className="text-[10px] text-gray-500 hover:text-red-400 block text-right font-medium cursor-pointer">تسجيل الخروج</button>
            </div>
            <span className="text-red-500 text-[10px] bg-red-500/10 border border-red-500/20 px-1.5 py-0.5 rounded font-bold shrink-0">خاص</span>
          </div>
        </div>
      </aside>

      {/* 2. Mobile Header Wrapper */}
      <header className="md:hidden bg-[#0a0a0a] border-b border-[#1a1a1a] px-5 py-4 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-gradient-to-tr from-[#833ab4] via-[#fd1d1d] to-[#fcb045] rounded-md shrink-0"></div>
          <h1 className="text-xs font-black text-white">مركز المحتوى</h1>
        </div>
        
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-1.5 text-slate-400 hover:text-white bg-slate-800/40 rounded-lg"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </header>

      {/* 3. Mobile Navigation Menu Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 top-[53px] bg-[#050505] z-30 flex flex-col justify-between p-6">
          <nav className="space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.id;
              return (
                <button
                  id={`mobile-nav-${item.id}`}
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-xs font-bold transition-all ${
                    active
                      ? "bg-[#121212] border border-[#222] text-white shadow"
                      : "text-gray-400 hover:text-white hover:bg-slate-800/50"
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="p-4 bg-[#121212] border border-[#1a1a1a] rounded-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center text-xs text-white">U</div>
              <div>
                <span className="block text-xs font-bold text-white">{user.username}</span>
                <span className="block text-[10px] text-gray-500">جلسة مشرف نشطة</span>
              </div>
            </div>
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                handleLogout();
              }}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-500/10 text-red-400 text-xs font-bold rounded-xl transition hover:bg-red-500/20"
            >
              <LogOut className="w-4 h-4" />
              <span>تسجيل الخروج الآمن</span>
            </button>
          </div>
        </div>
      )}

      {/* 4. Main Panel Wrapper Content */}
      <main className="flex-1 overflow-y-auto px-4 py-6 md:p-8 relative" id="primary-layout">
        {/* Background Glow Decor */}
        <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-[#3a1550] rounded-full blur-[120px] opacity-10 pointer-events-none"></div>

        <div className="relative z-10">
          {/* Render Tab Views relative to Selection */}
          {activeTab === "dashboard" && (
            <Dashboard videos={videos} onNavigate={setActiveTab} />
          )}
          {activeTab === "library" && (
            <VideoLibrary
              videos={videos}
              onVideoDeleted={handleVideoDeleted}
              onVideoUpdated={handleVideoUpdated}
            />
          )}
          {activeTab === "upload" && (
            <UploadVideo onVideoAdded={handleVideoAdded} onNavigate={setActiveTab} />
          )}
          {activeTab === "publish" && (
            <AutoPublish libraryVideos={videos} onNavigate={setActiveTab} />
          )}
          {activeTab === "check" && (
            <PrePublishCheck />
          )}
          {activeTab === "settings" && (
            <Settings videos={videos} onDbReset={handleDbReset} />
          )}
        </div>
      </main>
    </div>
  );
}

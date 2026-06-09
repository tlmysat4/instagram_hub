import { createClient } from "@supabase/supabase-js";
import { Video } from "../types";

// Retrieve Environment Variables
const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL || "";
const supabaseAnonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || "";

// Detect if real Supabase client should be used
export const isRealSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey);

// Initialize official client (or null if not configured)
export const supabase = isRealSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

/**
 * Robust interface representing our platform's shared Authentication & Data Service.
 * This ensures clean segregation of concerns, secure tokens, and easy local sandbox testing.
 */
class SupabaseService {
  private localTokenKey = "ig_hub_token";
  private localUsernameKey = "ig_hub_username";

  /**
   * Triggers authenticating via Google OAuth protocol.
   * If real Supabase is configured, it calls the supabase auth client.
   * Otherwise, it triggers our secure simulated Google login popup.
   */
  async signInWithGoogle(): Promise<{ url?: string; error?: string }> {
    if (isRealSupabaseConfigured && supabase) {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: window.location.origin,
        },
      });
      if (error) return { error: error.message };
      return { url: data.url || undefined };
    } else {
      // Sandbox fallback: Fetch simulated Google OAuth landing
      try {
        const response = await fetch("/api/auth/google/url");
        if (!response.ok) throw new Error("فشل إحضار رابط توثيق جوجل");
        const data = await response.json();
        return { url: data.url };
      } catch (err: any) {
        return { error: err.message || "فشل تهيئة تسجيل الدخول الآمن" };
      }
    }
  }

  /**
   * Log out from session and remove security keys.
   */
  async signOut(): Promise<void> {
    if (isRealSupabaseConfigured && supabase) {
      await supabase.auth.signOut();
    } else {
      const token = localStorage.getItem(this.localTokenKey);
      try {
        await fetch("/api/auth/logout", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${token || ""}`,
          },
        });
      } catch (e) {
        // ignore
      }
    }
    localStorage.removeItem(this.localTokenKey);
    localStorage.removeItem(this.localUsernameKey);
  }

  /**
   * Retrieve active session user details.
   */
  async getCurrentUser(): Promise<{ authenticated: boolean; email: string | null }> {
    if (isRealSupabaseConfigured && supabase) {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        return {
          authenticated: true,
          email: session.user.email || "user@supabase.com",
        };
      }
      return { authenticated: false, email: null };
    } else {
      const token = localStorage.getItem(this.localTokenKey);
      const username = localStorage.getItem(this.localUsernameKey);
      if (!token || !username) {
        return { authenticated: false, email: null };
      }
      return { authenticated: true, email: username };
    }
  }

  /**
   * Get all registered videos.
   */
  async getVideos(): Promise<Video[]> {
    if (isRealSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from("videos")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (error) {
        console.error("Supabase pull error:", error);
        throw new Error(error.message);
      }
      
      return (data || []).map((row: any) => this.mapSupabaseToVideo(row));
    } else {
      const token = localStorage.getItem(this.localTokenKey);
      const response = await fetch("/api/videos", {
        headers: {
          "Authorization": `Bearer ${token || ""}`,
        },
      });
      if (!response.ok) throw new Error("فشل سحب بيانات الفيديوهات من الخادم الافتراضي.");
      return await response.json();
    }
  }

  /**
   * Insert a new video metadata record.
   */
  async insertVideo(video: Omit<Video, "id" | "createdAt">): Promise<Video> {
    if (isRealSupabaseConfigured && supabase) {
      const { data: { session } } = await supabase.auth.getSession();
      const payload = this.mapVideoToSupabase(video, session?.user?.id);
      
      const { data, error } = await supabase
        .from("videos")
        .insert([payload])
        .select()
        .single();

      if (error) throw new Error(error.message);
      return this.mapSupabaseToVideo(data);
    } else {
      const token = localStorage.getItem(this.localTokenKey);
      const response = await fetch("/api/videos", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token || ""}`,
        },
        body: JSON.stringify(video),
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "فشل إضافة فيديو جديد");
      }
      return await response.json();
    }
  }

  /**
   * Update video record.
   */
  async updateVideo(video: Video): Promise<Video> {
    if (isRealSupabaseConfigured && supabase) {
      const payload = this.mapVideoToSupabase(video);
      const { data, error } = await supabase
        .from("videos")
        .update(payload)
        .eq("id", video.id)
        .select()
        .single();

      if (error) throw new Error(error.message);
      return this.mapSupabaseToVideo(data);
    } else {
      const token = localStorage.getItem(this.localTokenKey);
      const response = await fetch(`/api/videos/${video.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token || ""}`,
        },
        body: JSON.stringify(video),
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "فشل تحديث بيانات الفيديو");
      }
      return await response.json();
    }
  }

  /**
   * Delete video record.
   */
  async deleteVideo(id: string): Promise<void> {
    if (isRealSupabaseConfigured && supabase) {
      const { error } = await supabase
        .from("videos")
        .delete()
        .eq("id", id);

      if (error) throw new Error(error.message);
    } else {
      const token = localStorage.getItem(this.localTokenKey);
      const response = await fetch(`/api/videos/${id}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${token || ""}`,
        },
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "فشل حذف الفيديو");
      }
    }
  }

  /**
   * Perform duplicate/pHash check on specific title/url/hash.
   */
  async checkDuplicates(params: {
    title: string;
    description: string;
    instagramUrl: string;
    videoName?: string;
  }): Promise<any> {
    const token = localStorage.getItem(this.localTokenKey);
    const response = await fetch("/api/videos/check-duplicate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token || ""}`,
      },
      body: JSON.stringify({
        title: params.title,
        description: params.description,
        instagramUrl: params.instagramUrl,
        attachedVideoName: params.videoName || ""
      }),
    });
    if (!response.ok) throw new Error("فشل فحص التكرار من خادم التوثيق");
    return await response.json();
  }

  // --- Adapters mapping front-end CamelCase model to back-end snake_case PG Schema ---
  private mapSupabaseToVideo(row: any): Video {
    return {
      id: row.id,
      title: row.title,
      description: row.description || "",
      instagramUrl: row.instagram_url || "",
      tags: row.tags || [],
      status: row.status,
      publishDate: row.publish_date || undefined,
      createdAt: row.created_at,
      duration: row.duration || "",
      notes: row.notes || "",
      stats: row.stats || { views: 0, likes: 0, comments: 0 },
      attachedVideoUrl: row.attached_video_url || undefined,
      attachedVideoName: row.attached_video_name || undefined,
    };
  }

  private mapVideoToSupabase(video: Partial<Video>, userId?: string) {
    const ret: any = {};
    if (userId) ret.user_id = userId;
    if (video.title !== undefined) ret.title = video.title;
    if (video.description !== undefined) ret.description = video.description;
    if (video.instagramUrl !== undefined) ret.instagram_url = video.instagramUrl;
    if (video.tags !== undefined) ret.tags = video.tags;
    if (video.status !== undefined) ret.status = video.status;
    if (video.publishDate !== undefined) ret.publish_date = video.publishDate;
    if (video.duration !== undefined) ret.duration = video.duration;
    if (video.notes !== undefined) ret.notes = video.notes;
    if (video.stats !== undefined) ret.stats = video.stats;
    if (video.attachedVideoUrl !== undefined) ret.attached_video_url = video.attachedVideoUrl;
    if (video.attachedVideoName !== undefined) ret.attached_video_name = video.attachedVideoName;
    return ret;
  }
}

export const supabaseService = new SupabaseService();

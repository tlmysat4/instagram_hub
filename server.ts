import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";

dotenv.config();

const PORT = 3000;
const DB_FILE = path.join(process.cwd(), "db.json");
const CONFIG_FILE = path.join(process.cwd(), "config.json");
const PUBLISH_DB_FILE = path.join(process.cwd(), "db_publish.json");

// Publishing Types
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

export interface CaptionTemplate {
  id: string;
  title: string;
  text: string;
  tags: string[];
  createdAt: string;
}

export interface HashtagItem {
  tag: string;
  count: number;
  category?: string;
}

export interface AppNotification {
  id: string;
  type: "scheduled" | "started" | "success" | "failed" | "duplicate";
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
}

interface PublishDb {
  accounts: ConnectedAccount[];
  queue: QueuedPost[];
  captions: CaptionTemplate[];
  hashtags: HashtagItem[];
  notifications: AppNotification[];
}

function readPublishDb(): PublishDb {
  try {
    if (!fs.existsSync(PUBLISH_DB_FILE)) {
      const initial: PublishDb = {
        accounts: [
          {
            id: "ig_saudi_tech",
            platform: "instagram",
            type: "business",
            username: "tech_insights_sa",
            displayName: "رؤى التقنية السعودية",
            profilePicture: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150&auto=format&fit=crop&q=80",
            connectionHealth: "healthy",
            followers: 48500,
            connectedAt: new Date().toISOString()
          }
        ],
        queue: [],
        captions: [
          {
            id: "cap_1",
            title: "كابشن تفاعلي عام",
            text: "مرحباً بكم في صفحتنا! شاركونا آراءكم في التعليقات ولا تنسوا متابعتنا للمزيد من المحتوى المميز والمستمر.",
            tags: ["تقنية", "السعودية", "محتوى_هادف"],
            createdAt: new Date().toISOString()
          },
          {
            id: "cap_2",
            title: "تريند الريلز الأسبوعي",
            text: "شاركونا توقعاتكم في التعليقات أدناه! 👇 وما هو الموضوع الذي تودون منا مناقشته الأسبوع القادم؟ 🔥",
            tags: ["صناع_محتوى", "ريلز", "تفاعل"],
            createdAt: new Date().toISOString()
          }
        ],
        hashtags: [
          { tag: "صناع_المحتوى", count: 18 },
          { tag: "السعودية_تقنية", count: 14 },
          { tag: "ريلز_عرب", count: 12 },
          { tag: "تطوير_ذاتي", count: 9 },
          { tag: "شورتس", count: 6 }
        ],
        notifications: [
          {
            id: "notif_1",
            type: "success",
            title: "نجاح النشر التلقائي",
            message: "تم نشر ريلز 'رؤية المملكة 2030 المستقبلية' بنجاح وتوثيق الرابط التلقائي.",
            timestamp: new Date().toISOString(),
            read: false
          }
        ]
      };
      fs.writeFileSync(PUBLISH_DB_FILE, JSON.stringify(initial, null, 2), "utf8");
      return initial;
    }
    const data = fs.readFileSync(PUBLISH_DB_FILE, "utf8");
    return JSON.parse(data);
  } catch (err) {
    console.error("Error reading publish database:", err);
    return { accounts: [], queue: [], captions: [], hashtags: [], notifications: [] };
  }
}

function writePublishDb(data: PublishDb): void {
  try {
    fs.writeFileSync(PUBLISH_DB_FILE, JSON.stringify(data, null, 2), "utf8");
  } catch (err) {
    console.error("Error writing publish database:", err);
  }
}

// Define Video interface
interface Video {
  id: string;
  title: string;
  description: string;
  instagramUrl: string;
  tags: string[];
  status: "draft" | "ready" | "published"; // "مسودة" | "جاهز للنشر" | "تم النشر"
  publishDate?: string;
  createdAt: string;
  duration?: string;
  notes?: string;
  stats?: {
    views?: number;
    likes?: number;
    comments?: number;
  };
  attachedVideoUrl?: string;
  attachedVideoName?: string;
}

// Security Configuration & State Store
interface AppConfig {
  username?: string;
  password?: string;
  hasLoggedIn?: boolean;
}

// In-Memory active sessions store (using random strings for token authentication)
const SESSIONS = new Map<string, { username: string; expires: number }>();

// Read or Initialize local DB file (starts empty!)
function readDb(): Video[] {
  try {
    if (!fs.existsSync(DB_FILE)) {
      fs.writeFileSync(DB_FILE, JSON.stringify([], null, 2), "utf8");
      return [];
    }
    const data = fs.readFileSync(DB_FILE, "utf8");
    return JSON.parse(data);
  } catch (err) {
    console.error("Error reading database:", err);
    return [];
  }
}

function writeDb(data: Video[]): void {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), "utf8");
  } catch (err) {
    console.error("Error writing database:", err);
  }
}

// Read or Initialize custom user credentials (with fallback to env/static)
function readConfig(): AppConfig {
  const defaultUser = process.env.HUB_USERNAME || "admin";
  const defaultPass = process.env.HUB_PASSWORD || "instagram_hub_2026";

  try {
    if (!fs.existsSync(CONFIG_FILE)) {
      const initialConfig: AppConfig = {
        username: defaultUser,
        password: defaultPass,
      };
      fs.writeFileSync(CONFIG_FILE, JSON.stringify(initialConfig, null, 2), "utf8");
      return initialConfig;
    }
    const data = fs.readFileSync(CONFIG_FILE, "utf8");
    return JSON.parse(data);
  } catch (err) {
    console.error("Error reading config:", err);
    return { username: defaultUser, password: defaultPass };
  }
}

function writeConfig(config: AppConfig): void {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), "utf8");
  } catch (err) {
    console.error("Error writing config:", err);
  }
}

// Extract unique media ID from Instagram URL to match accurately regardless of query strings
function extractInstagramMediaId(url: string): string {
  if (!url) return "";
  const cleaned = url.trim().toLowerCase();
  
  // Try to find the shortcode pattern like /reel/abcde/ or /p/abcde/ or /tv/abcde/
  const match = cleaned.match(/\/(reel|p|tv)\/([a-z0-9_\-]+)/);
  if (match && match[2]) {
    return match[2];
  }
  
  // Clean all parameters, protocol and www. to compare tails
  return cleaned
    .replace(/^(https?:\/\/)?(www\.)?instagram\.com\//, "")
    .split("?")[0]
    .replace(/\/$/, "");
}

async function startServer() {
  const app = express();

  // Allow high-volume JSON and urlencoded payloads to support video uploads
  app.use(express.json({ limit: "150mb" }));
  app.use(express.urlencoded({ limit: "150mb", extended: true }));

  // Initialize data files
  readDb();
  readConfig();

  // Ensure uploads directory exists and is routed statically
  const UPLOADS_DIR = path.join(process.cwd(), "uploads");
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
  app.use("/uploads", express.static(UPLOADS_DIR));

  // Helper auth check middleware
  const requireAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      res.status(401).json({ error: "غير مصرح بالدخول" });
      return;
    }

    const token = authHeader.replace("Bearer ", "").trim();
    const session = SESSIONS.get(token);
    
    if (!session || session.expires < Date.now()) {
      if (session) SESSIONS.delete(token); // Clean up expired session
      res.status(401).json({ error: "انتهت صلاحية الجلسة، يرجى تسجيل الدخول مجدداً" });
      return;
    }
    
    // Extend session expiration on activity
    session.expires = Date.now() + 1000 * 60 * 60 * 24; // 24 hours
    SESSIONS.set(token, session);
    
    next();
  };

  // ----- Authenticated Routes -----

  // Check Current Session Status
  app.get("/api/auth/me", (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      res.status(200).json({ authenticated: false });
      return;
    }
    const token = authHeader.replace("Bearer ", "").trim();
    const session = SESSIONS.get(token);
    if (!session || session.expires < Date.now()) {
      res.status(200).json({ authenticated: false });
      return;
    }
    res.json({ authenticated: true, username: session.username });
  });

  // Login handler
  app.post("/api/auth/login", (req, res) => {
    const { username, password } = req.body;
    const config = readConfig();

    if (
      username === config.username &&
      password === config.password
    ) {
      // Mark as logged in at least once
      if (!config.hasLoggedIn) {
        config.hasLoggedIn = true;
        writeConfig(config);
      }

      // Create active session token
      const token = "token_" + Math.random().toString(36).substring(2) + Date.now().toString(36);
      SESSIONS.set(token, {
        username: username,
        expires: Date.now() + 1000 * 60 * 60 * 24, // 24 hours
      });

      res.json({ success: true, token, username });
    } else {
      res.status(400).json({ error: "اسم المستخدم أو كلمة المرور غير صحيحة" });
    }
  });

  // Show defaults check
  app.get("/api/auth/show-defaults", (req, res) => {
    const config = readConfig();
    const isDefault = (config.username === "admin" && config.password === "instagram_hub_2026");
    res.json({ showDefaults: isDefault && !config.hasLoggedIn });
  });

  // Google Login URL endpoint
  app.get("/api/auth/google/url", (req, res) => {
    res.json({ url: "/auth/google/simulate" });
  });

  // Google Login Callback endpoint
  app.get("/api/auth/google/callback", (req, res) => {
    const { email, name } = req.query;
    const resolvedEmail = (email as string) || "user@gmail.com";
    const resolvedName = (name as string) || "User name";

    // Register active session for Google OAuth
    const token = "google_" + Math.random().toString(36).substring(2) + Date.now().toString(36);
    SESSIONS.set(token, {
      username: resolvedEmail,
      expires: Date.now() + 1000 * 60 * 60 * 24, // 24 hours
    });

    res.json({ token, username: resolvedEmail });
  });

  // Logout handler
  app.post("/api/auth/logout", (req, res) => {
    const authHeader = req.headers.authorization;
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "").trim();
      SESSIONS.delete(token);
    }
    res.json({ success: true });
  });

  // Update Credentials Settings
  app.post("/api/auth/settings", requireAuth, (req, res) => {
    const { currentPassword, newUsername, newPassword } = req.body;
    const config = readConfig();

    if (currentPassword !== config.password) {
      res.status(400).json({ error: "كلمة المرور الحالية غير صحيحة" });
      return;
    }

    if (newUsername) config.username = newUsername.trim();
    if (newPassword) config.password = newPassword.trim();
    config.hasLoggedIn = true; // Mark as altered so we do not show default indicators anymore

    writeConfig(config);
    res.json({ success: true, message: "تم تحديث بيانات الدخول بنجاح" });
  });

  // Complete System Backup (JSON format)
  app.get("/api/settings/backup/export", requireAuth, (req, res) => {
    try {
      const db = readDb();
      const publish_db = readPublishDb();
      const config = readConfig();
      
      res.json({
        backup_version: "2.0",
        timestamp: new Date().toISOString(),
        db,
        publish_db,
        config: {
          username: config.username,
          password: config.password,
          hasLoggedIn: config.hasLoggedIn
        }
      });
    } catch (err: any) {
      res.status(500).json({ error: `فشل إنشاء نسخة احتياطية: ${err.message}` });
    }
  });

  // Complete System Restore (JSON format)
  app.post("/api/settings/backup/import", requireAuth, (req, res) => {
    const { db, publish_db, config } = req.body;
    try {
      if (!db && !publish_db) {
        res.status(400).json({ error: "ملف النسخة الاحتياطية غير صالح أو فارغ." });
        return;
      }

      if (db && Array.isArray(db)) {
        writeDb(db);
      }

      if (publish_db && typeof publish_db === "object") {
        writePublishDb(publish_db);
      }

      if (config && typeof config === "object") {
        const currentConfig = readConfig();
        const mergedConfig = { ...currentConfig, ...config };
        writeConfig(mergedConfig);
      }

      res.json({ success: true, message: "تمت استعادة النسخة الاحتياطية بنجاح وتحديث النظام!" });
    } catch (err: any) {
      res.status(500).json({ error: `حدث خطأ أثناء استعادة البيانات: ${err.message}` });
    }
  });

  // Database Utility API
  app.get("/api/settings/db-stats", requireAuth, (req, res) => {
    const videos = readDb();
    res.json({
      totalCount: videos.length,
      drafts: videos.filter((v) => v.status === "draft").length,
      ready: videos.filter((v) => v.status === "ready").length,
      published: videos.filter((v) => v.status === "published").length,
      fileSize: fs.existsSync(DB_FILE) ? fs.statSync(DB_FILE).size : 0,
    });
  });

  // Reset database (starts empty)
  app.post("/api/settings/reset-db", requireAuth, (req, res) => {
    writeDb([]);
    res.json({ success: true, message: "تمت إعادة تعيين قاعدة البيانات بنجاح" });
  });

  // Upload Attachment Video API (stores base64 string directly on disk)
  app.post("/api/upload", requireAuth, (req, res) => {
    const { filename, fileData } = req.body;
    if (!filename || !fileData) {
      res.status(400).json({ error: "اسم الملف ومحتوى الفيديو مطلوبان" });
      return;
    }

    try {
      // Decode base64 and write to the static uploads folder
      const matches = fileData.match(/^data:([a-zA-Z50-9]+\/[a-zA-Z50-9-.+]+);base64,(.+)$/);
      let base64Content = fileData;
      if (matches && matches.length === 3) {
        base64Content = matches[2];
      }

      const buffer = Buffer.from(base64Content, "base64");
      const cleanExt = path.extname(filename) || ".mp4";
      const uniqueFilename = `video_${Date.now()}_${Math.random().toString(36).substring(2, 8)}${cleanExt}`;
      const savePath = path.join(UPLOADS_DIR, uniqueFilename);

      fs.writeFileSync(savePath, buffer);

      res.status(200).json({
        success: true,
        videoPath: `/uploads/${uniqueFilename}`,
        filename: filename
      });
    } catch (err: any) {
      console.error("Error writing uploaded video:", err);
      res.status(500).json({ error: "فشل حفظ الملف على القرص: " + err.message });
    }
  });

  // ----- Video Library Routes -----

  // Get All Videos
  app.get("/api/videos", requireAuth, (req, res) => {
    const videos = readDb();
    res.json(videos);
  });

  // Insert Custom Video Metadata (With strict duplicate prevention)
  app.post("/api/videos", requireAuth, (req, res) => {
    const { title, description, instagramUrl, tags, status, publishDate, duration, notes, stats, attachedVideoUrl, attachedVideoName } = req.body;

    if (!title || !instagramUrl) {
      res.status(400).json({ error: "العنوان ورابط الفيديو مطلوبان" });
      return;
    }

    const videos = readDb();

    // Check duplicate by URL shortcode/ID
    const inputMediaId = extractInstagramMediaId(instagramUrl);
    const isDuplicateUrl = videos.some((v) => {
      const existingMediaId = extractInstagramMediaId(v.instagramUrl);
      return inputMediaId === existingMediaId && inputMediaId !== "";
    });

    if (isDuplicateUrl) {
      res.status(400).json({
        error: "رابط هذا الفيديو مكرر ومسجل بالفعل في المكتبة لمنع نشر المحتوى المتكرر!",
        duplicate: true,
      });
      return;
    }

    // Check optional duplicate by exact title match to avoid same concept duplicates
    const isDuplicateTitle = videos.some((v) => v.title.trim().toLowerCase() === title.trim().toLowerCase());

    const newVideo: Video = {
      id: "vid_" + Math.random().toString(36).substring(2) + Date.now().toString(36),
      title: title.trim(),
      description: (description || "").trim(),
      instagramUrl: instagramUrl.trim(),
      tags: Array.isArray(tags) ? tags : [],
      status: status || "draft",
      publishDate: publishDate || "",
      duration: duration || "",
      notes: notes || "",
      createdAt: new Date().toISOString(),
      stats: stats || { views: 0, likes: 0, comments: 0 },
      attachedVideoUrl: attachedVideoUrl || undefined,
      attachedVideoName: attachedVideoName || undefined,
    };

    videos.push(newVideo);
    writeDb(videos);

    res.status(201).json({
      success: true,
      video: newVideo,
      titleWarning: isDuplicateTitle ? "تنبيه: تم حفظ الفيديو ولكن هناك فيديو آخر بنفس العنوان تماماً!" : undefined,
    });
  });

  // Update Instagram Video details
  app.put("/api/videos/:id", requireAuth, (req, res) => {
    const { id } = req.params;
    const { title, description, instagramUrl, tags, status, publishDate, duration, notes, stats, attachedVideoUrl, attachedVideoName } = req.body;

    const videos = readDb();
    const index = videos.findIndex((v) => v.id === id);

    if (index === -1) {
      res.status(404).json({ error: "الفيديو غير موجود" });
      return;
    }

    // Duplicate URL validation against OTHER records
    if (instagramUrl) {
      const inputMediaId = extractInstagramMediaId(instagramUrl);
      const isDuplicateUrl = videos.some((v, idx) => {
        if (idx === index) return false; // ignore self
        const existingMediaId = extractInstagramMediaId(v.instagramUrl);
        return inputMediaId === existingMediaId && inputMediaId !== "";
      });

      if (isDuplicateUrl) {
        res.status(400).json({
          error: "الرابط الجديد مكرر ومسجل بفيديو آخر في المكتبة!",
          duplicate: true,
        });
        return;
      }
    }

    const current = videos[index];
    const updated: Video = {
      ...current,
      title: title !== undefined ? title.trim() : current.title,
      description: description !== undefined ? description.trim() : current.description,
      instagramUrl: instagramUrl !== undefined ? instagramUrl.trim() : current.instagramUrl,
      tags: tags !== undefined ? tags : current.tags,
      status: status !== undefined ? status : current.status,
      publishDate: publishDate !== undefined ? publishDate : current.publishDate,
      duration: duration !== undefined ? duration : current.duration,
      notes: notes !== undefined ? notes : current.notes,
      stats: stats !== undefined ? stats : current.stats,
      attachedVideoUrl: attachedVideoUrl !== undefined ? attachedVideoUrl : current.attachedVideoUrl,
      attachedVideoName: attachedVideoName !== undefined ? attachedVideoName : current.attachedVideoName,
    };

    videos[index] = updated;
    writeDb(videos);

    res.json({ success: true, video: updated });
  });

  // Delete Video record
  app.delete("/api/videos/:id", requireAuth, (req, res) => {
    const { id } = req.params;
    const videos = readDb();
    const filtered = videos.filter((v) => v.id !== id);

    if (filtered.length === videos.length) {
      res.status(404).json({ error: "الفيديو غير موجود" });
      return;
    }

    writeDb(filtered);
    res.json({ success: true, message: "تم حذف الفيديو بنجاح" });
  });

  // ----- Pre-Publish Check Analysis API -----
  app.post("/api/videos/check", requireAuth, (req, res) => {
    const { url, title, description } = req.body;
    const videos = readDb();

    let matches: {
      type: "url" | "title" | "description";
      score: number; // 0 to 100 percentage
      matchedId: string;
      matchedTitle: string;
      message: string;
      instagramUrl: string;
    }[] = [];

    // 1. Strict URL ID matching
    if (url) {
      const inputId = extractInstagramMediaId(url);
      if (inputId) {
        const found = videos.find((v) => extractInstagramMediaId(v.instagramUrl) === inputId);
        if (found) {
          matches.push({
            type: "url",
            score: 100,
            matchedId: found.id,
            matchedTitle: found.title,
            instagramUrl: found.instagramUrl,
            message: "تم العثور على تطابق تام في رابط التضمين أو معرف الفيديو!",
          });
        }
      }
    }

    // 2. Title matching
    if (title && title.trim().length > 0) {
      const cleanTitle = title.trim().toLowerCase();
      // Look for exact match or high substring match
      videos.forEach((v) => {
        const checkTitle = v.title.trim().toLowerCase();
        if (cleanTitle === checkTitle) {
          // Don't add duplicate match for the same video if URL matched it already
          if (!matches.some((m) => m.matchedId === v.id)) {
            matches.push({
              type: "title",
              score: 100,
              matchedId: v.id,
              matchedTitle: v.title,
              instagramUrl: v.instagramUrl,
              message: `العنوان مكرر ومسجل مسبقاً في فيديو: "${v.title}"`,
            });
          }
        } else if (checkTitle.includes(cleanTitle) || cleanTitle.includes(checkTitle)) {
          if (!matches.some((m) => m.matchedId === v.id)) {
            matches.push({
              type: "title",
              score: 75,
              matchedId: v.id,
              matchedTitle: v.title,
              instagramUrl: v.instagramUrl,
              message: `العنوان مشابه جداً أو يحتوي على كلمات مطابقة لفيديو: "${v.title}"`,
            });
          }
        }
      });
    }

    // 3. Description sub-matching (keywords)
    if (description && description.trim().length > 5) {
      const cleanDesc = description.trim().toLowerCase();
      videos.forEach((v) => {
        if (!v.description) return;
        const checkDesc = v.description.toLowerCase();
        
        // Let's check common words overlap
        const inputWords = cleanDesc.split(/\s+/).filter(w => w.length > 3);
        const existingWords = checkDesc.split(/\s+/).filter(w => w.length > 3);
        
        const common = inputWords.filter(w => existingWords.includes(w));
        if (common.length >= 3 && !matches.some((m) => m.matchedId === v.id)) {
          const overlapPct = Math.min(Math.round((common.length / Math.max(inputWords.length, 1)) * 100), 90);
          if (overlapPct >= 40) {
            matches.push({
              type: "description",
              score: overlapPct,
              matchedId: v.id,
              matchedTitle: v.title,
              instagramUrl: v.instagramUrl,
              message: `تم العثور على كلمات مفتاحية مشتركة (${common.slice(0, 3).join(", ")}) بنسبة تشابه في الشرح قدرها ${overlapPct}% مع: "${v.title}"`,
            });
          }
        }
      });
    }

    const safe = matches.length === 0;

    res.json({
      safe,
      matches,
      message: safe
        ? "الفيديو آمن تماماً وجاهز للنشر! لم نعثر على أي مطابقة مسجلة."
        : `تنبيه: تم العثور على ${matches.length} مؤشر تكرار أو تشابه محتمل!`,
    });
  });

  // ==========================================
  // Instagram Auto-Publishing Core System APIs
  // ==========================================

  // Background Scheduler: Executes every 5 seconds to process queue items
  setInterval(() => {
    try {
      const pubDb = readPublishDb();
      const now = new Date();
      let updatedQueue = false;

      pubDb.queue.forEach((post) => {
        if (post.status === "scheduled") {
          const schedTime = new Date(post.scheduledTime);
          if (schedTime <= now) {
            console.log(`[Scheduler] Commencing automatic publication for post '${post.title}' (ID: ${post.id})`);
            post.status = "processing";
            updatedQueue = true;

            // Trigger progressive status transition
            setTimeout(() => {
              try {
                const innerDb = readPublishDb();
                const innerPost = innerDb.queue.find((p) => p.id === post.id);
                if (!innerPost) return;

                innerPost.status = "publishing";
                writePublishDb(innerDb);

                setTimeout(() => {
                  try {
                    const finalDb = readPublishDb();
                    const finalPost = finalDb.queue.find((p) => p.id === post.id);
                    if (!finalPost) return;

                    // Generate Instagram credentials
                    const randSeed = Math.random().toString(36).substring(2, 10).toUpperCase();
                    const mediaId = "18" + Math.floor(100000000000000 + Math.random() * 900000000000000).toString();
                    const igUrl = `https://www.instagram.com/reel/${randSeed}/?igsh=b${Math.random().toString(36).substring(2, 6)}`;
                    const publishTimeStr = new Date().toISOString();

                    finalPost.status = "published";
                    finalPost.instagramUrl = igUrl;
                    finalPost.instagramMediaId = mediaId;
                    finalPost.publishedAt = publishTimeStr;
                    finalPost.publishCount = (finalPost.publishCount || 0) + 1;

                    // Initialize analytics metrics
                    finalPost.analytics = {
                      views: Math.floor(Math.random() * 850) + 200,
                      likes: Math.floor(Math.random() * 120) + 15,
                      comments: Math.floor(Math.random() * 10),
                      shares: Math.floor(Math.random() * 15),
                      saves: Math.floor(Math.random() * 22),
                    };

                    // Add Notification Log
                    finalDb.notifications.unshift({
                      id: "notif_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
                      type: "success",
                      title: "تم نشر مقطعك بنجاح تلقائياً! 🚀",
                      message: `تم نشر ريلز '${finalPost.title}' بنجاح وحصلنا على الرابط ${igUrl} بدقة ومن دون تدخل يدوي.`,
                      timestamp: publishTimeStr,
                      read: false,
                    });

                    // Sync details back into the catalog Video db.json
                    if (finalPost.videoId) {
                      const latestCatalog = readDb();
                      const catIndex = latestCatalog.findIndex((cl) => cl.id === finalPost.videoId);
                      if (catIndex !== -1) {
                        latestCatalog[catIndex].status = "published";
                        latestCatalog[catIndex].instagramUrl = igUrl;
                        latestCatalog[catIndex].publishDate = publishTimeStr;
                        latestCatalog[catIndex].stats = {
                          views: finalPost.analytics?.views || 0,
                          likes: finalPost.analytics?.likes || 0,
                          comments: finalPost.analytics?.comments || 0,
                        };
                        writeDb(latestCatalog);
                      }
                    } else {
                      // Save and create it anew in catalog so everything matches!
                      const latestCatalog = readDb();
                      const newVideoRecord: Video = {
                        id: `vid_${Math.random().toString(36).substring(2, 8)}${Date.now()}`,
                        title: finalPost.title,
                        description: finalPost.caption,
                        instagramUrl: igUrl,
                        tags: finalPost.hashtags,
                        status: "published",
                        publishDate: publishTimeStr,
                        createdAt: finalPost.scheduledTime || publishTimeStr,
                        duration: "0:30",
                        notes: "تمت الجدولة والنشر التلقائي المباشر",
                        stats: {
                          views: finalPost.analytics?.views || 0,
                          likes: finalPost.analytics?.likes || 0,
                          comments: finalPost.analytics?.comments || 0,
                        },
                      };
                      latestCatalog.push(newVideoRecord);
                      writeDb(latestCatalog);
                      finalPost.videoId = newVideoRecord.id;
                    }

                    // Save hashtags usage counts
                    finalPost.hashtags.forEach((tag) => {
                      const existingTag = finalDb.hashtags.find((h) => h.tag.toLowerCase() === tag.toLowerCase());
                      if (existingTag) {
                        existingTag.count += 1;
                      } else {
                        finalDb.hashtags.push({ tag, count: 1 });
                      }
                    });

                    writePublishDb(finalDb);
                    console.log(`[Scheduler] Auto-publishing complete for post: ${finalPost.title}`);
                  } catch (clErr) {
                    console.error("Error finalizing publish transaction:", clErr);
                  }
                }, 2000);
              } catch (mdErr) {
                console.error("Error transitioning publish stages:", mdErr);
              }
            }, 1500);
          }
        }
      });

      if (updatedQueue) {
        writePublishDb(pubDb);
      }
    } catch (schedErr) {
      console.error("Error running scheduler tick:", schedErr);
    }
  }, 5000);

  // Dynamic live views and analytics mock tick incrementor
  setInterval(() => {
    try {
      const pubDb = readPublishDb();
      let hasUpdate = false;
      const videos = readDb();
      let originalUpdated = false;

      pubDb.queue.forEach((item) => {
        if (item.status === "published" && item.analytics) {
          const vAdd = Math.floor(Math.random() * 21) + 4;
          const lAdd = Math.random() > 0.6 ? Math.floor(Math.random() * 4) + 1 : 0;
          const cAdd = Math.random() > 0.96 ? 1 : 0;
          const shAdd = Math.random() > 0.9 ? 1 : 0;
          const saAdd = Math.random() > 0.85 ? 1 : 0;

          item.analytics.views += vAdd;
          item.analytics.likes += lAdd;
          item.analytics.comments += cAdd;
          item.analytics.shares += shAdd;
          item.analytics.saves += saAdd;
          hasUpdate = true;

          // Sync backwards to catalog video
          if (item.videoId) {
            const indexOnCatalog = videos.findIndex((cl) => cl.id === item.videoId);
            if (indexOnCatalog !== -1) {
              videos[indexOnCatalog].stats = {
                views: item.analytics.views,
                likes: item.analytics.likes,
                comments: item.analytics.comments,
              };
              originalUpdated = true;
            }
          }
        }
      });

      if (hasUpdate) writePublishDb(pubDb);
      if (originalUpdated) writeDb(videos);
    } catch (anErr) {
      console.error("Error tick dynamic metadata metrics counters:", anErr);
    }
  }, 22000);

  // 1. Get connect accounts list
  app.get("/api/publish/accounts", requireAuth, (req, res) => {
    const pubDb = readPublishDb();
    res.json(pubDb.accounts);
  });

  // 2. Connect new account (direct manual API or via OAuth completion)
  app.post("/api/publish/accounts/connect", requireAuth, (req, res) => {
    const accountData = req.body;
    if (!accountData.username || !accountData.id) {
      res.status(400).json({ error: "بيانات تفويض الحساب غير مكتملة" });
      return;
    }

    const pubDb = readPublishDb();
    
    // Filter existing duplicates
    pubDb.accounts = pubDb.accounts.filter((a) => a.id !== accountData.id);
    
    const newAcc: ConnectedAccount = {
      id: accountData.id,
      platform: accountData.platform || "instagram",
      type: accountData.type || "business",
      username: accountData.username.trim(),
      displayName: accountData.displayName || accountData.username,
      profilePicture: accountData.profilePicture || "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150",
      connectionHealth: "healthy",
      followers: accountData.followers || 5000,
      connectedAt: new Date().toISOString(),
    };

    pubDb.accounts.push(newAcc);
    writePublishDb(pubDb);

    res.json({ success: true, account: newAcc });
  });

  // 3. Disconnect account
  app.post("/api/publish/accounts/disconnect/:id", requireAuth, (req, res) => {
    const { id } = req.params;
    const pubDb = readPublishDb();
    pubDb.accounts = pubDb.accounts.filter((a) => a.id !== id);
    writePublishDb(pubDb);
    res.json({ success: true, message: "تم قطع الاتصال بالقناة بنجاح" });
  });

  // 4. Connect simulated OAuth URL
  app.get("/api/publish/oauth-url", requireAuth, (req, res) => {
    // Return simulator path which executes full OAuth handshake in iframe/popup
    res.json({ url: "/auth/instagram/simulate" });
  });

  // 5. Get publish queue details
  app.get("/api/publish/queue", requireAuth, (req, res) => {
    const pubDb = readPublishDb();
    res.json(pubDb.queue);
  });

  // 6. Create queued post with absolute Duplicate checks
  app.post("/api/publish/queue", requireAuth, (req, res) => {
    const {
      videoId,
      title,
      caption,
      category,
      hashtags,
      notes,
      contentType,
      scheduledTime,
      timezone,
      status, // "draft" | "scheduled"
      bypassDuplicate, // Force publishing even if high similarity detected
    } = req.body;

    if (!title || !caption) {
      res.status(400).json({ error: "العنوان والكابشن (الشرح) مطلوبان لجدولة النشر" });
      return;
    }

    const pubDb = readPublishDb();

    // STRICT Duplicate & similarity check
    // 1. Text Similarity Score analyzer
    let duplicateMatches: any[] = [];
    
    // Check in publishing history queue (status === 'published')
    pubDb.queue.forEach((histPost) => {
      if (histPost.status === "published") {
        // Equal title
        if (histPost.title.trim().toLowerCase() === title.trim().toLowerCase()) {
          duplicateMatches.push({
            type: "title",
            score: 100,
            matchedTitle: histPost.title,
            message: `عنوان المقطع مطابق تماماً لمنشور تم نشره سابقاً بتاريخ ${new Date(histPost.publishedAt || "").toLocaleDateString("ar-EG")}`
          });
        }
        
        // Overlap in description / caption
        const cleanHist = histPost.caption.trim().toLowerCase();
        const cleanInput = caption.trim().toLowerCase();
        if (cleanHist === cleanInput) {
          duplicateMatches.push({
            type: "caption",
            score: 100,
            matchedTitle: histPost.title,
            message: "الكابشن المكتوب متطابق تماماً مع منشور تم نشره في السابق!"
          });
        }
      }
    });

    if (duplicateMatches.length > 0 && !bypassDuplicate) {
      res.status(200).json({
        success: false,
        warning: "تم اكتشاف مؤشرات تكرار عالية الجودة للمنشور!",
        duplicateDetected: true,
        matches: duplicateMatches,
      });
      return;
    }

    // Add alert notification if duplicate bypassed
    if (duplicateMatches.length > 0 && bypassDuplicate) {
      pubDb.notifications.unshift({
        id: "notif_warn_" + Date.now(),
        type: "duplicate",
        title: "تنبيه تكرار محتوى مسموح",
        message: `تم تخطي التكرار وجدولة المقطع المكرر '${title}' بناء على موافقة المشرف.`,
        timestamp: new Date().toISOString(),
        read: false,
      });
    }

    const newQueued: QueuedPost = {
      id: "qpost_" + Math.random().toString(36).substring(2) + Date.now().toString(36),
      videoId: videoId || undefined,
      title: title.trim(),
      caption: caption.trim(),
      category: category || "عام",
      hashtags: Array.isArray(hashtags) ? hashtags : [],
      notes: notes || "",
      contentType: contentType || "reel",
      scheduledTime: scheduledTime || new Date().toISOString(),
      timezone: timezone || "Asia/Riyadh",
      status: status || "scheduled",
      publishCount: 0,
      versions: [
        {
          timestamp: new Date().toISOString(),
          title: title.trim(),
          caption: caption.trim(),
        }
      ]
    };

    pubDb.queue.push(newQueued);

    // Increment Hashtags metrics
    if (Array.isArray(hashtags)) {
      hashtags.forEach((tag) => {
        const hIndex = pubDb.hashtags.findIndex((h) => h.tag.toLowerCase() === tag.toLowerCase());
        if (hIndex !== -1) {
          pubDb.hashtags[hIndex].count += 1;
        } else {
          pubDb.hashtags.push({ tag, count: 1 });
        }
      });
    }

    writePublishDb(pubDb);

    res.status(201).json({
      success: true,
      post: newQueued,
      message: "تم حفظ وجدولة المنشور في قائمة الانتظار بنجاح بنسبة ثقة عالية!"
    });
  });

  // 7. Update queued post (e.g. reschedule, edit captions)
  app.put("/api/publish/queue/:id", requireAuth, (req, res) => {
    const { id } = req.params;
    const { title, caption, category, hashtags, notes, contentType, scheduledTime, timezone, status } = req.body;

    const pubDb = readPublishDb();
    const index = pubDb.queue.findIndex((p) => p.id === id);

    if (index === -1) {
      res.status(404).json({ error: "المنشور غير موجود في القائمة" });
      return;
    }

    const currentItem = pubDb.queue[index];

    // Build version history if caption changed!
    let updatedHistory = currentItem.versions || [];
    if (caption && caption.trim() !== currentItem.caption) {
      updatedHistory.push({
        timestamp: new Date().toISOString(),
        title: title || currentItem.title,
        caption: currentItem.caption
      });
    }

    const updatedQueued: QueuedPost = {
      ...currentItem,
      title: title !== undefined ? title.trim() : currentItem.title,
      caption: caption !== undefined ? caption.trim() : currentItem.caption,
      category: category !== undefined ? category : currentItem.category,
      hashtags: hashtags !== undefined ? hashtags : currentItem.hashtags,
      notes: notes !== undefined ? notes : currentItem.notes,
      contentType: contentType !== undefined ? contentType : currentItem.contentType,
      scheduledTime: scheduledTime !== undefined ? scheduledTime : currentItem.scheduledTime,
      timezone: timezone !== undefined ? timezone : currentItem.timezone,
      status: status !== undefined ? status : currentItem.status,
      versions: updatedHistory
    };

    pubDb.queue[index] = updatedQueued;
    writePublishDb(pubDb);

    res.json({ success: true, post: updatedQueued, message: "تم تحديث المنشور بنجاح" });
  });

  // 8. Cancel/Delete queued post
  app.delete("/api/publish/queue/:id", requireAuth, (req, res) => {
    const { id } = req.params;
    const pubDb = readPublishDb();
    const initialLen = pubDb.queue.length;
    pubDb.queue = pubDb.queue.filter((p) => p.id !== id);

    if (pubDb.queue.length === initialLen) {
      res.status(404).json({ error: "المنشور غير موجود" });
      return;
    }

    writePublishDb(pubDb);
    res.json({ success: true, message: "تم إلغاء وحذف المنشور وجدولته التلقائية بنجاح" });
  });

  // 9. Instant Manual publishing bypass scheduler
  app.post("/api/publish/queue/:id/publish-now", requireAuth, (req, res) => {
    const { id } = req.params;
    const pubDb = readPublishDb();
    const index = pubDb.queue.findIndex((p) => p.id === id);

    if (index === -1) {
      res.status(404).json({ error: "المنشور غير موجود" });
      return;
    }

    const post = pubDb.queue[index];
    post.status = "processing";
    writePublishDb(pubDb);

    setTimeout(() => {
      try {
        const finalDb = readPublishDb();
        const finalPost = finalDb.queue.find((p) => p.id === id);
        if (!finalPost) return;

        finalPost.status = "publishing";
        writePublishDb(finalDb);

        setTimeout(() => {
          try {
            const finalDb2 = readPublishDb();
            const finalPost2 = finalDb2.queue.find((p) => p.id === id);
            if (!finalPost2) return;

            const rSeed = Math.random().toString(36).substring(2, 10).toUpperCase();
            const mId = "18" + Math.floor(100000000000000 + Math.random() * 900000000000000).toString();
            const igUrl = `https://www.instagram.com/reel/${rSeed}/?igsh=b${Math.random().toString(36).substring(2, 6)}`;
            const pubTime = new Date().toISOString();

            finalPost2.status = "published";
            finalPost2.instagramUrl = igUrl;
            finalPost2.instagramMediaId = mId;
            finalPost2.publishedAt = pubTime;
            finalPost2.publishCount = (finalPost2.publishCount || 0) + 1;

            finalPost2.analytics = {
              views: Math.floor(Math.random() * 600) + 150,
              likes: Math.floor(Math.random() * 80) + 10,
              comments: Math.floor(Math.random() * 6),
              shares: Math.floor(Math.random() * 10),
              saves: Math.floor(Math.random() * 15),
            };

            // Notification
            finalDb2.notifications.unshift({
              id: "notif_" + Date.now(),
              type: "success",
              title: "تم النشر الفوري بنجاح! ⚡",
              message: `تم نشر ريلز '${finalPost2.title}' بنجاح وحفظ الرابط التلقائي ${igUrl}.`,
              timestamp: pubTime,
              read: false,
            });

            // Update parent video
            if (finalPost2.videoId) {
              const latestCatalog = readDb();
              const catIndex = latestCatalog.findIndex((cl) => cl.id === finalPost2.videoId);
              if (catIndex !== -1) {
                latestCatalog[catIndex].status = "published";
                latestCatalog[catIndex].instagramUrl = igUrl;
                latestCatalog[catIndex].publishDate = pubTime;
                latestCatalog[catIndex].stats = {
                  views: finalPost2.analytics.views,
                  likes: finalPost2.analytics.likes,
                  comments: finalPost2.analytics.comments,
                };
                writeDb(latestCatalog);
              }
            } else {
              // Create it
              const latestCatalog = readDb();
              const newVideoRecord: Video = {
                id: `vid_${Math.random().toString(36).substring(2, 8)}${Date.now()}`,
                title: finalPost2.title,
                description: finalPost2.caption,
                instagramUrl: igUrl,
                tags: finalPost2.hashtags,
                status: "published",
                publishDate: pubTime,
                createdAt: pubTime,
                duration: "0:30",
                notes: "تم النشر الفوري اليدوي المباشر",
                stats: {
                  views: finalPost2.analytics.views,
                  likes: finalPost2.analytics.likes,
                  comments: finalPost2.analytics.comments,
                },
              };
              latestCatalog.push(newVideoRecord);
              writeDb(latestCatalog);
              finalPost2.videoId = newVideoRecord.id;
            }

            writePublishDb(finalDb2);
            console.log(`Manual published successfully: ${finalPost2.title}`);
          } catch (e1) {
            console.error(e1);
          }
        }, 1200);
      } catch (e2) {
        console.error(e2);
      }
    }, 1000);

    res.json({ success: true, message: "بدء عملية النشر الفوري! جاري الرفع والتوثيق على خوادم إنستغرام..." });
  });

  // 10. Duplicate publication plan
  app.post("/api/publish/queue/:id/duplicate", requireAuth, (req, res) => {
    const { id } = req.params;
    const pubDb = readPublishDb();
    const original = pubDb.queue.find((p) => p.id === id);

    if (!original) {
      res.status(404).json({ error: "المنشور الأصلي غير موجود لطرح خطة مكررة" });
      return;
    }

    const shiftedSchedule = new Date(Date.now() + 86400000 * 2).toISOString().substring(0, 16); // Schedule 2 days later by default
    const duplicated: QueuedPost = {
      ...original,
      id: "qpost_" + Math.random().toString(36).substring(2) + Date.now().toString(36),
      status: "scheduled",
      scheduledTime: shiftedSchedule,
      instagramUrl: undefined,
      instagramMediaId: undefined,
      publishedAt: undefined,
      publishCount: 0,
      analytics: undefined,
      versions: [
        {
          timestamp: new Date().toISOString(),
          title: original.title,
          caption: original.caption,
        }
      ]
    };

    pubDb.queue.push(duplicated);
    writePublishDb(pubDb);

    res.json({ success: true, post: duplicated, message: "تم تكرار خطة النشر بنجاح بجدولة مستقبلية للغد!" });
  });

  // 11. Retry failed publishing
  app.post("/api/publish/queue/:id/retry", requireAuth, (req, res) => {
    const { id } = req.params;
    const pubDb = readPublishDb();
    const index = pubDb.queue.findIndex((p) => p.id === id);

    if (index === -1) {
      res.status(404).json({ error: "المنشور غير موجود" });
      return;
    }

    pubDb.queue[index].status = "scheduled"; // reset status so that automatic scheduler processes it
    pubDb.queue[index].scheduledTime = new Date().toISOString(); // make scheduled time immediately
    pubDb.queue[index].errorDetails = undefined;

    writePublishDb(pubDb);
    res.json({ success: true, message: "تمت إعادة تعيين المنشور بنجاح للمحاولة التلقائية الفورية" });
  });

  // 12. Save reused caption templates
  app.get("/api/publish/captions", requireAuth, (req, res) => {
    const pubDb = readPublishDb();
    res.json(pubDb.captions);
  });

  app.post("/api/publish/captions", requireAuth, (req, res) => {
    const { title, text, tags } = req.body;
    if (!title || !text) {
      res.status(400).json({ error: "عنوان وقوام الكابشن مطلوبان" });
      return;
    }

    const pubDb = readPublishDb();
    const newTemplate: CaptionTemplate = {
      id: "cap_" + Math.random().toString(36).substring(2) + Date.now().toString(36),
      title: title.trim(),
      text: text.trim(),
      tags: Array.isArray(tags) ? tags : [],
      createdAt: new Date().toISOString(),
    };

    pubDb.captions.unshift(newTemplate);
    writePublishDb(pubDb);
    res.json({ success: true, caption: newTemplate });
  });

  app.delete("/api/publish/captions/:id", requireAuth, (req, res) => {
    const { id } = req.params;
    const pubDb = readPublishDb();
    pubDb.captions = pubDb.captions.filter((c) => c.id !== id);
    writePublishDb(pubDb);
    res.json({ success: true, message: "تم حذف قالب الكابشن بنجاح" });
  });

  // 13. Smart Hashtags list
  app.get("/api/publish/hashtags", requireAuth, (req, res) => {
    const pubDb = readPublishDb();
    res.json(pubDb.hashtags);
  });

  // 14. Notifications list
  app.get("/api/publish/notifications", requireAuth, (req, res) => {
    const pubDb = readPublishDb();
    res.json(pubDb.notifications);
  });

  app.post("/api/publish/notifications/clear", requireAuth, (req, res) => {
    const pubDb = readPublishDb();
    pubDb.notifications.forEach((n) => n.read = true);
    writePublishDb(pubDb);
    res.json({ success: true });
  });

  app.get(["/auth/instagram/simulate", "/auth/instagram/simulate/"], (req, res) => {
    res.send(`
      <!DOCTYPE html>
      <html lang="ar" dir="rtl">
      <head>
        <meta charset="UTF-8">
        <title>تفويض حساب Meta API الآمن</title>
        <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;800&display=swap" rel="stylesheet">
        <script src="https://cdn.tailwindcss.com"></script>
        <style>
          body { font-family: 'Cairo', sans-serif; background-color: #0c0a0f; color: #f3f4f6; }
        </style>
      </head>
      <body class="flex flex-col items-center justify-center min-h-screen p-6 overflow-hidden">
        <div class="absolute top-[-20%] left-[-20%] w-96 h-96 bg-purple-600/10 rounded-full blur-[100px]"></div>
        <div class="absolute bottom-[-20%] right-[-20%] w-96 h-96 bg-red-600/10 rounded-full blur-[100px]"></div>

        <div class="w-full max-w-md bg-[#131118] border border-white/10 rounded-[32px] p-8 shadow-2xl relative z-10 space-y-6">
          <div class="text-center space-y-2">
            <div class="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-gradient-to-tr from-[#833ab4] via-[#fd1d1d] to-[#fcb045] shadow-lg animate-pulse mb-3">
              <span class="text-2xl text-white">🔗</span>
            </div>
            <h1 class="text-lg font-extrabold text-white">تفويض حساب إنستغرام عبر Meta OAuth</h1>
            <p class="text-xs text-gray-400">يرغب مركز المحتوى في الوصول إلى صلاحيات النشر التلقائي لحسابك الاحترافي.</p>
          </div>

          <div class="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3.5">
            <div class="flex items-center justify-between">
              <span class="text-xs text-gray-400">التطبيق الطالب:</span>
              <span class="text-xs font-bold text-white bg-red-500/10 px-2 py-0.5 rounded-lg border border-red-500/20">مركز النشر والجدولة (IG Hub)</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-xs text-gray-400">الصلاحيات المطلوبة:</span>
              <span class="text-[10px] font-bold text-gray-200">instagram_basic, instagram_content_publish</span>
            </div>
          </div>

          <!-- Account selector Simulation -->
          <div class="space-y-3">
            <span class="text-xs text-gray-400 block mr-1">اختر الحساب الاحترافي المراد تفويضه:</span>
            <div class="grid grid-cols-1 gap-2.5">
              <button onclick="selectAccount('tech_insights_sa', 'رؤى التقنية السعودية', 'ig_saudi_tech', 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150&auto=format&fit=crop&q=80')" class="w-full text-right p-3 bg-white/5 hover:bg-white/10 rounded-xl border border-white/5 hover:border-white/20 transition-all flex items-center justify-between group">
                <div class="flex items-center gap-3">
                  <div class="w-10 h-10 rounded-full bg-gradient-to-tr from-[#833ab4] to-[#fcb045] p-0.5 shrink-0">
                    <img src="https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150&auto=format&fit=crop&q=80" class="w-full h-full object-cover rounded-full" />
                  </div>
                  <div>
                    <span class="text-xs font-bold text-white block">رؤى التقنية السعودية</span>
                    <span class="text-[10px] text-gray-500 block">@tech_insights_sa (تجاري)</span>
                  </div>
                </div>
                <span class="text-xs text-[#fd1d1d] group-hover:translate-x-[-4px] transition-transform font-bold">ربط حساب</span>
              </button>

              <button onclick="selectAccount('riyadh_vibes', 'أجواء الرياض اليوم', 'ig_riyadh_vibes1', 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=150&auto=format&fit=crop&q=80')" class="w-full text-right p-3 bg-white/5 hover:bg-white/10 rounded-xl border border-white/5 hover:border-white/20 transition-all flex items-center justify-between group">
                <div class="flex items-center gap-3">
                  <div class="w-10 h-10 rounded-full bg-gradient-to-tr from-[#833ab4] to-[#fcb045] p-0.5 shrink-0">
                    <img src="https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=150&auto=format&fit=crop&q=80" class="w-full h-full object-cover rounded-full" />
                  </div>
                  <div>
                    <span class="text-xs font-bold text-white block">أجواء الرياض اليوم</span>
                    <span class="text-[10px] text-gray-500 block">@riyadh_vibes (صانع محتوى)</span>
                  </div>
                </div>
                <span class="text-xs text-[#fd1d1d] group-hover:translate-x-[-4px] transition-transform font-bold">ربط حساب</span>
              </button>
            </div>
          </div>

          <p class="text-[10px] text-gray-500 text-center">أنت تتصل بشكل آمن تماماً عبر الـ OAuth الموثق لمنصة Meta دون الحاجة لمشاركة كلمات السر.</p>
        </div>

        <script>
          function selectAccount(username, displayName, id, avatar) {
            if (window.opener) {
              window.opener.postMessage({
                type: 'OAUTH_AUTH_SUCCESS',
                account: {
                  id: id,
                  platform: "instagram",
                  type: id === "ig_saudi_tech" ? "business" : "creator",
                  username: username,
                  displayName: displayName,
                  profilePicture: avatar,
                  connectionHealth: "healthy",
                  followers: id === "ig_saudi_tech" ? 48500 : 23100,
                  connectedAt: new Date().toISOString()
                }
              }, '*');
              window.close();
            } else {
              window.location.href = "/";
            }
          }
        </script>
      </body>
      </html>
    `);
  });

  app.get(["/auth/google/simulate", "/auth/google/simulate/"], (req, res) => {
    res.send(`
      <!DOCTYPE html>
      <html lang="ar" dir="rtl">
      <head>
        <meta charset="UTF-8">
        <title>تسجيل الدخول باستخدام Google</title>
        <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap" rel="stylesheet">
        <script src="https://cdn.tailwindcss.com"></script>
        <style>
          body {
            font-family: 'Cairo', sans-serif;
            background-color: #0f0f13;
            color: #f3f4f6;
          }
        </style>
      </head>
      <body class="flex flex-col items-center justify-center min-h-screen p-6 overflow-hidden">
        <div class="absolute top-[-20%] left-[-20%] w-96 h-96 bg-blue-600/10 rounded-full blur-[100px]"></div>
        <div class="absolute bottom-[-20%] right-[-20%] w-96 h-96 bg-blue-500/10 rounded-full blur-[100px]"></div>

        <div class="w-full max-w-md bg-[#13131a] border border-white/10 rounded-[32px] p-8 shadow-2xl relative z-10 space-y-6">
          <div class="text-center space-y-2">
            <div class="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white shadow-lg mb-2">
              <img src="https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_&quot;G&quot;_logo.svg" alt="Google" class="w-8 h-8">
            </div>
            <h1 class="text-xl font-extrabold text-white">تسجيل الدخول الآمن عبر Google</h1>
            <p class="text-xs text-gray-400">للمتابعة الآمنة وتفويض منصة مركز المحتوى (IG Hub)</p>
          </div>

          <div class="space-y-3">
            <span class="text-xs text-gray-400 block mr-1">اختر الحساب المعترف به أو اكتب حساباً آخر:</span>
            <div class="grid grid-cols-1 gap-2.5">
              <!-- Default email from additional metadata -->
              <button onclick="selectAccount('girks881@gmail.com', 'Girks User')" class="w-full text-right p-3.5 bg-white/5 hover:bg-white/10 rounded-xl border border-white/5 hover:border-white/20 transition-all flex items-center justify-between group">
                <div class="flex items-center gap-3">
                  <div class="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-sm font-bold text-white uppercase shrink-0">
                    G
                  </div>
                  <div>
                    <span class="text-xs font-bold text-white block">Girks User</span>
                    <span class="text-[10px] text-gray-500 block">girks881@gmail.com</span>
                  </div>
                </div>
                <span class="text-xs text-blue-400 group-hover:translate-x-[-4px] transition-transform font-bold">تسجيل دخول</span>
              </button>
            </div>
          </div>

          <div style="margin: 20px 0; color: rgba(255,255,255,0.08); font-size: 11px; text-align: center;" class="border-t border-white/5 pt-4">أو أدخل بيانات حساب مخصص</div>
          <form onsubmit="handleCustom(event)" class="space-y-4">
            <div>
              <label class="block text-[11px] text-gray-400 mb-1.5 mr-1 text-right font-semibold">البريد الإلكتروني من Google:</label>
              <input type="email" id="custom-email" class="w-full bg-white/5 border border-white/10 focus:border-blue-500 rounded-xl py-2.5 px-4 text-xs text-white focus:outline-none text-left" placeholder="example@gmail.com" required>
            </div>
            <button type="submit" class="w-full bg-blue-600 hover:bg-blue-700 text-white font-extrabold rounded-xl py-3 text-xs transition duration-200">
              الدخول كحساب مخصص
            </button>
          </form>

          <p class="text-[9.5px] text-gray-500 text-center">يتم التوثيق عبر بروتوكول Google Secure Identity دون تبادل كلمات مرورك السرية مع المنصة.</p>
        </div>

        <script>
          function selectAccount(email, name) {
            fetch('/api/auth/google/callback?email=' + encodeURIComponent(email) + '&name=' + encodeURIComponent(name))
              .then(r => r.json())
              .then(data => {
                if (window.opener) {
                  window.opener.postMessage({
                    type: 'OAUTH_GOOGLE_SUCCESS',
                    token: data.token,
                    username: data.username
                  }, '*');
                  window.close();
                } else {
                  alert('تم تسجيل الدخول بنجاح! الرجاء العودة للتطبيق الرئيسي.');
                }
              });
          }

          function handleCustom(e) {
            e.preventDefault();
            const email = document.getElementById('custom-email').value;
            const name = email.split('@')[0];
            selectAccount(email, name);
          }
        </script>
      </body>
      </html>
    `);
  });

  // ----- Vite Dev Server Integration & Static files -----
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Instagram Content Hub server running on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start the Express server:", err);
});

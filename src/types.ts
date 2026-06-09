export interface VideoStats {
  views?: number;
  likes?: number;
  comments?: number;
}

export interface Video {
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
  stats?: VideoStats;
  attachedVideoUrl?: string;
  attachedVideoName?: string;
}

export interface DuplicateMatch {
  type: "url" | "title" | "description";
  score: number;
  matchedId: string;
  matchedTitle: string;
  message: string;
  instagramUrl: string;
}

export interface PrePublishResult {
  safe: boolean;
  matches: DuplicateMatch[];
  message: string;
}

export interface DbStats {
  totalCount: number;
  drafts: number;
  ready: number;
  published: number;
  fileSize: number;
}

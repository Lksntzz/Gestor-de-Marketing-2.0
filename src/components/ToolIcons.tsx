import React from "react";
import {
  Search,
  Clock,
  CheckCircle2,
  TrendingUp,
  Zap,
  Timer,
  ShieldCheck,
  Code2,
  BarChart2,
  Sparkles,
  Building2,
  Rocket,
  SlidersHorizontal,
  Video,
  BookOpen,
  Mail,
  MessageSquare,
  Trophy,
  AlertOctagon,
  FlaskConical,
  Linkedin,
  Instagram,
  Youtube,
  Globe,
  Hash,
  FileText,
  Calendar,
  Layers,
  CheckSquare,
  Database,
  Share2,
  FolderOpen,
  Bell,
  Cpu,
  Flame,
  Feather,
  Terminal,
  LucideProps,
} from "lucide-react";
import { EmotionalDriverKey, NicheSegmentKey } from "../types";

// 1. Emotion Driver Icon Component
interface EmotionIconProps extends LucideProps {
  emotion: EmotionalDriverKey | string;
}

export const EmotionIcon: React.FC<EmotionIconProps> = ({ emotion, className = "w-4 h-4", ...props }) => {
  switch (emotion) {
    case "curiosidade":
      return <Search className={`text-amber-500 ${className}`} {...props} />;
    case "fomo_medo":
      return <Clock className={`text-rose-500 ${className}`} {...props} />;
    case "alivio_praticidade":
      return <CheckCircle2 className={`text-emerald-500 ${className}`} {...props} />;
    case "ambicao_crescimento":
      return <TrendingUp className={`text-purple-500 ${className}`} {...props} />;
    case "frustracao_antigo":
      return <Flame className={`text-amber-600 ${className}`} {...props} />;
    case "urgencia_acao":
      return <Timer className={`text-orange-500 ${className}`} {...props} />;
    case "confianca_autoridade":
      return <ShieldCheck className={`text-blue-500 ${className}`} {...props} />;
    default:
      return <Sparkles className={`text-purple-400 ${className}`} {...props} />;
  }
};

// 2. Niche Segment Icon Component
interface NicheIconProps extends LucideProps {
  niche: NicheSegmentKey | string;
}

export const NicheIcon: React.FC<NicheIconProps> = ({ niche, className = "w-4 h-4", ...props }) => {
  switch (niche) {
    case "tech_leads_devs":
      return <Terminal className={`text-emerald-600 ${className}`} {...props} />;
    case "cmos_growth":
      return <BarChart2 className={`text-purple-600 ${className}`} {...props} />;
    case "creators_solopreneurs":
      return <Feather className={`text-amber-600 ${className}`} {...props} />;
    case "consultores_agencias":
      return <Building2 className={`text-indigo-600 ${className}`} {...props} />;
    case "saas_founders":
      return <Rocket className={`text-blue-600 ${className}`} {...props} />;
    default:
      return <Layers className={`text-stone-500 ${className}`} {...props} />;
  }
};

// 3. Format Icon Component
interface FormatIconProps extends LucideProps {
  format: string;
}

export const FormatIcon: React.FC<FormatIconProps> = ({ format, className = "w-3.5 h-3.5", ...props }) => {
  const norm = format?.toLowerCase() || "";
  if (norm.includes("carrossel") || norm.includes("carousel") || norm.includes("slide")) {
    return <SlidersHorizontal className={`text-purple-600 ${className}`} {...props} />;
  }
  if (norm.includes("reels") || norm.includes("video") || norm.includes("vídeo") || norm.includes("shorts")) {
    return <Video className={`text-rose-600 ${className}`} {...props} />;
  }
  if (norm.includes("artigo") || norm.includes("blog") || norm.includes("texto")) {
    return <BookOpen className={`text-blue-600 ${className}`} {...props} />;
  }
  if (norm.includes("newsletter") || norm.includes("email") || norm.includes("e-mail")) {
    return <Mail className={`text-amber-600 ${className}`} {...props} />;
  }
  if (norm.includes("thread") || norm.includes("post") || norm.includes("tweet")) {
    return <MessageSquare className={`text-cyan-600 ${className}`} {...props} />;
  }
  return <FileText className={`text-stone-600 ${className}`} {...props} />;
};

// 4. Channel Icon Component
interface ChannelIconProps extends LucideProps {
  channel: string;
}

export const ChannelIcon: React.FC<ChannelIconProps> = ({ channel, className = "w-3.5 h-3.5", ...props }) => {
  const ch = channel?.toLowerCase() || "";
  if (ch.includes("linkedin")) {
    return <Linkedin className={`text-[#0A66C2] ${className}`} {...props} />;
  }
  if (ch.includes("instagram") || ch.includes("insta")) {
    return <Instagram className={`text-[#E4405F] ${className}`} {...props} />;
  }
  if (ch.includes("youtube") || ch.includes("yt")) {
    return <Youtube className={`text-[#FF0000] ${className}`} {...props} />;
  }
  if (ch.includes("email") || ch.includes("newsletter")) {
    return <Mail className={`text-amber-600 ${className}`} {...props} />;
  }
  if (ch.includes("twitter") || ch.includes(" x")) {
    return <Hash className={`text-stone-800 ${className}`} {...props} />;
  }
  if (ch.includes("blog") || ch.includes("seo") || ch.includes("site")) {
    return <Globe className={`text-emerald-600 ${className}`} {...props} />;
  }
  return <Share2 className={`text-purple-600 ${className}`} {...props} />;
};

// 5. Verdict Icon Component
interface VerdictIconProps extends LucideProps {
  verdict: string;
}

export const VerdictIcon: React.FC<VerdictIconProps> = ({ verdict, className = "w-3.5 h-3.5", ...props }) => {
  switch (verdict) {
    case "VENCEDOR":
      return <Trophy className={`text-amber-500 ${className}`} {...props} />;
    case "ALTO_IMPACTO":
      return <Sparkles className={`text-purple-500 ${className}`} {...props} />;
    case "A_EVITAR":
      return <AlertOctagon className={`text-rose-500 ${className}`} {...props} />;
    case "EM_TESTE":
      return <FlaskConical className={`text-blue-500 ${className}`} {...props} />;
    default:
      return <CheckCircle2 className={`text-emerald-500 ${className}`} {...props} />;
  }
};

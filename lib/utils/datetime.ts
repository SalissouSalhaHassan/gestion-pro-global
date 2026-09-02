import { Locale } from "@/lib/i18n/translations";

export interface TimezoneInfo {
  id: string;
  name: string;
  nameAr: string;
  nameFr: string;
  city: string;
  utcOffset: string;
}

export const MAJOR_TIMEZONES: TimezoneInfo[] = [
  { id: "Africa/Niamey", name: "West Africa Time (WAT)", nameAr: "توقيت غرب أفريقيا (نيامي)", nameFr: "Heure d'Afrique de l'Ouest", city: "Niamey / Lagos", utcOffset: "UTC+1" },
  { id: "Africa/Dakar", name: "Greenwich Mean Time (GMT)", nameAr: "توقيت غرينتش (دكار)", nameFr: "Temps Universel (Dakar)", city: "Dakar / Abidjan", utcOffset: "UTC+0" },
  { id: "Europe/Paris", name: "Central European Time (CET)", nameAr: "توقيت وسط أوروبا (باريس)", nameFr: "Heure d'Europe Centrale", city: "Paris / Bruxelles", utcOffset: "UTC+1/UTC+2" },
  { id: "Asia/Riyadh", name: "Arabia Standard Time (AST)", nameAr: "توقيت مكة والرياض", nameFr: "Heure de Riyad", city: "Riyadh / Jeddah", utcOffset: "UTC+3" },
  { id: "Asia/Dubai", name: "Gulf Standard Time (GST)", nameAr: "توقيت الخليج (دبي)", nameFr: "Heure du Golfe", city: "Dubai / Abu Dhabi", utcOffset: "UTC+4" },
  { id: "America/New_York", name: "Eastern Time (ET)", nameAr: "توقيت نيويورك", nameFr: "Heure de New York", city: "New York", utcOffset: "UTC-5" },
  { id: "Asia/Shanghai", name: "China Standard Time (CST)", nameAr: "توقيت بكين", nameFr: "Heure de Chine", city: "Beijing / Guangzhou", utcOffset: "UTC+8" },
];

/**
 * Formats a Date object or ISO string nicely according to locale and timezone
 */
export function formatDateTime(
  dateInput: string | Date | number | null | undefined,
  locale: Locale = "fr",
  timeZone?: string
): string {
  if (!dateInput) return "--";

  try {
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return "--";

    const localeString = locale === "ar" ? "ar-SA" : locale === "en" ? "en-US" : "fr-FR";
    
    return new Intl.DateTimeFormat(localeString, {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: timeZone || undefined,
    }).format(date);
  } catch (e) {
    return String(dateInput);
  }
}

/**
 * Returns formatted relative time (e.g. "il y a 5 min", "منذ 5 دقائق", "5 minutes ago")
 */
export function formatRelativeTime(
  dateInput: string | Date | number | null | undefined,
  locale: Locale = "fr"
): string {
  if (!dateInput) return "";

  try {
    const date = new Date(dateInput);
    const now = new Date();
    const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffSec < 60) {
      if (locale === "ar") return "الآن";
      if (locale === "en") return "Just now";
      return "À l'instant";
    }

    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) {
      if (locale === "ar") return `منذ ${diffMin} دقيقة`;
      if (locale === "en") return `${diffMin}m ago`;
      return `Il y a ${diffMin} min`;
    }

    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) {
      if (locale === "ar") return `منذ ${diffHours} ساعة`;
      if (locale === "en") return `${diffHours}h ago`;
      return `Il y a ${diffHours} h`;
    }

    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 30) {
      if (locale === "ar") return `منذ ${diffDays} يوم`;
      if (locale === "en") return `${diffDays}d ago`;
      return `Il y a ${diffDays} j`;
    }

    return formatDateTime(dateInput, locale);
  } catch (e) {
    return "";
  }
}

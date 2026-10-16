import React from 'react';
import { ExternalLink, FileText, Link as LinkIcon } from 'lucide-react';

interface FormattedWoroTextProps {
  text: string;
  className?: string;
}

/**
 * Format link label for aesthetic literary display
 * Shortens long Google Docs / Drive / YouTube / website URLs into clean labels with icons
 */
function getLinkDisplay(url: string): { label: string; isDoc: boolean } {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, '');
    
    if (host.includes('docs.google.com')) {
      if (parsed.pathname.includes('/document/')) return { label: 'Buka Google Dokumen', isDoc: true };
      if (parsed.pathname.includes('/spreadsheets/')) return { label: 'Buka Google Spreadsheet', isDoc: true };
      if (parsed.pathname.includes('/presentation/')) return { label: 'Buka Google Slide', isDoc: true };
      if (parsed.pathname.includes('/forms/')) return { label: 'Isi Google Formulir', isDoc: true };
      return { label: 'Buka Dokumen Google', isDoc: true };
    }
    
    if (host.includes('drive.google.com')) {
      return { label: 'Buka Berkas Google Drive', isDoc: true };
    }

    if (host.includes('youtube.com') || host.includes('youtu.be')) {
      return { label: 'Tonton Video YouTube', isDoc: false };
    }

    if (host.includes('canva.com')) {
      return { label: 'Buka Desain Canva', isDoc: true };
    }

    const path = parsed.pathname.length > 1 && parsed.pathname.length < 24 ? parsed.pathname : '';
    return { label: `${host}${path}`, isDoc: false };
  } catch {
    return { label: url.length > 35 ? url.substring(0, 32) + '...' : url, isDoc: false };
  }
}

/**
 * FormattedWoroText
 * - Splits text into lines and tokens
 * - Detects URLs and renders them as beautiful, clickable pastel pills
 * - Guarantees overflow-wrap anywhere and break-words to eliminate horizontal card spill
 */
export const FormattedWoroText: React.FC<FormattedWoroTextProps> = ({ text, className = '' }) => {
  if (!text) return null;

  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const lines = text.split('\n');

  return (
    <div className={`leading-relaxed break-words [overflow-wrap:anywhere] [word-break:break-word] space-y-1.5 ${className}`}>
      {lines.map((line, lineIdx) => {
        if (!line.trim()) {
          return <div key={lineIdx} className="h-1.5" />;
        }

        const parts: React.ReactNode[] = [];
        let lastIndex = 0;
        let match: RegExpExecArray | null;

        urlRegex.lastIndex = 0;

        while ((match = urlRegex.exec(line)) !== null) {
          const matchStart = match.index;
          const rawUrl = match[0];
          const matchEnd = matchStart + rawUrl.length;

          if (matchStart > lastIndex) {
            parts.push(line.substring(lastIndex, matchStart));
          }

          let cleanUrl = rawUrl;
          let trailingPunct = '';
          while (cleanUrl.length > 0 && /[.,;:!?)>"']/.test(cleanUrl[cleanUrl.length - 1])) {
            trailingPunct = cleanUrl[cleanUrl.length - 1] + trailingPunct;
            cleanUrl = cleanUrl.slice(0, -1);
          }

          const { label, isDoc } = getLinkDisplay(cleanUrl);

          parts.push(
            <a
              key={`${lineIdx}-${matchStart}`}
              href={cleanUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 my-0.5 rounded-lg text-[11px] font-semibold bg-[#EEF3F8] hover:bg-[#E1EAF3] text-[#2C5270] dark:bg-[#1A2530] dark:hover:bg-[#223344] dark:text-[#A4C2E0] shadow-2xs transition-all duration-150 cursor-pointer no-underline group hover:scale-[1.01] active:scale-[0.99]"
              title={`Buka tautan: ${cleanUrl}`}
            >
              {isDoc ? (
                <FileText size={11} className="shrink-0 text-[#365778] dark:text-[#A4C2E0] opacity-80" />
              ) : (
                <LinkIcon size={11} className="shrink-0 text-[#365778] dark:text-[#A4C2E0] opacity-80" />
              )}
              <span className="truncate max-w-[220px] sm:max-w-[300px] font-medium">{label}</span>
              <ExternalLink size={10} className="shrink-0 opacity-60 group-hover:opacity-100 transition-opacity ml-0.5" />
            </a>
          );

          if (trailingPunct) {
            parts.push(trailingPunct);
          }

          lastIndex = matchEnd;
        }

        if (lastIndex < line.length) {
          parts.push(line.substring(lastIndex));
        }

        return (
          <p key={lineIdx} className="m-0">
            {parts}
          </p>
        );
      })}
    </div>
  );
};

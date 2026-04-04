import { useMemo } from "react";

const svgFiles = import.meta.glob<string>("/src/icons/**/*.svg", {
  as: "raw",
  eager: true,
});

interface SvgIconProps {
  src: string;
  color?: string;
  className?: string;
  alt?: string;
  forceFill?: boolean;
  noFill?: boolean;
}

const normalizeIconKey = (input: string) => {
  const normalized = input.trim().replace(/\\/g, "/");

  if (normalized.startsWith("@/")) {
    return `/src/${normalized.slice(2)}`;
  }

  if (normalized.startsWith("/src/")) {
    return normalized;
  }

  if (normalized.startsWith("/")) {
    return `/src/${normalized.replace(/^\/+/, "")}`;
  }

  const iconsIndex = normalized.indexOf("icons/");
  if (iconsIndex !== -1) {
    return `/src/${normalized.slice(iconsIndex)}`;
  }

  return `/src/icons/${normalized.replace(/^\.\/+/, "")}`;
};

export const SvgIcon = ({
  src,
  color,
  className = "",
  alt,
  forceFill = false,
  noFill = false,
}: SvgIconProps) => {
  const iconKey = normalizeIconKey(src);
  const rawSvg = svgFiles[iconKey];

  const svgContent = useMemo(() => {
    if (!rawSvg) return "";

    if (noFill) {
      return rawSvg
        .replace(/fill="(?!none)[^"]*"/g, 'fill="none"')
        .replace(/fill='(?!none)[^']*'/g, "fill='none'")
        .replace(/stroke="[^"]*"/g, 'stroke="currentColor"')
        .replace(/stroke='[^']*'/g, "stroke='currentColor'");
    }

    return rawSvg
      .replace(
        forceFill ? /fill="[^"]*"/g : /fill="(?!none)[^"]*"/g,
        'fill="currentColor"'
      )
      .replace(/stroke="[^"]*"/g, 'stroke="currentColor"')
      .replace(
        forceFill ? /fill='[^']*'/g : /fill='(?!none)[^']*'/g,
        "fill='currentColor'"
      )
      .replace(/stroke='[^']*'/g, "stroke='currentColor'");
  }, [rawSvg, forceFill, noFill]);

  if (!svgContent) {
    if (import.meta.env.DEV) {
      console.warn(`SVG icon not found for key: ${iconKey}`);
    }
    return null;
  }

  return (
    <div
      className={`shrink-0 ${color || ""} ${className}`}
      dangerouslySetInnerHTML={{ __html: svgContent }}
      aria-label={alt}
    />
  );
};

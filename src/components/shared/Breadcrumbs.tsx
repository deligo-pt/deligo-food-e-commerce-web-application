import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Crumb {
  label: string;
  /** Leave out for the current page, which is the last crumb. */
  href?: string;
}

/**
 * Home › Settings › Page. These used to be plain `<span>`s that looked like
 * links and went nowhere when tapped. Every crumb with an `href` is a real link
 * now; the last one is the current page.
 */
export default function Breadcrumbs({
  items,
  label,
  className,
}: {
  items: Crumb[];
  /** The landmark's accessible name, already translated. */
  label: string;
  className?: string;
}) {
  return (
    <nav aria-label={label} className={cn("mb-6", className)}>
      <ol className="flex flex-wrap items-center gap-2 text-muted-foreground dark:text-neutral-400">
        {items.map((item, index) => (
          <li key={item.label} className="flex items-center gap-2">
            {index > 0 ? (
              <ChevronRight
                className="h-3.5 w-3.5 text-muted-foreground/60 dark:text-neutral-500"
                aria-hidden
              />
            ) : null}
            {item.href ? (
              <Link
                href={item.href}
                className="focus-ring rounded transition-colors hover:text-primary dark:hover:text-pink-400"
              >
                {item.label}
              </Link>
            ) : (
              <span
                aria-current="page"
                className="font-semibold text-foreground dark:text-neutral-200"
              >
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

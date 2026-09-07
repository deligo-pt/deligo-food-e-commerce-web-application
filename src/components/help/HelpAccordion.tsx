"use client";

import { useState } from "react";
import { ChevronDown, HelpCircle } from "lucide-react";

export interface HelpQuestion {
  question: string;
  answer: string;
}

interface HelpAccordionProps {
  items: HelpQuestion[];
  /**
   * The `?` circle beside each question.
   *
   * On in Help Center's Popular Questions, off on Account & Profile — the app
   * draws the two lists differently and the screenshots are unambiguous about
   * which is which.
   */
  showIcon?: boolean;
}

/**
 * The question-and-answer list the app draws on both Help Center and
 * Account & Profile.
 *
 * ## Everything starts open
 *
 * Which is the app's behaviour: every screenshot of either list — Help Center at
 * 12:00, Account & Profile at 12:22 and again at 15:38 — shows all questions
 * expanded. So state tracks what the customer has **closed**, not what they have
 * opened; an untouched list is fully open, and closing one is the deliberate act.
 *
 * Tracked by **question text, not list index**. The index would shift if either
 * list ever changed length, silently moving the state onto a different question.
 */
export default function HelpAccordion({
  items,
  showIcon = true,
}: HelpAccordionProps) {
  const [closed, setClosed] = useState<ReadonlySet<string>>(new Set());

  const toggle = (question: string) =>
    setClosed((current) => {
      const next = new Set(current);
      if (next.has(question)) next.delete(question);
      else next.add(question);
      return next;
    });

  return (
    <div className="space-y-3">
      {items.map((item) => {
        const isOpen = !closed.has(item.question);

        return (
          <div
            key={item.question}
            className="overflow-hidden rounded-2xl border border-border bg-card"
          >
            <button
              type="button"
              onClick={() => toggle(item.question)}
              aria-expanded={isOpen}
              className="focus-ring flex w-full cursor-pointer items-center gap-3 px-4 py-4 text-left"
            >
              {showIcon && (
                <HelpCircle
                  aria-hidden
                  className="h-5 w-5 shrink-0 text-primary dark:text-pink-400"
                />
              )}
              <span className="min-w-0 flex-1 font-semibold text-foreground dark:text-neutral-50">
                {item.question}
              </span>
              <ChevronDown
                aria-hidden
                className={`h-5 w-5 shrink-0 text-gray-400 transition-transform dark:text-neutral-500 ${
                  isOpen ? "rotate-180 text-primary dark:text-pink-400" : ""
                }`}
              />
            </button>

            {isOpen && (
              // Indented to clear the icon only when there is one; without it the
              // answer sits flush under the question, as the app draws it.
              <p
                className={`pb-4 pr-4 text-sm leading-6 text-muted-foreground dark:text-neutral-400 ${
                  showIcon ? "pl-12" : "pl-4"
                }`}
              >
                {item.answer}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

import { notFound } from "next/navigation";
import TermsCategoryContent from "@/components/terms/TermsCategoryContent";
import { TERMS_CATEGORIES, getTermsCategory } from "@/lib/termsCategories";

// Pre-render the 8 known category pages at build time.
export function generateStaticParams() {
  return TERMS_CATEGORIES.map((category) => ({ category: category.slug }));
}

interface PageProps {
  params: Promise<{ category: string }>;
}

export default async function Page({ params }: PageProps) {
  const { category } = await params;

  // Unknown slug → proper not-found UI instead of rendering empty content.
  if (!getTermsCategory(category)) {
    notFound();
  }

  return <TermsCategoryContent slug={category} />;
}

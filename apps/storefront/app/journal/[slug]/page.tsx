import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

interface Post {
  id: string;
  title: string;
  slug: string;
  content: string | null;
  excerpt: string | null;
  cover_image: string | null;
  author: string | null;
  status: string;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export default async function JournalPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  let post: Post | null = null;

  try {
    const baseUrl =
      process.env.NEXT_PUBLIC_STOREFRONT_URL || "http://localhost:3000";
    const res = await fetch(`${baseUrl}/api/store/journal`, {
      cache: "no-store",
    });
    if (res.ok) {
      const data = await res.json();
      const found = (data.posts ?? []).find(
        (p: any) => p.slug === slug
      );
      if (found) post = found;
    }
  } catch (error) {
    console.error("Failed to load journal post", error);
  }

  if (!post) {
    notFound();
  }

  return (
    <main className="py-10">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <Link
          href="/journal"
          className="inline-flex items-center gap-2 text-sm font-medium text-sindoor hover:underline mb-6"
        >
          ← Back to Journal
        </Link>

        {post.cover_image && (
          <div className="aspect-video bg-rang-paper/50 mb-8">
            <img
              src={post.cover_image}
              alt={post.title}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          </div>
        )}

        <h1 className="text-4xl md:text-5xl font-serif font-semibold text-deep-ink mb-6">
          {post.title}
        </h1>

        <div className="flex flex-col md:flex-row md:items-start gap-8 mb-10">
          <div className="flex-1 space-y-2 text-sm font-sans text-muted-ink">
            <div className="flex items-center gap-2">
              <time className="font-medium">
                {post.published_at
                  ? new Date(post.published_at).toLocaleDateString()
                  : new Date(post.created_at).toLocaleDateString()}
              </time>
              {post.author && (
                <span className="text-terracotta">by {post.author}</span>
              )}
            </div>
            {post.excerpt && (
              <p className="text-lg font-serif italic text-deep-ink border-l-2 border-terracotta pl-4 py-2 my-4">
                {post.excerpt}
              </p>
            )}
          </div>
        </div>

        <article
          className="prose prose-lg max-w-none text-sans text-deep-ink leading-relaxed"
          dangerouslySetInnerHTML={{ __html: post.content || "" }}
        />

        <div className="mt-12 pt-8 border-t border-sand-border">
          <Link
            href="/journal"
            className="text-sm font-medium text-sindoor hover:underline"
          >
            Browse all stories →
          </Link>
        </div>
      </div>
    </main>
  );
}

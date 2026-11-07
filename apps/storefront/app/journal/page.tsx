import Link from "next/link";

export const dynamic = "force-dynamic";

interface Post {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  cover_image: string | null;
  author: string | null;
  published_at: string | null;
  created_at: string;
}

export default async function JournalPage() {
  let posts: Post[] = [];

  try {
    const baseUrl =
      process.env.NEXT_PUBLIC_STOREFRONT_URL || "http://localhost:3000";
    const res = await fetch(`${baseUrl}/api/store/journal`, {
      cache: "no-store",
    });
    if (res.ok) {
      const data = await res.json();
      posts = data.posts ?? [];
    }
  } catch (error) {
    console.error("Failed to load journal posts", error);
  }

  return (
    <main className="py-10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl md:text-4xl font-serif font-semibold text-deep-ink mb-8">
          Journal
        </h1>
        <p className="mb-10 text-lg text-muted-ink font-sans leading-relaxed">
          Artist stories, art-form explainers, technique tutorials, and
          collection edits from SnehaVrinda Kala.
        </p>

        {posts.length === 0 ? (
          <div className="rounded-xl border border-sand-border bg-surface p-12 text-center">
            <p className="text-lg text-muted-ink font-sans mb-6">
              No stories yet.
            </p>
            <p className="text-sm text-muted-ink font-sans">
              Editorial content coming soon.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {posts.map((post: Post) => (
              <article
                key={post.id}
                className="group rounded-xl border border-sand-border bg-surface overflow-hidden hover:border-terracotta/50 transition-colors"
              >
                {post.cover_image && (
                  <div className="aspect-video bg-rang-paper/50">
                    <img
                      src={post.cover_image}
                      alt={post.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                    />
                  </div>
                )}
                <div className="p-6">
                  <div className="flex items-center gap-2 mb-3">
                    <time className="text-xs font-sans text-muted-ink">
                      {post.published_at
                        ? new Date(post.published_at).toLocaleDateString()
                        : new Date(post.created_at).toLocaleDateString()}
                    </time>
                    {post.author && (
                      <span className="text-xs font-sans text-muted-ink">
                        • {post.author}
                      </span>
                    )}
                  </div>
                  <Link
                    href={`/journal/${post.slug}`}
                    className="block"
                  >
                    <h2 className="text-xl font-serif font-semibold text-deep-ink mb-2 group-hover:text-terracotta transition-colors">
                      {post.title}
                    </h2>
                  </Link>
                  {post.excerpt && (
                    <p className="text-sm text-muted-ink font-sans mb-4 line-clamp-3">
                      {post.excerpt}
                    </p>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { BotanicalRule } from "@/components/ornaments";

export const metadata = {
  title: "Journal",
  description:
    "Artist stories, art-form explainers, technique notes and collection edits from SnehaVrinda Kala.",
  alternates: { canonical: "/journal" },
};

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
    <main className="bg-rang-paper">
      <PageHeader
        eyebrow="Notes from the studio"
        title="Journal"
        intro="Artist stories, art-form explainers and technique notes — written to make the work legible, not to sell it."
        breadcrumb={[{ label: "Home", href: "/" }, { label: "Journal" }]}
      />

      <section className="pb-20">
        <div className="mx-auto max-w-[1400px] px-5 sm:px-8 lg:px-12">
          {posts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <BotanicalRule className="mb-6 text-terracotta" />
              <p className="max-w-sm font-serif text-xl leading-relaxed text-deep-ink">
                The first pieces are being written.
              </p>
              <p className="mt-2 font-sans text-sm text-muted-ink">
                Stories about the traditions, the materials and the people
                behind the work will appear here.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-x-8 gap-y-14 md:grid-cols-2 lg:grid-cols-3">
              {posts.map((post: Post) => (
                <article key={post.id} className="group">
                  {post.cover_image && (
                    <Link href={`/journal/${post.slug}`} className="block">
                      <div className="relative aspect-[4/3] overflow-hidden bg-surface ring-1 ring-sand-border/50">
                        <img
                          src={post.cover_image}
                          alt={post.title}
                          className="h-full w-full object-cover transition-opacity duration-500 group-hover:opacity-90"
                          loading="lazy"
                        />
                      </div>
                    </Link>
                  )}
                  <div className="mt-4 border-t border-sand-border/60 pt-3">
                    <div className="flex items-center gap-2 font-sans text-[11px] uppercase tracking-[0.16em] text-muted-ink/80">
                      <time>
                        {post.published_at
                          ? new Date(post.published_at).toLocaleDateString("en-IN", {
                              day: "numeric",
                              month: "long",
                              year: "numeric",
                            })
                          : new Date(post.created_at).toLocaleDateString("en-IN", {
                              day: "numeric",
                              month: "long",
                              year: "numeric",
                            })}
                      </time>
                      {post.author && <span aria-hidden="true">·</span>}
                      {post.author && <span>{post.author}</span>}
                    </div>
                    <Link href={`/journal/${post.slug}`} className="block">
                      <h2 className="mt-2 font-serif text-xl font-semibold leading-snug text-deep-ink transition-colors group-hover:text-kumkum">
                        {post.title}
                      </h2>
                    </Link>
                    {post.excerpt && (
                      <p className="mt-2 font-sans text-sm leading-relaxed text-muted-ink line-clamp-3">
                        {post.excerpt}
                      </p>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

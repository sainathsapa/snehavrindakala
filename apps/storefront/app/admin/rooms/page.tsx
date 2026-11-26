import { ContentEditor } from "@/components/admin/content-editor";

export const metadata = { title: "Rooms · Admin" };

export default function AdminRoomsPage() {
  return (
    <main className="mx-auto max-w-[1400px] px-5 py-10 sm:px-8 lg:px-12">
      <header className="mb-8 border-b border-sand-border pb-5">
        <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.24em] text-sindoor">
          Editorial
        </p>
        <h1 className="mt-2 font-serif text-3xl text-deep-ink">Rooms</h1>
        <p className="mt-2 max-w-2xl font-sans text-sm leading-relaxed text-muted-ink">
          A room groups work the way a wall does — by season, by theme, by the reason
          the pieces were made together. Each room gets its own page at{" "}
          <code className="font-mono text-[12px]">/rooms/&lt;address&gt;</code> and shows the
          products whose collection handle matches.
        </p>
      </header>
      <ContentEditor kind="rooms" />
    </main>
  );
}

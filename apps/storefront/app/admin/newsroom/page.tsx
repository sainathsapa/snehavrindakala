import { ContentEditor } from "@/components/admin/content-editor";

export const metadata = { title: "Newsroom · Admin" };

export default function AdminNewsroomPage() {
  return (
    <main className="mx-auto max-w-[1400px] px-5 py-10 sm:px-8 lg:px-12">
      <header className="mb-8 border-b border-sand-border pb-5">
        <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.24em] text-sindoor">
          Editorial
        </p>
        <h1 className="mt-2 font-serif text-3xl text-deep-ink">Newsroom</h1>
        <p className="mt-2 max-w-2xl font-sans text-sm leading-relaxed text-muted-ink">
          Press releases, coverage and announcements. Coverage always keeps its outlet
          and a link to the original, because a newsroom that only quotes itself is a
          blog. Published entries appear at <code className="font-mono text-[12px]">/newsroom</code>.
        </p>
      </header>
      <ContentEditor kind="newsroom" />
    </main>
  );
}

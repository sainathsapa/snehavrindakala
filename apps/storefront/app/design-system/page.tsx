import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Container,
  Section,
  SectionHeading,
} from "@snehavrinda-kala/ui";

export const metadata = {
  title: "Design system",
  robots: { index: false, follow: false },
};

export default function DesignSystemPage() {
  return (
    <main className="py-10">
      <Container>
        <SectionHeading
          eyebrow="Design system"
          title="SnehaVrinda Kala"
          description="Indian-art-house colour, type, and reusable primitives."
        />

        <Section className="py-0">
          <h3 className="font-serif text-2xl font-semibold text-deep-ink mb-4">
            Colour
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-4">
            {[
              ["Rang Paper", "bg-rang-paper", "#FFF7E8"],
              ["Surface", "bg-surface", "#FFFCF5"],
              ["Deep Ink", "bg-deep-ink", "#2B211E"],
              ["Muted Ink", "bg-muted-ink", "#675A52"],
              ["Sindoor", "bg-sindoor", "#C84636"],
              ["Marigold", "bg-marigold", "#E6A72E"],
              ["Kumkum", "bg-kumkum", "#9F2947"],
              ["Peacock", "bg-peacock", "#176D6A"],
              ["Indigo", "bg-indigo", "#263A63"],
              ["Leaf", "bg-leaf", "#557447"],
              ["Haldi", "bg-haldi", "#F0C45B"],
              ["Gulabi", "bg-gulabi", "#D98291"],
              ["Terracotta", "bg-terracotta", "#B96E4B"],
              ["Sand Border", "bg-sand-border", "#DCCBB4"],
            ].map(([name, className, hex]) => (
              <div key={name} className="space-y-2">
                <div className={`h-16 rounded-lg border border-sand-border ${className}`} />
                <p className="text-xs font-medium text-deep-ink">{name}</p>
                <p className="text-xs text-muted-ink font-mono">{hex}</p>
              </div>
            ))}
          </div>
        </Section>

        <Section className="py-0">
          <h3 className="font-serif text-2xl font-semibold text-deep-ink mb-4">
            Typography
          </h3>
          <div className="space-y-4">
            <p className="font-serif text-4xl text-deep-ink">
              Cormorant Garamond — editorial headings
            </p>
            <p className="font-sans text-base text-muted-ink">
              Manrope — body, forms, filters, and commerce UI.
            </p>
          </div>
        </Section>

        <Section className="py-0">
          <h3 className="font-serif text-2xl font-semibold text-deep-ink mb-4">
            Buttons
          </h3>
          <div className="flex flex-wrap gap-4">
            <Button variant="primary">Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="text">Text</Button>
            <Button isLoading>Loading</Button>
          </div>
        </Section>

        <Section className="py-0">
          <h3 className="font-serif text-2xl font-semibold text-deep-ink mb-4">
            Badges
          </h3>
          <div className="flex flex-wrap gap-3">
            <Badge>Default</Badge>
            <Badge variant="sindoor">Sindoor</Badge>
            <Badge variant="peacock">Peacock</Badge>
            <Badge variant="marigold">Marigold</Badge>
            <Badge variant="haldi">Haldi</Badge>
            <Badge variant="outline">Outline</Badge>
          </div>
        </Section>

        <Section className="py-0">
          <h3 className="font-serif text-2xl font-semibold text-deep-ink mb-4">
            Card
          </h3>
          <Card elevated className="max-w-md">
            <CardHeader>
              <CardTitle>Hand-painted terracotta diya</CardTitle>
              <CardDescription>Ready to ship · Made in Jaipur</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-ink font-sans">
                A quiet surface for artwork, with warm rang paper, sindoor, and
                indigo accents.
              </p>
            </CardContent>
          </Card>
        </Section>
      </Container>
    </main>
  );
}

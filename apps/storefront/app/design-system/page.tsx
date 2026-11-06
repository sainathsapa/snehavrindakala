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
          description="Indian-authentic, gallery-calm interface tokens and reusable primitives."
        />

        <Section className="py-0">
          <h3 className="font-serif text-2xl font-semibold text-ink mb-4">Colour</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-4">
            {[
              ["Ivory", "bg-ivory", "#F4EFE6"],
              ["Paper", "bg-paper", "#F7F2E8"],
              ["Surface", "bg-surface", "#FFFDF8"],
              ["Ink", "bg-ink", "#221F1A"],
              ["Madder", "bg-madder", "#A63D2F"],
              ["Indigo", "bg-indigo", "#1F2A44"],
              ["Haldi", "bg-haldi", "#D9A441"],
              ["Peacock", "bg-peacock", "#1E6F6A"],
              ["Rose", "bg-rose", "#9C3F63"],
              ["Sage", "bg-sage", "#6F7F5B"],
              ["Gold", "bg-gold", "#B8860B"],
              ["Border", "bg-border", "#D8CCB8"],
            ].map(([name, className, hex]) => (
              <div key={name} className="space-y-2">
                <div className={`h-16 rounded-lg border border-border ${className}`} />
                <p className="text-xs font-medium text-ink">{name}</p>
                <p className="text-xs text-muted font-mono">{hex}</p>
              </div>
            ))}
          </div>
        </Section>

        <Section className="py-0">
          <h3 className="font-serif text-2xl font-semibold text-ink mb-4">Typography</h3>
          <div className="space-y-4">
            <p className="font-serif text-4xl text-ink">Cormorant Garamond — editorial headings</p>
            <p className="font-sans text-base text-muted">
              Manrope — body, forms, filters, and commerce UI.
            </p>
          </div>
        </Section>

        <Section className="py-0">
          <h3 className="font-serif text-2xl font-semibold text-ink mb-4">Buttons</h3>
          <div className="flex flex-wrap gap-4">
            <Button variant="primary">Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="text">Text</Button>
            <Button isLoading>Loading</Button>
          </div>
        </Section>

        <Section className="py-0">
          <h3 className="font-serif text-2xl font-semibold text-ink mb-4">Badges</h3>
          <div className="flex flex-wrap gap-3">
            <Badge>Default</Badge>
            <Badge variant="madder">Madder</Badge>
            <Badge variant="indigo">Indigo</Badge>
            <Badge variant="peacock">Peacock</Badge>
            <Badge variant="haldi">Haldi</Badge>
            <Badge variant="outline">Outline</Badge>
          </div>
        </Section>

        <Section className="py-0">
          <h3 className="font-serif text-2xl font-semibold text-ink mb-4">Card</h3>
          <Card elevated className="max-w-md">
            <CardHeader>
              <CardTitle>Hand-painted terracotta diya</CardTitle>
              <CardDescription>Ready to ship · Made in Jaipur</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted font-sans">
                A quiet surface for artwork, with warm ivory, madder, and indigo accents.
              </p>
            </CardContent>
          </Card>
        </Section>
      </Container>
    </main>
  );
}

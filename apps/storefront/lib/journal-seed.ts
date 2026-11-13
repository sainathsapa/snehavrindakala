/**
 * Sample journal articles.
 *
 * These are real essays, not placeholders — the point of the journal is that
 * someone learns how an Indian tradition actually works by reading it. Each one
 * answers a question a visitor genuinely has: Why are Madhubani lines so even?
 * What is a kolam for? Why does Warli have no gods?
 *
 * They are seeded once (see ensureJournalSeeded) and then owned by the admin at
 * /admin/journal, so editing or deleting one is permanent and a redeploy will
 * not bring it back.
 */

export interface JournalSeed {
  slug: string;
  title: string;
  excerpt: string;
  author: string;
  cover_image: string;
  /** Body is plain text with blank-line paragraphs and **bold** spans. */
  content: string;
  /** Days before "now" the piece is dated, so the list has a real chronology. */
  daysAgo: number;
}

export const DEFAULT_JOURNAL_POSTS: JournalSeed[] = [
  {
    slug: "why-madhubani-lines-never-waver",
    title: "Why Madhubani lines never waver",
    excerpt:
      "Two outlines, drawn twice over each form, by a hand that has done it ten thousand times. The double line is not decoration — it is the record of practice.",
    author: "Sneha Sainath Sapa",
    cover_image: "/images/artforms/folk.jpg",
    daysAgo: 4,
    content: `Look closely at any Mithila painting and you will see it: every figure is outlined twice. Not a thick line that reads as two — two separate strokes, drawn one after the other, the second sitting a few millimetres inside the first.

This is called **kacni** and **bharni**, the line work and the fill, and the reason it exists is practical. Madhubani was painted on mud walls, on cloth, on paper made from waste. The ground was never perfectly smooth. A single line would sink into a hollow and vanish. Two lines, one inside the other, keep the shape readable even where the surface fights back. When the tradition moved from walls to paper in the 1960s — after a drought pushed the women of Mithila to sell their work — the double line came with it, even though paper no longer needed the insurance.

So the double line became something else: a **signature of the hand**. A steady single line is easy to fake with a ruler. A second line that follows the first at a consistent, uncanny distance is not, because the distance is decided in the wrist and never measured.

The women who paint Madhubani learn this as children, sitting beside a mother or grandmother, filling in the spaces of her painting before being trusted with an outline. By the time they draw their own, the second line arrives without a decision being made. That is the whole point of an apprenticeship: to move the skill out of the mind and into the hand, where it is faster than thought.

**What to look for.** Find a fish, a parrot, a lotus. Look at the raised edge of the form. If the lines are parallel and get slightly closer as the shape narrows into a point — that is a person drawing, following the same instinct twice. If they are perfectly evenly spaced the whole way round, you are probably looking at a print.

There is no reason a painting has to be made this way. A machine would do it faster and more consistently. But the second line is not there for consistency. It is there because someone did it twice.`,
  },
  {
    slug: "the-kolam-is-a-welcome-and-a-warning",
    title: "The kolam is a welcome, and a warning",
    excerpt:
      "Drawn in rice flour before sunrise, wiped away by afternoon. A kolam feeds the ants, greets the visitor, and marks a boundary that only an insider can read.",
    author: "Sneha Sainath Sapa",
    cover_image: "/images/artforms/home-decor.jpg",
    daysAgo: 11,
    content: `In Tamil Nadu, before it is properly light, someone bends down at the threshold of the house with a handful of rice flour and draws.

The tool is not a brush. It is a small cone made by pinching a hole in the base of a fist of flour, and the drawing is done by letting the flour fall in a controlled stream while the hand moves. The dots go down first — a grid of pulli, usually five by five or seven by seven — and then one continuous line is woven around them, never lifting, never crossing itself.

**Why rice flour and not chalk.** A kolam feeds things. Ants and small insects come for it through the day. A house that keeps a kolam is a house that is part of the living world rather than sealed off from it, and the drawing is therefore a gift, given fresh every morning whether anyone sees it or not.

**The boundary.** The kolam sits at the threshold, which is the most loaded square metre in an Indian house — the place where inside becomes outside and where Lakshmi is invited to enter. It is a welcome. But a kolam is also a way of saying *this ground is tended*. An untended kerb and a kolam drawn at dawn are not the same threshold, and everyone in the street can tell which is which without being told anything.

There is a further layer that outsiders never see. Certain kolam patterns belong to certain days, certain households, certain festivals. A woman in the next street can glance at a kolam and know what day it is in that house. The drawing is a text, and reading it is a competence shared by the neighbourhood.

**What happened to it.** The kolam is disappearing from Indian city streets — cars park over the threshold, apartment drives are tiled and shared, and the hour before dawn is now spent commuting. It survives in villages, in temple courtyards, and in the work of artists who have carried the dot-grid geometry into their painting.

We use a kolam on this site at the point where the introduction ends and the collection begins. That is what a kolam is for: telling you that you have crossed from one place into another, and that someone has prepared the ground on the other side.`,
  },
  {
    slug: "warli-has-no-gods-in-it",
    title: "Warli has no gods in it",
    excerpt:
      "Two triangles for a body, a circle for a head. The Warli wall painting of Maharashtra leaves out everything except the ordinary — and that is the entire theology.",
    author: "Sneha Sainath Sapa",
    cover_image: "/images/artforms/folk.jpg",
    daysAgo: 19,
    content: `A Warli painting is built from almost nothing. A body is two triangles meeting at a point. A head is a circle above them. A drum is a triangle on its side. A tarpa dance is a spiral of these figures, arms linked, going round and round.

That is the whole vocabulary, and it has not changed for centuries. The Warlis are an Adivasi community from the Thane and Palghar districts of Maharashtra, and until the 1970s their paintings were made only on the walls of their homes for weddings — in rice paste on a base of red earth, drawn at night, and left to weather.

**The absence.** You can look at a great deal of Warli painting and never find a deity. There are no avatars, no elaborate iconography, no figures recognisable from a temple. What is there instead is people: people dancing, people harvesting, people carrying, people in a wedding procession, people around a fire.

This is not a lack of religion. It is a different idea about where the sacred sits. The Warlis painted their *life* on the wall, because the life was the thing worth marking. The tarpa dance is not entertainment; it is the ritual, and a spiral of figures in the tarpa *is* the ceremony, recorded at the moment it happens rather than depicting a god who might bless it.

**How it is painted.** The ground is prepared with a mixture of mud and cow dung, painted red-brown with earth. The figures are drawn in white rice paste using a bamboo stick chewed at the end to make a brush. There is no sketch and no correction: the bamboo goes down and the figure exists. Practitioners describe it as a matter of the arm, not the eye.

**What changed.** In the 1970s Jivya Soma Mashe, a Warli painter from Dahanu, began painting on paper and canvas instead of walls, and put scenes of everyday labour at the centre of work that was now made to be looked at in a gallery rather than lived with. That move — from the wall to the sheet — is what turned Warli into a recognised Indian art form, and it is also the moment the cave paintings of the Adivasi began to be called *artists*.

When you see a Warli painting here, the right thing to notice is not how simple it is. It is how much has been deliberately left out, and how much remains readable anyway. Two triangles and you know the person is walking.`,
  },
  {
    slug: "how-to-read-a-pattachitra",
    title: "How to read a Pattachitra",
    excerpt:
      "A cloth-backed scroll from Odisha where every panel is a chapter, every border is a frame, and the order you read it in was decided three hundred years ago.",
    author: "Sneha Sainath Sapa",
    cover_image: "/images/artforms/painting.jpg",
    daysAgo: 27,
    content: `A Pattachitra is not a picture of a story. It is the story, arranged in a way that has a reading order — and the order is usually the same one an Indian manuscript would use.

The word itself is *patta*, cloth, and *chitra*, picture. The cloth is cotton treated with a paste of tamarind seed and chalk so it takes paint without bleeding, then smoothed with a stone. The pigments are mineral and vegetable: white from conch shell, black from lamp soot, red from vermilion, yellow from orpiment, and a blue-green from a rock the painters call *megha*, cloud.

**Where to start.** In a traditional Puri Pattachitra, the eye is led to the central figure first — usually Jagannath, or Krishna, or Ganesha — and then outward, following the subsidiary panels clockwise. Backgrounds are filled with a dense, flat pattern of creepers or lotus so that no space is empty; emptiness would be a kind of carelessness. The border is not a frame in the western sense. It is the boundary of the world the story happens in, and it is always painted last.

**The line.** Pattachitra is drawn with a brush made from mouse hair tied to a bamboo handle, and the figures are outlined before anything is filled. Where Madhubani doubles the line, Pattachitra uses a single confident stroke that tapers. Look at the ends of the strokes on a good piece and you will see them rise off the cloth, the way a brush leaves.

**Why the faces are all the same.** Beginners often ask why the figures in a Pattachitra look alike. They do, deliberately. The faces are a convention — a large eye, a sharp nose, a profile turned out — and the convention is the point, because it lets the *story* be the variable and the *people* be recognisable types. It is closer to how a comic artist draws than to how a portraitist does.

**One honest note.** The bazaar in front of the Jagannath temple at Puri sells a great deal of hand-painted work and a great deal of printed cloth finished by hand. The difference is in the line: a printed line has an even weight all the way along, and a painted line thins as the brush lifts. That is the test, and it is the only test you need.`,
  },
  {
    slug: "what-a-kalamkari-actually-goes-through",
    title: "What a Kalamkari actually goes through",
    excerpt:
      "Twenty-three stages, a buffalo-milk treatment, and a river. The reason a Kalamkari costs what it does is that the cloth is washed more times than it is painted.",
    author: "Sneha Sainath Sapa",
    cover_image: "/images/artforms/textile.jpg",
    daysAgo: 36,
    content: `Kalamkari means *pen work* — kalam, pen, kari, work — and the pen is a bamboo stick wrapped with cloth at one end to hold dye. What surprises people is that the drawing is the quick part. Most of the labour is washing.

**The preparation.** The cotton is first treated with a mixture of myrobalan powder and buffalo milk. The milk keeps the dye from spreading; without it, the line bleeds and the whole piece is lost. The cloth is then dried, and only then is it drawn on, in a solution of iron acetate that will turn black when it is finally boiled with alizarin.

**The washing.** Between the drawing and the colour there are repeated trips to the river. Cloth is soaked, wrung, beaten on stone, dried, and soaked again. A single piece of Srikalahasti Kalamkari may be washed twenty times or more, and each wash is a chance for the whole thing to be ruined. This is why the river matters: the Pennar and the Swarnamukhi are not scenery in the story of Kalamkari, they are a tool, and the dyers know their water.

**Two kinds.** There are two living Kalamkari traditions and they are not the same thing. *Srikalahasti* style is drawn entirely by hand with the kalam, in free narrative panels, with the line carrying the drawing. *Machilipatnam* style is block-printed, more repeatable, and used for larger runs of yardage. Both are real Kalamkari; a piece labelled Kalamkari without saying which is telling you less than it could.

**What to look for.** Turn the cloth over. In hand-drawn Kalamkari the dye has gone through, and the reverse shows a softer, blurrier version of the same line — the mark of a pen pressing into cloth. A printed piece has a crisp even reverse, or none at all. The other tell is the black: real iron-acetate black ages to a warm brown-black over years, while a chemical black stays blue-black forever.

A Kalamkari that has been through the river twenty times and survived is not just decorated cloth. It is a record of everything that could have gone wrong and didn't.`,
  },
  {
    slug: "the-gond-eye-and-why-the-world-is-full",
    title: "The Gond eye, and why the world is full",
    excerpt:
      "Gond painting fills the inside of every animal with the landscape it lives in. The technique has a name: digna, and it turns a deer into a forest.",
    author: "Sneha Sainath Sapa",
    cover_image: "/images/artforms/painting.jpg",
    daysAgo: 45,
    content: `The first thing to understand about a Gond painting is that the animal is never just an animal.

The Gond are one of the largest Adivasi communities in India, spread across Madhya Pradesh, Chhattisgarh, Maharashtra and Odisha, and their painting — which moved from mud walls to paper in the 1980s through the work of Jangarh Singh Shyam — has a rule that is unique to it: **the inside of a form is not filled with a colour, it is filled with a world.**

This is called **digna** — the pattern of dashes, dots, seeds and small motifs that covers the interior of every bird and beast. A deer is not brown. A deer is covered in the seeds, leaves and small creatures of the forest the deer lives in. To look at the animal is to look at its habitat. The Gond painter has made a picture in which the subject and its world are literally the same area of paint.

**The eye.** The second rule is the eye. Gond animals are almost always shown in profile, with one eye drawn large and frontal. It is the same eye in every animal — fish, tiger, peacock, human — and it is doing something specific: it makes the creature look back. A Gond animal is never a specimen. It is a being that has noticed you.

**Why it looks modern.** Jangarh Singh Shyam's paintings from the 1980s look startlingly contemporary — flat fields, dense pattern, bold creatures on bare ground — and this is not an accident of influence. The tradition arrived at an idiom that western modernism also arrived at, from a completely different direction. The difference is that Gond pattern is not formal experimentation. It is a statement about how the world is made: everything inside everything, nothing separate.

**What to look for.** Get close. The digna marks are made with a fine brush and a great deal of patience, and no two are the same. The pattern does not repeat like wallpaper; it responds to the shape it is filling, growing denser where the form narrows. That is the difference between a Gond painting and a print of a Gond painting.`,
  },
];

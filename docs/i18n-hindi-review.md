# Hindi translation review — product titles

These are proposals, not applied changes. Nothing here is live yet.
Send back any line you want changed and I will adjust before wiring them in.

## Why this needs you, not just me

Art-tradition names are the risk. A few are proper nouns that must stay as
they are; others have a genuine Hindi form. Getting a Mithila painting
described with the wrong register sounds foreign to an Indian buyer —
exactly backwards from the point of having a Hindi site.

**What I kept in Roman script on purpose:** Madhubani, Warli, Pattachitra,
Gond, Kalamkari, Phulkari, Bidriware, Ikat. These are how these traditions
are named in India, in English and Hindi both. Transliterating them into
Devanagari would make a familiar thing look unfamiliar.

---

## Products (21)

| # | English | Proposed Hindi | Note |
|---|---|---|---|
| 1 | Madhubani Celebration (Limited) | मधुबनी उत्सव (सीमित) | को maintained as "उत्सव" — celebratory, not "celebration event" |
| 2 | Hand-painted Terracotta Vase | हस्तनिर्मित टेराकोटा फूलदान | फूलदान = vase; टेराकोटा kept, it is the trade word |
| 3 | Madhubani Folk Painting | मधुबनी लोक चित्रकला | |
| 4 | Embroidered Cotton Throw | कढ़ाईदार सूती चादर | चादर reads as throw/coverlet |
| 5 | Custom Portrait Commission | व्यक्तिचित्र — विशेष ऑर्डर | व्यक्तिचित्र is the proper word for portrait |
| 6 | Block-Printed Journal Set | ब्लॉक-प्रिंट डायरी सेट | ब्लॉक-प्रिंट kept; छपाईदार would imply screen print |
| 7 | Wearable Art Pendant | धारणीय कला लॉकेट | ⚠ धारणीय is correct but stiff — see Q2 |
| 8 | Warli Harvest Painting | वारली फ़सल चित्र | फ़सल = harvest |
| 9 | Pattachitra Scroll Panel | पट्टचित्र स्क्रॉल पैनल | |
| 10 | Gond Tree of Life | गोंड — जीवन वृक्ष | जीवन वृक्ष = tree of life |
| 11 | Kalamkari Penwork Panel | कलमकारी कलम-कार्य पैनल | |
| 12 | Phulkari Embroidered Dupatta | फुलकारी कढ़ाई दुपट्टा | दुपट्टा not transliterated to दुपट्टा-earlier typo risk |
| 13 | Madhubani Fish and Lotus | मधुबनी मछली और कमल | |
| 14 | Hand-thrown Stoneware Bowl | हस्त-निर्मित पत्थर के बर्तन का कटोरा | ⚠ long — see Q3 |
| 15 | Block-printed Cotton Table Runner | ब्लॉक-प्रिंट सूती टेबल रनर | |
| 16 | Bidriware Silver Inlay Box | बिदरी चाँदी जड़ाऊ डिब्बा | जड़ाऊ = inlay-work, the correct term |
| 17 | Hand-marbled Paper Journal | हस्त-संगमरमरी कागज़ डायरी | ⚠ clunky — see Q4 |
| 18 | Lacquer Wooden Pen Case | लाह लेपित लकड़ी क़लमदान | क़लमदान = pen case, well understood |
| 19 | Silver Filigree Earrings | चाँदी की ज़रीनकारी बालियाँ | ज़रीनकारी = filigree |
| 20 | Hand-woven Ikat Stole | हस्त-बुना इकत दुपट्टा | |
| 21 | Gold-leaf Miniature Portrait | स्वर्ण-पत्ती लघु व्यक्तिचित्र | |

## Art forms (6)

| English | Proposed Hindi |
|---|---|
| Painting & Drawing | चित्रकला और रेखांकन |
| Traditional & Folk Art | पारंपरिक और लोक कला |
| Home & Decorative Art | गृह और सजावटी कला |
| Textile & Fibre Art | वस्त्र और तंतु कला |
| Paper, Stationery & Books | कागज़, लेखन-सामग्री और पुस्तकें |
| Wearable Art | धारणीय कला |

---

## Four questions — your call

**Q1. Register.** I have used literary Hindi (चित्रकला, व्यक्तिचित्र, जड़ाऊ)
rather than everyday spoken Hindi (पेंटिंग, फोटो, जड़ा हुआ). For an art house
selling at these prices the literary register signals craft; the everyday one
signals a market stall. I recommend **keeping literary** — but this is a brand
voice decision, not a technical one. *My recommendation: literary.*

**Q2. "Wearable Art" (धारणीय कला).** Accurate, but it is not how anyone speaks.
Options: (a) धारणीय कला — correct but stiff; (b) पहनने योग्य कला — plainer,
more natural; (c) पहनावा कला — shortest. *My recommendation: (b).*

**Q3. Product 14** is 44 characters in Hindi vs 30 in English and will wrap to
two lines in the card grid. Shorter option: **पत्थर के बर्तन का कटोरा**
(drops "hand-thrown", which the description covers). *Recommendation: shorten.*

**Q4. Product 17** "हस्त-संगमरमरी" is awkward. Better: **हाथ से रंगा कागज़
डायरी** ("hand-coloured paper diary") — plainer and truer to what marbling
is. *Recommendation: use the plainer wording.*

---

## How it would be wired in

Product titles live in Postgres (Medusa), not in the message catalogues, so
these cannot go into `hi.json`. Two options:

- **A. Medusa product translations** — one title per locale, stored alongside
  the product. Correct data model, survives admin edits, scales to a third
  language. More work: schema, admin field, lookup in `catalogue.ts`.
- **B. Handle-keyed map in the catalogue** — `messages/` holds
  `products.<handle>.title`. Simple, no migration, but the title lives in two
  places and an admin title edit would not update the Hindi.

*Recommendation: **A**.* Option B drifts the moment anyone edits a product in
the admin panel, and this site is meant to be admin-managed end to end.

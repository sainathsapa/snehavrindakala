/**
 * Bilingual page copy for the sections added late.
 *
 * The nav and footer were translated from the start, the three plates were
 * written in both languages, but the pages added afterwards — partners, rooms,
 * newsroom — shipped in English only. A Hindi visitor switched language and
 * landed on English prose under a Hindi menu, which reads as a half-finished
 * translation rather than a choice.
 *
 * Keeping the pair together, in one place, is deliberate: a translator (or the
 * owner) can see both versions of a sentence side by side and correct either.
 * Splitting them into two messages files invites the drift where one language
 * gains a paragraph the other never gets.
 *
 * Register: the English is plain and declarative. The Hindi is deliberately not
 * a word-for-word gloss — it uses the words a Hindi speaker would actually use
 * for this trade (कारीगर, थोक, भेजना, माप) rather than Sanskritised equivalents.
 */

export type Locale = "en" | "hi";

const pick = <T,>(locale: string, pair: { en: T; hi: T }): T =>
  locale === "hi" ? pair.hi : pair.en;

export const partnersCopy = (locale: string) => {
  const t = <T,>(pair: { en: T; hi: T }) => pick(locale, pair);

  return {
    eyebrow: t({ en: "For galleries & trade", hi: "गैलरी और थोक व्यापार के लिए" }),
    title: t({ en: "Partners", hi: "साझेदार" }),
    intro: t({
      en: "The studio works with a small number of galleries, designers, hotels and offices. If you buy for a room rather than for yourself, this is the way in.",
      hi: "स्टूडियो कुछ ही गैलरी, डिज़ाइनर, होटल और दफ़्तरों के साथ काम करता है। अगर आप अपने लिए नहीं, किसी कमरे के लिए ख़रीदते हैं — तो रास्ता यही है।",
    }),
    crumbHome: t({ en: "Home", hi: "मुख्य पृष्ठ" }),
    whoHeading: t({ en: "Who we work with", hi: "हम किनके साथ काम करते हैं" }),
    audiences: [
      {
        title: t({ en: "Galleries & curators", hi: "गैलरी और क्यूरेटर" }),
        body: t({
          en: "Work for a show, a season or a standing display. We can hold a selection, supply condition reports and photographs sized for print.",
          hi: "प्रदर्शनी, मौसम या स्थायी प्रदर्शन के लिए काम। हम चुने हुए काम रोक सकते हैं, उनकी स्थिति की रिपोर्ट और छपाई के लिए तैयार तस्वीरें दे सकते हैं।",
        }),
      },
      {
        title: t({ en: "Interior designers & architects", hi: "इंटीरियर डिज़ाइनर और वास्तुकार" }),
        body: t({
          en: "Pieces chosen against a room rather than a listing. Tell us the wall, the light and the budget and we will propose what fits it.",
          hi: "सूची से नहीं, कमरे को देखकर चुने गए काम। दीवार, रोशनी और बजट बता दीजिए — जो उसमें बैठेगा, हम सुझाएँगे।",
        }),
      },
      {
        title: t({ en: "Hospitality & offices", hi: "होटल और दफ़्तर" }),
        body: t({
          en: "Lobbies, suites and meeting rooms, where a work has to survive daily proximity to people. We will say plainly which materials will.",
          hi: "लॉबी, सुइट और बैठक-कक्ष, जहाँ काम को रोज़ लोगों के बीच टिकना होता है। कौन-सी सामग्री टिकेगी, हम साफ़-साफ़ बता देंगे।",
        }),
      },
      {
        title: t({ en: "Corporate gifting", hi: "कंपनी उपहार" }),
        body: t({
          en: "Repeatable orders of small works and objects, with the invoicing and documentation a finance department needs.",
          hi: "छोटे कामों और वस्तुओं के दोहराए जा सकने वाले ऑर्डर, साथ में वह बिल और काग़ज़ात जो लेखा विभाग माँगता है।",
        }),
      },
    ],
    howHeading: t({ en: "How it runs", hi: "यह चलता कैसे है" }),
    howNote: t({ en: "Three steps, no forms after the first", hi: "तीन क़दम, पहले के बाद कोई फ़ॉर्म नहीं" }),
    steps: [
      {
        numeral: "01",
        title: t({ en: "Write to us", hi: "हमें लिखिए" }),
        body: t({
          en: "Use the application form. What you do, where you are, and the kind of work you are looking for is enough to start.",
          hi: "आवेदन फ़ॉर्म भर दीजिए। आप क्या करते हैं, कहाँ हैं, और किस तरह का काम ढूँढ रहे हैं — शुरू करने के लिए इतना काफ़ी है।",
        }),
      },
      {
        numeral: "02",
        title: t({ en: "A conversation", hi: "एक बातचीत" }),
        body: t({
          en: "A person replies — usually within a few working days — with questions about the space, the timeline and the budget, or with a straight no.",
          hi: "कुछ कार्य-दिवसों में कोई व्यक्ति उत्तर देता है — जगह, समय और बजट पर सवालों के साथ, या सीधे मना करके।",
        }),
      },
      {
        numeral: "03",
        title: t({ en: "Terms, then work", hi: "शर्तें, फिर काम" }),
        body: t({
          en: "Price, lead time, packing, shipping and payment are agreed in writing before anything is made or dispatched.",
          hi: "कुछ भी बनने या भेजे जाने से पहले दाम, समय, पैकिंग, ढुलाई और भुगतान लिखित में तय होते हैं।",
        }),
      },
    ],
    arrangedHeading: t({ en: "What can be arranged", hi: "क्या-क्या तय हो सकता है" }),
    arrangedIntro: t({
      en: "Terms are agreed for each partnership rather than published as a table. These are the things that are normally part of one.",
      hi: "शर्तें हर साझेदारी के लिए अलग तय होती हैं, किसी तालिका में छपी नहीं होतीं। ये वे बातें हैं जो आम तौर पर इसमें शामिल होती हैं।",
    }),
    arranged: [
      t({
        en: "A held selection, photographed and set aside for your dates",
        hi: "आपकी तारीख़ों के लिए रोका गया चयन, तस्वीरों के साथ",
      }),
      t({
        en: "Condition reports and print-resolution images for catalogues",
        hi: "कैटलॉग के लिए स्थिति-रिपोर्ट और छपाई-गुणवत्ता की तस्वीरें",
      }),
      t({
        en: "Consolidated shipping, crated, with a single invoice",
        hi: "एक साथ पैकिंग और ढुलाई, एक ही बिल के साथ",
      }),
      t({
        en: "Invoices issued by the studio, with the documentation your accounts team asks for",
        hi: "स्टूडियो द्वारा जारी बिल, आपकी लेखा टीम के माँगे काग़ज़ात के साथ",
      }),
      t({
        en: "Commissioned work made to a brief, with the lead time stated in writing",
        hi: "आपके विवरण पर बनाया गया काम, लिखित में बताए समय के साथ",
      }),
      t({
        en: "A named person at the studio for the length of the partnership",
        hi: "साझेदारी की पूरी अवधि के लिए स्टूडियो में एक नामित व्यक्ति",
      }),
    ],
    newHeading: t({ en: "New partnership", hi: "नई साझेदारी" }),
    newBody: t({
      en: "Tell us about your business and the work you have in mind — a gallery, a practice, a studio. Every application is read by a person and answered either way.",
      hi: "अपना काम और जो कल्पना में है बता दीजिए — गैलरी, प्रैक्टिस या स्टूडियो। हर आवेदन कोई व्यक्ति पढ़ता है और उत्तर देता है, चाहे हाँ हो या ना।",
    }),
    newCta: t({ en: "Apply to partner", hi: "साझेदारी के लिए आवेदन" }),
    buyForRoom: t({
      en: "Buying for a room rather than applying to sell?",
      hi: "बेचने के लिए आवेदन नहीं, कमरे के लिए ख़रीदना है?",
    }),
    writeToStudio: t({ en: "Write to the studio", hi: "स्टूडियो को लिखें" }),
    existingHeading: t({ en: "Already a partner", hi: "आप पहले से साझेदार हैं" }),
    existingBody: t({
      en: "Your orders, held stock, shipments, statements and settlement history are in the partner portal.",
      hi: "आपके ऑर्डर, रोका गया माल, ढुलाई, विवरण और भुगतान का इतिहास साझेदार पोर्टल में हैं।",
    }),
    signIn: t({ en: "Partner sign in", hi: "साझेदार साइन इन" }),
    askInstead: t({ en: "Ask a question instead", hi: "बजाय इसके, सवाल पूछें" }),
    sellHeading: t({ en: "Makers: sell with us", hi: "कारीगर: हमारे साथ बेचिए" }),
    sellBody: t({
      en: "If you make work rather than buy it, the seller route is the one you want: what we ask of a maker, how the review runs, and how payouts are recorded. The application form lives there, so there is one place to start rather than two.",
      hi: "अगर आप ख़रीदते नहीं, बनाते हैं, तो विक्रेता मार्ग आपके लिए है: कारीगर से हम क्या माँगते हैं, समीक्षा कैसे होती है, और भुगतान कैसे दर्ज होता है। आवेदन फ़ॉर्म वहीं है — शुरू करने की जगह एक, दो नहीं।",
    }),
    sellCta: t({ en: "Selling as a maker", hi: "कारीगर के रूप में बेचना" }),
    footerNote: t({
      en: "Trade enquiries are answered by the studio itself, not a sales desk — the same people who pack the work are the ones who reply.",
      hi: "थोक पूछताछ का जवाब स्टूडियो ख़ुद देता है, कोई सेल्स डेस्क नहीं — जो लोग काम पैक करते हैं, वही उत्तर भी देते हैं।",
    }),
  };
};

export const roomsCopy = (locale: string) => {
  const t = <T,>(pair: { en: T; hi: T }) => pick(locale, pair);

  return {
    eyebrow: t({ en: "Rooms", hi: "कक्ष" }),
    title: t({ en: "Work gathered the way a house gathers it", hi: "काम जैसे घर में जमा होता है, वैसे जमा" }),
    intro: t({
      en: "Each room is a season, an idea or an exhibition — pieces that answer one another, with the text that hangs beside them on the wall.",
      hi: "हर कक्ष एक मौसम, एक विचार या एक प्रदर्शनी है — वे काम जो एक-दूसरे से बात करते हैं, और साथ में वह पाठ जो दीवार पर उनके पास लगता है।",
    }),
    crumbHome: t({ en: "Home", hi: "मुख्य पृष्ठ" }),
    crumbRooms: t({ en: "Rooms", hi: "कक्ष" }),
    emptyTitle: t({ en: "The first rooms are being hung.", hi: "पहले कक्ष सजाए जा रहे हैं।" }),
    emptyBody: t({
      en: "Until then the collection is arranged by tradition and by material.",
      hi: "तब तक संग्रह परंपरा और सामग्री के हिसाब से लगा हुआ है।",
    }),
    browse: t({ en: "Browse the collection", hi: "संग्रह देखें" }),
    roomToOpen: t({ en: "Room to open", hi: "कक्ष खुलने को है" }),
    inThisRoom: t({ en: "In this room", hi: "इस कक्ष में" }),
    work: t({ en: "work", hi: "काम" }),
    works: t({ en: "works", hi: "काम" }),
    hangingTitle: t({ en: "The room is being hung.", hi: "कक्ष सजाया जा रहा है।" }),
    hangingBody: t({
      en: "Work for it is either still at the bench or not yet photographed —",
      hi: "इसके लिए काम या तो अभी तक बेंच पर है या उसकी तस्वीर नहीं खींची गई —",
    }),
    hangingCta: t({
      en: "write to the studio if you would like to be told when it opens.",
      hi: "अगर खुलने की ख़बर चाहिए तो स्टूडियो को लिखिए।",
    }),
    allRooms: t({ en: "All rooms", hi: "सभी कक्ष" }),
    enquire: t({ en: "Enquire", hi: "पूछताछ" }),
  };
};

export const newsroomCopy = (locale: string) => {
  const t = <T,>(pair: { en: T; hi: T }) => pick(locale, pair);

  return {
    eyebrow: t({ en: "Newsroom", hi: "समाचार कक्ष" }),
    title: t({
      en: "What has been written, and what we have said",
      hi: "जो लिखा गया, और जो हमने कहा",
    }),
    intro: t({
      en: "Coverage keeps its outlet and a link to the original. Announcements are the studio's own words.",
      hi: "कवरेज अपने अख़बार और मूल लेख के लिंक के साथ रहता है। घोषणाएँ स्टूडियो के अपने शब्द हैं।",
    }),
    crumbHome: t({ en: "Home", hi: "मुख्य पृष्ठ" }),
    crumbNewsroom: t({ en: "Newsroom", hi: "समाचार कक्ष" }),
    emptyTitle: t({ en: "The newsroom is quiet for now.", hi: "समाचार कक्ष अभी शांत है।" }),
    emptyBody: t({
      en: "Press enquiries are answered by the studio directly — the address on the contact page reaches a person, not a form queue.",
      hi: "प्रेस की पूछताछ का जवाब स्टूडियो ख़ुद देता है — संपर्क पृष्ठ का पता किसी व्यक्ति तक पहुँचता है, किसी फ़ॉर्म की क़तार तक नहीं।",
    }),
    pressCta: t({ en: "Press enquiries", hi: "प्रेस पूछताछ" }),
    read: t({ en: "Read", hi: "पढ़ें" }),
    readOriginal: t({ en: "Read the original", hi: "मूल लेख पढ़ें" }),
    readAt: t({ en: "Read at", hi: "यहाँ पढ़ें" }),
    kinds: {
      press: t({ en: "Press release", hi: "प्रेस विज्ञप्ति" }),
      coverage: t({ en: "Coverage", hi: "कवरेज" }),
      announcement: t({ en: "Announcement", hi: "घोषणा" }),
      news: t({ en: "News", hi: "समाचार" }),
    },
    backToNewsroom: t({ en: "Newsroom", hi: "समाचार कक्ष" }),
  };
};

export const sellCopy = (locale: string) => {
  const t = <T,>(pair: { en: T; hi: T }) => pick(locale, pair);

  return {
    eyebrow: t({ en: "Work with the studio", hi: "स्टूडियो के साथ काम करें" }),
    title: t({
      en: "We do not take consignments online",
      hi: "हम ऑनलाइन पर-विक्रय (कंसाइनमेंट) नहीं लेते",
    }),
    intro: t({
      en: "SnehaVrinda Kala is a single studio, not a marketplace: the works here are made by the house and by makers it works with directly. There is no listing fee and no catalogue to upload, because there is no open roster.",
      hi: "स्नेहवृंद कला एक ही स्टूडियो है, कोई मंडी नहीं: यहाँ के काम घर और उन कारीगरों के हैं जिनके साथ स्टूडियो सीधे काम करता है। कोई सूची-शुल्क नहीं और अपलोड करने के लिए कोई कैटलॉग नहीं, क्योंकि सबके लिए खुला दरवाज़ा नहीं है।",
    }),
    makerHeading: t({ en: "If you make work", hi: "अगर आप काम बनाते हैं" }),
    makerBody: t({
      en: "and want it considered, write to the studio with photographs, dimensions, the materials you use and where you learned the practice. A person reads every letter, and a reply comes either way.",
      hi: "और उसे सामने रखना चाहते हैं, तो स्टूडियो को तस्वीरें, नाप, इस्तेमाल की सामग्री और यह बताकर लिखिए कि यह हुनर कहाँ सीखा। हर चिट्ठी कोई व्यक्ति पढ़ता है, और उत्तर आता है — चाहे हाँ हो या ना।",
    }),
    galleryHeading: t({ en: "If you are a gallery or institution", hi: "अगर आप गैलरी या संस्था हैं" }),
    galleryBody: t({
      en: "the same address reaches the studio directly.",
      hi: "तो वही पता सीधे स्टूडियो तक पहुँचता है।",
    }),
    apply: t({ en: "Apply to work with us", hi: "हमारे साथ काम करने के लिए आवेदन" }),
    contact: t({ en: "Write to the studio", hi: "स्टूडियो को लिखें" }),
    learn: t({ en: "How these traditions are made", hi: "ये परंपराएँ कैसे बनती हैं" }),
  };
};

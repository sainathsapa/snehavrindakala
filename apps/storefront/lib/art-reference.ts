/**
 * The glossary and history of Indian art, written as content rather than
 * decoration.
 *
 * A visitor to an art house usually arrives with one of three questions:
 * *what am I looking at*, *what is it made of*, and *how did this tradition
 * come to exist*. The site answered the first (art-form stories) and the third
 * only in fragments. This file holds plain-language reference material for the
 * other two, so `/learn` can teach without a single product on the page.
 *
 * Everything here is deliberately factual and short. It is a glossary, not an
 * essay — the essays live in the journal.
 */

export interface GlossaryTerm {
  term: string;
  /** Language of origin, shown as a small tag. */
  language: string;
  meaning: string;
  /** Where or how it is used. */
  note: string;
}

/** Terms a reader meets constantly on an Indian art site and rarely sees defined. */
export const GLOSSARY: GlossaryTerm[] = [
  {
    term: "Kala",
    language: "Sanskrit",
    meaning: "Art, craft, and skill — one word for all three.",
    note: "The distinction between 'art' and 'craft' is a European one. Kala does not make it.",
  },
  {
    term: "Pattachitra",
    language: "Odia",
    meaning: "Patta (cloth) + chitra (picture).",
    note: "Cloth treated with tamarind seed and chalk so mineral pigment holds without bleeding.",
  },
  {
    term: "Kalamkari",
    language: "Telugu / Persian",
    meaning: "Kalam (pen) + kari (work) — pen work.",
    note: "Drawn with a bamboo pen wrapped in cloth. The colour comes later, in the river.",
  },
  {
    term: "Kacni",
    language: "Maithili",
    meaning: "Line work — the first pass of an outline.",
    note: "In Madhubani the outline is drawn twice, one line inside the other. See Bharni.",
  },
  {
    term: "Bharni",
    language: "Maithili",
    meaning: "Colour fill, applied inside the kacni outline.",
    note: "Flat colour, no shading. Depth is suggested by the double line, not by light.",
  },
  {
    term: "Digna",
    language: "Gondi",
    meaning: "The pattern that fills the inside of a form.",
    note: "Seeds, dashes and small creatures. A Gond animal is filled with its own habitat.",
  },
  {
    term: "Pulli",
    language: "Tamil",
    meaning: "Dots — the grid a kolam is woven around.",
    note: "Usually 5×5 or 7×7. The line is drawn around the dots without lifting the hand.",
  },
  {
    term: "Kolam",
    language: "Tamil",
    meaning: "A threshold drawing made in rice flour before sunrise.",
    note: "It feeds insects, greets a visitor, and marks ground that is tended.",
  },
  {
    term: "Tarpa",
    language: "Warli / Marathi",
    meaning: "A spiral dance around a central pipe instrument.",
    note: "Painted as a spiral of linked figures. It is the ceremony, not a picture of one.",
  },
  {
    term: "Pattachitra rasa",
    language: "Odia",
    meaning: "The mood a painting is composed to carry.",
    note: "Composition follows the rasa: a heroic scene is built on diagonals, a tender one on circles.",
  },
  {
    term: "Chitrakathi",
    language: "Marathi",
    meaning: "Picture-story — a painted scroll shown while it is sung.",
    note: "The image and the narration were never separate objects.",
  },
  {
    term: "Tana-bana",
    language: "Hindi / Urdu",
    meaning: "Warp and weft.",
    note: "Used of textiles and of the structure of a story. Both are woven, not stacked.",
  },
  {
    term: "Jali",
    language: "Persian / Hindi",
    meaning: "A pierced screen.",
    note: "Carved so light becomes pattern. In painting, used as a field of texture.",
  },
  {
    term: "Ambi",
    language: "Gujarati / Punjabi",
    meaning: "The mango motif — 'paisley' in English.",
    note: "Named after Paisley in Scotland, which copied it. The form is Indian.",
  },
  {
    term: "Kalash",
    language: "Sanskrit",
    meaning: "The auspicious pot, with mango leaves and a coconut.",
    note: "It marks a beginning. Its presence means 'this has been deliberately started'.",
  },
  {
    term: "Torana",
    language: "Sanskrit",
    meaning: "A ceremonial gateway.",
    note: "Not a border — a composition. Indian entrances are decorated as whole structures.",
  },
];

export interface MaterialNote {
  material: string;
  what: string;
  /** Why the artist uses it rather than something easier. */
  why: string;
  /** Which traditions depend on it. */
  usedIn: string[];
}

export const MATERIALS: MaterialNote[] = [
  {
    material: "Rice paste",
    what: "Rice ground with water, drawn with a bamboo stick chewed at the end to form a brush.",
    why: "It is what a household already had. The medium never travelled further than the kitchen.",
    usedIn: ["Warli", "Kolam"],
  },
  {
    material: "Conch shell white",
    what: "Shell burnt and ground to a fine powder, then mixed with gum.",
    why: "It stays white for centuries where chalk would yellow. The brightest passages in a Pattachitra are shell.",
    usedIn: ["Pattachitra", "Kerala Mural"],
  },
  {
    material: "Lamp soot black",
    what: "Soot collected from an oil lamp, bound with gum or water.",
    why: "Black made this way ages to a warm brown-black. Chemical black stays blue forever, which is how forgeries are spotted.",
    usedIn: ["Pattachitra", "Kalamkari"],
  },
  {
    material: "Iron acetate",
    what: "Rusty iron soaked in jaggery water until it turns black.",
    why: "It does not sit on the cloth; it binds to the fibre and survives twenty washes.",
    usedIn: ["Kalamkari"],
  },
  {
    material: "Myrobalan",
    what: "Dried Terminalia chebula fruit powder, applied to cotton before drawing.",
    why: "It leaves a tannin ground that the dye grips. Without it the line bleeds and the cloth is lost.",
    usedIn: ["Kalamkari", "Block printing"],
  },
  {
    material: "Buffalo milk",
    what: "Soured milk brushed over cloth and dried before drawing.",
    why: "A sizing coat. It stops the pen line spreading into the weave.",
    usedIn: ["Kalamkari"],
  },
  {
    material: "Tamarind seed + chalk",
    what: "A paste used to coat cotton so it behaves like paper.",
    why: "Cloth is porous and paint sinks. The paste gives the surface 'tooth', as priming does for a canvas.",
    usedIn: ["Pattachitra"],
  },
  {
    material: "Cow dung and red earth",
    what: "A wall base levelled by hand and painted with clay.",
    why: "Warli was painted on the wall it was about. The surface is the building.",
    usedIn: ["Warli"],
  },
  {
    material: "Myrobalan black + indigo",
    what: "The two-stage resist used in Ajrakh: black from iron, blue from indigo, with mud as resist.",
    why: "A fourteen-stage process where the mud is the shield and the river is the rinse.",
    usedIn: ["Ajrakh", "Block printing"],
  },
  {
    material: "Squirrel-hair brush",
    what: "A few hairs bound to a bamboo handle, cut to a single point.",
    why: "Made for the one thing a machine cannot do: a line that thins as the hand lifts.",
    usedIn: ["Pattachitra", "Miniature", "Kalamkari"],
  },
];

export interface TimelineEntry {
  era: string;
  title: string;
  body: string;
}
/** A short, honest history — the dates people argue about, stated as ranges. */
export const TIMELINE: TimelineEntry[] = [
  {
    era: "c. 10,000 BCE",
    title: "Bhimbetka",
    body: "Shelter paintings in Madhya Pradesh: animals, hunts, and handprints in red ochre. The oldest surviving picture-making on the subcontinent, and still the reference point for Warli and Gond line work.",
  },
  {
    era: "c. 500 BCE – 500 CE",
    title: "Ajanta and the mural tradition",
    body: "Rock-cut caves painted with mineral pigment on plaster. The figures are modelled with light, unlike the flat colour of later folk painting — proof that 'Indian painting' was never one style.",
  },
  {
    era: "c. 750 – 1200 CE",
    title: "The regional temple walls",
    body: "Kerala murals, Tanjore, and the early Mithila wall paintings. Art moves inside the building: the wall becomes the book, and colour is mixed from whatever the region grows.",
  },
  {
    era: "c. 1550 – 1750",
    title: "Mughal and Rajput miniature",
    body: "Small-format painting on paper, made for albums. The squirrel-hair brush, the flat field, and the profile face that later folk painting inherits all consolidate here.",
  },
  {
    era: "c. 1700 – 1900",
    title: "Pattachitra and the scroll trades",
    body: "Scroll painting serves pilgrimage and storytelling: a picture is unrolled and sung. Painting is a service performed, not an object owned.",
  },
  {
    era: "1930s",
    title: "Kalamkari and the nationalist turn",
    body: "Hand-printed and hand-drawn textiles become a symbol of swadeshi. The technique survives partly because of what it came to stand for.",
  },
  {
    era: "1966 – 1970s",
    title: "Madhubani moves to paper",
    body: "A drought pushes the women of Mithila to paint on paper for sale rather than walls for the household. The double line comes with them — insurance the paper no longer needs, kept as signature.",
  },
  {
    era: "1970s",
    title: "Jangarh Singh Shyam, and Warli on canvas",
    body: "Gond and Warli painters move from wall to canvas and enter the gallery. The forms survive the change, because the motif was never in the wall.",
  },
  {
    era: "Today",
    title: "Line, pigment, hand",
    body: "The materials have not changed much, because they did not need to. What is at risk is not the technique but the transmission — a form is only alive if someone is still learning it from someone.",
  },
];

/**
 * Hindi reference text.
 *
 * Kept as parallel arrays keyed by term/era rather than translated inline, so
 * the English file stays readable and a missing translation degrades to the
 * English entry instead of disappearing. The glossary terms themselves (Kala,
 * Pattachitra, Kacni) are not translated — they are the words under discussion,
 * and an Indian reader meets them in these forms on both languages of the site.
 */
interface HindiGlossary {
  language?: string;
  meaning: string;
  note: string;
}

export const GLOSSARY_HI: Record<string, HindiGlossary> = {
  Kala: {
    language: "संस्कृत",
    meaning: "कला, शिल्प और हुनर — तीनों के लिए एक ही शब्द।",
    note: "'कला' और 'शिल्प' का भेद यूरोपीय है। कला यह भेद नहीं करती।",
  },
  Pattachitra: {
    language: "ओडिया",
    meaning: "पट्ट (कपड़ा) + चित्र (चित्र)।",
    note: "कपड़े पर इमली के बीज और खड़िया का लेप, ताकि खनिज रंग बिना फैले टिके रहे।",
  },
  Kalamkari: {
    language: "तेलुगु / फ़ारसी",
    meaning: "कलम (क़लम) + कारी (काम) — क़लम का काम।",
    note: "कपड़े में लिपटी बाँस की क़लम से बनाया जाता है। रंग बाद में आता है, नदी में।",
  },
  Kacni: {
    language: "मैथिली",
    meaning: "रेखा-कार्य — बाहरी रेखा का पहला दौर।",
    note: "मधुबनी में रेखा दो बार खींची जाती है, एक रेखा दूसरी के भीतर। भर्णी देखें।",
  },
  Bharni: {
    language: "मैथिली",
    meaning: "कचनी रेखा के भीतर भरा जाने वाला रंग।",
    note: "सपाट रंग, कोई छाया नहीं। गहराई दोहरी रेखा से आती है, रोशनी से नहीं।",
  },
  Digna: {
    language: "गोंडी",
    meaning: "किसी आकृति के भीतर भरने वाला नमूना।",
    note: "बीज, लकीरें और छोटे जीव। गोंड का पशु अपने ही वासस्थान से भरा होता है।",
  },
  Pulli: {
    language: "तमिल",
    meaning: "बिंदु — वह जाली जिसके इर्द-गिर्द कोलम बुना जाता है।",
    note: "आमतौर पर 5×5 या 7×7। रेखा बिंदुओं के चारों ओर बिना हाथ उठाए खींची जाती है।",
  },
  Kolam: {
    language: "तमिल",
    meaning: "सूरज उगने से पहले चावल के आटे से बनाया गया देहरी-चित्र।",
    note: "यह कीटों को खिलाता है, आने वाले का स्वागत करता है, और उस ज़मीन को चिह्नित करता है जिसकी देखभाल होती है।",
  },
  Tarpa: {
    language: "वारली / मराठी",
    meaning: "बीच के वाद्य के इर्द-गिर्द घूमता एक भँवर-नृत्य।",
    note: "जुड़ी आकृतियों के भँवर के रूप में चित्रित। यह आयोजन स्वयं है, उसका चित्र नहीं।",
  },
  "Pattachitra rasa": {
    language: "ओडिया",
    meaning: "वह भाव जिसे रचना उठाने के लिए बनाई जाती है।",
    note: "रचना रस के अनुसार चलती है: वीर दृश्य तिरछी रेखाओं पर, कोमल दृश्य वृत्तों पर।",
  },
  Chitrakathi: {
    language: "मराठी",
    meaning: "चित्र-कथा — ऐसा चित्रित पोथा जो गाया जाते समय दिखाया जाता है।",
    note: "चित्र और कथावाचन कभी अलग वस्तुएँ नहीं थे।",
  },
  "Tana-bana": {
    language: "हिन्दी / उर्दू",
    meaning: "ताना और बाना।",
    note: "वस्त्रों के लिए भी, और कहानी की बनावट के लिए भी। दोनों बुने जाते हैं, ढेर किए नहीं जाते।",
  },
  Jali: {
    language: "फ़ारसी / हिन्दी",
    meaning: "छिद्रित जालीदार परदा।",
    note: "इस तरह तराशा गया कि रोशनी नमूना बन जाए। चित्रकला में बनावट के क्षेत्र के रूप में।",
  },
  Ambi: {
    language: "गुजराती / पंजाबी",
    meaning: "आम का रूपांकन — अंग्रेज़ी में 'पेज़ली'।",
    note: "इसे स्कॉटलैंड के पेज़ली से नाम मिला, जिसने इसकी नक़ल की। रूप भारतीय है।",
  },
  Kalash: {
    language: "संस्कृत",
    meaning: "शुभ कलश, आम के पत्तों और नारियल के साथ।",
    note: "यह आरंभ का चिह्न है। इसका होना अर्थ है 'यह जान-बूझकर शुरू किया गया है'।",
  },
  Torana: {
    language: "संस्कृत",
    meaning: "उत्सव का प्रवेश-द्वार।",
    note: "किनारा नहीं, एक पूरी रचना। भारतीय प्रवेश-द्वार पूरी संरचना के रूप में सजाए जाते हैं।",
  },
};

interface HindiMaterial {
  material?: string;
  what: string;
  why: string;
  usedIn?: string[];
}

export const MATERIALS_HI: Record<string, HindiMaterial> = {
  "Rice paste": {
    material: "चावल का लेप",
    what: "पानी में पिसा चावल, बाँस की छड़ी से बनाया जाता है जिसका सिरा चबाकर ब्रश बना लिया जाता है।",
    why: "घर में जो पहले से था वही। यह माध्यम रसोई से आगे कभी नहीं गया।",
  },
  "Conch shell white": {
    material: "शंख का सफ़ेद",
    what: "शंख जलाकर बारीक पाउडर बनाया जाता है, फिर गोंद में मिलाया जाता है।",
    why: "जहाँ खड़िया पीला पड़ जाती वहाँ यह सदियों सफ़ेद रहता है। पटचित्र के सबसे चमकीले हिस्से शंख के हैं।",
  },
  "Lamp soot black": {
    material: "दीए की कालिख",
    what: "दीए से इकट्ठी कालिख, गोंद या पानी में जोड़ी गई।",
    why: "इस तरह का काला पुराना होकर गरम भूरा-काला होता है। रासायनिक काला हमेशा नीला रहता है, और नक़ली कृति इसी से पकड़ी जाती है।",
  },
  "Iron acetate": {
    material: "लोहे का एसीटेट",
    what: "जंग लगा लोहा गुड़ के पानी में भिगोया जाता है जब तक काला न हो जाए।",
    why: "यह कपड़े पर बैठता नहीं, रेशे से बँध जाता है और बीस धुलाइयाँ झेल जाता है।",
  },
  Myrobalan: {
    material: "हरड़",
    what: "सूखे हरड़ फल का पाउडर, चित्र बनाने से पहले सूती कपड़े पर लगाया जाता है।",
    why: "यह टैनिन की तल बनाता है जिसे रंग पकड़ता है। इसके बिना रेखा फैल जाती है और कपड़ा बर्बाद।",
  },
  "Buffalo milk": {
    material: "भैंस का दूध",
    what: "खट्टा दूध कपड़े पर पोता जाता है और सुखाया जाता है, फिर चित्र बनाया जाता है।",
    why: "यह कलफ़ का काम करता है। क़लम की रेखा को बुनाई में फैलने से रोकता है।",
  },
  "Tamarind seed + chalk": {
    material: "इमली के बीज + खड़िया",
    what: "एक लेप जो सूती कपड़े पर लगाकर उसे कागज़ जैसा व्यवहार करने पर मजबूर करता है।",
    why: "कपड़ा छिद्रयुक्त होता है और रंग धँसता है। यह लेप सतह को 'पकड़' देता है, जैसे कैनवास पर प्राइमर करता है।",
  },
  "Cow dung and red earth": {
    material: "गोबर और गेरू",
    what: "हाथ से बराबर की गई दीवार की तल, मिट्टी से पुती हुई।",
    why: "वारली उसी दीवार पर बनती थी जिसके बारे में वह थी। सतह ही इमारत है।",
  },
  "Myrobalan black + indigo": {
    material: "हरड़ का काला + नील",
    what: "अजरख में दो-चरणी रोक: लोहे से काला, नील से नीला, और कीचड़ को रोक के रूप में।",
    why: "चौदह चरणों की प्रक्रिया जिसमें कीचड़ ढाल है और नदी धुलाई।",
  },
  "Squirrel-hair brush": {
    material: "गिलहरी के बाल का ब्रश",
    what: "बाँस के हैंडल पर कुछ बाल बाँधकर एक नोक पर काटे गए।",
    why: "उस एक चीज़ के लिए बना जो मशीन नहीं कर सकती: हाथ उठने के साथ पतली होती रेखा।",
  },
};

export const TIMELINE_HI: Record<string, { era?: string; title: string; body: string }> = {
  Bhimbetka: {
    era: "लगभग 10,000 ईसा पूर्व",
    title: "भीमबेटका",
    body: "मध्य प्रदेश की शरण-चित्रकारी: पशु, शिकार, और गेरू में हथेलियों के निशान। उपमहाद्वीप की सबसे पुरानी बची हुई चित्रकारी, और वारली तथा गोंड की रेखाओं का आज भी संदर्भ-बिंदु।",
  },
  "Ajanta and the mural tradition": {
    era: "लगभग 500 ईसा पूर्व – 500 ईस्वी",
    title: "अजंता और भित्ति-चित्र परंपरा",
    body: "चट्टान काटकर बनाई गई गुफाएँ, प्लास्टर पर खनिज रंग। आकृतियाँ रोशनी से गढ़ी गई हैं, बाद की लोक-चित्रकारी के सपाट रंग से उलट — सबूत कि 'भारतीय चित्रकला' कभी एक शैली नहीं थी।",
  },
  "The regional temple walls": {
    era: "लगभग 750 – 1200 ईस्वी",
    title: "क्षेत्रीय मंदिर-दीवारें",
    body: "केरल के भित्ति-चित्र, तंजौर, और आरंभिक मिथिला दीवार-चित्र। कला इमारत के भीतर आ जाती है: दीवार किताब बन जाती है, और रंग उसी से बनते हैं जो उस क्षेत्र में उगता है।",
  },
  "Mughal and Rajput miniature": {
    era: "लगभग 1550 – 1750",
    title: "मुग़ल और राजपूत लघु-चित्र",
    body: "कागज़ पर छोटे आकार की चित्रकारी, एलबम के लिए बनी। गिलहरी के बाल का ब्रश, सपाट क्षेत्र, और प्रोफ़ाइल चेहरा — जो बाद में लोक-चित्रकारी को मिले — यहीं स्थिर होते हैं।",
  },
  "Pattachitra and the scroll trades": {
    era: "लगभग 1700 – 1900",
    title: "पटचित्र और पोथी का व्यापार",
    body: "पोथी-चित्र तीर्थयात्रा और कथावाचन की सेवा करती है: चित्र खोला जाता है और गाया जाता है। चित्रकारी एक की गई सेवा है, रखी जाने वाली वस्तु नहीं।",
  },
  "Kalamkari and the nationalist turn": {
    era: "1930 का दशक",
    title: "कलमकारी और राष्ट्रवादी मोड़",
    body: "हाथ से छपे और हाथ से बने वस्त्र स्वदेशी का प्रतीक बन जाते हैं। यह तकनीक आंशिक रूप से इसलिए बची कि यह किस बात की प्रतीक बनी।",
  },
  "Madhubani moves to paper": {
    era: "1966 – 1970 का दशक",
    title: "मधुबनी कागज़ पर आती है",
    body: "सूखा मिथिला की महिलाओं को घर की दीवारों की जगह बिक्री के लिए कागज़ पर चित्र बनाने पर मजबूर करता है। दोहरी रेखा साथ आती है — उस तरह की सुरक्षा जिसकी कागज़ को ज़रूरत नहीं थी, पर जो अब पहचान बन गई।",
  },
  "Jangarh Singh Shyam, and Warli on canvas": {
    era: "1970 का दशक",
    title: "जनगढ़ सिंह श्याम, और कैनवास पर वारली",
    body: "गोंड और वारली चित्रकार दीवार से कैनवास पर आते हैं और दीर्घा में पहुँचते हैं। रूप यह बदलाव झेल जाते हैं, क्योंकि रूपांकन कभी दीवार में नहीं बसा था।",
  },
  "Line, pigment, hand": {
    era: "आज",
    title: "रेखा, रंग, हाथ",
    body: "सामग्री ज़्यादा नहीं बदली, क्योंकि बदलने की ज़रूरत नहीं थी। जो जोखिम में है वह तकनीक नहीं, हस्तांतरण है — कोई रूप तभी जीवित है जब कोई उसे किसी से सीख रहा हो।",
  },
};

/** Apply the Hindi overlay when the locale is not English. */
export function localiseGlossary(terms: GlossaryTerm[], locale: string) {
  if (locale !== "hi") return terms;
  return terms.map((term) => {
    const hi = GLOSSARY_HI[term.term];
    return hi ? { ...term, ...hi } : term;
  });
}

export function localiseMaterials(notes: MaterialNote[], locale: string) {
  if (locale !== "hi") return notes;
  return notes.map((note) => {
    const hi = MATERIALS_HI[note.material];
    return hi ? { ...note, ...hi } : note;
  });
}

export function localiseTimeline(entries: TimelineEntry[], locale: string) {
  if (locale !== "hi") return entries;
  return entries.map((entry) => {
    const hi = TIMELINE_HI[entry.title];
    return hi ? { ...entry, ...hi } : entry;
  });
}

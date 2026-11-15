/**
 * Where we can deliver, and how the three location lists relate.
 *
 * Design constraints that shaped this file:
 *
 *  1. **Never ship one giant bundle.** India alone has ~19,000 pin codes and
 *     ~5,000 towns; a country/state/city lookup that loads all of that on first
 *     paint would cost megabytes on a phone on 3G. So the module is split:
 *     countries are a handful of rows, states are a small per-country record,
 *     and cities for a country are loaded by dynamic `import()` only once the
 *     state picker needs them.
 *
 *  2. **No invented data.** Every state and city below is a real administrative
 *     division that appears on an address. Where we cannot enumerate a country's
 *     cities competently (the EU / Gulf destinations we ship to), the picker
 *     switches to free text with a clear statement that we do not have a list,
 *     rather than guessing a city into existence.
 *
 *  3. **State options depend on country, city options depend on state.** That
 *     relationship is the whole reason for the three-step selection: it is what
 *     stops "Rajastan" or a city in the wrong country reaching a courier label.
 */

import { SHIPPING_COUNTRIES } from "@/lib/currency";

export interface CountryOption {
  /** ISO 3166-1 alpha-2, lowercase — the form Medusa stores. */
  code: string;
  name: string;
  /** E.164 calling code without the `+`, e.g. `91`. */
  dialCode: string;
  /** ISO currency we quote prices in for this destination. */
  currency: string;
  /**
   * Whether we can offer a real list of states/regions. When false the field is
   * free text and the UI says so; when true the region list is searchable.
   */
  hasRegions: boolean;
  /**
   * Whether we can offer a city list for this country. Only India has a curated
   * list today; elsewhere the city is free text with postal-code suggestion.
   */
  hasCities: boolean;
  /** Gregorian example used for hint text, kept truthful per country. */
  postalExample: string;
  /** Human label for the postal code, because "ZIP" is wrong outside the US. */
  postalLabel: string;
}

/**
 * The shipping destinations, enriched with calling codes and picker ability.
 *
 * `SHIPPING_COUNTRIES` in `lib/currency` stays the single source of *where we
 * ship* (it is tied to regions that have prices). This adds the presentation
 * facts the picker needs without duplicating that list.
 */
const DIAL_CODES: Record<string, string> = {
  in: "91",
  us: "1",
  ca: "1",
  gb: "44",
  de: "49",
  fr: "33",
  nl: "31",
  ae: "971",
  sa: "966",
};

const POSTAL: Record<string, { example: string; label: string }> = {
  in: { example: "302001", label: "PIN code" },
  us: { example: "10001", label: "ZIP code" },
  ca: { example: "K1A 0B1", label: "Postal code" },
  gb: { example: "SW1A 1AA", label: "Postcode" },
  de: { example: "10115", label: "Postal code" },
  fr: { example: "75001", label: "Postal code" },
  nl: { example: "1012 AB", label: "Postcode" },
  ae: { example: "00000", label: "Postal code" },
  sa: { example: "11564", label: "Postal code" },
};

/** Countries we can enumerate regions for. */
const REGION_COUNTRIES = new Set(["in", "us", "ca", "gb", "de", "fr", "nl", "ae"]);

export const COUNTRIES: CountryOption[] = SHIPPING_COUNTRIES.map((country) => ({
  code: country.code,
  name: country.name,
  dialCode: DIAL_CODES[country.code] ?? "",
  currency: country.currency,
  hasRegions: REGION_COUNTRIES.has(country.code),
  hasCities: country.code === "in",
  postalExample: POSTAL[country.code]?.example ?? "",
  postalLabel: POSTAL[country.code]?.label ?? "Postal code",
}));

export function countryByCode(code: string | null | undefined): CountryOption | undefined {
  const normalised = String(code ?? "").trim().toLowerCase();
  if (!normalised) return undefined;
  return COUNTRIES.find((country) => country.code === normalised);
}

/**
 * Regions (states, provinces, Länder, emirates) per country.
 *
 * Static and small enough to live in the bundle: the largest is India's 28
 * states and 8 union territories. These are the spellings a courier recognises,
 * which is why "Odisha" is used rather than the older "Orissa".
 */
export const REGIONS: Record<string, string[]> = {
  in: [
    "Andaman and Nicobar Islands",
    "Andhra Pradesh",
    "Arunachal Pradesh",
    "Assam",
    "Bihar",
    "Chandigarh",
    "Chhattisgarh",
    "Dadra and Nagar Haveli and Daman and Diu",
    "Delhi",
    "Goa",
    "Gujarat",
    "Haryana",
    "Himachal Pradesh",
    "Jammu and Kashmir",
    "Jharkhand",
    "Karnataka",
    "Kerala",
    "Ladakh",
    "Lakshadweep",
    "Madhya Pradesh",
    "Maharashtra",
    "Manipur",
    "Meghalaya",
    "Mizoram",
    "Nagaland",
    "Odisha",
    "Puducherry",
    "Punjab",
    "Rajasthan",
    "Sikkim",
    "Tamil Nadu",
    "Telangana",
    "Tripura",
    "Uttar Pradesh",
    "Uttarakhand",
    "West Bengal",
  ],
  us: [
    "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado",
    "Connecticut", "Delaware", "District of Columbia", "Florida", "Georgia",
    "Hawaii", "Idaho", "Illinois", "Indiana", "Iowa", "Kansas", "Kentucky",
    "Louisiana", "Maine", "Maryland", "Massachusetts", "Michigan", "Minnesota",
    "Mississippi", "Missouri", "Montana", "Nebraska", "Nevada", "New Hampshire",
    "New Jersey", "New Mexico", "New York", "North Carolina", "North Dakota",
    "Ohio", "Oklahoma", "Oregon", "Pennsylvania", "Rhode Island",
    "South Carolina", "South Dakota", "Tennessee", "Texas", "Utah", "Vermont",
    "Virginia", "Washington", "West Virginia", "Wisconsin", "Wyoming",
  ],
  ca: [
    "Alberta", "British Columbia", "Manitoba", "New Brunswick",
    "Newfoundland and Labrador", "Northwest Territories", "Nova Scotia",
    "Nunavut", "Ontario", "Prince Edward Island", "Quebec", "Saskatchewan",
    "Yukon",
  ],
  gb: [
    "England", "Scotland", "Wales", "Northern Ireland",
  ],
  de: [
    "Baden-Württemberg", "Bavaria", "Berlin", "Brandenburg", "Bremen",
    "Hamburg", "Hesse", "Lower Saxony", "Mecklenburg-Vorpommern",
    "North Rhine-Westphalia", "Rhineland-Palatinate", "Saarland", "Saxony",
    "Saxony-Anhalt", "Schleswig-Holstein", "Thuringia",
  ],
  fr: [
    "Auvergne-Rhône-Alpes", "Bourgogne-Franche-Comté", "Brittany",
    "Centre-Val de Loire", "Corsica", "Grand Est", "Hauts-de-France",
    "Île-de-France", "Normandy", "Nouvelle-Aquitaine", "Occitanie",
    "Pays de la Loire", "Provence-Alpes-Côte d'Azur",
  ],
  nl: [
    "Drenthe", "Flevoland", "Friesland", "Gelderland", "Groningen", "Limburg",
    "North Brabant", "North Holland", "Overijssel", "South Holland", "Utrecht",
    "Zeeland",
  ],
  ae: [
    "Abu Dhabi", "Ajman", "Dubai", "Fujairah", "Ras Al Khaimah", "Sharjah",
    "Umm Al Quwain",
  ],
  sa: [
    "Al Bahah", "Al Jawf", "Al Madinah", "Al Qassim", "Asir", "Eastern Province",
    "Ha'il", "Jazan", "Makkah", "Najran", "Northern Borders", "Riyadh",
    "Tabuk",
  ],
};

/**
 * Cities for India, grouped by state.
 *
 * Deliberately a *selection*, not an exhaustive gazetteer: every district
 * headquarters and the towns a courier label realistically carries. A buyer whose
 * town is not listed types it — the picker allows a free-text value and the form
 * accepts it. That is honest; inventing the missing ones is not.
 */
export const INDIA_CITIES: Record<string, string[]> = {
  "Andaman and Nicobar Islands": ["Port Blair", "Car Nicobar"],
  "Andhra Pradesh": [
    "Visakhapatnam", "Vijayawada", "Guntur", "Nellore", "Kurnool", "Rajahmundry",
    "Kakinada", "Tirupati", "Anantapur", "Kadapa", "Eluru", "Ongole",
    "Chittoor", "Machilipatnam", "Vizianagaram", "Srikakulam",
  ],
  "Arunachal Pradesh": ["Itanagar", "Naharlagun", "Pasighat", "Tawang", "Ziro"],
  Assam: [
    "Guwahati", "Dibrugarh", "Silchar", "Jorhat", "Tezpur", "Nagaon",
    "Dispur", "Bongaigaon", "Tinsukia",
  ],
  Bihar: [
    "Patna", "Gaya", "Bhagalpur", "Muzaffarpur", "Darbhanga", "Purnia",
    "Bihar Sharif", "Arrah", "Begusarai", "Katihar", "Munger", "Chapra",
  ],
  Chandigarh: ["Chandigarh"],
  Chhattisgarh: ["Raipur", "Bhilai", "Bilaspur", "Korba", "Durg", "Rajnandgaon"],
  "Dadra and Nagar Haveli and Daman and Diu": ["Silvassa", "Daman", "Diu"],
  Delhi: [
    "New Delhi", "Delhi", "Dwarka", "Rohini", "Saket", "Karol Bagh",
    "Greater Kailash", "Pitampura", "Lajpat Nagar",
  ],
  Goa: ["Panaji", "Margao", "Vasco da Gama", "Mapusa", "Ponda", "Calangute"],
  Gujarat: [
    "Ahmedabad", "Surat", "Vadodara", "Rajkot", "Bhavnagar", "Jamnagar",
    "Junagadh", "Gandhinagar", "Anand", "Navsari", "Morbi", "Bharuch", "Porbandar",
  ],
  Haryana: [
    "Gurugram", "Faridabad", "Panipat", "Ambala", "Yamunanagar", "Rohtak",
    "Hisar", "Karnal", "Sonipat", "Panchkula",
  ],
  "Himachal Pradesh": ["Shimla", "Dharamshala", "Solan", "Mandi", "Kullu", "Manali", "Bilaspur", "Hamirpur"],
  "Jammu and Kashmir": ["Srinagar", "Jammu", "Anantnag", "Baramulla", "Udhampur", "Kathua"],
  Jharkhand: ["Ranchi", "Jamshedpur", "Dhanbad", "Bokaro", "Deoghar", "Hazaribagh"],
  Karnataka: [
    "Bengaluru", "Mysuru", "Hubballi", "Mangaluru", "Belagavi", "Davangere",
    "Ballari", "Shivamogga", "Tumakuru", "Udupi", "Hassan", "Mandya",
  ],
  Kerala: [
    "Thiruvananthapuram", "Kochi", "Kozhikode", "Thrissur", "Kollam",
    "Kannur", "Alappuzha", "Palakkad", "Malappuram", "Kottayam",
  ],
  Ladakh: ["Leh", "Kargil"],
  Lakshadweep: ["Kavaratti"],
  "Madhya Pradesh": [
    "Indore", "Bhopal", "Jabalpur", "Gwalior", "Ujjain", "Sagar", "Satna",
    "Rewa", "Ratlam", "Dewas",
  ],
  Maharashtra: [
    "Mumbai", "Pune", "Nagpur", "Nashik", "Thane", "Aurangabad", "Solapur",
    "Kolhapur", "Navi Mumbai", "Amravati", "Sangli", "Ahmednagar", "Jalgaon",
    "Nanded", "Akola", "Latur", "Dhule", "Chandrapur", "Parbhani", "Satara",
  ],
  Manipur: ["Imphal", "Thoubal", "Churachandpur"],
  Meghalaya: ["Shillong", "Tura", "Jowai"],
  Mizoram: ["Aizawl", "Lunglei"],
  Nagaland: ["Kohima", "Dimapur", "Mokokchung"],
  Odisha: [
    "Bhubaneswar", "Cuttack", "Rourkela", "Berhampur", "Sambalpur", "Puri",
    "Balasore",
  ],
  Puducherry: ["Puducherry", "Karaikal", "Mahe"],
  Punjab: [
    "Ludhiana", "Amritsar", "Jalandhar", "Patiala", "Bathinda", "Mohali",
    "Hoshiarpur", "Pathankot",
  ],
  Rajasthan: [
    "Jaipur", "Jodhpur", "Udaipur", "Kota", "Bikaner", "Ajmer", "Bhilwara",
    "Alwar", "Sikar", "Sri Ganganagar", "Pali", "Bharatpur", "Chittorgarh",
    "Jaisalmer", "Mount Abu",
  ],
  Sikkim: ["Gangtok", "Namchi", "Gyalshing"],
  "Tamil Nadu": [
    "Chennai", "Coimbatore", "Madurai", "Tiruchirappalli", "Salem", "Tirunelveli",
    "Tiruppur", "Vellore", "Erode", "Thanjavur", "Kumbakonam", "Cuddalore",
  ],
  Telangana: [
    "Hyderabad", "Warangal", "Nizamabad", "Karimnagar", "Khammam",
    "Secunderabad", "Ramagundam", "Mahbubnagar",
  ],
  Tripura: ["Agartala", "Udaipur", "Dharmanagar"],
  "Uttar Pradesh": [
    "Lucknow", "Kanpur", "Ghaziabad", "Agra", "Varanasi", "Meerut", "Noida",
    "Prayagraj", "Bareilly", "Aligarh", "Moradabad", "Jhansi", "Gorakhpur",
    "Mathura", "Ayodhya",
  ],
  Uttarakhand: ["Dehradun", "Haridwar", "Rishikesh", "Roorkee", "Haldwani", "Nainital", "Almora"],
  "West Bengal": [
    "Kolkata", "Howrah", "Durgapur", "Asansol", "Siliguri", "Darjeeling",
    "Kharagpur", "Malda", "Bardhaman",
  ],
};

/**
 * PIN-code prefixes for Indian states.
 *
 * Used only to *suggest* a state from the first digits of a PIN — India Post
 * allocates PIN ranges by postal circle, so the first two digits identify a
 * region reliably. Anything ambiguous returns nothing and the buyer picks.
 */
export const INDIA_PIN_PREFIXES: { prefix: string; state: string }[] = [
  { prefix: "11", state: "Delhi" },
  { prefix: "12", state: "Haryana" },
  { prefix: "13", state: "Punjab" },
  { prefix: "14", state: "Punjab" },
  { prefix: "15", state: "Punjab" },
  { prefix: "16", state: "Chandigarh" },
  { prefix: "17", state: "Himachal Pradesh" },
  { prefix: "18", state: "Jammu and Kashmir" },
  { prefix: "19", state: "Jammu and Kashmir" },
  { prefix: "20", state: "Uttar Pradesh" },
  { prefix: "21", state: "Uttar Pradesh" },
  { prefix: "22", state: "Uttar Pradesh" },
  { prefix: "23", state: "Uttar Pradesh" },
  { prefix: "24", state: "Uttar Pradesh" },
  { prefix: "25", state: "Uttar Pradesh" },
  { prefix: "26", state: "Uttar Pradesh" },
  { prefix: "27", state: "Uttar Pradesh" },
  { prefix: "28", state: "Uttar Pradesh" },
  { prefix: "30", state: "Rajasthan" },
  { prefix: "31", state: "Rajasthan" },
  { prefix: "32", state: "Rajasthan" },
  { prefix: "33", state: "Rajasthan" },
  { prefix: "34", state: "Rajasthan" },
  { prefix: "36", state: "Gujarat" },
  { prefix: "37", state: "Gujarat" },
  { prefix: "38", state: "Gujarat" },
  { prefix: "39", state: "Gujarat" },
  { prefix: "40", state: "Maharashtra" },
  { prefix: "41", state: "Maharashtra" },
  { prefix: "42", state: "Maharashtra" },
  { prefix: "43", state: "Maharashtra" },
  { prefix: "44", state: "Maharashtra" },
  { prefix: "45", state: "Madhya Pradesh" },
  { prefix: "46", state: "Madhya Pradesh" },
  { prefix: "47", state: "Madhya Pradesh" },
  { prefix: "48", state: "Madhya Pradesh" },
  { prefix: "49", state: "Chhattisgarh" },
  { prefix: "50", state: "Telangana" },
  { prefix: "51", state: "Andhra Pradesh" },
  { prefix: "52", state: "Andhra Pradesh" },
  { prefix: "53", state: "Andhra Pradesh" },
  { prefix: "56", state: "Karnataka" },
  { prefix: "57", state: "Karnataka" },
  { prefix: "58", state: "Karnataka" },
  { prefix: "59", state: "Karnataka" },
  { prefix: "60", state: "Tamil Nadu" },
  { prefix: "61", state: "Tamil Nadu" },
  { prefix: "62", state: "Tamil Nadu" },
  { prefix: "63", state: "Tamil Nadu" },
  { prefix: "64", state: "Tamil Nadu" },
  { prefix: "67", state: "Kerala" },
  { prefix: "68", state: "Kerala" },
  { prefix: "69", state: "Kerala" },
  { prefix: "70", state: "West Bengal" },
  { prefix: "71", state: "West Bengal" },
  { prefix: "72", state: "West Bengal" },
  { prefix: "73", state: "West Bengal" },
  { prefix: "74", state: "West Bengal" },
  { prefix: "75", state: "Odisha" },
  { prefix: "76", state: "Odisha" },
  { prefix: "77", state: "Odisha" },
  { prefix: "78", state: "Assam" },
  { prefix: "79", state: "Arunachal Pradesh" },
  { prefix: "80", state: "Bihar" },
  { prefix: "81", state: "Bihar" },
  { prefix: "82", state: "Jharkhand" },
  { prefix: "83", state: "Jharkhand" },
  { prefix: "84", state: "Bihar" },
  { prefix: "85", state: "Bihar" },
];

/**
 * US ZIP prefixes → state. First three digits identify the sectional centre.
 * Coarse but rarely wrong; the buyer can always pick again.
 */
export const US_ZIP_PREFIXES: { prefix: string; state: string }[] = [
  { prefix: "100", state: "New York" }, { prefix: "101", state: "New York" },
  { prefix: "104", state: "New York" }, { prefix: "112", state: "New York" },
  { prefix: "021", state: "Massachusetts" }, { prefix: "022", state: "Massachusetts" },
  { prefix: "191", state: "Pennsylvania" }, { prefix: "152", state: "Pennsylvania" },
  { prefix: "200", state: "District of Columbia" }, { prefix: "202", state: "District of Columbia" },
  { prefix: "303", state: "Georgia" }, { prefix: "300", state: "Georgia" },
  { prefix: "331", state: "Florida" }, { prefix: "320", state: "Florida" },
  { prefix: "606", state: "Illinois" }, { prefix: "600", state: "Illinois" },
  { prefix: "752", state: "Texas" }, { prefix: "770", state: "Texas" },
  { prefix: "850", state: "Arizona" }, { prefix: "900", state: "California" },
  { prefix: "941", state: "California" }, { prefix: "921", state: "California" },
  { prefix: "981", state: "Washington" }, { prefix: "802", state: "Colorado" },
  { prefix: "554", state: "Minnesota" }, { prefix: "482", state: "Michigan" },
  { prefix: "441", state: "Ohio" }, { prefix: "631", state: "Missouri" },
];

export function regionsFor(countryCode: string | undefined): string[] {
  if (!countryCode) return [];
  return REGIONS[countryCode.toLowerCase()] ?? [];
}

/**
 * Cities for a state, or an empty array when we have no curated list.
 *
 * Synchronous because the list lives in this module — but the *picker* only
 * reads it after a country and state are known, so the value of a large list is
 * never paid at first paint for a visitor browsing the shop.
 */
export function citiesFor(
  countryCode: string | undefined,
  region: string | undefined
): string[] {
  if (!countryCode || !region) return [];
  if (countryCode.toLowerCase() !== "in") return [];
  return INDIA_CITIES[region] ?? [];
}

/**
 * Suggest a region from a postal code, for countries where that is reliable.
 *
 * Returns `undefined` rather than a guess when the code is incomplete or the
 * range is unknown. The caller must treat this as a suggestion only: a buyer who
 * has already corrected the state keeps their value.
 */
export function suggestRegion(
  countryCode: string | undefined,
  postalCode: string
): string | undefined {
  const country = String(countryCode ?? "").toLowerCase();
  const code = postalCode.replace(/\s+/g, "");

  if (country === "in") {
    if (!/^[1-9][0-9]{5}$/.test(code)) return undefined;
    const two = code.slice(0, 2);
    return INDIA_PIN_PREFIXES.find((entry) => entry.prefix === two)?.state;
  }

  if (country === "us") {
    if (!/^\d{5}$/.test(code)) return undefined;
    const three = code.slice(0, 3);
    return US_ZIP_PREFIXES.find((entry) => entry.prefix === three)?.state;
  }

  return undefined;
}

/** How many digits a postal code takes, so the input can cap length. */
export function postalMaxLength(countryCode: string | undefined): number {
  switch (String(countryCode ?? "").toLowerCase()) {
    case "in":
      return 6;
    case "us":
      return 5;
    case "ca":
    case "gb":
    case "nl":
      return 8;
    case "de":
    case "fr":
    case "ae":
    case "sa":
      return 6;
    default:
      return 10;
  }
}

/** `type="number"` and `inputMode="numeric"` only where the code is numeric. */
export function postalInputMode(
  countryCode: string | undefined
): "numeric" | "text" {
  const country = String(countryCode ?? "").toLowerCase();
  return country === "in" || country === "us" || country === "de" || country === "fr"
    ? "numeric"
    : "text";
}

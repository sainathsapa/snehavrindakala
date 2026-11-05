// Seed product data for the SnehaVrinda Kala storefront.
// In production this is sourced from the Medusa backend; this file enables
// a working frontend shell before the backend is connected.

export interface Product {
  id: string;
  title: string;
  artist: string;
  price: number;
  stockType: "ready_to_ship" | "made_to_order" | "custom_only";
  image: string;
  isNew?: boolean;
  collection?: string;
  artForm?: string;
}

export const products: Product[] = [
  {
    id: "prod_001",
    title: "Hand-painted Terracotta Vase",
    artist: "Lakshmi Rajan",
    price: 2200,
    stockType: "ready_to_ship",
    image: "/images/products/terracotta-vase.jpg",
    isNew: true,
    collection: "Home & Decorative Art",
    artForm: "Ceramics",
  },
  {
    id: "prod_002",
    title: "Madhubani Folk Painting",
    artist: "Arjun Mehta",
    price: 8500,
    stockType: "ready_to_ship",
    image: "/images/products/madhubani-painting.jpg",
    collection: "Traditional & Folk Art",
    artForm: "Madhubani",
  },
  {
    id: "prod_003",
    title: "Embroidered Cotton Throw",
    artist: "Fatima Sheikh",
    price: 4200,
    stockType: "made_to_order",
    image: "/images/products/cotton-throw.jpg",
    collection: "Textile & Fibre Art",
    artForm: "Embroidery",
  },
  {
    id: "prod_004",
    title: "Custom Portrait Commission",
    artist: "Commission only",
    price: 15000,
    stockType: "custom_only",
    image: "/images/products/commission-portrait.jpg",
    collection: "Personalized & Commissioned",
    artForm: "Portraiture",
  },
  {
    id: "prod_005",
    title: "Block-Printed Journal Set",
    artist: "Rohan Das",
    price: 1100,
    stockType: "ready_to_ship",
    image: "/images/products/journal-set.jpg",
    isNew: true,
    collection: "Paper, Stationery & Books",
    artForm: "Block Printing",
  },
  {
    id: "prod_006",
    title: "Wearable Art Pendant",
    artist: "Sita Nair",
    price: 3400,
    stockType: "ready_to_ship",
    image: "/images/products/art-pendant.jpg",
    collection: "Wearable Art",
    artForm: "Jewellery",
  },
];

export const collections = [
  {
    id: "painting-drawing",
    name: "Painting & Drawing",
    productCount: 12,
  },
  {
    id: "traditional-folk-art",
    name: "Traditional & Folk Art",
    productCount: 8,
  },
  {
    id: "home-decor",
    name: "Home & Decorative Art",
    productCount: 10,
  },
  {
    id: "textile-fibre",
    name: "Textile & Fibre Art",
    productCount: 9,
  },
  {
    id: "paper-stationery",
    name: "Paper, Stationery & Books",
    productCount: 7,
  },
  {
    id: "wearable-art",
    name: "Wearable Art",
    productCount: 6,
  },
];

// Deterministic demo marketplace data (spec §3). Pure module: no DB access,
// so tests can verify invariants without a database. All rows created from
// this file are flagged isDemo by seed.ts.

export interface SeedMenuItem {
  category: string; name: string; description: string;
  priceCents: number; imageUrl: string | null; isAvailable: boolean; position: number;
}
export interface SeedReview { stars: number; reviewText: string; authorName: string; createdAt: Date; }
export interface SeedRestaurant {
  name: string; description: string; address: string; cuisines: string[];
  opensAt: string; closesAt: string; estDeliveryMin: number; orderCount: number;
  approvedAt: Date; heroImageUrl: string; avgRating: number; ratingCount: number;
  lat: number; lng: number;
  menuItems: SeedMenuItem[]; reviews: SeedReview[];
}

const DAY = 86_400_000;

// Deterministic PRNG so re-running the seed produces identical data.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const unsplash = (id: string) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=800&q=60`;

type ItemTuple = [name: string, description: string, priceCents: number];

// 8 cuisine menu templates; every template has 4 categories and 10-12 items
// (satisfies the 8-15 items / 3-4 categories invariant).
const MENUS: Record<string, { category: string; items: ItemTuple[] }[]> = {
  Pakistani: [
    { category: "Starters", items: [
      ["Chicken Samosa (2 pc)", "Crisp pastry, spiced chicken filling", 15000],
      ["Dahi Bhalla", "Lentil dumplings, whipped yogurt, tamarind", 22000],
      ["Seekh Kebab (4 pc)", "Charcoal-grilled minced beef skewers", 45000]] },
    { category: "Mains", items: [
      ["Chicken Biryani", "Sella rice, marinated chicken, raita on the side", 42000],
      ["Beef Nihari", "Slow-cooked shank, ginger, green chili", 55000],
      ["Chicken Karahi (Half)", "Tomato-chili wok curry, wood-fired", 65000],
      ["Daal Makhani", "Black lentils finished with butter and cream", 32000]] },
    { category: "Breads & Rice", items: [
      ["Garlic Naan", "Tandoor-baked, garlic butter brush", 8000],
      ["Roghni Naan", "Sesame topped, milk wash", 7000],
      ["Steamed Basmati", "Fragrant long-grain rice", 15000]] },
    { category: "Drinks & Desserts", items: [
      ["Sweet Lassi", "Churned yogurt, cardamom", 18000],
      ["Gulab Jamun (2 pc)", "Served warm in rose syrup", 16000]] },
  ],
  BBQ: [
    { category: "Skewers", items: [
      ["Malai Boti (6 pc)", "Cream-marinated chicken, charcoal grill", 48000],
      ["Beef Bihari Kebab", "Paper-thin strips, smoky masala", 52000],
      ["Chicken Tikka (Leg)", "Bone-in, tandoor-charred", 38000]] },
    { category: "Platters", items: [
      ["Mixed Grill Platter", "Boti, kebab, tikka, fries and naan", 145000],
      ["Family BBQ Deal", "12 skewers, 4 naan, 2 raita", 260000],
      ["Mutton Chops (4 pc)", "Marinated overnight, flame-finished", 98000]] },
    { category: "Sides", items: [
      ["Grilled Vegetables", "Seasonal, charred, olive oil", 25000],
      ["Masala Fries", "Hand-cut, chaat masala dust", 20000],
      ["Mint Raita", "Cooling yogurt dip", 8000]] },
    { category: "Drinks", items: [
      ["Kashmiri Chai", "Pink tea, crushed pistachio", 15000],
      ["Fresh Lime Soda", "Sweet or salted", 12000]] },
  ],
  Pizza: [
    { category: "Classics", items: [
      ["Margherita", "San Marzano tomato, fior di latte, basil", 85000],
      ["Pepperoni", "Beef pepperoni, mozzarella, oregano", 105000],
      ["Quattro Formaggi", "Four-cheese blend, wood-fired crust", 115000]] },
    { category: "Specials", items: [
      ["Chicken Tikka Pizza", "Desi tikka chunks, red onion, coriander", 110000],
      ["Smoked BBQ Ranch", "Grilled chicken, ranch drizzle, smoked cheddar", 120000],
      ["Veggie Ortolana", "Zucchini, bell pepper, olives, mushroom", 95000]] },
    { category: "Sides", items: [
      ["Garlic Bread (6 pc)", "Herb butter, parmesan", 30000],
      ["Chicken Wings (6 pc)", "Peri-peri glaze", 45000],
      ["Caesar Salad", "Romaine, croutons, shaved parmesan", 40000]] },
    { category: "Desserts", items: [
      ["Tiramisu", "Espresso-soaked ladyfingers, mascarpone", 42000],
      ["Molten Lava Cake", "Warm chocolate center", 38000]] },
  ],
  Burgers: [
    { category: "Beef", items: [
      ["Classic Smash", "Double smashed patty, American cheese", 65000],
      ["The Behemoth", "Triple patty, caramelized onion, house sauce", 95000],
      ["Mushroom Swiss", "Sautéed mushrooms, Swiss cheese", 75000]] },
    { category: "Chicken", items: [
      ["Crispy Zinger", "Buttermilk-fried thigh, spicy mayo", 55000],
      ["Grilled Chipotle", "Flame-grilled breast, chipotle aioli", 60000],
      ["Bun Kabab", "Shami patty, egg, chutney — street style", 25000]] },
    { category: "Sides & Shakes", items: [
      ["Loaded Fries", "Cheese sauce, jalapeño, beef bits", 35000],
      ["Onion Rings", "Beer-battered, ranch dip", 28000],
      ["Oreo Shake", "Hand-spun, whipped cream", 32000],
      ["Peanut Butter Shake", "Thick, salted caramel drizzle", 34000]] },
    { category: "Drinks", items: [
      ["Soft Drink (Can)", "Chilled", 8000]] },
  ],
  Chinese: [
    { category: "Soups & Starters", items: [
      ["Hot & Sour Soup", "Classic peppery-tangy broth", 28000],
      ["Chicken Dumplings (6 pc)", "Steamed, soy-vinegar dip", 38000],
      ["Prawn Tempura", "Light crisp batter, sweet chili", 55000]] },
    { category: "Mains", items: [
      ["Chicken Manchurian", "Tangy tomato-garlic sauce", 52000],
      ["Beef Chili Dry", "Wok-tossed, dried chilies, capsicum", 62000],
      ["Kung Pao Chicken", "Peanuts, Sichuan heat", 56000]] },
    { category: "Rice & Noodles", items: [
      ["Chicken Chowmein", "Egg noodles, julienned vegetables", 42000],
      ["Special Fried Rice", "Egg, chicken, prawn", 46000],
      ["Vegetable Hakka Noodles", "Light soy, spring onion", 38000]] },
    { category: "Desserts", items: [
      ["Fried Ice Cream", "Crisp shell, honey drizzle", 30000],
      ["Fortune Cookies (4 pc)", "House-made", 12000]] },
  ],
  Shawarma: [
    { category: "Wraps", items: [
      ["Chicken Shawarma", "Garlic toum, pickles, fries inside", 25000],
      ["Beef Shawarma Special", "Double meat, tahini", 35000],
      ["Falafel Wrap", "Herb chickpea fritters, hummus", 22000]] },
    { category: "Platters", items: [
      ["Shawarma Platter", "Open shawarma, rice, salad, toum", 55000],
      ["Mixed Grill Plate", "Shish tawook, kofta, garlic sauce", 75000],
      ["Hummus Bowl", "Olive oil, warm pita", 30000]] },
    { category: "Sides", items: [
      ["Garlic Fries", "Toum-tossed", 18000],
      ["Tabbouleh", "Parsley, bulgur, lemon", 24000],
      ["Extra Toum", "Whipped garlic dip", 6000]] },
    { category: "Drinks", items: [
      ["Mint Lemonade", "Crushed ice, fresh mint", 15000],
      ["Ayran", "Salted yogurt drink", 12000]] },
  ],
  Seafood: [
    { category: "Starters", items: [
      ["Fish Kebab (4 pc)", "Minced fish, coastal spices", 42000],
      ["Prawn Pakora", "Crisp gram-flour batter", 48000],
      ["Calamari Rings", "Golden fried, lemon aioli", 52000]] },
    { category: "Mains", items: [
      ["Lahori Fried Fish", "Ajwain batter, river fish", 85000],
      ["Grilled Pomfret", "Whole fish, green masala", 110000],
      ["Prawn Karahi", "Tomato-chili wok curry", 95000]] },
    { category: "Rice & Breads", items: [
      ["Prawn Fried Rice", "Wok-charred", 55000],
      ["Khameeri Roti", "Soft leavened tandoor bread", 7000],
      ["Steamed Rice", "Basmati", 15000]] },
    { category: "Drinks", items: [
      ["Sugarcane Juice", "Fresh-pressed, lemon", 12000],
      ["Mineral Water", "1.5L", 8000]] },
  ],
  Desserts: [
    { category: "Traditional", items: [
      ["Gajar ka Halwa", "Slow-cooked carrot, khoya", 28000],
      ["Ras Malai (2 pc)", "Saffron milk, pistachio", 24000],
      ["Kulfi Falooda", "Pistachio kulfi, vermicelli, rose", 32000]] },
    { category: "Cakes & Bakes", items: [
      ["Fudge Brownie", "Dark chocolate, walnut", 25000],
      ["Red Velvet Slice", "Cream cheese frosting", 30000],
      ["Lotus Cheesecake", "Biscoff crumb, baked", 38000]] },
    { category: "Ice Cream", items: [
      ["Scoop Trio", "Any three flavors", 35000],
      ["Waffle Sundae", "Fresh waffle, hot fudge", 42000],
      ["Mango Sorbet", "Seasonal, dairy-free", 28000]] },
    { category: "Hot Drinks", items: [
      ["Hot Chocolate", "Belgian, whipped cream", 26000],
      ["Doodh Patti", "Strong milk tea", 10000]] },
  ],
};

// 2-3 dish thumbnails per cuisine, cycled across menu items.
const DISH_IMAGES: Record<string, string[]> = {
  Pakistani: [unsplash("1601050690597-df0568f70950"), unsplash("1631452180519-c014fe946bc7")],
  BBQ: [unsplash("1544025162-d76694265947"), unsplash("1555939594-58d7cb561ad1")],
  Pizza: [unsplash("1513104890138-7c749659a591"), unsplash("1574071318508-1cdbab80d002")],
  Burgers: [unsplash("1568901346375-23c9450c58cd"), unsplash("1550547660-d9450f859349")],
  Chinese: [unsplash("1585032226651-759b368d7246"), unsplash("1563245372-f21724e3856d")],
  Shawarma: [unsplash("1529006557810-274b9b2fc783"), unsplash("1561651823-34feb02250e4")],
  Seafood: [unsplash("1519708227418-c8fd9a32b7a2"), unsplash("1504674900247-0877df9cc836")],
  Desserts: [unsplash("1551024506-0bccd828d307"), unsplash("1497034825429-c343d7c6a68f")],
};

// [name, description, cuisines, address, opensAt, closesAt, estDeliveryMin,
//  orderCount, approvedDaysAgo, targetRating, heroImageId]
type RestTuple = [string, string, string[], string, string, string, number, number, number, number, string];

const RESTAURANTS: RestTuple[] = [
  ["Karahi Khaas", "Wood-fired karahis and tandoor breads, family recipes since 1982.", ["Pakistani", "BBQ"], "12 Mall Road, Lahore", "11:00", "23:00", 25, 2400, 320, 4.7, "1631452180519-c014fe946bc7"],
  ["Nihari House 1964", "Slow-simmered nihari served with khameeri roti all day.", ["Pakistani"], "9 Burns Road, Karachi", "07:00", "22:00", 35, 1900, 400, 4.5, "1601050690597-df0568f70950"],
  ["Biryani Adda", "Layered sella biryani, degh-cooked, spice you can trust.", ["Pakistani"], "44 Tariq Road, Karachi", "11:30", "23:30", 28, 2100, 150, 4.2, "1563379926898-05f4575a45d8"],
  ["Lahori Chatkhara", "Street-style Lahori plates with serious chatkhara.", ["Pakistani"], "3 Anarkali Bazaar, Lahore", "12:00", "23:00", 40, 800, 90, 3.9, "1615141982883-c7ad0e69fd62"],
  ["Angeethi BBQ", "Charcoal skewers over open angeethi pits.", ["BBQ", "Pakistani"], "17 MM Alam Road, Lahore", "17:00", "01:00", 30, 1700, 200, 4.6, "1544025162-d76694265947"],
  ["Charcoal Tikka Co.", "Tikka, boti and platters made for sharing.", ["BBQ"], "5 Khadda Market, Karachi", "16:00", "00:00", 32, 950, 60, 4.1, "1555939594-58d7cb561ad1"],
  ["Raat ka Dhaba", "Late-night dhaba grills for the after-hours crowd.", ["BBQ"], "88 GT Road, Rawalpindi", "17:00", "02:00", 45, 600, 45, 3.8, "1529193591184-b1d58069ecdd"],
  ["Forno Napoli", "Neapolitan pies from a 450° wood oven, 90-second bake.", ["Pizza"], "21 Zamzama Boulevard, Karachi", "12:00", "23:30", 30, 1500, 25, 4.8, "1513104890138-7c749659a591"],
  ["Slice Street", "Big foldable slices, by the slice or the box.", ["Pizza"], "7 F-7 Markaz, Islamabad", "11:00", "01:00", 22, 1100, 180, 4.0, "1574071318508-1cdbab80d002"],
  ["Pizza Karachiwala", "Desi-topped pizzas with a Karachi attitude.", ["Pizza"], "31 Gulshan Chowrangi, Karachi", "13:00", "23:00", 38, 500, 240, 3.6, "1590947132387-155cc02f3212"],
  ["Bun Kabab Bros", "Street bun kababs elevated, secret chutney included.", ["Burgers", "Pakistani"], "2 Boat Basin, Karachi", "16:00", "01:30", 20, 1600, 130, 4.4, "1568901346375-23c9450c58cd"],
  ["Smash Junction", "Smashed-to-order patties, buttered brioche.", ["Burgers"], "14 DHA Phase 6, Lahore", "12:00", "00:00", 24, 1400, 20, 4.3, "1550547660-d9450f859349"],
  ["Griddle & Co", "Diner-style burgers and hand-spun shakes.", ["Burgers"], "6 Blue Area, Islamabad", "11:00", "23:00", 33, 700, 300, 3.7, "1571091718767-18b5b1457add"],
  ["Dragon Bowl", "Wok-fired Indo-Chinese classics, generous bowls.", ["Chinese"], "55 Clifton Block 5, Karachi", "12:00", "23:00", 27, 1300, 220, 4.5, "1585032226651-759b368d7246"],
  ["Chowk Chowmein", "Chowmein and manchurian from the corner chowk.", ["Chinese"], "19 Liberty Market, Lahore", "13:00", "22:30", 42, 450, 110, 3.9, "1563245372-f21724e3856d"],
  ["Shawarma Stop", "Spit-roasted shawarma, garlic toum with everything.", ["Shawarma"], "8 University Road, Peshawar", "11:00", "23:59", 18, 1250, 170, 4.2, "1529006557810-274b9b2fc783"],
  ["Beirut Bites", "Levantine wraps, platters and fresh tabbouleh.", ["Shawarma"], "40 E-11 Markaz, Islamabad", "12:00", "23:00", 26, 900, 12, 4.6, "1561651823-34feb02250e4"],
  ["Bandargah Fish Point", "Harbour-fresh fish, fried Lahori style.", ["Seafood", "Pakistani"], "1 West Wharf, Karachi", "16:00", "23:30", 48, 650, 260, 4.4, "1519708227418-c8fd9a32b7a2"],
  ["Meetha Mahal", "Traditional mithai and halwas, made every morning.", ["Desserts"], "23 Ichhra Bazaar, Lahore", "09:00", "23:30", 29, 1000, 350, 4.7, "1551024506-0bccd828d307"],
  ["Scoop Society", "Small-batch ice cream and late-night waffles.", ["Desserts"], "11 Bahadurabad, Karachi", "13:00", "01:00", 21, 850, 8, 4.3, "1497034825429-c343d7c6a68f"],
];

const REVIEW_TEXTS = [
  "Absolutely worth it — arrived hot and fresh.",
  "Portion sizes are generous for the price.",
  "Best in the neighbourhood, hands down.",
  "Solid food, delivery was a little slow.",
  "The flavours are authentic. Will reorder.",
  "Packaging was neat, nothing spilled.",
  "A bit too spicy for me but my family loved it.",
  "Consistently good across many orders.",
  "Tasty, though I've had better elsewhere.",
  "Their signature dish alone is worth ordering.",
  "Fresh ingredients, you can tell the difference.",
  "Decent, but the portion could be bigger.",
  "Arrived earlier than the estimate. Impressed.",
  "Great value deal for a family dinner.",
  "The rider was polite and everything was warm.",
  "Order was accurate down to the extra chutney.",
];

const AUTHORS = [
  "Ayesha K.", "Bilal R.", "Sana M.", "Hamza T.", "Zainab F.", "Usman A.",
  "Mariam S.", "Danish I.", "Hira Q.", "Fahad N.", "Noor J.", "Taha W.",
];

export function buildSeedData(now: Date = new Date()): SeedRestaurant[] {
  return RESTAURANTS.map((tuple, index) => {
    const [name, description, cuisines, address, opensAt, closesAt,
      estDeliveryMin, orderCount, approvedDaysAgo, targetRating, heroId] = tuple;
    const rand = mulberry32(index + 1);
    const primaryCuisine = cuisines[0];
    const template = MENUS[primaryCuisine];
    const dishImages = DISH_IMAGES[primaryCuisine];

    let position = 0;
    const menuItems: SeedMenuItem[] = template.flatMap((group) =>
      group.items.map(([itemName, itemDescription, priceCents]) => {
        position += 1;
        return {
          category: group.category, name: itemName, description: itemDescription,
          priceCents,
          imageUrl: dishImages[position % dishImages.length],
          isAvailable: rand() > 0.08, // a few items read "Unavailable"
          position,
        };
      }));

    const reviewCount = 3 + Math.floor(rand() * 6); // 3..8
    const reviews: SeedReview[] = Array.from({ length: reviewCount }, () => ({
      stars: Math.min(5, Math.max(1, Math.round(targetRating + (rand() - 0.5) * 1.6))),
      reviewText: REVIEW_TEXTS[Math.floor(rand() * REVIEW_TEXTS.length)],
      authorName: AUTHORS[Math.floor(rand() * AUTHORS.length)],
      createdAt: new Date(+now - Math.floor(1 + rand() * 90) * DAY),
    }));
    const mean = reviews.reduce((sum, r) => sum + r.stars, 0) / reviews.length;

    return {
      name, description, cuisines, address, opensAt, closesAt,
      estDeliveryMin, orderCount,
      approvedAt: new Date(+now - approvedDaysAgo * DAY),
      heroImageUrl: unsplash(heroId),
      avgRating: Math.round(mean * 10) / 10,
      ratingCount: reviews.length,
      lat: 24.86 + index * 0.01, lng: 67.01 + index * 0.01,
      menuItems, reviews,
    };
  });
}

// SEO category descriptions shipped in code (Task 73).
//
// The categories table has a `description` column; when the owner sets one
// (Admin → via PATCH /api/admin/categories/[id] or any future UI) it wins.
// These code-level fallbacks guarantee every live /category/[slug] page has
// real, keyword-targeted indexable content even before that — the generic
// "Shop X online in Somalia" blurb was the only copy before this.

export const CATEGORY_SEO_DESCRIPTIONS: Record<string, string> = {
  "computers-tv-gaming":
    "Buy TVs, laptops, projectors and gaming consoles online in Somalia at Hayaan Market — Samsung and LG smart TVs, MacBook laptops, PlayStation consoles and projectors, checked before dispatch and delivered to your door with secure EVC Plus, Edahab & card checkout.",
  "health-supplements":
    "Buy genuine vitamins and health supplements online in Somalia — multivitamins, immunity support and daily essentials, quality-checked before dispatch and delivered nationwide by Hayaan Market with secure EVC Plus, Edahab & card checkout.",
  "home-office":
    "Set up your home office in Somalia in one order — printers, toner, studio lights, microphones and desk essentials at market-fair prices, delivered across the country with secure EVC Plus, Edahab & card checkout from Hayaan Market.",
  "phones-wearables":
    "Buy smartphones, smartwatches and earbuds online in Somalia — iPhone, Samsung Galaxy and Apple Watch models plus budget-friendly picks, quality-checked before dispatch and delivered nationwide with EVC Plus, Edahab & card.",
  "power-charging-audio":
    "Buy power banks, chargers, headphones and speakers online in Somalia — reliable charging and audio gear for frequent outages and everyday listening, delivered to your door by Hayaan Market with EVC Plus, Edahab & card.",
};

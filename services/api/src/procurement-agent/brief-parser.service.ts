import { Injectable } from '@nestjs/common';

export interface ParsedBrief {
  quantity: number | null;
  budgetEur: number | null;
  destination: string | null;
  timelineDays: number | null;
  urgency: 'low' | 'normal' | 'high' | 'critical';
  category: string | null;
  keywords: string[];
}

const CITY_TO_COUNTRY: Record<string, string> = {
  dubai: 'UAE',
  london: 'UK',
  paris: 'France',
  berlin: 'Germany',
  amsterdam: 'Netherlands',
  warsaw: 'Poland',
  lisbon: 'Portugal',
  madrid: 'Spain',
  rome: 'Italy',
  zurich: 'Switzerland',
  'new york': 'USA',
  'los angeles': 'USA',
  chicago: 'USA',
  'são paulo': 'Brazil',
  'sao paulo': 'Brazil',
};

const COUNTRY_NAMES = [
  'portugal',
  'spain',
  'germany',
  'france',
  'italy',
  'uk',
  'united kingdom',
  'usa',
  'united states',
  'uae',
  'netherlands',
  'poland',
  'switzerland',
  'brazil',
  'dubai',
];

@Injectable()
export class BriefParserService {
  parse(description: string): ParsedBrief {
    const text = description.toLowerCase();
    const original = description;

    // ── Extract quantity ──────────────────────────────────────────────────────
    let quantity: number | null = null;
    const qtyMatch = text.match(
      /(\d+)\s*(?:employees?|units?|items?|pieces?|people|pessoas|funcionários|persons?)/i,
    );
    if (qtyMatch) {
      quantity = parseInt(qtyMatch[1], 10);
    } else {
      // "for 50 people" / "for 200"
      const forMatch = text.match(/for\s+(\d+)/i);
      if (forMatch) {
        quantity = parseInt(forMatch[1], 10);
      }
    }

    // ── Extract budget ────────────────────────────────────────────────────────
    let budgetEur: number | null = null;
    const budgetMatch = original.match(
      /(?:€|\$|eur|usd|budget[:\s]+)(\d+(?:[.,]\d+)?)\s*(k|thousand)?/i,
    );
    if (budgetMatch) {
      let val = parseFloat(budgetMatch[1].replace(',', '.'));
      if (budgetMatch[2]?.toLowerCase() === 'k' || budgetMatch[2]?.toLowerCase() === 'thousand') {
        val *= 1000;
      }
      budgetEur = val;
    }

    // ── Extract destination ───────────────────────────────────────────────────
    let destination: string | null = null;

    for (const [city, country] of Object.entries(CITY_TO_COUNTRY)) {
      if (text.includes(city)) {
        destination = country;
        break;
      }
    }

    if (!destination) {
      for (const country of COUNTRY_NAMES) {
        if (text.includes(country)) {
          // Normalize display
          const normalized: Record<string, string> = {
            uk: 'UK',
            'united kingdom': 'UK',
            usa: 'USA',
            'united states': 'USA',
            uae: 'UAE',
            dubai: 'UAE',
          };
          destination = normalized[country] ?? country.charAt(0).toUpperCase() + country.slice(1);
          break;
        }
      }
    }

    // ── Extract timeline ──────────────────────────────────────────────────────
    let timelineDays: number | null = null;

    if (/urgent|asap|immediately|critical|rush/i.test(text)) {
      timelineDays = 3;
    } else {
      const daysMatch = text.match(/(?:within\s+|in\s+)?(\d+)\s*days?/i);
      if (daysMatch) {
        timelineDays = parseInt(daysMatch[1], 10);
      } else {
        const weeksMatch = text.match(/(\d+)\s*weeks?/i);
        if (weeksMatch) {
          timelineDays = parseInt(weeksMatch[1], 10) * 7;
        } else if (/next\s+month/i.test(text)) {
          timelineDays = 30;
        }
      }
    }

    // ── Extract urgency ───────────────────────────────────────────────────────
    let urgency: 'low' | 'normal' | 'high' | 'critical' = 'normal';

    if (/urgent|asap|immediately|critical|rush/i.test(text)) {
      urgency = 'critical';
    } else if (/fast|quickly|soon|priority|express/i.test(text)) {
      urgency = 'high';
    } else if (/no\s+rush|flexible|whenever/i.test(text)) {
      urgency = 'low';
    }

    // ── Extract category ──────────────────────────────────────────────────────
    let category: string | null = null;

    if (/bag|tote|backpack/i.test(text)) {
      category = 'bags';
    } else if (/pen|notebook|stationery|notepad/i.test(text)) {
      category = 'stationery';
    } else if (/mug|bottle|drinkware|thermos|tumbler/i.test(text)) {
      category = 'drinkware';
    } else if (/shirt|polo|apparel|clothing|jacket|hoodie|vest/i.test(text)) {
      category = 'apparel';
    } else if (/tech|usb|charger|headphone|speaker|cable|electronic/i.test(text)) {
      category = 'tech';
    } else if (/kit|onboarding|welcome\s+pack|starter\s+pack/i.test(text)) {
      category = 'kits';
    } else if (/luxury|premium/i.test(text)) {
      category = 'premium_gifts';
    }

    // ── Extract keywords ──────────────────────────────────────────────────────
    const keywordTests: Array<[RegExp, string]> = [
      [/luxury/i, 'luxury'],
      [/premium/i, 'premium'],
      [/eco|sustainable|green|recycled/i, 'eco'],
      [/branded|branding|logo/i, 'branded'],
      [/custom|customis|customiz/i, 'custom'],
      [/promotional|promo/i, 'promotional'],
      [/welcome/i, 'welcome'],
      [/onboarding/i, 'onboarding'],
    ];

    const keywords: string[] = [];
    for (const [re, kw] of keywordTests) {
      if (re.test(text)) {
        keywords.push(kw);
      }
    }

    return { quantity, budgetEur, destination, timelineDays, urgency, category, keywords };
  }
}

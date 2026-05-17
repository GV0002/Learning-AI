import express from "express";
import path from "path";
import axios from "axios";
import * as cheerio from "cheerio";
import { GoogleGenAI, Type } from "@google/genai";
import { createServer as createViteServer } from "vite";
import serverless from "serverless-http";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

// Gemini Initialization
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

const GEOAPIFY_API_KEY = process.env.GEOAPIFY_API_KEY;

// API Routes

// 1. Geocode City/State -> Place ID
app.post("/api/geocode", async (req, res) => {
  try {
    const { city, state } = req.body;
    const query = `${city}, ${state}, USA`;
    const url = `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(query)}&apiKey=${GEOAPIFY_API_KEY}`;
    
    const response = await axios.get(url);
    const results = response.data.features;
    
    if (results && results.length > 0) {
      const place = results[0].properties;
      res.json({
        place_id: place.place_id,
        lat: place.lat,
        lon: place.lon
      });
    } else {
      res.status(404).json({ error: "Location not found" });
    }
  } catch (error: any) {
    console.error("Geocode error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// 2. Fetch Leads (Businesses)
app.post("/api/leads", async (req, res) => {
  try {
    const { place_id, categories, lat, lon } = req.body;
    
    // Fallback logic if filter=place returns zero (mentioned in spec)
    let url = `https://api.geoapify.com/v2/places?categories=${categories}&filter=place:${place_id}&limit=20&apiKey=${GEOAPIFY_API_KEY}`;
    
    let response = await axios.get(url);
    let features = response.data.features;
    
    if (!features || features.length === 0) {
      console.log("No leads found with place_id, falling back to radius search");
      url = `https://api.geoapify.com/v2/places?categories=${categories}&filter=circle:${lon},${lat},15000&limit=20&apiKey=${GEOAPIFY_API_KEY}`;
      response = await axios.get(url);
      features = response.data.features;
    }
    
    // Filter leads with websites
    const leads = features
      .map((f: any) => ({
        name: f.properties.name,
        website: f.properties.website,
        address: f.properties.address_line2,
        city: f.properties.city,
        state: f.properties.state,
        id: f.properties.place_id
      }))
      .filter((l: any) => l.website && l.website.startsWith("http"));
      
    res.json({ leads });
  } catch (error: any) {
    console.error("Leads search error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// 3. Email Scraper Logic
const scrapeEmails = async (baseUrl: string) => {
  const candidatePaths = ['', '/contact', '/contact-us', '/about', '/about-us', '/team', '/locations'];
  const emails = new Set<string>();
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

  // Junk filters
  const junkWords = ['noreply', 'sentry', 'wix', 'godaddy', '@2x', '.png', '.jpg', '.jpeg', '.svg', 'example.com'];

  for (const path of candidatePaths) {
    try {
      const url = baseUrl.endsWith('/') ? `${baseUrl.slice(0, -1)}${path}` : `${baseUrl}${path}`;
      const response = await axios.get(url, { 
        timeout: 5000, 
        validateStatus: (status) => status < 500, // Resilience: avoid 404s breaking the loop
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });
      
      if (response.status !== 200) continue;
      
      const html = response.data;
      const found = html.match(emailRegex);
      if (found) {
        found.forEach((email: string) => {
          const lower = email.toLowerCase();
          if (!junkWords.some(junk => lower.includes(junk))) {
            emails.add(lower);
          }
        });
      }
      
      // Also look for mailto links using cheerio
      const $ = cheerio.load(html);
      $('a[href^="mailto:"]').each((_, el) => {
        const href = $(el).attr('href');
        if (href) {
            const email = href.replace('mailto:', '').split('?')[0].toLowerCase();
            if (email.match(emailRegex) && !junkWords.some(junk => email.includes(junk))) {
                emails.add(email);
            }
        }
      });

      // If we found personal-looking emails, we can stop early or keep looking for quality
      // (Simplified heuristic: more than 2 emails found is good enough)
      if (emails.size > 3) break; 
      
    } catch (err: any) {
      // Ignore errors for individual pages
    }
  }

  const sortedEmails = Array.from(emails).sort((a, b) => {
    // 1. Personal-ish emails (dots in name)
    const aHasDot = a.split('@')[0].includes('.');
    const bHasDot = b.split('@')[0].includes('.');
    if (aHasDot && !bHasDot) return -1;
    if (!aHasDot && bHasDot) return 1;
    
    // 2. Generic but useful
    const generic = ['info@', 'contact@', 'hello@', 'support@'];
    const aIsGeneric = generic.some(g => a.startsWith(g));
    const bIsGeneric = generic.some(g => b.startsWith(g));
    if (aIsGeneric && !bIsGeneric) return -1;
    if (!aIsGeneric && bIsGeneric) return 1;
    
    return 0;
  });

  return sortedEmails[0] || null;
};

// 4. Analyze & Draft
app.post("/api/analyze", async (req, res) => {
  try {
    const { website, name } = req.body;
    
    // Step 1: Scrape Email
    const foundEmail = await scrapeEmails(website);
    
    // Step 2: Capture Screenshot & Audit with Gemini
    const screenshotUrl = `https://api.microlink.io?url=${encodeURIComponent(website)}&screenshot=true&embed=screenshot.url&meta=false`;
    
    let base64Image = "";
    try {
      const imgRes = await axios.get(screenshotUrl, { responseType: 'arraybuffer' });
      base64Image = Buffer.from(imgRes.data, 'binary').toString('base64');
    } catch (e: any) {
      console.warn("Screenshot capture failed:", e.message);
    }

    if (!base64Image) {
      return res.status(500).json({ error: "Failed to capture website screenshot" });
    }

    // Gemini Vision Audit
    const auditPrompt = `
      You are an expert website conversion auditor.
      Analyze this screenshot of the website for '${name}'.
      Rate the website from 0-100 based on conversion design, mobile responsiveness (visual cues), and clarity of value proposition.
      Provide 3 specific, brutal, honest technical findings using the "Observation -> Insight -> Gap" framework.
      NO PLATTERY. 
      Format exactly as JSON:
      {
        "score": number,
        "findings": [
          { "observation": "...", "insight": "...", "gap": "..." }
        ],
        "specificDetail": "one catchy technical detail about the UI noticed (e.g., 'your hero section layout' or 'the sticky nav depth')"
      }
    `;

    const visionResponse = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          parts: [
            { text: auditPrompt },
            { inlineData: { mimeType: "image/png", data: base64Image } }
          ]
        }
      ],
      config: {
        responseMimeType: "application/json"
      }
    });

    const auditData = JSON.parse(visionResponse.text || "{}");

    // Email Draft Generation
    const emailPrompt = `
      Write a hyper-personalized multi-part vertical cold email for ${name}.
      Audit Findings: ${JSON.stringify(auditData.findings)}
      Specific Detail: ${auditData.specificDetail}

      CRITICAL RULES:
      - No flattery. No "I hope you're well". No "I noticed your website".
      - Subject: 2-4 words, lowercase, specific (e.g., "${auditData.specificDetail}").
      - Body Framework: "I was looking at your site and the [Specific Detail] is [Problem]. Usually, this makes it harder for customers to [Action]. I recorded a 2-min video on how to fix this. Worth a look?"
      - Tone: peer-to-peer, helpful Peer, not a bot.
      - Signature: Animesh, ProspectPilot

      Return JSON: { "subject": "...", "body": "..." }
    `;

    const textResponse = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: emailPrompt,
      config: {
        responseMimeType: "application/json"
      }
    });

    const emailData = JSON.parse(textResponse.text || "{}");

    res.json({
      foundEmail,
      audit: auditData,
      draft: emailData,
      screenshotUrl: `data:image/png;base64,${base64Image}`
    });

  } catch (error: any) {
    console.error("Analysis error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// Vite Middleware/Static
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  if (process.env.NODE_ENV !== "production" || !process.env.AWS_LAMBDA_FUNCTION_NAME) {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  }
}

startServer();

// Serverless Export
export const handler = serverless(app);

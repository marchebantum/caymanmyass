# API Configuration Guide

This guide explains which API keys you need to configure for the Cayman Watch scraper to function properly.

## Overview

The system uses two main APIs:
1. **Firecrawl** - Required for web scraping judicial.ky
2. **OCR Service** - Optional, for extracting text from image-based PDFs

## Required API: Firecrawl

### What is Firecrawl?
Firecrawl is a web scraping API that can scrape JavaScript-heavy websites and return clean HTML/markdown content.

### Why do we need it?
The judicial.ky public registers website requires JavaScript to render the table of cases. Firecrawl handles this complexity for us.

### How to get your API key:

1. **Sign up at Firecrawl**
   - Go to: https://www.firecrawl.dev
   - Click "Get Started" or "Sign Up"
   - Create an account (free tier available)

2. **Get your API key**
   - After signing up, go to your dashboard
   - Look for "API Keys" section
   - Copy your API key (format: `fc-xxxxxxxxxxxxxxxxxxxxxxxxxx`)

3. **Add to Cayman Watch**
   - Go to Settings page in the app
   - Find "Firecrawl Web Scraping" section
   - Paste your API key in the "Firecrawl API Key" field
   - Check the box "Enable automated web scraping with Firecrawl"
   - Click "Save Settings"

### Testing your Firecrawl setup:

1. After saving your API key, scroll down to "Scraper Testing & Diagnostics"
2. Select "Dry Run" mode (won't save data)
3. Click "Run Scraper Test"
4. Review the detailed logs to see if scraping works

## Optional API: OCR Service

OCR (Optical Character Recognition) is only needed if the PDFs you upload are scanned images rather than text-based PDFs.

### When do you need OCR?
- If PDF text extraction shows very few words (less than 50)
- If PDFs are scanned images of documents
- If you see warnings about "low extraction confidence"

### Option 1: pdfRest (Recommended)

**Website:** https://pdfrest.com

**How to get API key:**
1. Sign up at pdfrest.com
2. Navigate to API section
3. Generate an API key
4. Add to Settings > OCR Settings > OCR API Key
5. Select "pdfRest OCR" as provider

### Option 2: ConvertAPI

**Website:** https://www.convertapi.com

**How to get API key:**
1. Sign up at convertapi.com
2. Go to your dashboard
3. Find your "Secret" key
4. Add to Settings > OCR Settings > OCR API Key
5. Select "ConvertAPI OCR" as provider

## Summary: What You Need

### Minimum Configuration (for testing)
- ✅ Firecrawl API Key - **REQUIRED**

### Full Configuration (for production use)
- ✅ Firecrawl API Key - **REQUIRED** for scraping
- ✅ OCR API Key - **OPTIONAL** (only if PDFs are image-based)

## Testing Workflow

1. **Get Firecrawl API key** from firecrawl.dev
2. **Add it to Settings** and enable Firecrawl
3. **Click "Save Settings"**
4. **Scroll to "Scraper Testing & Diagnostics"**
5. **Select "Dry Run"** mode
6. **Click "Run Scraper Test"**
7. **Review the results:**
   - ✅ Green checkmarks = Success
   - ⚠️ Amber warnings = Non-critical issues
   - ❌ Red errors = Problems that need fixing

## What the Test Shows You

The scraper test provides detailed logs for each step:

1. **Validate API** - Checks if Firecrawl key is configured
2. **Initialize Firecrawl** - Creates connection to Firecrawl service
3. **Fetch Website** - Scrapes judicial.ky public registers page
4. **Parse HTML** - Extracts table rows from the HTML
5. **Filter Subjects** - Identifies Winding Up-Petitions and Petitions
6. **Check Duplicates** - Compares with existing database entries
7. **Insert Data** - (Only in Live mode) Saves new entries to database

Each step shows:
- Status (success/warning/error/info)
- Execution time in milliseconds
- Detailed data extracted
- Any error messages if something fails

## Troubleshooting

### "Firecrawl API key not configured"
- Make sure you've pasted your API key in Settings
- Check that you've enabled the "Enable automated web scraping" checkbox
- Click "Save Settings" before running the test

### "Firecrawl returned unsuccessful response"
- Your API key might be invalid
- You might have hit your rate limit
- Check the error message in the test log for details

### "No entries found in HTML table"
- The website structure might have changed
- Firecrawl might not have waited long enough for content to load
- Check the "HTML Preview" in the test data to see what was scraped

### Test shows 0 new entries
- This is normal if you've already scraped all current cases
- The system tracks entries by fingerprint to avoid duplicates
- Try selecting "Live" mode if you want to force check the database

## API Costs

### Firecrawl Pricing (as of 2024)
- Free tier: 500 requests/month
- Paid plans: Starting from $49/month
- Each test uses 1 request
- Daily automated runs use 1 request per day

### OCR Pricing
Varies by provider - check their websites for current pricing.

## Security Notes

- All API keys are stored securely in Supabase database
- Keys are never exposed in client-side code
- API calls are made from Supabase Edge Functions (server-side)
- You can regenerate keys at any time on the provider's website

## Getting Help

If you encounter issues:
1. Check the test logs for specific error messages
2. Verify your API key is correct (copy-paste fresh from provider)
3. Ensure you've clicked "Save Settings"
4. Try the test in "Dry Run" mode first
5. Check your API provider's dashboard for usage/limits

## Next Steps After Configuration

Once your APIs are configured and tests pass:
1. The system will automatically run daily at 7:00 AM Cayman time
2. New cases will be detected and flagged for PDF upload
3. Upload PDFs manually from the Registry page
4. The system will automatically extract and analyze the PDFs
5. View analysis results in the Registry page

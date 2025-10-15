# Quick Start Guide

## Get Testing in 5 Minutes

### Step 1: Get Your Firecrawl API Key (2 minutes)

1. Go to **https://www.firecrawl.dev**
2. Click **"Sign Up"** (free tier available)
3. Once logged in, find **"API Keys"** in dashboard
4. Copy your API key (starts with `fc-`)

### Step 2: Configure the System (1 minute)

1. Open Cayman Watch app
2. Go to **Settings** page (left sidebar)
3. Scroll to **"Firecrawl Web Scraping"**
4. Paste your API key
5. Check ✅ **"Enable automated web scraping with Firecrawl"**
6. Click **"Save Settings"**

### Step 3: Run Your First Test (2 minutes)

1. Scroll down to **"Scraper Testing & Diagnostics"**
2. Make sure **"Dry Run"** is selected
3. Click **"Run Scraper Test"**
4. Wait 10-15 seconds for results
5. Look for green checkmarks ✅

### What Success Looks Like

You should see:
- ✅ Validate API
- ✅ Initialize Firecrawl
- ✅ Fetch Website (HTML length > 50,000)
- ✅ Parse HTML (Multiple entries found)
- ✅ Filter Subjects (Winding Up and Petition cases)
- ✅ Check Duplicates
- ✅ Complete

### What Each Metric Means

- **Total Found** = All registry entries scraped from website
- **Winding Up** = Winding Up-Petition cases (highest priority)
- **Petitions** = Regular Petition cases
- **New Entries** = Cases not yet in your database

### Next Steps

**If test succeeds:**
1. Switch to **"Live"** mode
2. Run test again to save entries to database
3. Go to **Registry** page to see the cases
4. Upload PDFs for analysis

**If test fails:**
1. Check error messages in the log
2. Verify your API key is correct
3. See TESTING_GUIDE.md for detailed troubleshooting

## Common Issues & Quick Fixes

### ❌ "Firecrawl API key not configured"
→ Make sure you saved settings after pasting the API key

### ❌ "Failed to fetch website"
→ Check your internet connection or try again in a few minutes

### ⚠️ "0 entries parsed"
→ HTML was fetched but couldn't find table - check html_preview in logs

### ℹ️ "0 new entries"
→ This is normal if you've already scraped these cases before

## Production Use

Once testing works:
- **Automated scraping** runs daily at 7:00 AM
- **Dashboard notifications** alert you to new cases
- **Manual PDF upload** required for each case
- **Automatic analysis** runs when PDFs uploaded

## API Costs

**Firecrawl:**
- Free tier: 500 requests/month
- Daily automation: ~30 requests/month
- Manual tests: 1 request each
- Plenty of headroom for testing!

## Need Help?

1. Check **TESTING_GUIDE.md** for detailed explanations
2. Check **API_CONFIGURATION_GUIDE.md** for API setup
3. Review test logs for specific error messages
4. Verify API key at provider's website

## One-Line Summary

**Get Firecrawl key → Paste in Settings → Enable → Save → Run Test → See Results**

That's it! 🚀

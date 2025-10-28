# Scraper Testing Guide

## What Has Been Implemented

A complete testing infrastructure has been added to help you diagnose and validate the registry scraper functionality.

## New Features

### 1. Database Tables
Two new tables have been created to store test results:
- `scraper_test_runs` - Stores high-level test execution data
- `scraper_test_logs` - Stores detailed step-by-step logs for each test

### 2. Test Edge Function
A new Supabase Edge Function `test-scraper` that:
- Validates Firecrawl API configuration
- Scrapes judicial.ky public registers
- Parses the HTML table
- Filters for relevant case types (Winding Up-Petition, Petition)
- Checks for duplicates in the database
- Optionally saves new entries (Live mode)
- Logs every step with detailed diagnostics

### 3. Testing UI in Settings Page
A comprehensive testing panel with:
- API configuration instructions
- Test mode selection (Dry Run vs Live)
- Real-time test execution
- Detailed log viewer with expandable sections
- Summary statistics
- Error highlighting and diagnostics

## How to Use the Testing System

### Step 1: Configure API Keys

1. Navigate to the **Settings** page
2. Scroll to **"Firecrawl Web Scraping"** section
3. Get your API key from https://www.firecrawl.dev
4. Paste your Firecrawl API key
5. Check "Enable automated web scraping with Firecrawl"
6. Click **"Save Settings"**

### Step 2: Run a Test

1. Scroll down to **"Scraper Testing & Diagnostics"** section
2. Choose your test mode:
   - **Dry Run** - Test only, doesn't save data to database (recommended first)
   - **Live** - Saves new entries to database
3. Click **"Run Scraper Test"**
4. Wait for test to complete (usually 10-15 seconds)

### Step 3: Review Results

The test will show you:

#### Summary Metrics (Top)
- **Total Found** - Total entries scraped from website
- **Winding Up** - Number of Winding Up-Petition cases
- **Petitions** - Number of Petition cases
- **New Entries** - How many are new (not in database)

#### Detailed Execution Log
Each step shows:
- ✅ **Success** - Step completed successfully
- ⚠️ **Warning** - Step completed with warnings
- ❌ **Error** - Step failed
- ℹ️ **Info** - Informational message

Click on any step to expand and see:
- Execution time in milliseconds
- Detailed data extracted
- Error messages (if any)
- Raw data preview

## Understanding Test Steps

### 1. Initialize
Creates the test run record in database.

**What to look for:**
- Test run ID
- Test mode (dry_run or live)

### 2. Validate API
Checks if Firecrawl is configured and enabled.

**What to look for:**
- API key present
- Firecrawl enabled status

**Common issues:**
- ❌ "Firecrawl not configured" - Add API key in Settings
- ❌ "Firecrawl not enabled" - Check the enable checkbox

### 3. Initialize Firecrawl
Creates connection to Firecrawl service.

**What to look for:**
- Successful initialization

**Common issues:**
- ❌ "Invalid API key" - Check your API key is correct

### 4. Fetch Website
Scrapes the judicial.ky public registers page.

**What to look for:**
- HTML length (should be 50,000+ characters)
- HTML preview showing table content
- "has_table" and "has_tr" both true

**Common issues:**
- ❌ "Failed to fetch" - Network issue or website down
- ❌ "Unsuccessful response" - API key issue or rate limit
- ⚠️ Very short HTML - Website might not have loaded fully

### 5. Parse HTML
Extracts table rows and parses case data.

**What to look for:**
- Number of entries parsed
- Sample entries showing cause numbers and subjects

**Common issues:**
- ⚠️ "0 entries parsed" - Website structure might have changed
- Check the HTML preview in previous step

### 6. Filter Subjects
Identifies Winding Up-Petitions and regular Petitions.

**What to look for:**
- Count of each case type
- Sample cause numbers for each type

**Good results:**
- Both winding up and petition cases found
- Cause numbers in format "FSD-XXX/YYYY"

### 7. Check Duplicates
Compares scraped entries with database.

**What to look for:**
- Total entries in database
- Number of new entries
- Number of new cause numbers
- Sample of new cases

**Expected results:**
- First run: Many new entries
- Subsequent runs: 0-5 new entries (only if new cases filed)

### 8. Insert Data (Live Mode Only)
Saves new entries to database.

**What to look for:**
- Number of entries inserted
- Success/failure status

**Note:** Only appears in Live mode, not Dry Run

### 9. Complete
Summary of test execution.

**What to look for:**
- Total execution time
- Number of successful/failed steps

## Test Modes Explained

### Dry Run Mode (Recommended First)
- **Does:** Tests all scraping and parsing logic
- **Doesn't:** Save any data to the database
- **Use when:**
  - First time testing
  - Checking if scraper still works
  - Debugging issues
  - Validating API key

### Live Mode
- **Does:** Everything Dry Run does PLUS saves new entries
- **Use when:**
  - You want to actually import new cases
  - You've verified Dry Run works correctly
  - You're ready to populate the database

## Reading the Data Output

Each step that extracts data shows it in JSON format. Here's what to look for:

### Fetch Website Data
```json
{
  "html_length": 123456,
  "html_preview": "<!DOCTYPE html>...",
  "has_table": true,
  "has_tr": true
}
```

### Parse HTML Data
```json
{
  "total_parsed": 45,
  "sample_entries": [
    {
      "cause_number": "FSD-123/2024",
      "subject": "Winding Up-Petition",
      "title": "In the Matter of ABC Company..."
    }
  ]
}
```

### Filter Subjects Data
```json
{
  "winding_up_petitions": 12,
  "petitions": 8,
  "total_relevant": 20,
  "winding_up_samples": ["FSD-123/2024", "FSD-124/2024"],
  "petition_samples": ["FSD-125/2024"]
}
```

### Check Duplicates Data
```json
{
  "total_in_database": 100,
  "total_scraped": 20,
  "new_entries": 3,
  "new_cause_numbers": 2,
  "duplicate_entries": 17,
  "new_cases_sample": [...]
}
```

## Troubleshooting Common Issues

### No API Key Error
**Problem:** "Firecrawl API key not configured"

**Solution:**
1. Go to https://www.firecrawl.dev and sign up
2. Copy your API key
3. Paste in Settings > Firecrawl section
4. Enable the checkbox
5. Save settings
6. Run test again

### Zero Entries Parsed
**Problem:** HTML fetched but 0 entries parsed

**Possible causes:**
1. Website structure changed - Contact support
2. Filtered for wrong content - Check filter logic
3. HTML not fully loaded - Might need longer wait time

**Debugging:**
- Expand "Fetch Website" step
- Look at "html_preview"
- Check if table content is visible
- Look for "Financial Services" filter being applied

### All Entries Are Duplicates
**Problem:** Test shows new_entries: 0

**This is normal if:**
- You've already scraped these cases before
- System is working correctly (preventing duplicates)

**To verify it's working:**
- Check "total_scraped" count matches expectations
- Check "duplicate_entries" equals total_scraped
- System uses fingerprints to detect duplicates

### Rate Limit Errors
**Problem:** "Rate limit exceeded" or 429 errors

**Solution:**
- Wait a few minutes before testing again
- Check your Firecrawl plan limits
- Upgrade your Firecrawl plan if needed

## Best Practices

### Initial Setup
1. Use Dry Run mode first
2. Verify all steps complete successfully
3. Check sample data looks correct
4. Only then switch to Live mode

### Regular Testing
1. Test monthly to ensure scraper still works
2. Check after website updates
3. Verify new cases are being detected

### Before Going Live
1. Run several Dry Run tests
2. Verify data extraction is accurate
3. Check cause numbers format correctly
4. Ensure subjects are filtered properly
5. Only then enable automation

## What Happens in Production

Once testing is successful and APIs are configured:

1. **Daily Automation** runs at 7:00 AM Cayman time
2. **Scrapes** judicial.ky automatically
3. **Detects** new Winding Up-Petitions and Petitions
4. **Stores** metadata in registry_rows table
5. **Creates** dashboard notifications
6. **Waits** for you to manually upload PDFs
7. **Analyzes** PDFs when uploaded
8. **Extracts** key information (parties, timeline, financials, liquidators)

## Support

If you encounter issues not covered here:
1. Take screenshots of the test results
2. Note the specific error messages
3. Check the API_CONFIGURATION_GUIDE.md
4. Verify your API keys are valid on provider websites
5. Check Firecrawl dashboard for usage/errors

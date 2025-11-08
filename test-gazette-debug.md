# Gazette Analyzer Debug Guide

## Issue: No results returned for gazette with known liquidation notices

### Step 1: Check Edge Function Logs in Supabase Dashboard

1. Go to Supabase Dashboard → Edge Functions → analyze-gazette-with-claude → Logs
2. Look for the most recent invocation
3. Check for these log messages:
   - "⚠️  NO LIQUIDATION NOTICES FOUND"
   - "Response status:" (should show what Claude returned)
   - Any error messages from Claude API

### Step 2: What to look for in the logs

**If you see "Response status: no_data":**
- Claude successfully processed the PDF but didn't find matching liquidation notices
- Check if the gazette has a COMMERCIAL section
- Check if section headings match the expected format

**If you see parsing errors:**
- Claude returned malformed JSON
- This might indicate the response was truncated
- System should automatically retry with batch processing

**If you see API errors:**
- Check ANTHROPIC_API_KEY is configured correctly
- Check for rate limiting or quota issues

### Step 3: Verify Gazette Structure

The analyzer expects this structure:

```
COMMERCIAL
  ├── Liquidation Notices, Notices of Winding Up, Appointment of Voluntary Liquidators and Notices to Creditors
  ├── Notices of Final Meeting of Shareholders
  ├── Partnership Notices
  ├── Bankruptcy Notices
  ├── Receivership Notices
  ├── Dividend Notices
  └── Grand Court Notices
```

**Common issues:**
1. Section headings have slightly different wording
2. COMMERCIAL section is missing or named differently
3. Liquidation notices are in a different section (e.g., "General Commercial Notices")

### Step 4: Test with Simplified Prompt

If the gazette structure is different, we may need to:
1. Update the section heading patterns in the prompt
2. Add more flexible pattern matching
3. Create a gazette-specific prompt variant

### Step 5: Manual Verification

Please provide:
1. What type of gazette? (Regular or Extraordinary)
2. Issue number and date
3. How many liquidation notices should there be?
4. What section are they in? (exact section heading)
5. Screenshot or text sample of one liquidation notice

This will help identify if it's a structural issue or a prompt engineering issue.

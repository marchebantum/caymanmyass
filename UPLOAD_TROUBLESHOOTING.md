# PDF Upload Troubleshooting Guide

## Recent Updates Applied

1. **Database Schema Updated**
   - Added extraction metadata fields (extraction_metadata, fields_extracted, fields_missing, etc.)
   - Added quality scoring and review flags

2. **Enhanced Error Handling**
   - Added console logging at each step
   - Better error messages with details
   - Status updates at each processing stage

3. **Fixed Default Values**
   - All new required fields now have proper defaults when inserting cases

## How to Test PDF Upload

1. **Navigate to Registry page**
2. **Find a case with status "awaiting_pdf"**
3. **Click "Upload PDF" button**
4. **Select your PDF file**
5. **Open browser console** (F12 or right-click > Inspect > Console tab)
6. **Watch for log messages:**
   - "Starting upload for case: [cause number]"
   - "PDF file size: [bytes]"
   - "PDF saved to database, starting processing..."
   - "Step 1: Extracting text from PDF..."
   - "Extract result: {...}"
   - "Step 2: Analyzing case and extracting fields..."
   - "Analyze result: {...}"

## What to Check If Upload Fails

### Check 1: Browser Console Errors
Look for red error messages in the browser console. Common issues:
- Network errors (check your internet connection)
- CORS errors (edge functions not deployed properly)
- Authorization errors (check .env file has correct Supabase keys)

### Check 2: File Upload Succeeds
After clicking upload, check if the case status changes:
- Should change from "awaiting_pdf" to "processing"
- Then to either "analyzed" (success) or "pdf_captured" (partial success)

### Check 3: Edge Function Logs
If the upload reaches the edge functions, check Supabase dashboard:
1. Go to Supabase Dashboard
2. Click on "Edge Functions"
3. Click on the function name (extract-pdf-text or analyze-case)
4. Check "Logs" tab for error messages

### Check 4: Database State
Query the database to see what was saved:
```sql
SELECT id, status, extraction_quality_score, fields_extracted, fields_missing
FROM cases
ORDER BY created_at DESC
LIMIT 5;
```

## Common Issues and Solutions

### Issue: "Failed to upload PDF: Missing required field"
**Solution:** The new database fields need default values. Already fixed in latest code.

### Issue: Edge functions return 500 errors
**Solution:** Edge functions need to be redeployed with updated extraction patterns.
Run this in your terminal or redeploy via Supabase dashboard.

### Issue: PDF uploads but extraction fails
**Solution:**
- Check if PDF is readable (not corrupted)
- Check if PDF is text-based or scanned (OCR needed for scanned)
- Look at edge function logs for specific extraction errors

### Issue: Analysis completes but shows 0% quality
**Solution:** The extraction patterns might not match the PDF format. Check the actual PDF content format.

## Testing with Sample Data

If you don't have a real PDF, you can test with a simple text file renamed to .pdf to verify the upload mechanism works, then test with actual court documents.

## Next Steps if Still Not Working

1. Share the exact error message from browser console
2. Share the cause number you're trying to upload
3. Check if the PDF file is accessible and not corrupted
4. Verify Supabase connection is working (check other pages load data correctly)

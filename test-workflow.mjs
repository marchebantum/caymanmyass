import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://hffetgwpezjfmsiwysje.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhmZmV0Z3dwZXpqZm1zaXd5c2plIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAwOTA0MjMsImV4cCI6MjA3NTY2NjQyM30.CUZcomxhRq_CXG2rozPCFVaJMT0LN5cbcfptJHV9SJw';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

console.log('\n🚀 Starting Cayman Watch Workflow Test\n');
console.log('='.repeat(60));

async function testRegistryMonitoring() {
  console.log('\n📋 TEST 1: Registry Monitoring');
  console.log('-'.repeat(60));

  try {
    console.log('⏳ Calling scrape-registry function...');

    const apiUrl = `${SUPABASE_URL}/functions/v1/scrape-registry`;
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const result = await response.json();

    console.log('✅ Registry monitoring completed');
    console.log(`   Total rows found: ${result.total_rows}`);
    console.log(`   New rows: ${result.new_rows}`);
    console.log(`   Existing rows: ${result.existing_rows}`);

    if (result.new_cause_numbers && result.new_cause_numbers.length > 0) {
      console.log(`   New cause numbers: ${result.new_cause_numbers.join(', ')}`);
    }

    return result;
  } catch (error) {
    console.error('❌ Registry monitoring failed:', error.message);
    throw error;
  }
}

async function verifyDatabaseState() {
  console.log('\n📊 TEST 2: Database Verification');
  console.log('-'.repeat(60));

  try {
    const { data: registryRows, error: registryError } = await supabase
      .from('registry_rows')
      .select('id, cause_number, status, filing_date, subject')
      .order('created_at', { ascending: false })
      .limit(10);

    if (registryError) throw registryError;

    console.log(`✅ Registry rows in database: ${registryRows.length}`);

    if (registryRows.length > 0) {
      console.log('\n   Recent entries:');
      registryRows.slice(0, 5).forEach(row => {
        console.log(`   - ${row.cause_number} [${row.status}] - ${row.subject}`);
      });
    }

    const awaitingPdf = registryRows.filter(r => r.status === 'awaiting_pdf').length;
    console.log(`\n   📁 Cases awaiting PDF: ${awaitingPdf}`);

    const { data: jobs, error: jobsError } = await supabase
      .from('scrape_jobs')
      .select('job_type, status, items_found, new_items, created_at')
      .order('created_at', { ascending: false })
      .limit(3);

    if (jobsError) throw jobsError;

    console.log(`\n   📋 Recent scrape jobs: ${jobs.length}`);
    if (jobs.length > 0) {
      const lastJob = jobs[0];
      console.log(`   Last job: ${lastJob.job_type} - ${lastJob.status}`);
      console.log(`   Items found: ${lastJob.items_found}, New: ${lastJob.new_items}`);
    }

    const { data: settings, error: settingsError } = await supabase
      .from('app_settings')
      .select('last_registry_run')
      .maybeSingle();

    if (settingsError) throw settingsError;

    if (settings?.last_registry_run) {
      console.log(`\n   ⏰ Last registry run: ${new Date(settings.last_registry_run).toLocaleString()}`);
    }

    return { registryRows, jobs };
  } catch (error) {
    console.error('❌ Database verification failed:', error.message);
    throw error;
  }
}

async function testEdgeFunctionAccess() {
  console.log('\n🔧 TEST 3: Edge Function Accessibility');
  console.log('-'.repeat(60));

  const functions = [
    'scrape-registry',
    'extract-pdf-text',
    'analyze-case',
    'capture-pdf',
    'scrape-gazette',
    'parse-gazette'
  ];

  for (const funcName of functions) {
    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/${funcName}`, {
        method: 'OPTIONS',
        headers: {
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
      });

      if (response.status === 200) {
        console.log(`   ✅ ${funcName} - accessible`);
      } else {
        console.log(`   ⚠️  ${funcName} - returned status ${response.status}`);
      }
    } catch (error) {
      console.log(`   ❌ ${funcName} - error: ${error.message}`);
    }
  }
}

async function checkDatabaseSchema() {
  console.log('\n🗄️  TEST 4: Database Schema Check');
  console.log('-'.repeat(60));

  const tables = [
    'registry_rows',
    'cases',
    'gazette_issues',
    'gazette_notices',
    'scrape_jobs',
    'review_queue',
    'app_settings',
    'audit_log'
  ];

  for (const table of tables) {
    try {
      const { count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });

      if (error) {
        console.log(`   ❌ ${table} - error: ${error.message}`);
      } else {
        console.log(`   ✅ ${table} - ${count} rows`);
      }
    } catch (error) {
      console.log(`   ❌ ${table} - ${error.message}`);
    }
  }
}

async function runTests() {
  try {
    console.log('\n⚙️  Environment:');
    console.log(`   Supabase URL: ${SUPABASE_URL}`);
    console.log(`   API Key: ${SUPABASE_ANON_KEY.substring(0, 20)}...`);

    await testEdgeFunctionAccess();

    await checkDatabaseSchema();

    await testRegistryMonitoring();

    await verifyDatabaseState();

    console.log('\n' + '='.repeat(60));
    console.log('✅ ALL TESTS COMPLETED SUCCESSFULLY');
    console.log('='.repeat(60));
    console.log('\n📝 Next Steps:');
    console.log('   1. Check the Dashboard for new case notifications');
    console.log('   2. Go to judicial.ky and download PDFs for new cases');
    console.log('   3. Upload PDFs through the Registry page');
    console.log('   4. Wait for automatic processing (text extraction + analysis)');
    console.log('   5. View the analysis results in the Registry page\n');

  } catch (error) {
    console.log('\n' + '='.repeat(60));
    console.log('❌ TEST SUITE FAILED');
    console.log('='.repeat(60));
    console.error('\nError:', error.message);
    process.exit(1);
  }
}

runTests();

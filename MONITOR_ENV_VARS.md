# Cayman Monitor - Environment Variables

## Required Configuration

These environment variables must be set in your Supabase Edge Functions environment.

### Setting Environment Variables

**Via Supabase CLI:**
```bash
supabase secrets set NEWSAPI_KEY=your-key-here
supabase secrets set OPENAI_API_KEY=sk-your-key-here
supabase secrets set ANTHROPIC_API_KEY=sk-ant-your-key-here
```

**Via Supabase Dashboard:**
1. Navigate to Edge Functions → Settings
2. Add environment variables in the "Secrets" section

## Environment Variables

### NEWSAPI_KEY (optional but recommended)
```bash
NEWSAPI_KEY=your-newsapi-key-here
```
- **Purpose**: Access NewsAPI for English-language news articles
- **Get from**: https://newsapi.org/register
- **Free tier**: 100 requests/day
- **Paid tier**: $449/month for 250,000 requests
- **Note**: If not provided, system will only use GDELT (free)

### OPENAI_API_KEY (required for classification)
```bash
OPENAI_API_KEY=sk-your-openai-key-here
```
- **Purpose**: Classify articles for Cayman relevance and risk signals
- **Get from**: https://platform.openai.com/api-keys
- **Model**: GPT-4o-mini
- **Cost**: ~$0.0008 per article
- **Budget**: ~$2.50/month for 100 articles/day

### ANTHROPIC_API_KEY (optional alternative)
```bash
ANTHROPIC_API_KEY=sk-ant-your-anthropic-key-here
```
- **Purpose**: Alternative to OpenAI for classification
- **Get from**: https://console.anthropic.com
- **Model**: Claude 3.5 Sonnet
- **Cost**: ~$0.003 per article (higher than OpenAI)
- **Note**: System will prefer OpenAI if both are set

### ALLOW_SOURCES (optional)
```bash
ALLOW_SOURCES=reuters.com,bloomberg.com,ft.com
```
- **Purpose**: Comma-separated allowlist of news source domains
- **Default**: All sources allowed if not set
- **Example**: `reuters.com,bloomberg.com,ft.com,wsj.com`
- **Use case**: Filter to only trusted/premium news sources

## Example Configuration

### Minimal Setup (GDELT + OpenAI only)
```bash
OPENAI_API_KEY=sk-your-key-here
```
Cost: ~$2.50/month

### Recommended Setup (GDELT + NewsAPI + OpenAI)
```bash
NEWSAPI_KEY=your-newsapi-key-here
OPENAI_API_KEY=sk-your-key-here
```
Cost: ~$2.70/month (within free tiers)

### Premium Setup (with source filtering)
```bash
NEWSAPI_KEY=your-newsapi-key-here
OPENAI_API_KEY=sk-your-key-here
ALLOW_SOURCES=reuters.com,bloomberg.com,ft.com,wsj.com
```
Cost: ~$2.70/month + potential NewsAPI paid tier

### Alternative LLM Setup
```bash
NEWSAPI_KEY=your-newsapi-key-here
ANTHROPIC_API_KEY=sk-ant-your-key-here
```
Cost: ~$9/month (Anthropic is more expensive)

## Verification

After setting environment variables, verify they're accessible:

```bash
# Test edge function can access secrets
supabase functions deploy ingest_newsapi
supabase functions invoke ingest_newsapi

# Check logs for any "not configured" errors
```

## Security Notes

- ⚠️ **Never** commit API keys to git
- ⚠️ **Never** expose keys in frontend code
- ✅ **Always** use Supabase secrets for edge functions
- ✅ **Rotate** keys periodically for security
- ✅ **Monitor** usage to detect anomalies

## Troubleshooting

**"NEWSAPI_KEY not configured" error:**
- Verify secret is set: `supabase secrets list`
- Redeploy function after setting secret
- Check function logs for exact error

**"No LLM API keys configured" error:**
- Set at least one: OPENAI_API_KEY or ANTHROPIC_API_KEY
- Verify key format (should start with "sk-")
- Test key with direct API call outside edge function

**Rate limit errors:**
- NewsAPI free tier: 100/day (upgrade or disable NewsAPI)
- OpenAI Tier 1: 3,500 req/min (should be sufficient)
- Implement backoff retry logic in code

## Cost Monitoring

Track costs via:
- OpenAI: https://platform.openai.com/usage
- Anthropic: https://console.anthropic.com/settings/billing
- NewsAPI: https://newsapi.org/account

Query token usage from database:
```sql
SELECT 
  COUNT(*) as articles_classified,
  SUM((meta->>'input_tokens')::int) as total_input_tokens,
  SUM((meta->>'output_tokens')::int) as total_output_tokens
FROM public.articles
WHERE meta ? 'input_tokens';
```


/*
  # Seed Data for Cayman Monitor Testing
  
  Creates sample articles, entities, and relationships for testing the Monitor feature.
*/

-- Insert sample entities first (needed for foreign key references)
INSERT INTO public.entities (id, name, canonical_name, type, aliases) VALUES
-- Organizations
('11111111-1111-1111-1111-111111111111'::uuid, 'Cayman Investment Fund Ltd', 'cayman investment fund ltd', 'ORG', ARRAY['CIF', 'Cayman Investment']),
('22222222-2222-2222-2222-222222222222'::uuid, 'Grand Cayman Capital Partners', 'grand cayman capital partners', 'ORG', ARRAY['GCCP', 'GC Capital']),
('33333333-3333-3333-3333-333333333333'::uuid, 'Island Hedge Fund Management', 'island hedge fund management', 'ORG', ARRAY['IHFM', 'Island Hedge']),
('44444444-4444-4444-4444-444444444444'::uuid, 'Caribbean Financial Services Corp', 'caribbean financial services corp', 'ORG', ARRAY['CFSC', 'Caribbean FS']),
('55555555-5555-5555-5555-555555555555'::uuid, 'Offshore Holdings International', 'offshore holdings international', 'ORG', ARRAY['OHI']),

-- People
('66666666-6666-6666-6666-666666666666'::uuid, 'John Hamilton Smith', 'john hamilton smith', 'PERSON', ARRAY['J.H. Smith', 'John Smith']),
('77777777-7777-7777-7777-777777777777'::uuid, 'Sarah Chen', 'sarah chen', 'PERSON', ARRAY['S. Chen']),
('88888888-8888-8888-8888-888888888888'::uuid, 'Michael Rodriguez', 'michael rodriguez', 'PERSON', ARRAY['M. Rodriguez', 'Mike Rodriguez']),
('99999999-9999-9999-9999-999999999999'::uuid, 'Patricia O''Connor', 'patricia o''connor', 'PERSON', ARRAY['P. O''Connor', 'Pat O''Connor']),

-- Geopolitical Entities
('aaaaaaaa-1111-1111-1111-111111111111'::uuid, 'Cayman Islands', 'cayman islands', 'GPE', ARRAY['Cayman', 'Grand Cayman']),
('aaaaaaaa-2222-2222-2222-222222222222'::uuid, 'George Town', 'george town', 'GPE', ARRAY['Georgetown']),
('aaaaaaaa-3333-3333-3333-333333333333'::uuid, 'British Virgin Islands', 'british virgin islands', 'GPE', ARRAY['BVI']),

-- RO Providers
('bbbbbbbb-1111-1111-1111-111111111111'::uuid, 'Maples and Calder', 'maples and calder', 'RO_PROVIDER', ARRAY['Maples', 'MaplesFS']),
('bbbbbbbb-2222-2222-2222-222222222222'::uuid, 'Walkers Global', 'walkers global', 'RO_PROVIDER', ARRAY['Walkers']),
('bbbbbbbb-3333-3333-3333-333333333333'::uuid, 'Ogier', 'ogier', 'RO_PROVIDER', ARRAY['Ogier Law'])
ON CONFLICT (id) DO NOTHING;

-- Insert sample articles
INSERT INTO public.articles (id, url, url_hash, source, title, excerpt, published_at, cayman_flag, signals, reasons, confidence, meta) VALUES
(
  'cccccccc-1111-1111-1111-111111111111'::uuid,
  'https://reuters.com/article/cayman-fund-fraud-2025',
  'hash001',
  'reuters.com',
  'Cayman Investment Fund Under Investigation for Fraud Allegations',
  'Regulators are investigating a Cayman Islands-based hedge fund following allegations of fraudulent activities and misstatement of assets.',
  NOW() - INTERVAL '2 days',
  true,
  '{"fraud": true, "enforcement": true, "financial_decline": false, "misstated_financials": false, "shareholder_issues": false, "director_duties": false}'::jsonb,
  ARRAY['Mentions Cayman Islands explicitly', 'Fraud investigation mentioned', 'Regulatory enforcement action'],
  0.95,
  '{"author": "Jane Reporter", "word_count": 1200}'::jsonb
),
(
  'cccccccc-2222-2222-2222-222222222222'::uuid,
  'https://ft.com/content/cayman-financial-decline-2025',
  'hash002',
  'ft.com',
  'Grand Cayman Capital Partners Reports Significant Losses',
  'The Cayman-domiciled fund reported a 40% decline in asset value amid market volatility and investor redemptions.',
  NOW() - INTERVAL '5 days',
  true,
  '{"financial_decline": true, "fraud": false, "enforcement": false, "misstated_financials": false, "shareholder_issues": false, "director_duties": false}'::jsonb,
  ARRAY['Cayman-domiciled entity', 'Significant financial decline reported', 'Asset value decrease'],
  0.88,
  '{"author": "Financial Desk", "word_count": 950}'::jsonb
),
(
  'cccccccc-3333-3333-3333-333333333333'::uuid,
  'https://bloomberg.com/news/cayman-shareholder-dispute',
  'hash003',
  'bloomberg.com',
  'Shareholders Sue Cayman Fund Over Misstated Financial Reports',
  'Island Hedge Fund Management faces shareholder lawsuit alleging false financial statements and breach of fiduciary duty.',
  NOW() - INTERVAL '7 days',
  true,
  '{"shareholder_issues": true, "misstated_financials": true, "director_duties": true, "fraud": false, "enforcement": false, "financial_decline": false}'::jsonb,
  ARRAY['Cayman entity involved', 'Shareholder lawsuit filed', 'Financial misstatements alleged', 'Director duty breach'],
  0.92,
  '{"author": "Legal Team", "word_count": 1500}'::jsonb
),
(
  'cccccccc-4444-4444-4444-444444444444'::uuid,
  'https://wsj.com/articles/caribbean-financial-enforcement',
  'hash004',
  'wsj.com',
  'SEC Sanctions Caribbean Financial Services Corp for Compliance Failures',
  'The US Securities and Exchange Commission imposed sanctions on a Cayman-registered firm for regulatory violations.',
  NOW() - INTERVAL '10 days',
  true,
  '{"enforcement": true, "director_duties": true, "fraud": false, "financial_decline": false, "misstated_financials": false, "shareholder_issues": false}'::jsonb,
  ARRAY['Cayman-registered entity', 'SEC enforcement action', 'Regulatory compliance failure'],
  0.89,
  '{"author": "Regulatory Reporter", "word_count": 800}'::jsonb
),
(
  'cccccccc-5555-5555-5555-555555555555'::uuid,
  'https://reuters.com/article/offshore-holdings-fraud',
  'hash005',
  'reuters.com',
  'Offshore Holdings International Faces Fraud Charges in Multiple Jurisdictions',
  'Authorities in three countries filed criminal charges against directors of the Cayman Islands-based company.',
  NOW() - INTERVAL '12 days',
  true,
  '{"fraud": true, "enforcement": true, "director_duties": true, "financial_decline": false, "misstated_financials": false, "shareholder_issues": false}'::jsonb,
  ARRAY['Cayman Islands-based entity', 'Criminal fraud charges', 'Multiple jurisdiction enforcement', 'Directors charged'],
  0.97,
  '{"author": "Crime Desk", "word_count": 1800}'::jsonb
),
(
  'cccccccc-6666-6666-6666-666666666666'::uuid,
  'https://ft.com/content/cayman-auditor-concerns',
  'hash006',
  'ft.com',
  'Auditor Raises Red Flags Over Cayman Fund Financial Statements',
  'Independent auditors expressed concern over accounting practices at a George Town-based investment fund.',
  NOW() - INTERVAL '15 days',
  true,
  '{"misstated_financials": true, "fraud": false, "enforcement": false, "financial_decline": false, "shareholder_issues": false, "director_duties": false}'::jsonb,
  ARRAY['George Town location (Cayman)', 'Auditor concerns raised', 'Accounting irregularities'],
  0.85,
  '{"author": "Audit Reporter", "word_count": 700}'::jsonb
),
(
  'cccccccc-7777-7777-7777-777777777777'::uuid,
  'https://bloomberg.com/news/cayman-director-resignation',
  'hash007',
  'bloomberg.com',
  'Directors Resign from Troubled Cayman Investment Vehicle',
  'Board members stepped down citing concerns over governance and fiduciary responsibilities.',
  NOW() - INTERVAL '18 days',
  true,
  '{"director_duties": true, "shareholder_issues": true, "fraud": false, "enforcement": false, "financial_decline": false, "misstated_financials": false}'::jsonb,
  ARRAY['Cayman investment vehicle', 'Director resignations', 'Governance concerns', 'Fiduciary duty issues'],
  0.82,
  '{"author": "Corporate Governance", "word_count": 600}'::jsonb
),
(
  'cccccccc-8888-8888-8888-888888888888'::uuid,
  'https://wsj.com/articles/cayman-fund-redemption-crisis',
  'hash008',
  'wsj.com',
  'Investors Rush to Redeem from Struggling Cayman Hedge Fund',
  'Mass redemptions triggered concerns about the fund liquidity and valuation practices.',
  NOW() - INTERVAL '20 days',
  true,
  '{"financial_decline": true, "shareholder_issues": true, "fraud": false, "enforcement": false, "misstated_financials": false, "director_duties": false}'::jsonb,
  ARRAY['Cayman hedge fund', 'Financial distress', 'Mass investor redemptions', 'Liquidity concerns'],
  0.86,
  '{"author": "Markets Team", "word_count": 1100}'::jsonb
),
(
  'cccccccc-9999-9999-9999-999999999999'::uuid,
  'https://reuters.com/article/cayman-restructuring-2025',
  'hash009',
  'reuters.com',
  'Cayman-Domiciled Fund Announces Restructuring Plan',
  'Following financial difficulties, the fund will undergo major restructuring with creditor approval.',
  NOW() - INTERVAL '25 days',
  true,
  '{"financial_decline": true, "fraud": false, "enforcement": false, "misstated_financials": false, "shareholder_issues": false, "director_duties": false}'::jsonb,
  ARRAY['Cayman-domiciled entity', 'Financial restructuring', 'Creditor involvement'],
  0.79,
  '{"author": "Restructuring Desk", "word_count": 900}'::jsonb
),
(
  'cccccccc-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
  'https://ft.com/content/cayman-maples-investigation',
  'hash010',
  'ft.com',
  'Law Firm Maples Assists in Cayman Fund Investigation',
  'Registered office provider Maples and Calder is cooperating with authorities investigating fund irregularities.',
  NOW() - INTERVAL '28 days',
  true,
  '{"enforcement": true, "fraud": false, "financial_decline": false, "misstated_financials": false, "shareholder_issues": false, "director_duties": false}'::jsonb,
  ARRAY['Maples and Calder (RO provider)', 'Cayman fund investigation', 'Regulatory cooperation'],
  0.84,
  '{"author": "Legal Affairs", "word_count": 750}'::jsonb
),

-- Non-Cayman articles for filtering tests
(
  'dddddddd-1111-1111-1111-111111111111'::uuid,
  'https://reuters.com/article/singapore-fund-2025',
  'hash011',
  'reuters.com',
  'Singapore Investment Fund Posts Strong Returns',
  'Asia-based fund management company reports excellent quarterly performance.',
  NOW() - INTERVAL '3 days',
  false,
  '{"fraud": false, "enforcement": false, "financial_decline": false, "misstated_financials": false, "shareholder_issues": false, "director_duties": false}'::jsonb,
  ARRAY['No Cayman connection'],
  0.15,
  '{"author": "Asia Desk", "word_count": 500}'::jsonb
),
(
  'dddddddd-2222-2222-2222-222222222222'::uuid,
  'https://bloomberg.com/news/london-market-update',
  'hash012',
  'bloomberg.com',
  'London Markets Close Higher on Strong Economic Data',
  'UK stock markets rallied following positive employment figures.',
  NOW() - INTERVAL '4 days',
  false,
  '{"fraud": false, "enforcement": false, "financial_decline": false, "misstated_financials": false, "shareholder_issues": false, "director_duties": false}'::jsonb,
  ARRAY['No Cayman connection'],
  0.08,
  '{"author": "Markets", "word_count": 400}'::jsonb
),
(
  'dddddddd-3333-3333-3333-333333333333'::uuid,
  'https://wsj.com/articles/tech-ipo-2025',
  'hash013',
  'wsj.com',
  'Tech Startup Prepares for Major IPO',
  'Silicon Valley company files for initial public offering with promising valuation.',
  NOW() - INTERVAL '6 days',
  false,
  '{"fraud": false, "enforcement": false, "financial_decline": false, "misstated_financials": false, "shareholder_issues": false, "director_duties": false}'::jsonb,
  ARRAY['No Cayman connection'],
  0.05,
  '{"author": "Tech Reporter", "word_count": 650}'::jsonb
)
ON CONFLICT (url) DO NOTHING;

-- Link articles to entities
INSERT INTO public.article_entities (article_id, entity_id, role) VALUES
-- Article 1: Cayman Investment Fund fraud
('cccccccc-1111-1111-1111-111111111111'::uuid, '11111111-1111-1111-1111-111111111111'::uuid, 'subject'),
('cccccccc-1111-1111-1111-111111111111'::uuid, 'aaaaaaaa-1111-1111-1111-111111111111'::uuid, 'location'),

-- Article 2: Grand Cayman Capital losses
('cccccccc-2222-2222-2222-222222222222'::uuid, '22222222-2222-2222-2222-222222222222'::uuid, 'subject'),
('cccccccc-2222-2222-2222-222222222222'::uuid, 'aaaaaaaa-1111-1111-1111-111111111111'::uuid, 'location'),

-- Article 3: Island Hedge shareholder lawsuit
('cccccccc-3333-3333-3333-333333333333'::uuid, '33333333-3333-3333-3333-333333333333'::uuid, 'subject'),
('cccccccc-3333-3333-3333-333333333333'::uuid, '66666666-6666-6666-6666-666666666666'::uuid, 'director'),
('cccccccc-3333-3333-3333-333333333333'::uuid, 'aaaaaaaa-1111-1111-1111-111111111111'::uuid, 'location'),

-- Article 4: Caribbean Financial SEC sanctions
('cccccccc-4444-4444-4444-444444444444'::uuid, '44444444-4444-4444-4444-444444444444'::uuid, 'subject'),
('cccccccc-4444-4444-4444-444444444444'::uuid, '77777777-7777-7777-7777-777777777777'::uuid, 'director'),
('cccccccc-4444-4444-4444-444444444444'::uuid, 'aaaaaaaa-1111-1111-1111-111111111111'::uuid, 'location'),

-- Article 5: Offshore Holdings fraud charges
('cccccccc-5555-5555-5555-555555555555'::uuid, '55555555-5555-5555-5555-555555555555'::uuid, 'subject'),
('cccccccc-5555-5555-5555-555555555555'::uuid, '88888888-8888-8888-8888-888888888888'::uuid, 'director'),
('cccccccc-5555-5555-5555-555555555555'::uuid, '99999999-9999-9999-9999-999999999999'::uuid, 'director'),
('cccccccc-5555-5555-5555-555555555555'::uuid, 'aaaaaaaa-1111-1111-1111-111111111111'::uuid, 'location'),

-- Article 6: Auditor concerns
('cccccccc-6666-6666-6666-666666666666'::uuid, '33333333-3333-3333-3333-333333333333'::uuid, 'subject'),
('cccccccc-6666-6666-6666-666666666666'::uuid, 'aaaaaaaa-2222-2222-2222-222222222222'::uuid, 'location'),

-- Article 7: Director resignations
('cccccccc-7777-7777-7777-777777777777'::uuid, '22222222-2222-2222-2222-222222222222'::uuid, 'subject'),
('cccccccc-7777-7777-7777-777777777777'::uuid, '66666666-6666-6666-6666-666666666666'::uuid, 'director'),
('cccccccc-7777-7777-7777-777777777777'::uuid, 'aaaaaaaa-1111-1111-1111-111111111111'::uuid, 'location'),

-- Article 8: Redemption crisis
('cccccccc-8888-8888-8888-888888888888'::uuid, '11111111-1111-1111-1111-111111111111'::uuid, 'subject'),
('cccccccc-8888-8888-8888-888888888888'::uuid, 'aaaaaaaa-1111-1111-1111-111111111111'::uuid, 'location'),

-- Article 9: Restructuring
('cccccccc-9999-9999-9999-999999999999'::uuid, '44444444-4444-4444-4444-444444444444'::uuid, 'subject'),
('cccccccc-9999-9999-9999-999999999999'::uuid, 'aaaaaaaa-1111-1111-1111-111111111111'::uuid, 'location'),

-- Article 10: Maples investigation
('cccccccc-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, 'bbbbbbbb-1111-1111-1111-111111111111'::uuid, 'ro_provider'),
('cccccccc-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, 'aaaaaaaa-1111-1111-1111-111111111111'::uuid, 'location')
ON CONFLICT (article_id, entity_id) DO NOTHING;

-- Insert sample ingest runs
INSERT INTO public.ingest_runs (id, source, status, fetched, stored, skipped, started_at, finished_at) VALUES
(
  'eeeeeeee-1111-1111-1111-111111111111'::uuid,
  'gdelt',
  'completed',
  150,
  12,
  138,
  NOW() - INTERVAL '2 days',
  NOW() - INTERVAL '2 days' + INTERVAL '2 minutes'
),
(
  'eeeeeeee-2222-2222-2222-222222222222'::uuid,
  'newsapi',
  'completed',
  50,
  8,
  42,
  NOW() - INTERVAL '4 days',
  NOW() - INTERVAL '4 days' + INTERVAL '1 minute'
),
(
  'eeeeeeee-3333-3333-3333-333333333333'::uuid,
  'gdelt',
  'completed',
  200,
  15,
  185,
  NOW() - INTERVAL '7 days',
  NOW() - INTERVAL '7 days' + INTERVAL '3 minutes'
)
ON CONFLICT (id) DO NOTHING;
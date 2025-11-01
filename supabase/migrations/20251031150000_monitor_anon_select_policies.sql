-- Cayman Monitor - anon read access policies

CREATE POLICY articles_select_anon ON public.articles
FOR SELECT TO anon
USING (true);

CREATE POLICY entities_select_anon ON public.entities
FOR SELECT TO anon
USING (true);

CREATE POLICY article_entities_select_anon ON public.article_entities
FOR SELECT TO anon
USING (true);

CREATE POLICY ingest_runs_select_anon ON public.ingest_runs
FOR SELECT TO anon
USING (true);


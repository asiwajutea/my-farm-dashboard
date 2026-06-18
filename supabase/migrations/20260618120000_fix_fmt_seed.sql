-- Fix fmt_seed: the old format mask 'FM999999999990.00######' could output
-- literal '#' characters for certain numeric values because PostgreSQL
-- substitutes '#' when a to_char integer-part slot overflows.
-- Replace with a clean round-to-2dp approach that is safe for all values.

CREATE OR REPLACE FUNCTION public.fmt_seed(p_amount numeric)
RETURNS text
LANGUAGE sql IMMUTABLE
AS $$
  SELECT trim(trailing '.' FROM
           trim(trailing '0' FROM
             to_char(round(p_amount, 8), 'FM9999999999990.00000000')
           )
         ) || ' Seed';
$$;

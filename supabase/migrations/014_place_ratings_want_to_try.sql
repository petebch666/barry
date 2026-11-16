-- Widens place_ratings.rating from ternary (been-there) to a 4th value,
-- 'want_to_try' — no new table/column. A row's absence, or an explicit
-- want_to_try rating, both mean "haven't been yet"; the same upsert
-- (UNIQUE(place_id, user_id)) handles moving to a real rating later.

ALTER TABLE place_ratings DROP CONSTRAINT IF EXISTS place_ratings_rating_check;
ALTER TABLE place_ratings ADD CONSTRAINT place_ratings_rating_check
  CHECK (rating IN ('loved_it', 'it_was_fine', 'not_for_me', 'want_to_try'));

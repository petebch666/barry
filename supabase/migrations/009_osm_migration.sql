-- Migrate from Google Places to OpenStreetMap/Overpass as the place provider.
-- 1. Update any existing 'google_places' rows to 'osm' before changing the constraint.
-- 2. Replace the source CHECK constraint to accept 'osm' instead of 'google_places'.
-- 3. Rename saved_places.google_place_id to osm_id for OSM element references.

UPDATE places SET source = 'osm' WHERE source = 'google_places';

ALTER TABLE places DROP CONSTRAINT IF EXISTS places_source_check;
ALTER TABLE places ADD CONSTRAINT places_source_check
  CHECK (source IN ('osm', 'manual'));

ALTER TABLE saved_places RENAME COLUMN google_place_id TO osm_id;

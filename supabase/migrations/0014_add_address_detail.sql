-- Free-text plot/house number, floor, landmark, etc. -- Nominatim search
-- (or manual pin placement) only ever locates the general area, never
-- this level of detail, so it's captured separately and shown alongside
-- the searched address on both the rider's and customer's pages.
alter table orders add column address_detail text;

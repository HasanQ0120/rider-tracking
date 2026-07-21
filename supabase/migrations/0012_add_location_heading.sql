-- Bearing (0=north, clockwise) computed from consecutive GPS points, so the
-- rider's marker can be drawn as a directional arrow instead of a plain dot.
-- Null for a rider's very first reading, since there's no previous point to
-- compute a bearing from yet.
alter table current_locations add column heading double precision;

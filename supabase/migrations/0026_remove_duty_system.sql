-- Full removal of the on-duty/off-duty check-in system. Every active rider
-- is now considered available by default (see src/lib/autoAssign.ts) --
-- there is no longer a separate duty state, geofence, or ping table for
-- anything to read from or write to.

drop table if exists rider_duty_locations;

alter table riders drop column if exists duty_token;

alter table tenants drop column if exists duty_checkin_radius_m;

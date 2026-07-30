import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { loadActiveRiderToken, getDeviceLock } from "@/lib/rider/shared";
import { verifyPin, generateSessionId } from "@/lib/tokens";
import { PIN_MAX_ATTEMPTS, PIN_LOCKOUT_MINUTES } from "@/lib/config";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const { pin, device_key } = await req.json();

  if (!pin || !device_key) {
    return NextResponse.json({ status: "invalid_request" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const riderToken = await loadActiveRiderToken(supabase, token);
  if (!riderToken) {
    return NextResponse.json({ status: "invalid" }, { status: 404 });
  }

  if (riderToken.pin_locked_until && new Date(riderToken.pin_locked_until) > new Date()) {
    return NextResponse.json(
      { status: "locked_out", lockedUntil: riderToken.pin_locked_until },
      { status: 423 }
    );
  }

  // A different device presenting ANY pin -- right or wrong -- is rejected
  // outright. This is what stops a forwarded link from being usable on a
  // second device even if the PIN leaked with it.
  const lockedDeviceKey = await getDeviceLock(supabase, riderToken.id);
  if (lockedDeviceKey && lockedDeviceKey !== device_key) {
    return NextResponse.json({ status: "blocked_device" }, { status: 403 });
  }

  const { data: pinRow } = await supabase
    .from("pin_codes")
    .select("pin_hash")
    .eq("rider_token_id", riderToken.id)
    .single();

  const correct = pinRow ? await verifyPin(pin, pinRow.pin_hash) : false;

  const { error: attemptError } = await supabase.from("pin_attempts").insert({
    rider_token_id: riderToken.id,
    success: correct,
  });
  if (attemptError) {
    console.error("[verify-pin] failed to record pin_attempts", attemptError);
  }

  if (!correct) {
    const nextFailCount = riderToken.pin_fail_count + 1;
    const lockingOut = nextFailCount >= PIN_MAX_ATTEMPTS;
    const { error: failCountError } = await supabase
      .from("tracking_tokens")
      .update({
        pin_fail_count: lockingOut ? 0 : nextFailCount,
        pin_locked_until: lockingOut
          ? new Date(Date.now() + PIN_LOCKOUT_MINUTES * 60_000).toISOString()
          : null,
      })
      .eq("id", riderToken.id);
    if (failCountError) {
      console.error("[verify-pin] failed to update pin_fail_count", failCountError);
    }

    if (lockingOut) {
      return NextResponse.json({ status: "locked_out" }, { status: 423 });
    }
    return NextResponse.json(
      { status: "wrong_pin", attemptsRemaining: PIN_MAX_ATTEMPTS - nextFailCount },
      { status: 401 }
    );
  }

  const { error: resetFailCountError } = await supabase
    .from("tracking_tokens")
    .update({ pin_fail_count: 0, pin_locked_until: null })
    .eq("id", riderToken.id);
  if (resetFailCountError) {
    console.error("[verify-pin] failed to reset pin_fail_count", resetFailCountError);
  }

  if (!lockedDeviceKey) {
    const { error: deviceLockError } = await supabase
      .from("device_locks")
      .insert({ rider_token_id: riderToken.id, device_key });
    if (deviceLockError) {
      console.error("[verify-pin] failed to write device_locks", deviceLockError);
    }
  }

  const sessionId = generateSessionId();
  const { error: supersedeError } = await supabase
    .from("tracking_sessions")
    .update({ is_active: false, superseded_at: new Date().toISOString() })
    .eq("rider_token_id", riderToken.id)
    .eq("is_active", true);
  if (supersedeError) {
    console.error("[verify-pin] failed to supersede previous session", supersedeError);
  }
  const { error: sessionInsertError } = await supabase
    .from("tracking_sessions")
    .insert({ rider_token_id: riderToken.id, session_id: sessionId });
  if (sessionInsertError) {
    console.error("[verify-pin] failed to create tracking session", sessionInsertError);
    return NextResponse.json({ status: "error" }, { status: 500 });
  }

  return NextResponse.json({ status: "active", sessionId });
}

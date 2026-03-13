import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface JobRun {
  run_id: number;
  memberships_found: number;
  memberships_processed: number;
  memberships_skipped: number;
  memberships_failed: number;
  total_payments_created: number;
  total_items_created: number;
  errors: Array<{ program_id: number; error: string }>;
}

interface MembershipFinances {
  monthly_rate: number;
  monthly_discount: number;
  monthly_tax: number;
}

interface ClonedItemMapping {
  originalItemId: number;
  newItemId: number;
}

/**
 * Calculate the number of days between two dates
 */
function daysBetween(date1: Date, date2: Date): number {
  const oneDay = 24 * 60 * 60 * 1000;
  return Math.round((date2.getTime() - date1.getTime()) / oneDay);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const startTime = Date.now();
  
  let triggeredBy = 'cron';
  try {
    const body = await req.json().catch(() => ({}));
    triggeredBy = body.triggered_by || 'cron';
  } catch {
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const supabase = createClient(supabaseUrl, supabaseKey);

  const jobRun: Partial<JobRun> = {
    memberships_found: 0,
    memberships_processed: 0,
    memberships_skipped: 0,
    memberships_failed: 0,
    total_payments_created: 0,
    total_items_created: 0,
    errors: [],
  };

  try {
    console.log("[MONTHLY BILLING] Starting job...");
    const { data: runRecord, error: runError } = await supabase
      .from("cron_job_runs")
      .insert({
        job_name: "process_monthly_memberships",
        status: "running",
        triggered_by: triggeredBy,
      })
      .select()
      .single();

    if (runError) {
      console.error("[MONTHLY BILLING] Failed to create job run record:", runError);
      throw new Error("Failed to create job run record");
    }

    jobRun.run_id = runRecord.run_id;
    console.log(`[MONTHLY BILLING] Job run ID: ${jobRun.run_id}`);

    const today = new Date();
    const tenDaysFromNow = new Date(today);
    tenDaysFromNow.setDate(tenDaysFromNow.getDate() + 10);
    const cutoffDate = tenDaysFromNow.toISOString().split("T")[0];

    console.log(`[MONTHLY BILLING] Looking for memberships with next_billing_date <= ${cutoffDate}`);

    const { data: memberships, error: membershipsError } = await supabase
      .from("member_programs")
      .select(`
        member_program_id,
        program_template_name,
        start_date,
        next_billing_date,
        total_cost,
        total_charge,
        duration,
        lead_id,
        program_status:program_status_id(status_name)
      `)
      .eq("program_type", "membership")
      .eq("active_flag", true)
      .lte("next_billing_date", cutoffDate);

    if (membershipsError) {
      console.error("[MONTHLY BILLING] Error fetching memberships:", membershipsError);
      throw new Error("Failed to fetch memberships");
    }

    const activeMemberships = (memberships || []).filter(
      (m: any) => m.program_status?.status_name?.toLowerCase() === "active"
    );

    jobRun.memberships_found = activeMemberships.length;
    console.log(`[MONTHLY BILLING] Found ${activeMemberships.length} active memberships due for processing`);

    for (const membership of activeMemberships) {
      const programId = membership.member_program_id;
      console.log(`[MONTHLY BILLING] Processing program ${programId}...`);

      try {
        const { data: existingPayment } = await supabase
          .from("member_program_payments")
          .select("member_program_payment_id")
          .eq("member_program_id", programId)
          .eq("payment_due_date", membership.next_billing_date)
          .eq("active_flag", true)
          .maybeSingle();

        if (existingPayment) {
          console.log(`[MONTHLY BILLING] Program ${programId}: Payment already exists for ${membership.next_billing_date}, skipping`);
          jobRun.memberships_skipped!++;
          continue;
        }

        const { data: membershipFinances, error: financesError } = await supabase
          .from("member_program_membership_finances")
          .select("monthly_rate, monthly_discount, monthly_tax")
          .eq("member_program_id", programId)
          .single();

        if (financesError || !membershipFinances) {
          throw new Error(`No membership finances found for program ${programId}`);
        }

        const finances: MembershipFinances = membershipFinances;
        console.log(`[MONTHLY BILLING] Program ${programId}: Monthly values - rate: ${finances.monthly_rate}, discount: ${finances.monthly_discount}, tax: ${finances.monthly_tax}`);

        const { data: maxPeriodResult } = await supabase
          .from("member_program_items")
          .select("billing_period_month")
          .eq("member_program_id", programId)
          .eq("active_flag", true)
          .order("billing_period_month", { ascending: false })
          .limit(1)
          .single();

        const currentMaxPeriod = maxPeriodResult?.billing_period_month || 1;
        const newPeriod = currentMaxPeriod + 1;
        console.log(`[MONTHLY BILLING] Program ${programId}: Current max period: ${currentMaxPeriod}, new period: ${newPeriod}`);

        const startDate = new Date(membership.start_date);
        const billingDate = new Date(membership.next_billing_date);
        const daysOffset = daysBetween(startDate, billingDate);
        console.log(`[MONTHLY BILLING] Program ${programId}: Days offset for new period: ${daysOffset}`);

        const { data: period1Items, error: itemsError } = await supabase
          .from("member_program_items")
          .select("*")
          .eq("member_program_id", programId)
          .eq("billing_period_month", 1)
          .eq("active_flag", true);

        if (itemsError) {
          throw new Error(`Failed to fetch Period 1 items: ${itemsError.message}`);
        }

        let period1TotalCost = 0;
        for (const item of period1Items || []) {
          period1TotalCost += (Number(item.item_cost) || 0) * (Number(item.quantity) || 1);
        }
        console.log(`[MONTHLY BILLING] Program ${programId}: Period 1 total cost: ${period1TotalCost}`);

        const clonedItemMappings: ClonedItemMapping[] = [];
        let itemsCreated = 0;
        
        for (const item of period1Items || []) {
          const originalItemId = item.member_program_item_id;
          const originalDaysFromStart = Number(item.days_from_start) || 0;
          const newDaysFromStart = originalDaysFromStart + daysOffset;
          
          const { member_program_item_id, created_at, updated_at, ...itemData } = item;
          
          const { data: newItem, error: insertError } = await supabase
            .from("member_program_items")
            .insert({
              ...itemData,
              billing_period_month: newPeriod,
              days_from_start: newDaysFromStart,
            })
            .select("member_program_item_id")
            .single();

          if (insertError) {
            console.error(`[MONTHLY BILLING] Failed to clone item:`, insertError);
          } else if (newItem) {
            itemsCreated++;
            clonedItemMappings.push({
              originalItemId: originalItemId,
              newItemId: newItem.member_program_item_id,
            });
            console.log(`[MONTHLY BILLING] Program ${programId}: Cloned item ${originalItemId} -> ${newItem.member_program_item_id}`);
          }
        }
        console.log(`[MONTHLY BILLING] Program ${programId}: Cloned ${itemsCreated} items to period ${newPeriod}`);
        jobRun.total_items_created! += itemsCreated;

        let tasksCreated = 0;
        for (const mapping of clonedItemMappings) {
          const { data: originalTasks, error: tasksError } = await supabase
            .from("member_program_item_tasks")
            .select("*")
            .eq("member_program_item_id", mapping.originalItemId);

          if (tasksError) {
            console.error(`[MONTHLY BILLING] Failed to fetch tasks for item ${mapping.originalItemId}:`, tasksError);
            continue;
          }

          for (const task of originalTasks || []) {
            const { 
              member_program_item_task_id, 
              member_program_item_id,
              created_at, 
              updated_at,
              completed_flag,
              completed_date,
              completed_by,
              ...taskData 
            } = task;

            const { error: taskInsertError } = await supabase
              .from("member_program_item_tasks")
              .insert({
                ...taskData,
                member_program_item_id: mapping.newItemId,
                completed_flag: false,
                completed_date: null,
                completed_by: null,
              });

            if (taskInsertError) {
              console.error(`[MONTHLY BILLING] Failed to clone task:`, taskInsertError);
            } else {
              tasksCreated++;
            }
          }
        }
        console.log(`[MONTHLY BILLING] Program ${programId}: Cloned ${tasksCreated} tasks`);

        // Update member_programs totals AND duration (add 30 days for new billing period)
        const currentTotalCost = Number(membership.total_cost) || 0;
        const currentTotalCharge = Number(membership.total_charge) || 0;
        const currentDuration = Number(membership.duration) || 30;
        const newTotalCost = currentTotalCost + period1TotalCost;
        const newTotalCharge = currentTotalCharge + (finances.monthly_rate || 0);
        const newDuration = currentDuration + 30;

        await supabase
          .from("member_programs")
          .update({
            total_cost: newTotalCost,
            total_charge: newTotalCharge,
            duration: newDuration,
          })
          .eq("member_program_id", programId);

        console.log(`[MONTHLY BILLING] Program ${programId}: Updated totals - cost: ${newTotalCost}, charge: ${newTotalCharge}, duration: ${newDuration}`);

        const { data: currentFinances } = await supabase
          .from("member_program_finances")
          .select("discounts, taxes, final_total_price")
          .eq("member_program_id", programId)
          .single();

        const monthlyPayment = (finances.monthly_rate || 0) + (finances.monthly_discount || 0) + (finances.monthly_tax || 0);

        const newDiscounts = (Number(currentFinances?.discounts) || 0) + (finances.monthly_discount || 0);
        const newTaxes = (Number(currentFinances?.taxes) || 0) + (finances.monthly_tax || 0);
        const newFinalTotalPrice = (Number(currentFinances?.final_total_price) || 0) + monthlyPayment;

        await supabase
          .from("member_program_finances")
          .update({
            discounts: newDiscounts,
            taxes: newTaxes,
            final_total_price: newFinalTotalPrice,
          })
          .eq("member_program_id", programId);

        console.log(`[MONTHLY BILLING] Program ${programId}: Updated finances`);

        const paymentAmount = monthlyPayment;

        const { data: pendingStatus } = await supabase
          .from("payment_status")
          .select("payment_status_id")
          .ilike("payment_status_name", "pending")
          .single();

        const { error: paymentError } = await supabase
          .from("member_program_payments")
          .insert({
            member_program_id: programId,
            payment_amount: paymentAmount,
            payment_due_date: membership.next_billing_date,
            payment_status_id: pendingStatus?.payment_status_id || 1,
            notes: `Month ${newPeriod} membership payment`,
          });

        if (paymentError) {
          throw new Error(`Failed to create payment: ${paymentError.message}`);
        }

        console.log(`[MONTHLY BILLING] Program ${programId}: Created payment of $${paymentAmount} due ${membership.next_billing_date}`);
        jobRun.total_payments_created! += paymentAmount;

        const nextBillingDate = new Date(membership.next_billing_date);
        nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);
        const nextBillingDateStr = nextBillingDate.toISOString().split("T")[0];

        await supabase
          .from("member_programs")
          .update({ next_billing_date: nextBillingDateStr })
          .eq("member_program_id", programId);

        console.log(`[MONTHLY BILLING] Program ${programId}: Updated next_billing_date to ${nextBillingDateStr}`);

        const { data: scheduleResult, error: scheduleError } = await supabase
          .rpc("generate_member_program_schedule", { 
            p_program_id: programId,
            p_recent_minutes: 30
          });

        if (scheduleError) {
          console.error(`[MONTHLY BILLING] Program ${programId}: Failed to generate schedule:`, scheduleError);
        } else {
          console.log(`[MONTHLY BILLING] Program ${programId}: Schedule generated:`, scheduleResult);
        }

        jobRun.memberships_processed!++;
        console.log(`[MONTHLY BILLING] Program ${programId}: Successfully processed`);

      } catch (error: any) {
        console.error(`[MONTHLY BILLING] Program ${programId}: Error - ${error.message}`);
        jobRun.memberships_failed!++;
        jobRun.errors!.push({
          program_id: programId,
          error: error.message,
        });
      }
    }

    const duration = Date.now() - startTime;
    const finalStatus = jobRun.memberships_failed! > 0
      ? (jobRun.memberships_processed! > 0 ? "partial_success" : "failed")
      : "success";

    await supabase
      .from("cron_job_runs")
      .update({
        completed_at: new Date().toISOString(),
        status: finalStatus,
        memberships_found: jobRun.memberships_found,
        memberships_processed: jobRun.memberships_processed,
        memberships_skipped: jobRun.memberships_skipped,
        memberships_failed: jobRun.memberships_failed,
        total_payments_created: jobRun.total_payments_created,
        total_items_created: jobRun.total_items_created,
        errors: jobRun.errors!.length > 0 ? jobRun.errors : null,
        duration_ms: duration,
      })
      .eq("run_id", jobRun.run_id);

    console.log(`[MONTHLY BILLING] Job completed in ${duration}ms - Status: ${finalStatus}`);
    console.log(`[MONTHLY BILLING] Summary: Found=${jobRun.memberships_found}, Processed=${jobRun.memberships_processed}, Skipped=${jobRun.memberships_skipped}, Failed=${jobRun.memberships_failed}`);

    return new Response(
      JSON.stringify({
        success: true,
        run_id: jobRun.run_id,
        status: finalStatus,
        summary: {
          memberships_found: jobRun.memberships_found,
          memberships_processed: jobRun.memberships_processed,
          memberships_skipped: jobRun.memberships_skipped,
          memberships_failed: jobRun.memberships_failed,
          total_payments_created: jobRun.total_payments_created,
          total_items_created: jobRun.total_items_created,
        },
        duration_ms: duration,
        errors: jobRun.errors!.length > 0 ? jobRun.errors : undefined,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );

  } catch (error: any) {
    console.error("[MONTHLY BILLING] Fatal error:", error);

    if (jobRun.run_id) {
      await supabase
        .from("cron_job_runs")
        .update({
          completed_at: new Date().toISOString(),
          status: "failed",
          errors: [{ program_id: 0, error: error.message }],
          duration_ms: Date.now() - startTime,
        })
        .eq("run_id", jobRun.run_id);
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        run_id: jobRun.run_id,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});

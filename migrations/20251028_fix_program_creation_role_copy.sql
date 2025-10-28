-- Fix create_member_program_from_template to copy program_role_id from therapies and therapy_tasks
-- This ensures items and tasks get the correct role when programs are created

CREATE OR REPLACE FUNCTION public.create_member_program_from_template(
    p_lead_id INTEGER, 
    p_template_ids INTEGER[], 
    p_program_name TEXT, 
    p_description TEXT, 
    p_start_date DATE DEFAULT CURRENT_DATE
)
RETURNS INTEGER
LANGUAGE plpgsql
AS $function$
DECLARE
    new_member_program_id INTEGER;
    template_item RECORD;
    therapy_task RECORD;
    rasha_item RECORD;
    new_member_program_item_id INTEGER;
    calculated_margin NUMERIC(5,2);
    total_program_cost NUMERIC(9,2) := 0;
    total_program_charge NUMERIC(9,2) := 0;
    therapy_aggregate RECORD;
    calculated_taxes NUMERIC(10,2) := 0.00;
    item_tax NUMERIC(10,2);
    final_total_price NUMERIC(10,2);
BEGIN
    -- Calculate aggregated costs and charges from all templates
    SELECT 
        SUM(total_cost) as total_cost,
        SUM(total_charge) as total_charge
    INTO total_program_cost, total_program_charge
    FROM program_template 
    WHERE program_template_id = ANY(p_template_ids);
    
    -- Create the member program with user-provided name and description
    INSERT INTO member_programs (
        lead_id, program_template_name, description, start_date,
        total_cost, total_charge, source_template_id, program_status_id
    )
    VALUES (
        p_lead_id, 
        p_program_name,
        p_description,
        p_start_date,
        total_program_cost, 
        total_program_charge, 
        p_template_ids[1],
        1
    )
    RETURNING member_program_id INTO new_member_program_id;
    
    -- Calculate initial margin from aggregated data
    SELECT 
        CASE 
            WHEN total_program_charge > 0 THEN ((total_program_charge - total_program_cost) / total_program_charge) * 100
            ELSE 0
        END
    INTO calculated_margin;
    
    -- Copy RASHA items from template(s)
    FOR rasha_item IN 
        SELECT 
            ptr.rasha_list_id,
            ptr.group_name,
            ptr.type,
            ptr.order_number,
            ptr.active_flag
        FROM program_template_rasha ptr
        WHERE ptr.program_template_id = ANY(p_template_ids)
        AND ptr.active_flag = TRUE
        ORDER BY ptr.order_number
    LOOP
        INSERT INTO member_program_rasha (
            member_program_id,
            rasha_list_id,
            group_name,
            type,
            order_number,
            active_flag
        ) VALUES (
            new_member_program_id,
            rasha_item.rasha_list_id,
            rasha_item.group_name,
            rasha_item.type,
            rasha_item.order_number,
            rasha_item.active_flag
        );
    END LOOP;
    
    -- Aggregate items from templates and JOIN therapies to get program_role_id
    FOR therapy_aggregate IN 
        SELECT 
            therapy_id,
            SUM(quantity) as total_quantity,
            MAX(item_cost) as item_cost,
            MAX(item_charge) as item_charge,
            MIN(days_from_start) as min_days_from_start,
            AVG(days_between) as avg_days_between,
            (array_agg(instructions ORDER BY program_template_items_id DESC))[1] as last_instructions,
            therapy_role_id  -- CRITICAL: Get role from therapy
        FROM (
            SELECT 
                pti.program_template_items_id, 
                pti.therapy_id, 
                pti.quantity, 
                t.cost as item_cost, 
                t.charge as item_charge,
                pti.days_from_start, 
                pti.days_between, 
                pti.instructions,
                t.program_role_id as therapy_role_id  -- CRITICAL: Include role
            FROM program_template_items pti
            JOIN therapies t ON pti.therapy_id = t.therapy_id
            WHERE pti.program_template_id = ANY(p_template_ids)
            AND pti.active_flag = TRUE
        ) aggregated_items
        GROUP BY therapy_id, therapy_role_id  -- CRITICAL: Group by role too
    LOOP
        -- Insert the aggregated member program item with program_role_id
        INSERT INTO member_program_items (
            member_program_id, 
            therapy_id, 
            quantity,
            item_cost, 
            item_charge, 
            days_from_start, 
            days_between, 
            instructions,
            program_role_id  -- CRITICAL: Include role column
        ) VALUES (
            new_member_program_id, 
            therapy_aggregate.therapy_id, 
            therapy_aggregate.total_quantity,
            therapy_aggregate.item_cost, 
            therapy_aggregate.item_charge, 
            therapy_aggregate.min_days_from_start, 
            therapy_aggregate.avg_days_between, 
            therapy_aggregate.last_instructions,
            therapy_aggregate.therapy_role_id  -- CRITICAL: Copy role from therapy
        ) RETURNING member_program_item_id INTO new_member_program_item_id;
        
        -- Copy therapy tasks for this therapy to member program item tasks
        FOR therapy_task IN 
            SELECT tt.*
            FROM therapy_tasks tt
            WHERE tt.therapy_id = therapy_aggregate.therapy_id
            AND tt.active_flag = TRUE
        LOOP
            INSERT INTO member_program_item_tasks (
                member_program_item_id, 
                task_id, 
                task_name, 
                description, 
                task_delay, 
                completed_flag, 
                program_role_id,  -- CRITICAL: Include role column
                created_by, 
                updated_by
            ) VALUES (
                new_member_program_item_id, 
                therapy_task.task_id, 
                therapy_task.task_name, 
                therapy_task.description, 
                therapy_task.task_delay, 
                FALSE,
                therapy_task.program_role_id,  -- CRITICAL: Copy role from therapy_task
                auth.uid(), 
                auth.uid()
            );
        END LOOP;
    END LOOP;
    
    -- Calculate taxes separately after items are created
    SELECT COALESCE(SUM(
        CASE 
            WHEN t.taxable = true THEN mpi.item_charge * mpi.quantity * 0.0825
            ELSE 0
        END
    ), 0)
    INTO calculated_taxes
    FROM member_program_items mpi
    JOIN therapies t ON mpi.therapy_id = t.therapy_id
    WHERE mpi.member_program_id = new_member_program_id;
    
    -- Calculate final total price including taxes
    final_total_price := total_program_charge + calculated_taxes;
    
    -- Create initial finances record with calculated margin and taxes
    INSERT INTO member_program_finances (
        member_program_id,
        finance_charges,
        taxes,
        discounts,
        final_total_price,
        margin,
        financing_type_id
    ) VALUES (
        new_member_program_id,
        0.00,
        calculated_taxes,
        0.00,
        final_total_price,
        calculated_margin,
        NULL
    );
    
    RETURN new_member_program_id;
END;
$function$;

COMMENT ON FUNCTION create_member_program_from_template IS 'Creates member program from template(s) and correctly copies program_role_id from therapies and therapy_tasks';


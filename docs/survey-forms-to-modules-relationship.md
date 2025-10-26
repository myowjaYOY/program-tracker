# Survey Forms to Modules Relationship

## Overview
The relationship between **Survey Forms** (`survey_forms`) and **Modules** (`survey_modules`) is **many-to-many** and is captured **implicitly** through the `survey_session_program_context` table.

## Database Architecture

### No Direct Junction Table
- There is **NO** explicit `survey_module_forms` or `survey_form_modules` junction table
- The relationship is established **at runtime** when members complete surveys
- Each survey completion session is linked to both a form AND a module via `survey_session_program_context`

### How It Works

```
survey_forms (What survey?)
    ↓ form_id
survey_response_sessions (Who took what survey when?)
    ↓ session_id
survey_session_program_context (In which module context?)
    ↓ module_id
survey_modules (Which curriculum module?)
```

### Key Tables

#### 1. `survey_forms` - Global Survey Definitions
- Contains survey form definitions (e.g., "MSQ", "PROMIS-29 Survey", "Week 1 Progress Report")
- **NOT tied** to specific modules
- Reusable across multiple modules

#### 2. `survey_modules` - Curriculum Structure
- Contains module definitions (e.g., "MODULE 1 - PRE-PROGRAM", "MODULE 2 - WEEK 1")
- Tied to specific programs (`program_id`)
- Represents the educational curriculum sequence

#### 3. `survey_session_program_context` - The Bridge
- Links each survey completion (`session_id`) to a specific module (`module_id`)
- Establishes the **contextual relationship** at the time of survey completion
- One-to-one with `survey_response_sessions`

## The Form-to-Module Mapping (4 Month AIP Program)

Based on actual member data, here is the **standard pattern**:

### MODULE 1 - PRE-PROGRAM
- **Initial Program Report** (51 members took it)
- **MSQ** (51 members) - ✅ Assessment #1
- **PROMIS-29 Survey** (48 members) - ✅ Assessment #1
- **Goals & Whys** (47 members)

### MODULE 2 - WEEK 1
- **Week 1 Progress Report** (47 members)

### MODULE 3 - WEEK 2
- **Week 2 Progress Report** (47 members)

### MODULE 4 - START OF DETOX
- **Start of Detox Progress Report** (47 members)

### MODULE 5 - WEEK 4
- **Week 4 Progress Report** (45 members)

### MODULE 6 - MID-DETOX
- **Start of Detox Progress Report** (44 members) - 2nd instance
- **MSQ** (44 members) - ✅ Assessment #2
- **PROMIS-29 Survey** (44 members) - ✅ Assessment #2

### MODULE 7 - END OF DETOX
- **End of Detox Progress Report** (40 members)
- **Initial Results Survey** (40 members)

### MODULE 8 - END OF MONTH 2
- **Module 8 Progress Report** (40 members)

### MODULE 9 - START OF MONTH 3
- **Module 9 Progress Report** (38 members)
- **MSQ** (38 members) - ✅ Assessment #3
- **PROMIS-29 Survey** (38 members) - ✅ Assessment #3

### MODULE 10 - MID-MONTH 3
- **Module 10 Progress Report** (35 members)
- **Mid-Program Results Survey** (35 members)

### MODULE 11 - END OF MONTH 3
- **Module 11 Progress Report** (35 members)

### MODULE 12 - START OF MONTH 4
- **Module 12 Progress Report** (31 members)

### MODULE 13 - MID-MONTH 4
- **Final Results Survey** (26 members)
- **MSQ** (24 members) - ✅ Assessment #4
- **PROMIS-29 Survey** (24 members) - ✅ Assessment #4

## Key Insights

### 1. Assessment Points (MSQ + PROMIS-29)
These two forms are taken together at 4 key milestones:
- Module 1: Baseline (PRE-PROGRAM)
- Module 6: Mid-Detox (END OF MONTH 1)
- Module 9: Start of Month 3
- Module 13: Final (MID-MONTH 4)

### 2. Progress Reports
- Most modules have their own specific progress report form
- The naming convention usually matches: "Week X Progress Report" or "Module X Progress Report"

### 3. Special Forms
- **Start of Detox Progress Report**: Taken TWICE (Module 4 and Module 6)
- **Goals & Whys**: Only at the beginning (Module 1)
- **Initial Results Survey**: End of detox phase (Module 7)
- **Mid-Program Results Survey**: Mid-program checkpoint (Module 10)
- **Final Results Survey**: Program completion (Module 13)

### 4. Completion Rate Drop-off
- Module 1: ~51 members
- Module 6: ~44 members (86% retention)
- Module 9: ~38 members (75% retention)
- Module 13: ~24 members (47% retention)

## Why This Design?

### Advantages:
1. **Flexibility**: Same form can be used in multiple modules (e.g., MSQ taken 4 times)
2. **Dynamic**: Relationship is established when member completes survey, not pre-defined
3. **Contextual**: Each survey response is tied to the specific module context it was completed in
4. **Reusability**: Forms are global definitions, not duplicated per module

### Implications for Reporting:
1. **Query Pattern**: Always JOIN through `survey_session_program_context` to get module context
2. **No Predefined Curriculum**: The "curriculum" (which forms in which modules) emerges from actual usage
3. **Data-Driven**: The mapping is discovered through analysis, not defined in a schema

## Where to Capture This?

### Option 1: Keep As-Is (Recommended)
- **Current State**: Implicit relationship through session context
- **Pros**: Flexible, reflects reality, no schema changes needed
- **Cons**: Must query to discover the pattern
- **Best For**: When curriculum is still evolving

### Option 2: Create Formal Junction Table
- **New Table**: `survey_module_forms` (module_id, form_id, is_required, display_order)
- **Pros**: Explicit curriculum definition, can validate at intake
- **Cons**: Adds complexity, may not match actual usage
- **Best For**: When curriculum is stable and needs enforcement

### Option 3: Documentation Only (Current Approach)
- **Document**: This file captures the discovered pattern
- **Pros**: Zero schema changes, easy to update as patterns change
- **Cons**: Only as accurate as last analysis
- **Best For**: Current phase - document what is, not what should be

## Recommendation

**Document and Query**: 
- Keep the flexible implicit relationship
- Document the discovered pattern here
- Use queries to validate the pattern over time
- Update documentation as patterns evolve
- Consider formal junction table only if curriculum becomes rigid and requires enforcement

## Last Updated
October 26, 2025 - Based on analysis of 51 members in "4 Month AIP Program" (program_id: 2)


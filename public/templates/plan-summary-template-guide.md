# Plan Summary Template Creation Guide

## Overview
The Plan Summary Template generates a document that organizes program items by therapy type (Diagnostics, Evaluation, Services, Supplements) as shown in your reference image.

## Template Setup Steps

### 1. Create Your Word Document
Create a new Word document with the following structure:

```
PLAN SUMMARY

Member: [MEMBER_NAME]
Program: [PROGRAM_NAME]
Description: [PROGRAM_DESCRIPTION]
Start Date: [PROGRAM_START_DATE]
Duration: [PROGRAM_DURATION]

Generated: [GENERATED_DATE]

+++FOR therapyType IN therapyTypes+++
+++INS $therapyType.name+++

+++FOR item IN $therapyType.items+++
• +++INS $item.name+++: +++INS $item.quantity+++
+++END-FOR item+++

+++END-FOR therapyType+++
```

### 2. Add Bookmarks for Simple Data
In Microsoft Word, add these bookmarks:

1. **Select the text** `[MEMBER_NAME]` and add bookmark: `MEMBER_NAME`
2. **Select the text** `[PROGRAM_NAME]` and add bookmark: `PROGRAM_NAME`
3. **Select the text** `[PROGRAM_DESCRIPTION]` and add bookmark: `PROGRAM_DESCRIPTION`
4. **Select the text** `[PROGRAM_START_DATE]` and add bookmark: `PROGRAM_START_DATE`
5. **Select the text** `[PROGRAM_DURATION]` and add bookmark: `PROGRAM_DURATION`
6. **Select the text** `[GENERATED_DATE]` and add bookmark: `GENERATED_DATE`

### 3. Loop Syntax for Grouped Items
The template uses `docx-templates` syntax with `+++` delimiters:

**CRITICAL: Make sure your template has EXACTLY this structure:**

```
+++FOR therapyType IN therapyTypes+++
+++INS $therapyType.name+++

+++FOR item IN $therapyType.items+++
• +++INS $item.name+++: +++INS $item.quantity+++
+++END-FOR item+++

+++END-FOR therapyType+++
```

**Important Notes:**
- Every `+++FOR` MUST have a matching `+++END-FOR`
- Use the exact variable names: `therapyType` and `item`
- No extra spaces or characters in the commands
- The `+++END-FOR therapyType+++` at the end is CRITICAL

### 4. Formatting Tips
- Use bullet points (•) or dashes (-) for item lists
- Apply consistent font formatting
- Consider using tables for better alignment
- The system will apply font size 12 to all replaced content

### 5. Save the Template
Save your document as: `Plan-Summary-Template.docx` in the `/public/templates/` directory

## Example Output Structure

Your template will generate documents like this:

```
PLAN SUMMARY

Member: John Smith
Program: THRIVE Wellness Program
Description: Comprehensive wellness program
Start Date: 1/15/2024
Duration: 30 days

Generated: 1/10/2024

Diagnostics
• Thrive Program Labs: 2
• THRIVE Wellness Labs: 1
• HeartQuest Scan: 2
• OligoScan: 2
• Acugraph Scan: 2
• Bio-Well Scan: 2
• THRIVE Eat 144 Allergy Test: 1

Evaluation
• Thrive Onboarding 1: 1
• Thrive Onboarding 2: 1
• THRIVE Program ReCap and Maintenance Plan: 1
• THRIVE Custom TX Plan: 1
• Thrive Onboarding 3: 1
• THRIVE Provider Check-in and Lab: 1

Services
• Initial Nutritional Visit with Initial Supplements: 1
• THRIVE Program Member Graduate: 1
• Miscellaneous Fee: 1
• Cupping: 2
• THRIVE Custom TX Plan Nutritional Visit: 1
• THRIVE Genius Insight Scan Home Therapy Set Up: 1
• Food Sensitivity Test Review and Maintenance Supplement Visit: 1
• Tuning Forks 60 mins: 3
• Energetic Osteopathy: 3
• Acupuncture 60 mins: 8
• Specialized Body Treatment (60 Minute): 3
• THRIVE Experience Review: 1

Supplements
• Core Restore - 7 days: 1
```

## Data Structure
The system provides data in this format:

```javascript
{
  therapyTypes: [
    {
      name: "Diagnostics",
      items: [
        { name: "Thrive Program Labs", quantity: 2 },
        { name: "HeartQuest Scan", quantity: 2 }
      ]
    },
    {
      name: "Services", 
      items: [
        { name: "Initial Nutritional Visit", quantity: 1 },
        { name: "Acupuncture 60 mins", quantity: 8 }
      ]
    }
  ]
}
```

## Testing
1. Create your template following the steps above
2. Save as `Plan-Summary-Template.docx` in `/public/templates/`
3. Go to Programs page
4. Select a program
5. Click the "Plan Summary" button
6. Your formatted document will be generated and downloaded!

## Troubleshooting

### Common Issues and Solutions:

**1. "Unterminated FOR-loop" Error:**
- ✅ **Fix**: Make sure you have `+++END-FOR therapyType+++` at the very end of your template
- ✅ **Check**: Every `+++FOR` must have a matching `+++END-FOR`

**2. Template Takes Too Long or Fails:**
- ✅ **Fix**: Simplify your template structure
- ✅ **Check**: Make sure there are no extra characters or spaces in the loop commands
- ✅ **Try**: Use the exact syntax provided above

**3. Bookmark Issues:**
- ✅ **Fix**: Ensure bookmark names match exactly (case-sensitive)
- ✅ **Check**: Don't include brackets in bookmark names
- ✅ **Verify**: Bookmarks are properly placed around the text to replace

**4. Loop Syntax Issues:**
- ✅ **Use**: `+++` delimiters for loop syntax (not `{{}}` or `$$`)
- ✅ **Check**: Variable names must match exactly: `therapyType` and `item`
- ✅ **Verify**: No extra spaces in the commands

**5. File Issues:**
- ✅ **Check**: Template file is saved as `.docx` format
- ✅ **Verify**: File is in the correct `/public/templates/` directory
- ✅ **Name**: File must be named `Plan-Summary-Template.docx`

### Simple Test Template:
If you're still having issues, try this minimal template first:

```
PLAN SUMMARY

Member: [MEMBER_NAME]
Program: [PROGRAM_NAME]
Date: [GENERATED_DATE]

+++FOR therapyType IN therapyTypes+++
+++INS $therapyType.name+++

+++FOR item IN $therapyType.items+++
- +++INS $item.name+++: +++INS $item.quantity+++
+++END-FOR item+++

+++END-FOR therapyType+++
```

This minimal version should work and help you identify any remaining issues.

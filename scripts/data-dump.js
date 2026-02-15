// Diagnostic script to dump actual report card data structure
// Usage: node scripts/dump-report-data.js [leadId]

const fs = require('fs');
const path = require('path');

// Read env
const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');

const supabaseUrl = envContent.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)?.[1]?.trim();
const serviceKey = envContent.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/)?.[1]?.trim();

if (!supabaseUrl || !serviceKey) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
    process.exit(1);
}

const leadId = process.argv[2] || 89;

async function query(table, select, filters = {}) {
    let url = `${supabaseUrl}/rest/v1/${table}?select=${encodeURIComponent(select)}`;

    for (const [key, value] of Object.entries(filters)) {
        url += `&${key}=${encodeURIComponent(value)}`;
    }

    const res = await fetch(url, {
        headers: {
            'apikey': serviceKey,
            'Authorization': `Bearer ${serviceKey}`,
        },
    });

    return res.json();
}

async function main() {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`REPORT CARD DATA DUMP - Lead ID: ${leadId}`);
    console.log(`${'='.repeat(60)}\n`);

    // 1. Member info
    console.log('1. MEMBER INFO (leads table)');
    console.log('-'.repeat(40));
    const leads = await query('leads', '*', { lead_id: `eq.${leadId}` });
    console.log(JSON.stringify(leads[0] || {}, null, 2));

    // 2. Member Progress Summary
    console.log('\n2. MEMBER PROGRESS SUMMARY');
    console.log('-'.repeat(40));
    const progress = await query('member_progress_summary', '*', { lead_id: `eq.${leadId}` });
    console.log(JSON.stringify(progress[0] || {}, null, 2));

    // 3. Survey Response Sessions (to find external_user_id mapping)
    console.log('\n3. SURVEY SESSIONS (first 3)');
    console.log('-'.repeat(40));
    const sessions = await query(
        'survey_response_sessions',
        'session_id,external_user_id,lead_id,form_id,completed_on',
        { lead_id: `eq.${leadId}`, limit: '3', order: 'completed_on.desc' }
    );
    console.log(JSON.stringify(sessions, null, 2));

    const externalUserId = sessions[0]?.external_user_id;

    if (externalUserId) {
        // 4. Survey Domain Scores (MSQ)
        console.log('\n4. MSQ DOMAIN SCORES (survey_domain_scores)');
        console.log('-'.repeat(40));
        const msqScores = await query(
            'survey_domain_scores',
            '*',
            {
                external_user_id: `eq.${externalUserId}`,
                survey_type: 'eq.msq',
                limit: '15',
                order: 'created_at.desc'
            }
        );
        console.log(JSON.stringify(msqScores.slice(0, 5), null, 2));
        console.log(`... (${msqScores.length} total MSQ domain records)`);

        // 5. Survey Domain Scores (PROMIS)
        console.log('\n5. PROMIS DOMAIN SCORES (survey_domain_scores)');
        console.log('-'.repeat(40));
        const promisScores = await query(
            'survey_domain_scores',
            '*',
            {
                external_user_id: `eq.${externalUserId}`,
                survey_type: 'eq.promis',
                limit: '15',
                order: 'created_at.desc'
            }
        );
        console.log(JSON.stringify(promisScores.slice(0, 5), null, 2));
        console.log(`... (${promisScores.length} total PROMIS domain records)`);
    }

    // 6. Member Goals (if exists)
    console.log('\n6. MEMBER GOALS (member_goals table, if exists)');
    console.log('-'.repeat(40));
    try {
        const goals = await query('member_goals', '*', { lead_id: `eq.${leadId}` });
        console.log(JSON.stringify(goals, null, 2));
    } catch (e) {
        console.log('Table may not exist or error:', e.message);
    }

    // 7. Check what fetchReportCardData actually returns
    console.log('\n7. API RESPONSE (via /api/report-card/export-pdf data fetch)');
    console.log('-'.repeat(40));
    console.log('Call the endpoint manually to see the transformed data:');
    console.log(`curl http://localhost:3000/api/member-progress/${leadId}/dashboard`);

    // Output summary
    console.log('\n' + '='.repeat(60));
    console.log('SUMMARY');
    console.log('='.repeat(60));
    console.log(`Lead ID: ${leadId}`);
    console.log(`External User ID: ${externalUserId || 'NOT FOUND'}`);
    console.log(`Has Progress Summary: ${progress.length > 0}`);
    console.log(`Survey Sessions: ${sessions.length}`);

    // Write full dump to file for reference
    const dumpFile = path.join(__dirname, `report-data-dump-${leadId}.json`);
    const fullDump = {
        leadId,
        member: leads[0],
        progressSummary: progress[0],
        sessions,
        externalUserId,
    };
    fs.writeFileSync(dumpFile, JSON.stringify(fullDump, null, 2));
    console.log(`\nFull dump written to: ${dumpFile}`);
}

main().catch(console.error);
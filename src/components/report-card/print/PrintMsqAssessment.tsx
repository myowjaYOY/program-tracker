'use client';

import React from 'react';
import { Box, Typography, Grid } from '@mui/material';
import { printStyles } from './print-styles';
import PrintIcon from './PrintIcon';

interface PrintMsqAssessmentProps {
    data: any;
    isFirstSection?: boolean;
}

export default function PrintMsqAssessment({ data, isFirstSection = false }: PrintMsqAssessmentProps) {
    const summary = data?.summary || {};
    const domains = data?.domains || [];

    const getSeverityLevel = (score: number) => {
        if (score <= 10) return { level: 'Optimal', color: '#10b981', bgColor: '#f0fdf4' };
        if (score <= 30) return { level: 'Mild', color: '#84cc16', bgColor: '#f7fee7' };
        if (score <= 60) return { level: 'Moderate', color: '#f59e0b', bgColor: '#fffbeb' };
        if (score <= 100) return { level: 'Severe', color: '#ef4444', bgColor: '#fef2f2' };
        return { level: 'Very Severe', color: '#991b1b', bgColor: '#fef2f2' };
    };

    const getDomainSeverityColor = (severity: string) => {
        switch (severity?.toLowerCase()) {
            case 'minimal': return '#10b981';
            case 'mild': return '#f59e0b';
            case 'moderate': return '#ef4444';
            case 'severe': return '#991b1b';
            default: return '#9ca3af';
        }
    };

    const getTrendInfo = (trend: string) => {
        switch (trend) {
            case 'improving': return { symbol: '', color: '#10b981', label: 'Improving' };
            case 'declining': return { symbol: '', color: '#ef4444', label: 'Worsening' };
            default: return { symbol: '', color: '#6b7280', label: 'Stable' };
        }
    };

    const totalScore = summary.all_total_scores?.[summary.all_total_scores.length - 1] || 0;
    const currentLevel = getSeverityLevel(totalScore);
    const trendInfo = getTrendInfo(summary.total_score_trend);

    // Find top problem area
    const topDomain = domains.reduce((max: any, d: any) =>
        d.average_score > (max?.average_score || 0) ? d : max, null);

    return (
        <Box sx={{ width: '100%', mb: 4, ...(isFirstSection ? {} : printStyles.pageBreakBefore) }}>
            <Typography variant="h6" sx={printStyles.sectionTitle}>
                MSQ Clinical Assessment
            </Typography>

            {/* Profile Card */}
            <Box sx={{
                mb: 3,
                p: 2.5,
                background: `linear-gradient(135deg, ${currentLevel.bgColor} 0%, #ffffff 100%)`,
                borderLeft: `4px solid ${currentLevel.color}`,
                borderRadius: '8px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            }}>
                <Grid container spacing={2}>
                    <Grid size={{ xs: 3 }}>
                        <Typography sx={printStyles.cardLabel}>
                            <PrintIcon type="ui" name="stats" size={14} sx={{ mr: 0.5 }} /> CURRENT SCORE
                        </Typography>
                        <Typography sx={{ ...printStyles.cardValue, color: currentLevel.color }}>{Math.round(totalScore)}</Typography>
                        <Typography sx={{ color: currentLevel.color, fontWeight: 600, fontSize: '13px', mt: 0.5 }}>
                            {currentLevel.level}
                        </Typography>
                    </Grid>
                    <Grid size={{ xs: 3 }}>
                        <Typography sx={printStyles.cardLabel}>
                            <PrintIcon type="ui" name="trending" size={14} sx={{ mr: 0.5 }} /> TREND
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
                            <Typography sx={{ fontSize: '32px', fontWeight: 700, color: trendInfo.color, lineHeight: 1 }}>
                                {trendInfo.symbol}
                            </Typography>
                            <Typography sx={{ fontSize: '13px', fontWeight: 600, color: trendInfo.color }}>
                                {trendInfo.label}
                            </Typography>
                        </Box>
                    </Grid>
                    <Grid size={{ xs: 3 }}>
                        <Typography sx={printStyles.cardLabel}>
                            <PrintIcon type="ui" name="search" size={14} sx={{ mr: 0.5 }} /> TOP PROBLEM AREA
                        </Typography>
                        {topDomain ? (
                            <>
                                <Typography sx={{ fontSize: '18px', fontWeight: 600, color: '#1a1a1a', display: 'flex', alignItems: 'center', mb: 0.5 }}>
                                    <PrintIcon type="msq" name={topDomain.domain_key} size={16} sx={{ mr: 0.5 }} /> {topDomain.domain_label}
                                </Typography>
                                <Typography sx={{ fontSize: '13px', color: getDomainSeverityColor(topDomain.severity), fontWeight: 600 }}>
                                    Score: {topDomain.average_score.toFixed(1)}
                                </Typography>
                            </>
                        ) : (
                            <Typography sx={{ color: '#999' }}>No significant issues</Typography>
                        )}
                    </Grid>
                    <Grid size={{ xs: 3 }}>
                        <Typography sx={printStyles.cardLabel}>
                            <PrintIcon type="ui" name="calendar" size={14} sx={{ mr: 0.5 }} /> ASSESSMENT HISTORY
                        </Typography>
                        <Box sx={{ fontSize: '11px', color: '#666' }}>
                            {summary.all_total_scores?.slice(-4).reverse().map((score: number, idx: number) => (
                                <Box key={idx} sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.2 }}>
                                    <span style={{ fontWeight: 700, color: '#1a1a1a' }}>{Math.round(score)}</span>
                                    <span>{new Date(summary.assessment_dates?.slice(-4).reverse()[idx]).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })}</span>
                                </Box>
                            ))}
                        </Box>
                    </Grid>
                </Grid>
            </Box>

            {/* Body Systems Analysis Grid */}
            <Typography variant="subtitle1" sx={{ fontWeight: 700, fontSize: '18px', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                <PrintIcon type="ui" name="hospital" size={18} /> Body Systems Analysis
            </Typography>
            <Grid container spacing={2} sx={{ mb: 4 }}>
                {domains.map((domain: any) => (
                    <Grid size={{ xs: 4 }} key={domain.domain_key}>
                        <Box sx={{
                            ...printStyles.card,
                            p: 1.5,
                            borderTop: `3px solid ${getDomainSeverityColor(domain.severity)}`,
                            boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                        }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                    <PrintIcon type="msq" name={domain.domain_key} size={16} />
                                    <Typography sx={{ fontSize: '12px', fontWeight: 700, color: '#1a1a1a' }}>{domain.domain_label}</Typography>
                                </Box>
                                <Typography sx={{ fontSize: '20px', color: getTrendInfo(domain.trend).color, fontWeight: 700, lineHeight: 1 }}>
                                    {getTrendInfo(domain.trend).symbol}
                                </Typography>
                            </Box>

                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                <Box sx={{ bgcolor: getDomainSeverityColor(domain.severity), color: 'white', px: 1, borderRadius: 1, fontSize: '11px', fontWeight: 700 }}>
                                    {domain.average_score.toFixed(1)}
                                </Box>
                                <Typography sx={{ fontSize: '11px', color: getDomainSeverityColor(domain.severity), fontWeight: 600, textTransform: 'capitalize' }}>
                                    {domain.severity}
                                </Typography>
                            </Box>

                            {domain.symptoms && domain.symptoms.length > 0 && (
                                <Box sx={{ fontSize: '10px', color: '#666', borderTop: '1px solid #f3f4f6', pt: 1 }}>
                                    {domain.symptoms.slice(0, 3).map((sym: any, i: number) => (
                                        <Box key={i} sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '80%' }}>{sym.question_text}</span>
                                            <span style={{ fontWeight: 600 }}>{sym.recent_score}</span>
                                        </Box>
                                    ))}
                                </Box>
                            )}
                        </Box>
                    </Grid>
                ))}
            </Grid>

            {/* MSQ Interpretation Guide */}
            <Box sx={{ pageBreakInside: 'avoid' }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, fontSize: '18px', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <PrintIcon type="ui" name="book" size={18} /> MSQ Interpretation Guide
                </Typography>
                <Grid container spacing={2}>
                    <Grid size={{ xs: 6 }}>
                        <Box sx={printStyles.card}>
                            <Typography sx={{ ...printStyles.cardLabel, mb: 1 }}>Score Interpretation</Typography>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                                <tbody>
                                    <tr style={{ borderBottom: '1px solid #f3f4f6' }}>
                                        <td style={{ padding: '6px 0', verticalAlign: 'top' }}>
                                            <div style={{ fontWeight: 700, color: '#10b981' }}>0-10 Points</div>
                                            <div style={{ color: '#666' }}>Optimal health, minimal symptoms</div>
                                        </td>
                                    </tr>
                                    <tr style={{ borderBottom: '1px solid #f3f4f6' }}>
                                        <td style={{ padding: '6px 0', verticalAlign: 'top' }}>
                                            <div style={{ fontWeight: 700, color: '#84cc16' }}>11-30 Points</div>
                                            <div style={{ color: '#666' }}>Mild burden, monitor trends</div>
                                        </td>
                                    </tr>
                                    <tr style={{ borderBottom: '1px solid #f3f4f6' }}>
                                        <td style={{ padding: '6px 0', verticalAlign: 'top' }}>
                                            <div style={{ fontWeight: 700, color: '#f59e0b' }}>31-60 Points</div>
                                            <div style={{ color: '#666' }}>Moderate burden, intervention recommended</div>
                                        </td>
                                    </tr>
                                    <tr style={{ borderBottom: '1px solid #f3f4f6' }}>
                                        <td style={{ padding: '6px 0', verticalAlign: 'top' }}>
                                            <div style={{ fontWeight: 700, color: '#ef4444' }}>61-100 Points</div>
                                            <div style={{ color: '#666' }}>Severe symptoms, immediate attention needed</div>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style={{ padding: '6px 0', verticalAlign: 'top' }}>
                                            <div style={{ fontWeight: 700, color: '#991b1b' }}>100+ Points</div>
                                            <div style={{ color: '#666' }}>Extreme symptom burden, high clinical priority</div>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </Box>
                    </Grid>
                    <Grid size={{ xs: 6 }}>
                        <Box sx={printStyles.card}>
                            <Typography sx={{ ...printStyles.cardLabel, mb: 1 }}>Clinical Significance</Typography>
                            <Box sx={{ fontSize: '11px', color: '#666' }}>
                                <Box sx={{ p: 1.5, borderRadius: '8px', border: '1px solid #e9d5ff', bgcolor: '#fdfaff' }}>
                                    <div style={{ fontWeight: 700, color: '#8e24ff', marginBottom: '8px', fontSize: '12px' }}>Clinical Significance:</div>
                                    <div style={{ fontSize: '10.5px', color: '#4b5563', lineHeight: 1.5 }}>
                                        <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                                            <span style={{ color: '#8e24ff', fontWeight: 700 }}>[!] Clinical Note:</span>
                                            <span>Changes of ≥10 points are considered clinically significant. Re-assess every 4-8 weeks to track protocol effectiveness.</span>
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', backgroundColor: 'rgba(255,255,255,0.5)', padding: '8px', borderRadius: '4px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#ef4444' }}></div>
                                                <span><b>Worsening</b>: Symptoms intensifying, plan adjustment needed</span>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#6b7280' }}></div>
                                                <span><b>Stable</b>: Symptoms maintained, continue current protocol</span>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#10b981' }}></div>
                                                <span><b>Improving</b>: Symptoms reducing, protocol is effective</span>
                                            </div>
                                        </div>
                                    </div>
                                </Box>
                            </Box>
                        </Box>
                    </Grid>
                </Grid>
            </Box>
        </Box>
    );
}

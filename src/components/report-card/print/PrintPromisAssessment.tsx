'use client';

import React from 'react';
import { Box, Typography, Grid } from '@mui/material';
import { printStyles } from './print-styles';
import PrintIcon from './PrintIcon';

interface PrintPromisAssessmentProps {
    data: any;
    isFirstSection?: boolean;
}

export default function PrintPromisAssessment({ data, isFirstSection = false }: PrintPromisAssessmentProps) {
    const summary = data?.summary || {};
    const domains = data?.domains || [];

    const getSeverityLevel = (score: number) => {
        if (score >= 45 && score <= 55) return { level: 'Normal', color: '#10b981', bgColor: '#f0fdf4' };
        if (score < 45 || score < 60) return { level: 'Mild', color: '#f59e0b', bgColor: '#fffbeb' };
        if (score < 65) return { level: 'Moderate', color: '#ef4444', bgColor: '#fef2f2' };
        return { level: 'Severe', color: '#dc2626', bgColor: '#fef2f2' };
    };

    const getDomainSeverityColor = (severity: string) => {
        const s = severity?.toLowerCase() || '';
        if (s.includes('normal')) return '#10b981';
        if (s.includes('mild')) return '#f59e0b';
        if (s.includes('moderate')) return '#ef4444';
        if (s.includes('severe')) return '#dc2626';
        if (s.includes('very_severe')) return '#991b1b';
        return '#9ca3af';
    };

    const getTrendInfo = (trend: string) => {
        switch (trend) {
            case 'improving': return { symbol: '', color: '#10b981', label: 'Improving' };
            case 'worsening':
            case 'declining': return { symbol: '', color: '#ef4444', label: 'Worsening' };
            default: return { symbol: '', color: '#6b7280', label: 'Stable' };
        }
    };

    const currentMeanTScore = summary.current_mean_t_score || 50;
    const currentLevel = getSeverityLevel(currentMeanTScore);
    const trendInfo = getTrendInfo(summary.total_score_trend);

    // Find top concern
    const topDomain = domains.reduce((max: any, d: any) => {
        const isFun = ['physical_function', 'social_roles'].includes(d.domain_key);
        if (!max) return d;

        // For symptoms, higher is worse. For function, lower is worse.
        const score = d.current_score || 0;
        const maxScore = max.current_score || 0;

        if (isFun) return score < maxScore ? d : max;
        return score > maxScore ? d : max;
    }, null);

    return (
        <Box sx={{ width: '100%', mb: 4, ...(isFirstSection ? {} : printStyles.pageBreakBefore) }}>
            <Typography variant="h6" sx={printStyles.sectionTitle}>
                PROMIS-29 Health Assessment
            </Typography>

            {/* Dashboard Header Card */}
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
                            <PrintIcon type="ui" name="stats" size={14} sx={{ mr: 0.5 }} /> MEAN T-SCORE
                        </Typography>
                        <Typography sx={{ ...printStyles.cardValue, color: currentLevel.color }}>{currentMeanTScore.toFixed(1)}</Typography>
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
                            <PrintIcon type="ui" name="search" size={14} sx={{ mr: 0.5 }} /> TOP CONCERN
                        </Typography>
                        {topDomain ? (
                            <>
                                <Typography sx={{ fontSize: '18px', fontWeight: 600, color: '#1a1a1a', display: 'flex', alignItems: 'center', mb: 0.5 }}>
                                    <PrintIcon type="promis" name={topDomain.domain_key} size={16} sx={{ mr: 0.5 }} /> {topDomain.domain_label}
                                </Typography>
                                <Typography sx={{ fontSize: '13px', color: getDomainSeverityColor(topDomain.severity), fontWeight: 600 }}>
                                    {topDomain.domain_key === 'pain_intensity' ? `Score: ${topDomain.current_score}/10` : `T-Score: ${topDomain.current_score.toFixed(0)}`}
                                </Typography>
                            </>
                        ) : (
                            <Typography sx={{ color: '#999' }}>All domains normal</Typography>
                        )}
                    </Grid>
                    <Grid size={{ xs: 3 }}>
                        <Typography sx={printStyles.cardLabel}>
                            <PrintIcon type="ui" name="calendar" size={14} sx={{ mr: 0.5 }} /> ASSESSMENT HISTORY
                        </Typography>
                        <Box sx={{ fontSize: '11px', color: '#666' }}>
                            {summary.all_mean_t_scores?.slice(-4).reverse().map((score: number, idx: number) => (
                                <Box key={idx} sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.2 }}>
                                    <span style={{ fontWeight: 700, color: '#1a1a1a' }}>{score.toFixed(1)}</span>
                                    <span>{new Date(summary.assessment_dates?.slice(-4).reverse()[idx]).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })}</span>
                                </Box>
                            ))}
                        </Box>
                    </Grid>
                </Grid>
            </Box>

            {/* Domain Breakdown Grid */}
            <Typography variant="subtitle1" sx={{ fontWeight: 700, fontSize: '18px', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                <PrintIcon type="ui" name="hospital" size={18} /> Health Domains Analysis
            </Typography>
            <Grid container spacing={2} sx={{ mb: 4 }}>
                {domains.map((domain: any) => (
                    <Grid size={{ xs: 4 }} key={domain.domain_key}>
                        <Box sx={{
                            ...printStyles.card,
                            p: 1.5,
                            borderLeft: `4px solid ${getDomainSeverityColor(domain.severity)}`,
                            boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                        }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                    <PrintIcon type="promis" name={domain.domain_key} size={16} />
                                    <Typography sx={{ fontSize: '12px', fontWeight: 700, color: '#1a1a1a' }}>{domain.domain_label}</Typography>
                                </Box>
                                <Typography sx={{ fontSize: '20px', color: getTrendInfo(domain.trend).color, fontWeight: 700, lineHeight: 1 }}>
                                    {getTrendInfo(domain.trend).symbol}
                                </Typography>
                            </Box>

                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Typography sx={{
                                    fontSize: '24px',
                                    fontWeight: 700,
                                    color: '#1a1a1a',
                                    lineHeight: 1
                                }}>
                                    {domain.domain_key === 'pain_intensity' ? domain.current_score.toFixed(0) : domain.current_score.toFixed(0)}
                                    <span style={{ fontSize: '12px', color: '#666', fontWeight: 500, marginLeft: '4px' }}>
                                        {domain.domain_key === 'pain_intensity' ? '/10' : 'T-Score'}
                                    </span>
                                </Typography>
                                <Box sx={{
                                    bgcolor: `${getDomainSeverityColor(domain.severity)}20`,
                                    color: getDomainSeverityColor(domain.severity),
                                    px: 1,
                                    py: 0.2,
                                    borderRadius: 1,
                                    fontSize: '10px',
                                    fontWeight: 700,
                                    textTransform: 'uppercase'
                                }}>
                                    {domain.severity.replace(/_/g, ' ')}
                                </Box>
                            </Box>

                            {['physical_function', 'social_roles'].includes(domain.domain_key) && (
                                <Typography sx={{ fontSize: '9px', color: '#666', fontStyle: 'italic', mt: 0.5 }}>
                                    Higher is better function
                                </Typography>
                            )}
                        </Box>
                    </Grid>
                ))}
            </Grid>

            {/* PROMIS Interpretation Guide */}
            <Box sx={{ pageBreakInside: 'avoid' }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, fontSize: '18px', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <PrintIcon type="ui" name="book" size={18} /> PROMIS Interpretation Guide
                </Typography>
                <Grid container spacing={2}>
                    <Grid size={{ xs: 6 }}>
                        <Box sx={printStyles.card}>
                            <Typography sx={{ ...printStyles.cardLabel, mb: 1 }}>T-Score Interpretation</Typography>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                                <tbody>
                                    <tr style={{ borderBottom: '1px solid #f3f4f6' }}>
                                        <td style={{ padding: '6px 0', verticalAlign: 'top' }}>
                                            <div style={{ fontWeight: 700, color: '#10b981' }}>&lt; 45 Points</div>
                                            <div style={{ color: '#666' }}>Normal limits for symptom domains</div>
                                        </td>
                                    </tr>
                                    <tr style={{ borderBottom: '1px solid #f3f4f6' }}>
                                        <td style={{ padding: '6px 0', verticalAlign: 'top' }}>
                                            <div style={{ fontWeight: 700, color: '#f59e0b' }}>45-54 Points</div>
                                            <div style={{ color: '#666' }}>Mild symptoms / functional limitation</div>
                                        </td>
                                    </tr>
                                    <tr style={{ borderBottom: '1px solid #f3f4f6' }}>
                                        <td style={{ padding: '6px 0', verticalAlign: 'top' }}>
                                            <div style={{ fontWeight: 700, color: '#ef4444' }}>55-64 Points</div>
                                            <div style={{ color: '#666' }}>Moderate symptoms / functional limitation</div>
                                        </td>
                                    </tr>
                                    <tr style={{ borderBottom: '1px solid #f3f4f6' }}>
                                        <td style={{ padding: '6px 0', verticalAlign: 'top' }}>
                                            <div style={{ fontWeight: 700, color: '#dc2626' }}>65-74 Points</div>
                                            <div style={{ color: '#666' }}>Severe symptoms / functional limitation</div>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style={{ padding: '6px 0', verticalAlign: 'top' }}>
                                            <div style={{ fontWeight: 700, color: '#991b1b' }}>75+ Points</div>
                                            <div style={{ color: '#666' }}>Very severe symptoms / functional limitation</div>
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
                                            <span style={{ color: '#8e24ff', fontWeight: 700 }}>[!] T-Scores:</span>
                                            <span>Standardized metrics where 50 is the US population average. A change of ≥5 points is clinically meaningful.</span>
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', backgroundColor: 'rgba(255,255,255,0.5)', padding: '8px', borderRadius: '4px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#8b5cf6' }}></div>
                                                <span><b>Function Domains</b>: Higher score = better function</span>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#ec4899' }}></div>
                                                <span><b>Symptom Domains</b>: Lower score = fewer symptoms</span>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#06b6d4' }}></div>
                                                <span><b>Pain Intensity</b>: 0–10 raw scale (not standardized)</span>
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

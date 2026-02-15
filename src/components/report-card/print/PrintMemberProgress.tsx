'use client';

import React from 'react';
import { Box, Typography, Grid } from '@mui/material';
import { printStyles } from './print-styles';
import PrintIcon from './PrintIcon';

interface PrintMemberProgressProps {
    data: any;
}

export default function PrintMemberProgress({ data }: PrintMemberProgressProps) {
    const safeValue = (val: any, fallback = 'N/A') => val ?? fallback;
    const safePercent = (val: any) => val != null ? `${Math.round(val)}%` : '0%';

    const extractModuleNumber = (moduleName: string): string => {
        const match = moduleName.match(/MODULE\s+(\d+)/i);
        return match ? `M${match[1]}` : 'M?';
    };

    const extractModuleDescription = (moduleName: string): string => {
        const parts = moduleName.split('-');
        let description = moduleName;
        if (parts.length > 1) {
            description = parts.slice(1).join('-').trim();
        }
        return description.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    };

    const getStatusConfig = (indicator: string) => {
        switch (indicator) {
            case 'green':
                return { color: '#10b981', bgColor: '#f0fdf4', label: 'On Track', icon: 'checkmark' };
            case 'yellow':
                return { color: '#f59e0b', bgColor: '#fffbeb', label: 'Needs Monitoring', icon: 'warning' };
            case 'red':
                return { color: '#ef4444', bgColor: '#fef2f2', label: 'Needs Attention', icon: 'warning' };
            default:
                return { color: '#6b7280', bgColor: '#f9fafb', label: 'No Data', icon: 'stats' };
        }
    };

    const status = getStatusConfig(data?.status_indicator);

    const getTrendInfo = (trend: string) => {
        switch (trend) {
            case 'improving': return { color: '#10b981', symbol: '' };
            case 'declining': return { color: '#ef4444', symbol: '' };
            default: return { color: '#6b7280', symbol: '' };
        }
    };

    const vitals = [
        { label: 'ENERGY', score: data?.energy_score, trend: data?.energy_trend, color: '#f59e0b', icon: 'energy' },
        { label: 'MOOD', score: data?.mood_score, trend: data?.mood_trend, color: '#8b5cf6', icon: 'mood' },
        { label: 'MOTIVATION', score: data?.motivation_score, trend: data?.motivation_trend, color: '#06b6d4', icon: 'motivation' },
        { label: 'WELLBEING', score: data?.wellbeing_score, trend: data?.wellbeing_trend, color: '#ec4899', icon: 'wellbeing' },
        { label: 'SLEEP QUALITY', score: data?.sleep_score, trend: data?.sleep_trend, color: '#6366f1', icon: 'sleep' },
    ];

    const compliance = [
        { label: 'NUTRITION', value: data?.nutrition_compliance_pct, color: '#84cc16', icon: 'nutrition' },
        { label: 'SUPPLEMENTS', value: data?.supplements_compliance_pct, color: '#8b5cf6', icon: 'supplements' },
        { label: 'EXERCISE', value: data?.exercise_compliance_pct, color: '#06b6d4', icon: 'exercise' },
        { label: 'MEDITATION', value: data?.meditation_compliance_pct, color: '#a855f7', icon: 'meditation' },
    ];

    const goals = data?.goals || [];
    const moduleSequence = data?.module_sequence || [];
    const completedMilestones = data?.completed_milestones || [];
    const overdueMilestones = data?.overdue_milestones || [];
    const nextMilestone = data?.next_milestone;

    return (
        <Box sx={{ width: '100%', mb: 4 }}>
            <Typography variant="h6" sx={{ ...printStyles.sectionTitle, mt: 0 }}>
                Member Progress Dashboard
            </Typography>

            {/* Profile Information Card - High Fidelity Gradient */}
            <Box sx={{
                mb: 3,
                p: 2.5,
                background: `linear-gradient(135deg, ${status.bgColor} 0%, #ffffff 100%)`,
                borderLeft: `4px solid ${status.color}`,
                borderRadius: '8px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            }}>
                <Grid container spacing={2}>
                    <Grid size={{ xs: 3 }}>
                        <Typography sx={printStyles.cardLabel}>
                            <PrintIcon type="ui" name="stats" size={14} sx={{ mr: 0.5 }} /> CURRENT SCORE
                        </Typography>
                        <Typography sx={{ ...printStyles.cardValue, color: status.color, fontSize: '36px' }}>
                            {safeValue(data?.status_score, '0')}
                        </Typography>
                        <Typography sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5, color: status.color, fontWeight: 600, fontSize: '13px' }}>
                            <PrintIcon type="ui" name={status.icon} size={16} /> {status.label}
                        </Typography>
                    </Grid>
                    <Grid size={{ xs: 3 }}>
                        <Typography sx={printStyles.cardLabel}>
                            <PrintIcon type="ui" name="timer" size={14} sx={{ mr: 0.5 }} /> DAYS IN PROGRAM
                        </Typography>
                        <Typography sx={printStyles.cardValue}>{safeValue(data?.days_in_program, '0')}</Typography>
                    </Grid>
                    <Grid size={{ xs: 3 }}>
                        <Typography sx={printStyles.cardLabel}>
                            <PrintIcon type="ui" name="surveys" size={14} sx={{ mr: 0.5 }} /> SURVEYS COMPLETED
                        </Typography>
                        <Typography sx={printStyles.cardValue}>{safeValue(data?.total_surveys_completed, '0')}</Typography>
                    </Grid>
                    <Grid size={{ xs: 3 }}>
                        <Typography sx={printStyles.cardLabel}>
                            <PrintIcon type="ui" name="scale" size={14} sx={{ mr: 0.5 }} /> WEIGHT CHANGE
                        </Typography>
                        {data?.weight_change !== null ? (
                            <>
                                <Typography sx={{
                                    ...printStyles.cardValue,
                                    color: data?.weight_change < 0 ? '#10b981' : data?.weight_change > 0 ? '#ef4444' : '#6b7280'
                                }}>
                                    {data?.weight_change > 0 ? '+' : ''}{data?.weight_change} lbs
                                </Typography>
                                <Typography variant="caption" sx={{ color: '#666' }}>
                                    Current: {data?.current_weight || 'N/A'} lbs
                                </Typography>
                            </>
                        ) : (
                            <Typography sx={{ fontSize: '16px', color: '#999' }}>No data</Typography>
                        )}
                    </Grid>
                </Grid>
            </Box>

            {/* Health Vitals Table Style */}
            <Typography variant="subtitle1" sx={{ fontWeight: 700, fontSize: '18px', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                <PrintIcon type="ui" name="hospital" size={18} /> Health Vitals
            </Typography>
            <Grid container spacing={0} sx={{ mb: 4 }}>
                {vitals.map((vital, idx) => (
                    <Grid size={{ xs: 2.4 }} key={vital.label}>
                        <Box sx={{
                            ...printStyles.card,
                            p: 2,
                            borderBottom: `3px solid ${vital.color}`,
                            background: `linear-gradient(180deg, ${vital.color}08 0%, #ffffff 100%)`,
                            borderRadius: idx === 0 ? '8px 0 0 8px' : idx === vitals.length - 1 ? '0 8px 8px 0' : '0',
                            borderRight: idx === vitals.length - 1 ? '1px solid #e5e7eb' : 'none',
                        }}>
                            <Typography sx={{
                                fontSize: '12px',
                                fontWeight: 600,
                                color: vital.color,
                                display: 'flex',
                                alignItems: 'center',
                                mb: 1,
                                gap: 0.5
                            }}>
                                <PrintIcon type="ui" name={vital.icon} size={14} color={vital.color} /> {vital.label}
                            </Typography>
                            <Typography sx={{ ...printStyles.cardValue, fontSize: '32px', color: vital.color }}>
                                {safeValue(vital.score, 'N/A')}
                            </Typography>
                            <Typography sx={{
                                fontSize: '11px',
                                fontWeight: 700,
                                color: getTrendInfo(vital.trend).color,
                                mt: 0.5
                            }}>
                                {getTrendInfo(vital.trend).symbol} {vital.trend || 'N/A'}
                            </Typography>
                        </Box>
                    </Grid>
                ))}
            </Grid>

            {/* Protocol Compliance */}
            <Typography variant="subtitle1" sx={{ fontWeight: 700, fontSize: '18px', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                <PrintIcon type="ui" name="checkmark" size={18} /> Protocol Compliance
            </Typography>
            <Grid container spacing={0} sx={{ mb: 4 }}>
                {compliance.map((item, idx) => (
                    <Grid size={{ xs: 3 }} key={item.label}>
                        <Box sx={{
                            ...printStyles.card,
                            p: 2,
                            borderRadius: idx === 0 ? '8px 0 0 8px' : idx === compliance.length - 1 ? '0 8px 8px 0' : '0',
                            borderRight: idx === compliance.length - 1 ? '1px solid #e5e7eb' : 'none',
                        }}>
                            <Typography sx={{
                                fontSize: '12px',
                                fontWeight: 600,
                                color: '#666',
                                display: 'flex',
                                alignItems: 'center',
                                mb: 1,
                                gap: 0.5
                            }}>
                                <PrintIcon type="ui" name={item.icon} size={14} color={item.color} /> {item.label}
                            </Typography>
                            <Typography sx={{
                                ...printStyles.cardValue,
                                fontSize: '32px',
                                color: (item.value || 0) >= 80 ? '#10b981' : (item.value || 0) >= 60 ? '#f59e0b' : '#ef4444'
                            }}>
                                {safePercent(item.value)}
                            </Typography>
                            <Box sx={{ height: 6, bgcolor: '#e5e7eb', borderRadius: 3, mt: 1, overflow: 'hidden' }}>
                                <Box sx={{
                                    height: '100%',
                                    width: `${item.value || 0}%`,
                                    bgcolor: (item.value || 0) >= 80 ? '#10b981' : (item.value || 0) >= 60 ? '#f59e0b' : '#ef4444'
                                }} />
                            </Box>
                        </Box>
                    </Grid>
                ))}
            </Grid>

            {/* Curriculum Progress & Goals Section */}
            <Grid container spacing={4} sx={{ pageBreakInside: 'avoid' }}>
                <Grid size={{ xs: 7 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700, fontSize: '18px', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                        <PrintIcon type="ui" name="timer" size={18} /> Curriculum Progress
                    </Typography>
                    <Box sx={{ ...printStyles.card, p: 2 }}>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
                            {moduleSequence.map((mod: string, idx: number) => {
                                const isCompleted = completedMilestones.includes(mod);
                                const isOverdue = overdueMilestones.includes(mod);
                                const isNext = nextMilestone === mod;

                                let statusColor = '#e0e0e0';
                                if (isCompleted) statusColor = '#10b981';
                                else if (isOverdue) statusColor = '#ef4444';
                                else if (isNext) statusColor = '#3b82f6';

                                return (
                                    <Box key={idx} sx={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        width: '45px'
                                    }}>
                                        <Box sx={{
                                            width: 30,
                                            height: 30,
                                            borderRadius: '50%',
                                            bgcolor: isCompleted ? statusColor : 'white',
                                            border: `2px solid ${statusColor}`,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            color: isCompleted ? 'white' : statusColor,
                                            fontWeight: 700,
                                            fontSize: '10px',
                                            mb: 0.5
                                        }}>
                                            {extractModuleNumber(mod)}
                                        </Box>
                                        <Typography sx={{
                                            fontSize: '8px',
                                            color: '#666',
                                            textAlign: 'center',
                                            lineHeight: 1.1,
                                            fontWeight: (isCompleted || isOverdue || isNext) ? 700 : 400
                                        }}>
                                            {extractModuleDescription(mod)}
                                        </Typography>
                                    </Box>
                                );
                            })}
                        </Box>
                        <Box sx={{ mt: 2, display: 'flex', gap: 2, borderTop: '1px solid #f3f4f6', pt: 1.5 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#10b981' }} />
                                <Typography sx={{ fontSize: '10px', color: '#666' }}>Completed</Typography>
                            </Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#3b82f6' }} />
                                <Typography sx={{ fontSize: '10px', color: '#666' }}>Up Next</Typography>
                            </Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#ef4444' }} />
                                <Typography sx={{ fontSize: '10px', color: '#666' }}>Overdue</Typography>
                            </Box>
                        </Box>
                    </Box>
                </Grid>

                <Grid size={{ xs: 5 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700, fontSize: '18px', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                        <PrintIcon type="ui" name="goals" size={18} /> Goals & Progress
                    </Typography>
                    <Box sx={{ ...printStyles.card, p: 2 }}>
                        {goals.length > 0 ? (
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                                {goals.slice(0, 4).map((goal: any, idx: number) => {
                                    const statusColors: any = {
                                        win: { color: '#10b981', bgColor: '#10b98115', label: 'Achieved' },
                                        on_track: { color: '#10b981', bgColor: '#10b98115', label: 'On Track' },
                                        at_risk: { color: '#ef4444', bgColor: '#ef444415', label: 'At Risk' },
                                        insufficient_data: { color: '#6b7280', bgColor: '#6b728015', label: 'N/A' },
                                    };
                                    const config = statusColors[goal.status] || statusColors.insufficient_data;

                                    return (
                                        <Box key={idx} sx={{
                                            display: 'flex',
                                            gap: 1.5,
                                            alignItems: 'flex-start',
                                            p: 1,
                                            borderRadius: 1,
                                            bgcolor: config.bgColor
                                        }}>
                                            <Box sx={{
                                                width: 8,
                                                height: 8,
                                                borderRadius: '50%',
                                                bgcolor: config.color,
                                                mt: 0.7,
                                                flexShrink: 0
                                            }} />
                                            <Box>
                                                <Typography sx={{ fontSize: '12px', fontWeight: 600, color: '#1a1a1a', lineHeight: 1.3 }}>
                                                    {goal.goal_text}
                                                </Typography>
                                                <Typography sx={{ fontSize: '10px', color: config.color, fontWeight: 700, textTransform: 'uppercase' }}>
                                                    {config.label}
                                                </Typography>
                                            </Box>
                                        </Box>
                                    );
                                })}
                            </Box>
                        ) : (
                            <Typography sx={{ color: '#999', fontSize: '12px', fontStyle: 'italic' }}>
                                No goals recorded for this period.
                            </Typography>
                        )}
                    </Box>
                </Grid>
            </Grid>
        </Box>
    );
}

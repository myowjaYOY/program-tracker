/**
 * Report Card PDF Document
 * 
 * Uses @react-pdf/renderer to generate PDFs directly from React components.
 * Replaces the Puppeteer-based HTML-to-PDF approach.
 * 
 * Benefits:
 * - No Chrome/Chromium dependency
 * - Works natively in Vercel serverless
 * - Faster generation (~500ms vs ~3-5s)
 * - Smaller bundle size
 */

import React from 'react';
import {
    Document,
    Page,
    Text,
    View,
    StyleSheet,
} from '@react-pdf/renderer';

// Note: Using built-in Helvetica font (default in @react-pdf/renderer)
// Custom Google Fonts require .ttf files, not woff2 URLs

// Color palette matching the app theme
const colors = {
    primary: '#8e24ff',
    primaryLight: '#e9d5ff',
    primaryDark: '#5a0ea4',
    success: '#10b981',
    successLight: '#d1fae5',
    warning: '#f59e0b',
    warningLight: '#fef3c7',
    error: '#ef4444',
    errorLight: '#fee2e2',
    gray: {
        50: '#f9fafb',
        100: '#f3f4f6',
        200: '#e5e7eb',
        300: '#d1d5db',
        400: '#9ca3af',
        500: '#6b7280',
        600: '#4b5563',
        700: '#374151',
        800: '#1f2937',
        900: '#111827',
    },
};

// Reusable styles
const styles = StyleSheet.create({
    page: {
        padding: 40,
        fontFamily: 'Helvetica',
        fontSize: 10,
        color: colors.gray[800],
        backgroundColor: '#ffffff',
    },
    // Header
    header: {
        backgroundColor: colors.primary,
        padding: 20,
        marginBottom: 24,
        marginHorizontal: -40,
        marginTop: -40,
        paddingHorizontal: 40,
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: 700,
        color: '#ffffff',
        marginBottom: 4,
    },
    headerSubtitle: {
        fontSize: 14,
        color: colors.primaryLight,
        fontWeight: 600,
    },
    headerDate: {
        fontSize: 10,
        color: colors.primaryLight,
        marginTop: 8,
    },
    // Section
    section: {
        marginBottom: 20,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: 700,
        color: colors.primary,
        borderBottomWidth: 2,
        borderBottomColor: colors.primary,
        paddingBottom: 8,
        marginBottom: 16,
    },
    // Cards
    card: {
        backgroundColor: colors.gray[50],
        borderRadius: 6,
        padding: 12,
        marginBottom: 12,
    },
    cardWithBorder: {
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: colors.gray[200],
        borderRadius: 6,
        padding: 12,
        marginBottom: 12,
    },
    // Grid layouts
    row: {
        flexDirection: 'row',
        marginBottom: 8,
    },
    col2: {
        width: '50%',
        paddingRight: 8,
    },
    col3: {
        width: '33.33%',
        paddingRight: 8,
    },
    col4: {
        width: '25%',
        paddingRight: 8,
    },
    // Typography
    label: {
        fontSize: 9,
        color: colors.gray[500],
        marginBottom: 2,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    value: {
        fontSize: 12,
        fontWeight: 600,
        color: colors.gray[800],
    },
    valueLarge: {
        fontSize: 20,
        fontWeight: 700,
        color: colors.primary,
    },
    bodyText: {
        fontSize: 10,
        color: colors.gray[600],
        lineHeight: 1.5,
    },
    // Status indicators
    statusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
        fontSize: 9,
        fontWeight: 600,
    },
    statusGreen: {
        backgroundColor: colors.successLight,
        color: colors.success,
    },
    statusYellow: {
        backgroundColor: colors.warningLight,
        color: colors.warning,
    },
    statusRed: {
        backgroundColor: colors.errorLight,
        color: colors.error,
    },
    // Progress bar
    progressBarContainer: {
        height: 8,
        backgroundColor: colors.gray[200],
        borderRadius: 4,
        overflow: 'hidden',
    },
    progressBarFill: {
        height: '100%',
        borderRadius: 4,
    },
    // Table
    table: {
        marginTop: 8,
    },
    tableHeader: {
        flexDirection: 'row',
        backgroundColor: colors.gray[100],
        borderBottomWidth: 1,
        borderBottomColor: colors.gray[300],
        paddingVertical: 8,
        paddingHorizontal: 8,
    },
    tableHeaderCell: {
        fontSize: 9,
        fontWeight: 600,
        color: colors.gray[600],
        textTransform: 'uppercase',
    },
    tableRow: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: colors.gray[200],
        paddingVertical: 8,
        paddingHorizontal: 8,
    },
    tableCell: {
        fontSize: 10,
        color: colors.gray[700],
    },
    // Footer
    footer: {
        position: 'absolute',
        bottom: 30,
        left: 40,
        right: 40,
        textAlign: 'center',
        fontSize: 8,
        color: colors.gray[400],
        borderTopWidth: 1,
        borderTopColor: colors.gray[200],
        paddingTop: 10,
    },
    // Utility
    mb4: { marginBottom: 4 },
    mb8: { marginBottom: 8 },
    mb12: { marginBottom: 12 },
    mb16: { marginBottom: 16 },
    mt8: { marginTop: 8 },
    mt16: { marginTop: 16 },
    textCenter: { textAlign: 'center' },
    textRight: { textAlign: 'right' },
    fontBold: { fontWeight: 700 },
});

// ============================================================================
// Helper Components
// ============================================================================

interface MetricBoxProps {
    label: string;
    value: string | number;
    subValue?: string;
    color?: string;
}

const MetricBox: React.FC<MetricBoxProps> = ({ label, value, subValue, color }) => (
    <View style={styles.card}>
        <Text style={styles.label}>{label}</Text>
        <Text style={[styles.valueLarge, color ? { color } : {}]}>{value}</Text>
        {subValue && <Text style={[styles.bodyText, styles.mt8]}>{subValue}</Text>}
    </View>
);

interface ProgressBarProps {
    value: number;
    max?: number;
    color?: string;
    showLabel?: boolean;
}

const ProgressBar: React.FC<ProgressBarProps> = ({
    value,
    max = 100,
    color = colors.primary,
    showLabel = true
}) => {
    const percentage = Math.min(Math.max((value / max) * 100, 0), 100);
    return (
        <View>
            {showLabel && (
                <Text style={[styles.bodyText, styles.mb4, styles.textRight]}>
                    {Math.round(percentage)}%
                </Text>
            )}
            <View style={styles.progressBarContainer}>
                <View
                    style={[
                        styles.progressBarFill,
                        { width: `${percentage}%`, backgroundColor: color }
                    ]}
                />
            </View>
        </View>
    );
};

interface StatusBadgeProps {
    status: 'green' | 'yellow' | 'red' | string;
    label: string;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status, label }) => {
    const statusStyle =
        status === 'green' ? styles.statusGreen :
            status === 'yellow' ? styles.statusYellow :
                styles.statusRed;

    return (
        <View style={[styles.statusBadge, statusStyle]}>
            <Text>{label}</Text>
        </View>
    );
};

// ============================================================================
// Section Components
// ============================================================================

interface MemberProgressSectionProps {
    data: any;
    memberName: string;
}

const MemberProgressSection: React.FC<MemberProgressSectionProps> = ({ data, memberName }) => {
    const getStatusColor = (status: string) => {
        if (status === 'green') return colors.success;
        if (status === 'yellow') return colors.warning;
        return colors.error;
    };

    const getComplianceColor = (pct: number | null | undefined) => {
        if (pct === null || pct === undefined) return colors.gray[400];
        if (pct >= 80) return colors.success;
        if (pct >= 60) return colors.warning;
        return colors.error;
    };

    const getTrendSymbol = (trend: string | null | undefined) => {
        if (!trend) return '→';
        if (trend === 'improving') return '↑';
        if (trend === 'declining') return '↓';
        return '→';
    };

    const getTrendColor = (trend: string | null | undefined) => {
        if (!trend) return colors.gray[500];
        if (trend === 'improving') return colors.success;
        if (trend === 'declining') return colors.error;
        return colors.gray[500];
    };

    // Calculate overall compliance
    const complianceValues = [
        data.nutrition_compliance_pct,
        data.supplements_compliance_pct,
        data.exercise_compliance_pct,
        data.meditation_compliance_pct,
    ].filter(v => v != null);
    const overallCompliance = complianceValues.length > 0
        ? Math.round(complianceValues.reduce((a, b) => a + b, 0) / complianceValues.length)
        : null;

    return (
        <View style={styles.section}>
            <Text style={styles.sectionTitle}>Member Progress Dashboard</Text>

            {/* Status Overview */}
            <View style={[styles.cardWithBorder, { borderLeftWidth: 4, borderLeftColor: getStatusColor(data.status_indicator || 'gray') }]}>
                <View style={styles.row}>
                    <View style={styles.col3}>
                        <Text style={styles.label}>Member</Text>
                        <Text style={styles.value}>{memberName}</Text>
                    </View>
                    <View style={styles.col3}>
                        <Text style={styles.label}>Days in Program</Text>
                        <Text style={styles.value}>{data.days_in_program ?? 'N/A'}</Text>
                    </View>
                    <View style={styles.col3}>
                        <Text style={styles.label}>Status</Text>
                        <StatusBadge
                            status={data.status_indicator || 'gray'}
                            label={data.status_indicator === 'green' ? 'On Track' : data.status_indicator === 'yellow' ? 'Needs Attention' : 'At Risk'}
                        />
                    </View>
                </View>
                {data.next_milestone && (
                    <View style={[styles.row, styles.mt8]}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.label}>Next Milestone</Text>
                            <Text style={styles.bodyText}>{data.next_milestone}</Text>
                        </View>
                    </View>
                )}
            </View>

            {/* Health Metrics */}
            <View style={styles.row}>
                <View style={styles.col2}>
                    <View style={styles.card}>
                        <Text style={styles.label}>Weight Change</Text>
                        <Text style={[styles.valueLarge, { color: (data.weight_change || 0) < 0 ? colors.success : colors.error }]}>
                            {data.weight_change != null ? `${data.weight_change > 0 ? '+' : ''}${data.weight_change} lbs` : 'N/A'}
                        </Text>
                        {data.current_weight && (
                            <Text style={styles.bodyText}>Current: {data.current_weight} lbs</Text>
                        )}
                    </View>
                </View>
                <View style={styles.col2}>
                    <View style={styles.card}>
                        <Text style={styles.label}>Overall Compliance</Text>
                        <Text style={[styles.valueLarge, { color: getComplianceColor(overallCompliance) }]}>
                            {overallCompliance != null ? `${overallCompliance}%` : 'N/A'}
                        </Text>
                        <View style={styles.mt8}>
                            <ProgressBar
                                value={overallCompliance || 0}
                                color={getComplianceColor(overallCompliance)}
                            />
                        </View>
                    </View>
                </View>
            </View>

            {/* Compliance Breakdown */}
            <View style={styles.card}>
                <Text style={[styles.label, styles.mb8]}>Compliance by Category</Text>
                <View style={styles.row}>
                    {[
                        { label: 'Nutrition', value: data.nutrition_compliance_pct },
                        { label: 'Supplements', value: data.supplements_compliance_pct },
                        { label: 'Exercise', value: data.exercise_compliance_pct },
                        { label: 'Meditation', value: data.meditation_compliance_pct },
                    ].map((item, idx) => (
                        <View key={idx} style={styles.col4}>
                            <Text style={styles.label}>{item.label}</Text>
                            <Text style={[styles.value, { color: getComplianceColor(item.value) }]}>
                                {item.value != null ? `${Math.round(item.value)}%` : 'N/A'}
                            </Text>
                        </View>
                    ))}
                </View>
            </View>

            {/* Health Scores */}
            <View style={styles.card}>
                <Text style={[styles.label, styles.mb8]}>Health Scores (1-5 Scale)</Text>
                <View style={styles.row}>
                    {[
                        { label: 'Energy', score: data.energy_score, trend: data.energy_trend },
                        { label: 'Mood', score: data.mood_score, trend: data.mood_trend },
                        { label: 'Sleep', score: data.sleep_score, trend: data.sleep_trend },
                        { label: 'Wellbeing', score: data.wellbeing_score, trend: data.wellbeing_trend },
                    ].map((item, idx) => (
                        <View key={idx} style={styles.col4}>
                            <Text style={styles.label}>{item.label}</Text>
                            <Text style={styles.value}>
                                {item.score ?? '-'}{' '}
                                <Text style={{ color: getTrendColor(item.trend), fontSize: 10 }}>
                                    {getTrendSymbol(item.trend)}
                                </Text>
                            </Text>
                        </View>
                    ))}
                </View>
            </View>

            {/* Goals Section */}
            {Array.isArray(data.goals) && data.goals.length > 0 && (
                <View style={styles.card}>
                    <Text style={[styles.label, styles.mb8]}>Active Goals</Text>
                    {data.goals.slice(0, 5).map((goal: any, idx: number) => (
                        <View key={idx} style={[styles.row, { alignItems: 'center', borderBottomWidth: idx < data.goals.length - 1 ? 1 : 0, borderBottomColor: colors.gray[200], paddingBottom: 8 }]}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.bodyText}>{goal.goal_text || 'Untitled Goal'}</Text>
                                {goal.progress_summary && (
                                    <Text style={[styles.bodyText, { fontSize: 8, color: colors.gray[500], marginTop: 2 }]}>
                                        {goal.progress_summary}
                                    </Text>
                                )}
                            </View>
                            <StatusBadge
                                status={goal.status === 'on_track' ? 'green' : goal.status === 'achieved' ? 'green' : 'yellow'}
                                label={goal.status === 'on_track' ? 'On Track' : goal.status === 'achieved' ? 'Achieved' : goal.status === 'at_risk' ? 'At Risk' : 'Unknown'}
                            />
                        </View>
                    ))}
                </View>
            )}
        </View>
    );
};

interface MsqAssessmentSectionProps {
    data: any;
    memberName: string;
}

const MsqAssessmentSection: React.FC<MsqAssessmentSectionProps> = ({ data, memberName }) => {
    const summary = data.summary || {};
    const domains = Array.isArray(data.domains) ? data.domains : [];

    const getScoreColor = (score: number) => {
        if (score <= 10) return colors.success;
        if (score <= 30) return colors.warning;
        return colors.error;
    };

    const getClassification = (score: number) => {
        if (score <= 10) return 'Optimal';
        if (score <= 30) return 'Mild';
        if (score <= 50) return 'Moderate';
        if (score <= 70) return 'Severe';
        return 'Very Severe';
    };

    return (
        <View style={styles.section} break>
            <Text style={styles.sectionTitle}>MSQ-95 Health Assessment</Text>

            {/* Summary Card */}
            <View style={styles.row}>
                <View style={styles.col3}>
                    <View style={styles.card}>
                        <Text style={styles.label}>Current Score</Text>
                        <Text style={[styles.valueLarge, { color: getScoreColor(summary?.current_score || 0) }]}>
                            {summary?.current_score ?? 'N/A'}
                        </Text>
                        <Text style={styles.bodyText}>{getClassification(summary?.current_score || 0)}</Text>
                    </View>
                </View>
                <View style={styles.col3}>
                    <View style={styles.card}>
                        <Text style={styles.label}>Baseline Score</Text>
                        <Text style={styles.valueLarge}>{summary?.baseline_score ?? 'N/A'}</Text>
                    </View>
                </View>
                <View style={styles.col3}>
                    <View style={styles.card}>
                        <Text style={styles.label}>Total Improvement</Text>
                        <Text style={[styles.valueLarge, { color: (summary?.total_improvement || 0) > 0 ? colors.success : colors.error }]}>
                            {summary?.total_improvement != null ? `${summary.total_improvement > 0 ? '-' : '+'}${Math.abs(summary.total_improvement)}` : 'N/A'}
                        </Text>
                        <Text style={styles.bodyText}>
                            {summary?.total_improvement > 0 ? 'points reduced' : 'points increased'}
                        </Text>
                    </View>
                </View>
            </View>

            {/* Domain Scores Table */}
            {domains.length > 0 && (
                <View style={styles.cardWithBorder}>
                    <Text style={[styles.label, styles.mb12]}>Domain Breakdown</Text>
                    <View style={styles.table}>
                        <View style={styles.tableHeader}>
                            <Text style={[styles.tableHeaderCell, { width: '35%' }]}>Domain</Text>
                            <Text style={[styles.tableHeaderCell, { width: '20%', textAlign: 'center' }]}>Baseline</Text>
                            <Text style={[styles.tableHeaderCell, { width: '20%', textAlign: 'center' }]}>Current</Text>
                            <Text style={[styles.tableHeaderCell, { width: '25%', textAlign: 'center' }]}>Change</Text>
                        </View>
                        {domains.map((domain: any, idx: number) => (
                            <View key={idx} style={styles.tableRow}>
                                <Text style={[styles.tableCell, { width: '35%' }]}>{domain.domain_name}</Text>
                                <Text style={[styles.tableCell, { width: '20%', textAlign: 'center' }]}>{domain.baseline_score ?? '-'}</Text>
                                <Text style={[styles.tableCell, { width: '20%', textAlign: 'center' }]}>{domain.current_score ?? '-'}</Text>
                                <Text style={[styles.tableCell, { width: '25%', textAlign: 'center', color: (domain.change || 0) < 0 ? colors.success : (domain.change || 0) > 0 ? colors.error : colors.gray[500] }]}>
                                    {domain.change != null ? `${domain.change > 0 ? '+' : ''}${domain.change}` : '-'}
                                </Text>
                            </View>
                        ))}
                    </View>
                </View>
            )}
        </View>
    );
};

interface PromisAssessmentSectionProps {
    data: any;
    memberName: string;
}

const PromisAssessmentSection: React.FC<PromisAssessmentSectionProps> = ({ data, memberName }) => {
    const domains = Array.isArray(data.domains) ? data.domains : [];

    const getScoreInterpretation = (domain: string, score: number) => {
        // For most PROMIS domains, lower is better (except Physical Function & Social Roles)
        const higherIsBetter = ['physical_function', 'social_roles'].includes(domain);
        if (higherIsBetter) {
            if (score >= 55) return { label: 'Above Average', color: colors.success };
            if (score >= 45) return { label: 'Average', color: colors.gray[600] };
            return { label: 'Below Average', color: colors.error };
        } else {
            if (score <= 45) return { label: 'Below Average (Good)', color: colors.success };
            if (score <= 55) return { label: 'Average', color: colors.gray[600] };
            return { label: 'Above Average (Concern)', color: colors.error };
        }
    };

    return (
        <View style={styles.section} break>
            <Text style={styles.sectionTitle}>PROMIS-29 Quality of Life Assessment</Text>

            {domains.length > 0 ? (
                <View style={styles.cardWithBorder}>
                    <Text style={[styles.label, styles.mb12]}>Domain T-Scores (Population Mean = 50)</Text>
                    <View style={styles.table}>
                        <View style={styles.tableHeader}>
                            <Text style={[styles.tableHeaderCell, { width: '30%' }]}>Domain</Text>
                            <Text style={[styles.tableHeaderCell, { width: '15%', textAlign: 'center' }]}>T-Score</Text>
                            <Text style={[styles.tableHeaderCell, { width: '25%', textAlign: 'center' }]}>Interpretation</Text>
                            <Text style={[styles.tableHeaderCell, { width: '30%', textAlign: 'center' }]}>Change</Text>
                        </View>
                        {domains.map((domain: any, idx: number) => {
                            const interpretation = getScoreInterpretation(domain.domain_key || '', domain.current_score || 50);
                            return (
                                <View key={idx} style={styles.tableRow}>
                                    <Text style={[styles.tableCell, { width: '30%' }]}>{domain.domain_name || 'Unknown'}</Text>
                                    <Text style={[styles.tableCell, { width: '15%', textAlign: 'center', fontWeight: 600 }]}>
                                        {domain.current_score?.toFixed(1) ?? '-'}
                                    </Text>
                                    <Text style={[styles.tableCell, { width: '25%', textAlign: 'center', color: interpretation.color }]}>
                                        {interpretation.label}
                                    </Text>
                                    <Text style={[styles.tableCell, { width: '30%', textAlign: 'center' }]}>
                                        {domain.change != null ? `${domain.change > 0 ? '+' : ''}${domain.change.toFixed(1)}` : '-'}
                                    </Text>
                                </View>
                            );
                        })}
                    </View>
                </View>
            ) : (
                <View style={styles.card}>
                    <Text style={styles.bodyText}>No PROMIS domain scores available.</Text>
                </View>
            )}

            <View style={[styles.card, styles.mt16]}>
                <Text style={[styles.label, styles.mb4]}>Understanding T-Scores</Text>
                <Text style={styles.bodyText}>
                    PROMIS T-scores have a mean of 50 and standard deviation of 10. For most domains (anxiety, depression, fatigue, pain),
                    lower scores indicate better health. For Physical Function and Social Roles, higher scores indicate better function.
                </Text>
            </View>
        </View>
    );
};

// ============================================================================
// Main Document Component
// ============================================================================

export interface ReportCardPdfProps {
    memberName: string;
    reportDate: string;
    sections: {
        memberProgress: boolean;
        msqAssessment: boolean;
        promisAssessment: boolean;
    };
    data: {
        memberProgress?: any;
        msqAssessment?: any;
        promisAssessment?: any;
    };
}

const ReportCardPdfDocument: React.FC<ReportCardPdfProps> = ({
    memberName,
    reportDate,
    sections,
    data,
}) => {
    // Guard against null/undefined data
    const safeData = data || {};
    const safeSections = sections || { memberProgress: false, msqAssessment: false, promisAssessment: false };

    const showMemberProgress = safeSections.memberProgress && safeData.memberProgress;
    const showMsqAssessment = safeSections.msqAssessment && safeData.msqAssessment;
    const showPromisAssessment = safeSections.promisAssessment && safeData.promisAssessment;

    // Check if we have any content to show
    const hasContent = showMemberProgress || showMsqAssessment || showPromisAssessment;

    return (
        <Document>
            <Page size="LETTER" style={styles.page}>
                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>Member Report Card</Text>
                    <Text style={styles.headerSubtitle}>{memberName || 'Unknown Member'}</Text>
                    <Text style={styles.headerDate}>Generated: {reportDate || new Date().toLocaleDateString()}</Text>
                </View>

                {/* No data message */}
                {!hasContent && (
                    <View style={styles.card}>
                        <Text style={styles.value}>No report data available for the selected sections.</Text>
                        <Text style={styles.bodyText}>Please ensure the member has completed surveys or has progress data.</Text>
                    </View>
                )}

                {/* Member Progress Section */}
                {showMemberProgress && (
                    <MemberProgressSection data={safeData.memberProgress} memberName={memberName || 'Unknown'} />
                )}

                {/* MSQ Assessment Section */}
                {showMsqAssessment && (
                    <MsqAssessmentSection data={safeData.msqAssessment} memberName={memberName || 'Unknown'} />
                )}

                {/* PROMIS Assessment Section */}
                {showPromisAssessment && (
                    <PromisAssessmentSection data={safeData.promisAssessment} memberName={memberName || 'Unknown'} />
                )}

                {/* Footer */}
                <View style={styles.footer} fixed>
                    <Text>This report contains confidential health information. Handle with appropriate privacy measures.</Text>
                    <Text style={styles.mt8}>© {new Date().getFullYear()} Program Tracker • Powered by Advanced Health Analytics</Text>
                </View>
            </Page>
        </Document>
    );
};

export default ReportCardPdfDocument;
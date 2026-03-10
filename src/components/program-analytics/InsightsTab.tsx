'use client'

import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Alert,
  Button,
  CircularProgress
} from '@mui/material'

import { Theme } from '@mui/material/styles'

import { Refresh } from '@mui/icons-material'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts'

import { useMemo, useState } from 'react'


/* ---------------- TYPES ---------------- */

type PaletteColorKey =
  | 'primary'
  | 'secondary'
  | 'error'
  | 'warning'
  | 'info'
  | 'success'

type SuccessRate = {
  tier: string
  success_rate?: number
  improved?: number
  total?: number
}

type EffectSize = {
  low_compliance_avg?: number
  high_compliance_avg?: number
  effect_size?: number
}

type OddsRatio = {
  odds_ratio?: number
}

type Interpretation = {
  severity: 'success' | 'warning' | 'error' | 'info'
  message: string
}

/* ---------------- HELPERS ---------------- */

function parseMetric<T>(value: any, fallback: T): T {
  if (!value) return fallback
  if (typeof value === 'string') return JSON.parse(value)
  return value
}

/* ---------------- COMPONENTS ---------------- */

function OutcomeAnalysisCard({
  title,
  color,
  effectSize,
  oddsRatio,
  interpretation,
  unit
}: {
  title: string
  color: PaletteColorKey
  effectSize: EffectSize
  oddsRatio: OddsRatio
  interpretation: Interpretation
  unit: string
}) {
  return (
    <>
      <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>
        {title}
      </Typography>

      <Card
        sx={{
          borderTop: (t: Theme) => `4px solid ${t.palette[color].main}`,
          mb: 2
        }}
      >
        <CardContent>

          <Typography variant="subtitle2" fontWeight={600}>
            Effect Size
          </Typography>

          <Box sx={{ display: 'flex', justifyContent: 'space-between', my: 2 }}>

            <Box textAlign="center">
              <Typography variant="caption">Low Compliance</Typography>
              <Typography variant="h5">
                {effectSize.low_compliance_avg ?? 0}
              </Typography>
            </Box>

            <Box textAlign="center">
              <Typography variant="caption">High Compliance</Typography>
              <Typography variant="h5">
                {effectSize.high_compliance_avg ?? 0}
              </Typography>
            </Box>

          </Box>

          <Typography variant="h4" textAlign="center">
            +{effectSize.effect_size ?? 0} {unit}
          </Typography>

        </CardContent>
      </Card>

      <Card>
        <CardContent>

          <Typography variant="h3" textAlign="center">
            {oddsRatio.odds_ratio ? `${oddsRatio.odds_ratio}x` : 'N/A'}
          </Typography>

          <Alert severity={interpretation.severity} sx={{ mt: 2 }}>
            {interpretation.message}
          </Alert>

        </CardContent>
      </Card>
    </>
  )
}

/* ---------------- MAIN COMPONENT ---------------- */

export default function InsightsTab({ metrics }: { metrics: any }) {

  const [isRefreshing, setIsRefreshing] = useState(false)
  const [refreshError, setRefreshError] = useState<string | null>(null)

  if (!metrics) {
    return <Alert severity="info">No analytics data available</Alert>
  }

  /* ---------------- parse metrics ---------------- */

  const msqSuccessRates = parseMetric<SuccessRate[]>(
    metrics.compliance_success_rates,
    []
  )

  const promisSuccessRates = parseMetric<SuccessRate[]>(
    metrics.promis_success_rates,
    []
  )

  const msqEffectSize = parseMetric<EffectSize>(
    metrics.compliance_effect_size,
    {}
  )

  const promisEffectSize = parseMetric<EffectSize>(
    metrics.promis_effect_size,
    {}
  )

  const msqOddsRatio = parseMetric<OddsRatio>(
    metrics.compliance_odds_ratio,
    {}
  )

  const promisOddsRatio = parseMetric<OddsRatio>(
    metrics.promis_odds_ratio,
    {}
  )

  /* ---------------- chart data ---------------- */

  const barChartData = useMemo(() => {
    return msqSuccessRates.map((msq, i) => {

      const promis = promisSuccessRates[i]

      return {
        tier: msq.tier,
        msq: msq.success_rate ?? 0,
        promis: promis?.success_rate ?? 0,
        msqCount: `${msq.improved ?? 0}/${msq.total ?? 0}`,
        promisCount: `${promis?.improved ?? 0}/${promis?.total ?? 0}`
      }

    })
  }, [msqSuccessRates, promisSuccessRates])

  /* ---------------- interpretation ---------------- */

  const interpretOddsRatio = (or: OddsRatio): Interpretation => {

    if (!or.odds_ratio) {
      return { severity: 'info', message: 'Insufficient data' }
    }

    if (or.odds_ratio > 5) {
      return { severity: 'success', message: 'Strong effect' }
    }

    if (or.odds_ratio > 2) {
      return { severity: 'success', message: 'Moderate effect' }
    }

    if (or.odds_ratio > 1) {
      return { severity: 'warning', message: 'Weak effect' }
    }

    return { severity: 'error', message: 'No advantage detected' }

  }

  const msqInterpret = interpretOddsRatio(msqOddsRatio)
  const promisInterpret = interpretOddsRatio(promisOddsRatio)

  /* ---------------- refresh ---------------- */

  const handleRefresh = async () => {

    setIsRefreshing(true)
    setRefreshError(null)

    try {

      const res = await fetch('/api/analytics/refresh', {
        method: 'POST'
      })

      if (!res.ok) throw new Error('Failed to refresh analytics')

      window.location.reload()

    } catch (err: any) {

      setRefreshError(err.message)

    } finally {

      setIsRefreshing(false)

    }

  }

  /* ---------------- UI ---------------- */

  return (
    <Box>

      <Box display="flex" justifyContent="space-between" mb={3}>

        <Typography variant="body2">
          Last calculated: {new Date(metrics.calculated_at).toLocaleString()}
        </Typography>

        <Button
          variant="contained"
          startIcon={isRefreshing ? <CircularProgress size={16} /> : <Refresh />}
          onClick={handleRefresh}
        >
          Refresh Analytics
        </Button>

      </Box>

      {refreshError && <Alert severity="error">{refreshError}</Alert>}

      {/* chart */}

      <Card sx={{ mb: 4 }}>

        <CardContent>

          <Typography variant="h6" gutterBottom>
            Success Rates by Compliance Tier
          </Typography>

          <ResponsiveContainer width="100%" height={300}>

            <BarChart data={barChartData}>

              <CartesianGrid strokeDasharray="3 3" />

              <XAxis dataKey="tier" />

              <YAxis domain={[0, 100]} />

              <Tooltip
                formatter={(value, name, item) => {
                  if (value === undefined || value === null) return ['-', String(name)]

                  const payload = item?.payload

                  const count =
                    name === 'MSQ (Symptoms)'
                      ? payload?.msqCount
                      : payload?.promisCount

                  const numericValue =
                    typeof value === 'number' ? value : Number(value)

                  return [
                    `${numericValue.toFixed(1)}% (${count})`,
                    String(name)
                  ]
                }}
              />

              <Legend />

              <Bar
                dataKey="msq"
                fill="#8e24ff"
                name="MSQ (Symptoms)"
              />

              <Bar
                dataKey="promis"
                fill="#f50057"
                name="PROMIS-29 (Quality of Life)"
              />

            </BarChart>

          </ResponsiveContainer>

        </CardContent>

      </Card>

      {/* analysis */}

      <Grid container spacing={3}>

        <Grid size={{ xs: 12, md: 6 }}>

          <OutcomeAnalysisCard
            title="MSQ: Medical Symptoms"
            color="primary"
            effectSize={msqEffectSize}
            oddsRatio={msqOddsRatio}
            interpretation={msqInterpret}
            unit="pts"
          />

        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>

          <OutcomeAnalysisCard
            title="PROMIS-29: Quality of Life"
            color="secondary"
            effectSize={promisEffectSize}
            oddsRatio={promisOddsRatio}
            interpretation={promisInterpret}
            unit="T-score"
          />

        </Grid>

      </Grid>

    </Box>
  )
}

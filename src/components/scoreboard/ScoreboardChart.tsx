"use client";

import dynamic from 'next/dynamic'
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { LeaderboardEntry } from '@/types'

const Plot = dynamic(() => import('react-plotly.js'), {
  ssr: false,
  loading: () => <Skeleton className="h-80 w-full" />,
})

interface ScoreboardChartProps {
  leaderboard: LeaderboardEntry[]
  isDark: boolean
}

const ScoreboardChart: React.FC<ScoreboardChartProps> = ({ leaderboard, isDark }) => {
  // Fungsi untuk truncate username
  const truncate = (str: string, n: number) => str.length > n ? str.slice(0, n) + '...' : str;

  const chartData = leaderboard.slice(0, 10).map((entry) => {
    const x = entry.progress.map((p) => {
      const date = new Date(p.date)
      const offset = date.getTimezoneOffset() * 60000
      return new Date(date.getTime() - offset).toISOString().slice(0, 16)
    })
    const shortName = truncate(entry.username, 16);
    return {
      x,
      y: entry.progress.map((p) => p.score),
      text: entry.progress.map((p) => `${shortName} - ${p.score}`),
      hovertemplate: '%{x}<br>%{text}<extra></extra>',
      mode: 'lines+markers',
      name: shortName,
      showlegend: true,
      line: { shape: 'hv', width: 3 },
      marker: { size: 6 },
    }
  })

  return (
    <Card className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-sm rounded-2xl">
      <CardHeader>
        <CardTitle className="text-lg font-bold text-center text-slate-900 dark:text-white">Top 10 Users</CardTitle>
      </CardHeader>
      <CardContent>
        <Plot
          data={chartData}
          layout={{
            showlegend: true,
            dragmode: false,
            autosize: true,
            xaxis: {
              type: 'date',
              autorange: true,
              tickfont: { size: 10, color: isDark ? '#94a3b8' : '#64748b' },
              tickformat: '%Y-%m-%d %H:%M',
              gridcolor: isDark ? '#1e293b' : '#f1f5f9',
              linecolor: isDark ? '#334155' : '#cbd5e1',
            },
            yaxis: {
              autorange: true,
              rangemode: 'tozero',
              automargin: true,
              title: { text: 'Score', font: { size: 12, color: isDark ? '#94a3b8' : '#64748b' } },
              tickfont: { size: 10, color: isDark ? '#94a3b8' : '#64748b' },
              gridcolor: isDark ? '#1e293b' : '#f1f5f9',
              linecolor: isDark ? '#334155' : '#cbd5e1',
            },
            legend: {
              orientation: 'h',
              x: 0.5,
              xanchor: 'center',
              y: -0.22,
              font: { size: 10, color: isDark ? '#cbd5e1' : '#475569' },
            },
            margin: { t: 20, r: 10, l: 30, b: 50 },
            plot_bgcolor: isDark ? '#0f172a' : '#fff',
            paper_bgcolor: isDark ? '#0f172a' : '#fff',
          }}
          style={{ width: '100%', height: '320px' }}
          useResizeHandler
          config={{ scrollZoom: false, displayModeBar: false }}
          className="dark:!bg-slate-900 dark:!text-slate-100"
        />
      </CardContent>
    </Card>
  )
}

export default ScoreboardChart

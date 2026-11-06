"use client";

import React, { useMemo } from 'react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  TimeScale,
  ChartOptions,
} from 'chart.js'
import 'chartjs-adapter-date-fns'
import { Line } from 'react-chartjs-2'
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { LeaderboardEntry } from '@/types'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  TimeScale
)

interface ScoreboardChartProps {
  leaderboard: LeaderboardEntry[]
  isDark: boolean
}

const PALETTE = [
  '#38bdf8', // sky-400
  '#f43f5e', // rose-500
  '#10b981', // emerald-500
  '#a855f7', // purple-500
  '#f59e0b', // amber-500
  '#ec4899', // pink-500
  '#06b6d4', // cyan-500
  '#84cc16', // lime-500
  '#6366f1', // indigo-500
  '#f97316', // orange-500
]

const truncate = (str: string, n: number) => (str.length > n ? str.slice(0, n) + '...' : str)

const ScoreboardChart: React.FC<ScoreboardChartProps> = ({ leaderboard, isDark }) => {
  const top10 = useMemo(() => leaderboard.slice(0, 10), [leaderboard])

  const chartData = useMemo(() => {
    const datasets = top10.map((entry, idx) => {
      const color = PALETTE[idx % PALETTE.length]
      const data = (entry.progress || []).map((p) => ({
        x: new Date(p.date).getTime(),
        y: p.score,
      }))

      return {
        label: truncate(entry.username, 16),
        data,
        borderColor: color,
        backgroundColor: color,
        borderWidth: 2.5,
        stepped: 'after' as const,
        pointRadius: 3.5,
        pointHoverRadius: 6,
        tension: 0,
      }
    })

    return { datasets }
  }, [top10])

  const options: ChartOptions<'line'> = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      animation: {
        duration: 400,
      },
      interaction: {
        mode: 'nearest',
        axis: 'x',
        intersect: false,
      },
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            boxWidth: 10,
            boxHeight: 10,
            usePointStyle: true,
            pointStyle: 'circle',
            padding: 12,
            font: {
              size: 11,
              family: 'monospace',
            },
            color: isDark ? '#cbd5e1' : '#475569',
          },
        },
        tooltip: {
          backgroundColor: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
          titleColor: isDark ? '#f8fafc' : '#0f172a',
          bodyColor: isDark ? '#cbd5e1' : '#334155',
          borderColor: isDark ? '#334155' : '#e2e8f0',
          borderWidth: 1,
          padding: 10,
          boxPadding: 4,
          usePointStyle: true,
          callbacks: {
            label: (context) => ` ${context.dataset.label}: ${context.parsed.y} pts`,
          },
        },
      },
      scales: {
        x: {
          type: 'time',
          time: {
            tooltipFormat: 'yyyy-MM-dd HH:mm',
            displayFormats: {
              hour: 'HH:mm',
              day: 'MMM d',
              week: 'MMM d',
              month: 'MMM yyyy',
            },
          },
          ticks: {
            font: { size: 10 },
            color: isDark ? '#94a3b8' : '#64748b',
            maxRotation: 0,
            autoSkip: true,
          },
          grid: {
            color: isDark ? '#1e293b' : '#f1f5f9',
          },
        },
        y: {
          beginAtZero: true,
          ticks: {
            font: { size: 10 },
            color: isDark ? '#94a3b8' : '#64748b',
            precision: 0,
          },
          grid: {
            color: isDark ? '#1e293b' : '#f1f5f9',
          },
          title: {
            display: true,
            text: 'Score',
            color: isDark ? '#94a3b8' : '#64748b',
            font: { size: 11, weight: 'bold' as const },
          },
        },
      },
    }),
    [isDark]
  )

  const hasData = chartData.datasets.some((d) => d.data.length > 0)

  return (
    <Card className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-sm rounded-2xl">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-bold text-center text-slate-900 dark:text-white">
          Top 10 Users Progression
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="w-full h-80">
          {hasData ? (
            <Line data={chartData} options={options} />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-slate-400">
              Belum ada data progress untuk ditampilkan
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export default ScoreboardChart

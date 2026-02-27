<script lang="ts">
    import { onMount } from 'svelte';
    import type { Position } from '$lib/types/account';
    import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, PointElement, LineElement, Title } from 'chart.js';
    import Chart from 'chart.js/auto';

    ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, PointElement, LineElement, Title);

    let { positions = [], accountBalance = 0 } = $props();

    let profitChartCanvas: HTMLCanvasElement;
    let allocationChartCanvas: HTMLCanvasElement;
    let profitChart: any;
    let allocationChart: any;

    $effect(() => {
        if (positions.length > 0) {
            updateCharts();
        }
    });

    function getChartColors() {
        const styles = getComputedStyle(document.documentElement);
        return {
            textPrimary: styles.getPropertyValue('--text-primary').trim() || '#111827',
            textSecondary: styles.getPropertyValue('--text-secondary').trim() || '#4b5563',
            borderPrimary: styles.getPropertyValue('--border-primary').trim() || 'rgba(0, 0, 0, 0.1)',
        };
    }

    function updateCharts() {
        updateProfitChart();
        updateAllocationChart();
    }

    function updateProfitChart() {
        if (!profitChartCanvas) return;

        const profitRows = positions
            .map((pos) => {
                const invested = pos.quantity * pos.entry_price;
                const current = pos.quantity * pos.current_price;
                const pnl = current - invested;
                const pnlPercent = invested > 0 ? (pnl / invested) * 100 : 0;
                return {
                    symbol: pos.symbol,
                    invested,
                    current,
                    pnl,
                    pnlPercent,
                };
            })
            .sort((a, b) => b.pnl - a.pnl);

        const data = profitRows.map((row) => row.pnl);
        const minValue = Math.min(...data, 0);
        const maxValue = Math.max(...data, 0);
        const range = Math.max(1, maxValue - minValue);
        const padding = range * 0.12;
        const suggestedMin = minValue - padding;
        const suggestedMax = maxValue + padding;

        const ctx = profitChartCanvas.getContext('2d');
        if (!ctx) return;

        if (profitChart) {
            profitChart.destroy();
        }

        const colors = getChartColors();

        profitChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: profitRows.map((row) => row.symbol),
                datasets: [
                    {
                        label: 'Gain/Perte ($)',
                        data: data,
                        backgroundColor: data.map(val => val >= 0 ? 'rgba(16, 185, 129, 0.7)' : 'rgba(239, 68, 68, 0.7)'),
                        borderColor: data.map(val => val >= 0 ? 'rgb(16, 185, 129)' : 'rgb(239, 68, 68)'),
                        borderWidth: 1,
                        borderRadius: 6
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                indexAxis: 'y',
                plugins: {
                    legend: {
                        display: false,
                        labels: {
                            color: colors.textPrimary,
                            font: { size: 12 }
                        }
                    },
                    tooltip: {
                        callbacks: {
                            title: function(context: any) {
                                return `Titre: ${context[0]?.label ?? ''}`;
                            },
                            label: function(context: any) {
                                const index = context.dataIndex;
                                const row = profitRows[index];
                                if (!row) return '$0.00';
                                const sign = row.pnl >= 0 ? '+' : '';
                                return `Gains/Pertes: ${sign}$${row.pnl.toFixed(2)}`;
                            },
                            afterLabel: function(context: any) {
                                const index = context.dataIndex;
                                const row = profitRows[index];
                                if (!row) return '';
                                const sign = row.pnlPercent >= 0 ? '+' : '';
                                return [
                                    `Rendement: ${sign}${row.pnlPercent.toFixed(2)}%`,
                                    `Valeur actuelle: $${row.current.toFixed(2)}`
                                ];
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        stacked: false,
                        suggestedMin,
                        suggestedMax,
                        ticks: {
                            color: colors.textSecondary,
                            callback: function(value: any) {
                                return '$' + value.toFixed(0);
                            }
                        },
                        grid: {
                            color: function(context: any) {
                                return context.tick.value === 0
                                    ? 'rgba(59, 130, 246, 0.45)'
                                    : colors.borderPrimary;
                            },
                            lineWidth: function(context: any) {
                                return context.tick.value === 0 ? 2 : 1;
                            }
                        }
                    },
                    y: {
                        ticks: {
                            color: colors.textSecondary
                        },
                        grid: {
                            color: colors.borderPrimary
                        }
                    }
                }
            }
        });
    }

    function updateAllocationChart() {
        if (!allocationChartCanvas) return;

        const totalValue = positions.reduce((sum, pos) => sum + pos.quantity * pos.current_price, 0);
        const data = positions.map(pos => (pos.quantity * pos.current_price / totalValue) * 100);
        const palette = [
            'rgba(59, 130, 246, 0.8)',
            'rgba(16, 185, 129, 0.8)',
            'rgba(139, 92, 246, 0.8)',
            'rgba(245, 158, 11, 0.8)',
            'rgba(236, 72, 153, 0.8)',
            'rgba(34, 197, 94, 0.8)',
            'rgba(99, 102, 241, 0.8)',
            'rgba(168, 85, 247, 0.8)'
        ];

        const ctx = allocationChartCanvas.getContext('2d');
        if (!ctx) return;

        if (allocationChart) {
            allocationChart.destroy();
        }

        const themeColors = getChartColors();

        allocationChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: positions.map(pos => `${pos.symbol} (${data[positions.indexOf(pos)].toFixed(1)}%)`),
                datasets: [
                    {
                        data: data,
                        backgroundColor: palette.slice(0, positions.length),
                        borderColor: 'rgba(31, 41, 55, 1)',
                        borderWidth: 2
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: themeColors.textPrimary,
                            font: { size: 12 },
                            padding: 15
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context: any) {
                                return context.label;
                            }
                        }
                    }
                }
            }
        });
    }

    onMount(() => {
        if (positions.length > 0) {
            updateCharts();
        }

        const observer = new MutationObserver(() => {
            if (positions.length > 0) {
                updateCharts();
            }
        });

        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

        return () => {
            observer.disconnect();
            if (profitChart) profitChart.destroy();
            if (allocationChart) allocationChart.destroy();
        };
    });
</script>

<div class="charts-container">
    <div class="chart-wrapper">
        <h3>Gains / Pertes par Position</h3>
        <canvas bind:this={profitChartCanvas}></canvas>
    </div>
    <div class="chart-wrapper">
        <h3>Répartition du Portefeuille</h3>
        <canvas bind:this={allocationChartCanvas}></canvas>
    </div>
</div>

<style>
    .charts-container {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 2rem;
        margin: 2rem 0;
    }

    .chart-wrapper {
        background: var(--bg-secondary);
        border: 1px solid var(--border-primary);
        border-radius: 16px;
        padding: 1.5rem;
    }

    .chart-wrapper h3 {
        margin: 0 0 1rem 0;
        color: var(--text-primary);
        font-size: 1.1rem;
    }

    @media (max-width: 1024px) {
        .charts-container {
            grid-template-columns: 1fr;
        }
    }
</style>

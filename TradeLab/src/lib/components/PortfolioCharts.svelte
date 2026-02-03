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

    function updateCharts() {
        updateProfitChart();
        updateAllocationChart();
    }

    function updateProfitChart() {
        if (!profitChartCanvas) return;

        const data = positions.map(pos => {
            const invested = pos.quantity * pos.entry_price;
            const current = pos.quantity * pos.current_price;
            return current - invested;
        });

        const ctx = profitChartCanvas.getContext('2d');
        if (!ctx) return;

        if (profitChart) {
            profitChart.destroy();
        }

        profitChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: positions.map(pos => pos.symbol),
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
                        display: true,
                        labels: {
                            color: 'rgba(255, 255, 255, 0.8)',
                            font: { size: 12 }
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context: any) {
                                return '$' + context.parsed.x.toFixed(2);
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        stacked: false,
                        ticks: {
                            color: 'rgba(255, 255, 255, 0.6)',
                            callback: function(value: any) {
                                return '$' + value.toFixed(0);
                            }
                        },
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        }
                    },
                    y: {
                        ticks: {
                            color: 'rgba(255, 255, 255, 0.8)'
                        },
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
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
        const colors = [
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

        allocationChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: positions.map(pos => `${pos.symbol} (${data[positions.indexOf(pos)].toFixed(1)}%)`),
                datasets: [
                    {
                        data: data,
                        backgroundColor: colors.slice(0, positions.length),
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
                            color: 'rgba(255, 255, 255, 0.8)',
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

        return () => {
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

<script lang="ts">
    import { onMount, onDestroy } from "svelte";
    import type { Position } from "$lib/types/account";
    import TradeForm from "./TradeForm.svelte";
    import StockDetail from "./StockDetail.svelte";
    import PortfolioCharts from "./PortfolioCharts.svelte";
    import { QuotesWebSocket } from "$lib/services/quotesWebSocket";
    import { accountStore, setAccount } from "$lib/stores/account";
    import "./PlacementsTab.css";

    let positions: Position[] = $state([]);
    let loading = $state(true);
    let totalValue = $state(0);
    let accountBalance = $state(0);
    let availableBalance = $state(0);
    $effect(() => {
        const account = $accountStore;
        accountBalance = account?.current_balance ?? 0;
        availableBalance = account?.available_balance ?? 0;
    });
    let showTradeForm = $state(false);
    let tradeMode: "buy" | "sell" = $state("buy");
    let selectedSymbol = $state("");
    let showStockDetail = $state(false);
    let detailSymbol = $state("");
    let ws: QuotesWebSocket | null = null;

    onMount(async () => {
        await loadPositions();
        
        ws = QuotesWebSocket.getInstance();
        
        try {
            await ws.connect();
            
            positions.forEach(position => {
                ws?.subscribe(position.symbol, (data) => {
                    updatePositionPrice(position.symbol, data.price);
                });
            });
        } catch (error) {
            console.error('WebSocket connection failed:', error);
        }
    });
    
    onDestroy(() => {
        if (ws) {
            positions.forEach(position => {
                ws?.unsubscribe(position.symbol);
            });
        }
    });
    
    function updatePositionPrice(symbol: string, newPrice: number) {
        positions = positions.map(pos => {
            if (pos.symbol === symbol) {
                return { ...pos, current_price: newPrice };
            }
            return pos;
        });
        
        totalValue = positions.reduce(
            (sum, pos) => sum + pos.quantity * pos.current_price,
            0,
        );
    }

    function calculateProfitLoss(position: Position) {
        const invested = position.quantity * position.entry_price;
        const current = position.quantity * position.current_price;
        return current - invested;
    }

    function calculateProfitLossPercent(position: Position) {
        const invested = position.quantity * position.entry_price;
        if (invested === 0) return 0;
        return (
            ((position.current_price - position.entry_price) /
                position.entry_price) *
            100
        );
    }

    function openBuyForm() {
        tradeMode = "buy";
        selectedSymbol = "";
        showTradeForm = true;
    }

    function openSellForm(symbol: string) {
        tradeMode = "sell";
        selectedSymbol = symbol;
        showTradeForm = true;
    }

    function closeTradeForm() {
        showTradeForm = false;
        selectedSymbol = "";
        loadPositions();
    }

    async function loadPositions() {
        loading = true;
        try {
            if (ws) {
                positions.forEach(pos => ws?.unsubscribe(pos.symbol));
            }

            const [positionsResponse, accountResponse] = await Promise.all([
                fetch("/api/account/positions", { credentials: 'include' }),
                fetch("/api/account", { credentials: 'include' }),
            ]);

            if (positionsResponse.ok) {
                const data = await positionsResponse.json();
                positions = data.positions || [];
            } else {
                positions = [];
            }

            totalValue = positions.reduce(
                (sum, pos) => sum + pos.quantity * pos.current_price,
                0,
            );

            if (accountResponse.ok) {
                const accountData = await accountResponse.json();
                setAccount(accountData.account);
            }

            if (ws && positions.length > 0) {
                positions.forEach(pos => {
                    ws?.subscribe(pos.symbol, (data) => {
                        updatePositionPrice(pos.symbol, data.price);
                    });
                });
            }
        } catch (error) {
            console.error("Erreur:", error);
        } finally {
            loading = false;
        }
    }

    function handleStockSearch(symbol: string) {
        detailSymbol = symbol;
        showStockDetail = true;
    }

    function closeStockDetail() {
        showStockDetail = false;
        detailSymbol = "";
        loadPositions();
    }
</script>

{#if showStockDetail}
    <StockDetail symbol={detailSymbol} onClose={closeStockDetail} />
{/if}

<div class="placements-container">
    <div class="placements-header">
        <div class="header-content">
            <h2>Portefeuille</h2>
        </div>
    </div>

    {#if showTradeForm}
        <div class="trade-form-container">
            <div class="trade-form-header">
                <h3>
                    {tradeMode === "buy"
                        ? "Acheter des Actions"
                        : "Vendre des Actions"}
                </h3>
                <button
                    class="btn-close"
                    onclick={closeTradeForm}
                    aria-label="Fermer le formulaire"
                >
                    <svg
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                    >
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
            </div>
            <TradeForm bind:mode={tradeMode} prefilledSymbol={selectedSymbol} />
        </div>
    {/if}

    {#if loading}
        <div class="loading">Chargement de vos positions...</div>
    {:else}
        <div class="portfolio-summary">
            <div class="summary-card">
                <div class="summary-label">Solde Disponible</div>
                <div class="summary-value">
                    ${availableBalance.toLocaleString("fr-FR", {
                        maximumFractionDigits: 2,
                    })}
                </div>
            </div>
            <div class="summary-card">
                <div class="summary-label">Valeur du Portefeuille</div>
                <div class="summary-value">
                    ${totalValue.toLocaleString("fr-FR", {
                        maximumFractionDigits: 2,
                    })}
                </div>
            </div>
            <div class="summary-card">
                <div class="summary-label">Valeur Totale</div>
                <div class="summary-value">
                    ${(availableBalance + totalValue).toLocaleString("fr-FR", {
                        maximumFractionDigits: 2,
                    })}
                </div>
            </div>
        </div>

        {#if positions.length > 0}
            <PortfolioCharts {positions} {accountBalance} />

            <div class="positions-list">
                {#each positions as position (position.id)}
                    {@const profitLoss = calculateProfitLoss(position)}
                    {@const profitLossPercent =
                        calculateProfitLossPercent(position)}
                    <button class="position-card" onclick={() => handleStockSearch(position.symbol)}>
                        <div class="position-header">
                            <div class="symbol-section">
                                <h3 class="symbol">{position.symbol}</h3>
                                <span class="status-badge"
                                    >{position.quantity} shares</span
                                >
                            </div>
                            <div class="price-section">
                                <div class="current-price">
                                    ${position.current_price.toFixed(2)}
                                </div>
                                <div
                                    class="price-change"
                                    class:positive={profitLossPercent > 0}
                                    class:negative={profitLossPercent < 0}
                                >
                                    {profitLossPercent > 0
                                        ? "+"
                                        : ""}{profitLossPercent.toFixed(2)}%
                                </div>
                            </div>
                        </div>

                        <div class="position-details">
                            <div class="detail-row">
                                <span class="detail-label">Prix d'Entrée</span>
                                <span class="detail-value"
                                    >${position.entry_price.toFixed(2)}</span
                                >
                            </div>
                            <div class="detail-row">
                                <span class="detail-label">Montant Investi</span>
                                <span class="detail-value"
                                    >${(
                                        position.quantity * position.entry_price
                                    ).toLocaleString("fr-FR", {
                                        maximumFractionDigits: 2,
                                    })}</span
                                >
                            </div>
                            <div class="detail-row">
                                <span class="detail-label">Valeur Actuelle</span>
                                <span class="detail-value">
                                    ${(
                                        position.quantity * position.current_price
                                    ).toLocaleString("fr-FR", {
                                        maximumFractionDigits: 2,
                                    })}
                                </span>
                            </div>
                            <div class="detail-row profit-loss">
                                <span class="detail-label">Gain/Perte</span>
                                <span
                                    class="detail-value"
                                    class:positive={profitLoss > 0}
                                    class:negative={profitLoss < 0}
                                >
                                    {profitLoss > 0
                                        ? "+"
                                        : ""}{profitLoss.toLocaleString("fr-FR", {
                                        maximumFractionDigits: 2,
                                    })}$
                                </span>
                            </div>
                        </div>
                    </button>
                {/each}
            </div>
        {:else}
            <div class="positions-empty">
                <p>Les titres que vous détenez s'afficheront ici.</p>
            </div>
        {/if}
    {/if}
</div>

<script lang="ts">
  import { onMount } from 'svelte';

  let symbols = ['AAPL', 'MSFT', 'GOOGL'];
  let connected = false;
  let ws: WebSocket | null = null;
  let quotes: Record<string, any> = {};
  let stats: any = null;
  let newSymbol = '';

  function connect() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/quotes`;

    try {
      ws = new WebSocket(wsUrl);

      if (ws) {
        ws.onopen = () => {
          console.log('Connecté au serveur');
          connected = true;

          ws?.send(JSON.stringify({ symbols }));
        };
      }

      if (ws) {
        ws.onmessage = (event) => {
          const data = JSON.parse(event.data);

          if (data.type === 'quote_update') {
            quotes[data.symbol] = {
              price: data.price,
              change: data.change,
              changePercent: data.changePercent,
              timestamp: new Date(data.timestamp)
            };
            quotes = quotes;
          } else if (data.type === 'stats') {
            stats = data;
          }
        };

        ws.onerror = (error) => {
          console.error('Erreur WebSocket:', error);
          connected = false;
        };

        ws.onclose = () => {
          console.log('Déconnecté');
          connected = false;
        };
      }
    } catch (error) {
      console.error('Erreur connexion:', error);
    }
  }

  function disconnect() {
    if (ws) {
      ws.close();
      connected = false;
      ws = null;
    }
  }

  function addSymbol() {
    if (newSymbol && !symbols.includes(newSymbol)) {
      symbols = [...symbols, newSymbol.toUpperCase()];
      newSymbol = '';

      if (ws && connected) {
        ws.send(
          JSON.stringify({
            type: 'subscribe',
            symbols: [symbols[symbols.length - 1]]
          })
        );
      }
    }
  }

  function removeSymbol(symbol: string) {
    symbols = symbols.filter(s => s !== symbol);
  }

  function requestStats() {
    if (ws) {
      ws.send(JSON.stringify({ type: 'stats' }));
    }
  }

  onMount(() => {
    connect();

    return () => {
      disconnect();
    };
  });
</script>

<div class="container">
  <div class="header">
    <h1>Portefeuille Temps Réel - WebSocket Multi-Symboles</h1>
    <div class="status">
      Status: <span class={connected ? 'connected' : 'disconnected'}>
        {connected ? ' Connecté' : ' Déconnecté'}
      </span>
    </div>
  </div>

  <div class="controls">
    <button on:click={connect} disabled={connected}>Connecter</button>
    <button on:click={disconnect} disabled={!connected}>Déconnecter</button>
    <button on:click={requestStats} disabled={!connected}>Stats</button>

    <div class="add-symbol">
      <input
        type="text"
        bind:value={newSymbol}
        placeholder="Nouveau symbole"
        on:keyup={(e) => e.key === 'Enter' && addSymbol()}
      />
      <button on:click={addSymbol} disabled={!connected || !newSymbol}>Ajouter</button>
    </div>
  </div>

  {#if stats}
    <div class="stats">
      <p>Symboles actifs: <strong>{stats.symbols_count}</strong> / 15</p>
      <p>Appels API/min: <strong>{stats.api_calls_per_minute}</strong> / 60</p>
      <p>Connexions: <strong>{stats.total_connections}</strong></p>
      <p>Efficacité: {((15 / stats.symbols_count) * 100).toFixed(0)}% de réduction requêtes</p>
    </div>
  {/if}

  <div class="quotes-grid">
    {#each symbols as symbol (symbol)}
      <div class="quote-card">
        <button class="close-btn" on:click={() => removeSymbol(symbol)} aria-label="Supprimer {symbol}">×</button>
        <div class="symbol">{symbol}</div>
        {#if quotes[symbol]}
          <div class="price">${quotes[symbol].price.toFixed(2)}</div>
          <div
            class="change"
            class:positive={quotes[symbol].changePercent > 0}
            class:negative={quotes[symbol].changePercent < 0}
          >
            {quotes[symbol].change >= 0 ? '+' : ''}{quotes[symbol].change.toFixed(2)}
            ({quotes[symbol].changePercent > 0 ? '+' : ''}{quotes[symbol].changePercent.toFixed(
              2
            )}%)
          </div>
          <div class="time">{quotes[symbol].timestamp.toLocaleTimeString()}</div>
        {:else}
          <div class="loading">Chargement...</div>
        {/if}
      </div>
    {/each}
  </div>

  <div class="info">
    <h3>💡 WebSocket Multi-Symboles</h3>
    <ul>
      <li>✅ Une connexion pour {symbols.length} symboles</li>
      <li>✅ Réduction requêtes: {((symbols.length * 12) / 60 * 100).toFixed(0)}% de la limite API</li>
      <li>✅ Jusqu'à 15 symboles simultanément</li>
      <li>✅ Cache local (5s) pour éviter appels redondants</li>
      <li>✅ Mises à jour temps réel</li>
    </ul>
  </div>
</div>

<style>
  .container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 2rem;
    background: #f9f9f9;
  }

  .header {
    text-align: center;
    margin-bottom: 2rem;
  }

  h1 {
    margin: 0;
    color: #333;
  }

  .status {
    margin-top: 0.5rem;
    font-size: 0.9rem;
  }

  .connected {
    color: #28a745;
    font-weight: bold;
  }

  .disconnected {
    color: #dc3545;
    font-weight: bold;
  }

  .controls {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 2rem;
    flex-wrap: wrap;
  }

  button {
    padding: 0.5rem 1rem;
    background: #007bff;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-weight: bold;
  }

  button:disabled {
    background: #ccc;
    cursor: not-allowed;
  }

  button:hover:not(:disabled) {
    background: #0056b3;
  }

  .add-symbol {
    display: flex;
    gap: 0.5rem;
  }

  input {
    padding: 0.5rem;
    border: 1px solid #ccc;
    border-radius: 4px;
    font-size: 0.9rem;
  }

  .stats {
    background: white;
    padding: 1rem;
    border-radius: 4px;
    margin-bottom: 2rem;
    border-left: 4px solid #007bff;
  }

  .stats p {
    margin: 0.5rem 0;
    font-size: 0.9rem;
  }

  .quotes-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 1rem;
    margin-bottom: 2rem;
  }

  .quote-card {
    background: white;
    padding: 1.5rem;
    border-radius: 8px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    position: relative;
    text-align: center;
  }

  .close-btn {
    position: absolute;
    top: 0.5rem;
    right: 0.5rem;
    cursor: pointer;
    font-size: 1.5rem;
    color: var(--accent-red);
    font-weight: bold;
    opacity: 0.9;
    background: var(--bg-tertiary);
    border: 1px solid var(--border-primary);
    border-radius: 999px;
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: opacity 0.2s, background 0.2s, border-color 0.2s;
  }

  .close-btn:hover {
    opacity: 1;
    background: var(--bg-hover);
    border-color: var(--border-secondary);
  }

  .symbol {
    font-size: 0.9rem;
    color: #666;
    text-transform: uppercase;
    margin-bottom: 0.5rem;
  }

  .price {
    font-size: 2rem;
    font-weight: bold;
    color: #333;
    margin-bottom: 0.5rem;
  }

  .change {
    font-size: 1rem;
    font-weight: bold;
    margin-bottom: 0.5rem;
  }

  .change.positive {
    color: #28a745;
  }

  .change.negative {
    color: #dc3545;
  }

  .time {
    font-size: 0.75rem;
    color: #999;
  }

  .loading {
    color: #999;
    font-style: italic;
  }

  .info {
    background: white;
    padding: 1.5rem;
    border-radius: 8px;
    border-left: 4px solid #28a745;
  }

  .info h3 {
    margin-top: 0;
    color: #333;
  }

  .info ul {
    margin: 0;
    padding-left: 1.5rem;
  }

  .info li {
    margin: 0.5rem 0;
    font-size: 0.95rem;
    color: #555;
  }
</style>

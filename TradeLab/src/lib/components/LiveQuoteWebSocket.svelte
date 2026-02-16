<script lang="ts">
  
  import { onMount } from 'svelte';
  
  let symbol = 'AAPL';
  let price = 0;
  let change = 0;
  let changePercent = 0;
  let connected = false;
  let ws: WebSocket | null = null;
  
  function connect() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/quote/${symbol}`;
    
    try {
      ws = new WebSocket(wsUrl);
      
      ws.onopen = () => {
        connected = true;
      };
      
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        if (data.type === 'quote_update') {
          price = data.price;
          change = data.change;
          changePercent = data.changePercent;
        }
      };
      
      ws.onerror = (error) => {
        connected = false;
      };
      
      ws.onclose = () => {
        connected = false;
      };
      
    } catch (error) {
      // noop
    }
  }
  
  function disconnect() {
    if (ws) {
      ws.close();
      connected = false;
    }
  }
  
  onMount(() => {
    connect();
    
    return () => {
      disconnect();
    };
  });
  
  function changeSymbol() {
    disconnect();
    connect();
  }
</script>

<div class="quote-container">
  <div class="symbol-input">
    <input 
      type="text" 
      bind:value={symbol}
      on:change={changeSymbol}
      placeholder="Entrez le symbole (ex: AAPL)"
    />
    <button on:click={connect} disabled={connected}>Connecter</button>
    <button on:click={disconnect} disabled={!connected}>Déconnecter</button>
  </div>
  
  <div class="status">
    Status: 
    <span class={connected ? 'connected' : 'disconnected'}>
      {connected ? '🟢 Connecté' : '🔴 Déconnecté'}
    </span>
  </div>
  
  {#if connected}
    <div class="quote-display">
      <div class="symbol">{symbol}</div>
      <div class="price">${price.toFixed(2)}</div>
      <div class="change" class:positive={changePercent > 0} class:negative={changePercent < 0}>
        {change >= 0 ? '+' : ''}{change.toFixed(2)} ({(changePercent > 0 ? '+' : '')}{changePercent.toFixed(2)}%)
      </div>
      <div class="note">✓ Mises à jour en temps réel (WebSocket)</div>
    </div>
  {/if}
</div>

<style>
  .quote-container {
    padding: 2rem;
    background: #f5f5f5;
    border-radius: 8px;
    max-width: 400px;
    margin: 0 auto;
  }
  
  .symbol-input {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }
  
  input {
    flex: 1;
    padding: 0.5rem;
    border: 1px solid #ccc;
    border-radius: 4px;
    font-size: 1rem;
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
  
  .status {
    margin-bottom: 1rem;
    padding: 0.5rem;
    background: white;
    border-radius: 4px;
  }
  
  .connected {
    color: #28a745;
    font-weight: bold;
  }
  
  .disconnected {
    color: #dc3545;
    font-weight: bold;
  }
  
  .quote-display {
    background: white;
    padding: 1rem;
    border-radius: 4px;
    text-align: center;
  }
  
  .symbol {
    font-size: 0.9rem;
    color: #666;
    margin-bottom: 0.5rem;
  }
  
  .price {
    font-size: 2.5rem;
    font-weight: bold;
    color: #333;
    margin-bottom: 0.5rem;
  }
  
  .change {
    font-size: 1.2rem;
    font-weight: bold;
    margin-bottom: 0.5rem;
  }
  
  .change.positive {
    color: #28a745;
  }
  
  .change.negative {
    color: #dc3545;
  }
  
  .note {
    font-size: 0.85rem;
    color: #666;
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 1px solid #eee;
  }
</style>

<script lang="ts">
import { supabase } from '$lib/supabaseClient';
let email = '';
let password = '';
let error = '';

async function handleLogin() {
  error = '';
  const { error: err } = await supabase.auth.signInWithPassword({ email, password });
  if (err) error = err.message;
  else window.location.href = '/';
}
</script>

<h1>Connexion</h1>
<form on:submit|preventDefault={handleLogin}>
  <input type="email" bind:value={email} placeholder="Email" required />
  <input type="password" bind:value={password} placeholder="Mot de passe" required />
  <button type="submit">Se connecter</button>
  {#if error}
    <p style="color:red">{error}</p>
  {/if}
</form>

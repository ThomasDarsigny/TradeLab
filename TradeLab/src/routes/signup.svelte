<script lang="ts">
import { supabase } from '$lib/supabaseClient';
let email = '';
let password = '';
let error = '';
let message = '';

async function handleSignup() {
  error = '';
  message = '';
  const { error: err } = await supabase.auth.signUp({ email, password });
  if (err) error = err.message;
  else message = 'Vérifiez vos emails pour confirmer votre inscription.';
}
</script>

<h1>Créer un compte</h1>
<form on:submit|preventDefault={handleSignup}>
  <input type="email" bind:value={email} placeholder="Email" required />
  <input type="password" bind:value={password} placeholder="Mot de passe" required />
  <button type="submit">S'inscrire</button>
  {#if error}
    <p style="color:red">{error}</p>
  {/if}
  {#if message}
    <p style="color:green">{message}</p>
  {/if}
</form>

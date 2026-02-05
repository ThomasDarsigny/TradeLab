"""
Gestionnaire automatique de proxies avec rotation et remplacement
"""
import requests
import threading
import time
from typing import List, Dict, Optional
from datetime import datetime
import random

class ProxyManager:
    def __init__(self, 
                 min_proxies: int = 5, 
                 max_failed_attempts: int = 3,
                 test_timeout: int = 5,
                 refresh_interval: int = 300,
                 candidate_proxies: Optional[List[str]] = None):
        """
        Gestionnaire de proxies avec rotation automatique
        
        Args:
            min_proxies: Nombre minimum de proxies à maintenir
            max_failed_attempts: Échecs max avant de retirer un proxy
            test_timeout: Timeout pour tester un proxy (secondes)
            refresh_interval: Intervalle de rafraîchissement auto (secondes)
        """
        self.min_proxies = min_proxies
        self.max_failed_attempts = max_failed_attempts
        self.test_timeout = test_timeout
        self.refresh_interval = refresh_interval
        
        self.active_proxies: List[Dict] = []
        self.proxy_index = 0
        self.lock = threading.Lock()
        
        self.candidate_proxies: List[str] = candidate_proxies or []

        self.refresh_thread = None
        self.should_stop = False

    def set_candidate_proxies(self, proxies: List[str]):
        """Met à jour la liste des proxies privés candidats"""
        self.candidate_proxies = list(dict.fromkeys(proxies))
    
    def test_proxy(self, proxy_url: str) -> bool:
        """Teste si un proxy fonctionne"""
        try:
            proxies = {
                'http': proxy_url,
                'https': proxy_url
            }
            response = requests.get(
                'https://httpbin.org/ip',
                proxies=proxies,
                timeout=15
            )
            return response.status_code == 200
        except Exception as e:
            return False
    
    def add_proxy(self, proxy_url: str):
        """Ajoute un proxy au pool actif"""
        with self.lock:
            if not any(p['url'] == proxy_url for p in self.active_proxies):
                self.active_proxies.append({
                    'url': proxy_url,
                    'failures': 0,
                    'successes': 0,
                    'last_used': None,
                    'added_at': datetime.now()
                })
                print(f" Proxy ajouté: {proxy_url}")
    
    def remove_proxy(self, proxy_url: str):
        """Retire un proxy du pool"""
        with self.lock:
            self.active_proxies = [p for p in self.active_proxies if p['url'] != proxy_url]
            print(f" Proxy retiré: {proxy_url}")
    
    def mark_proxy_failed(self, proxy_url: str):
        """Marque un proxy comme ayant échoué"""
        with self.lock:
            for proxy in self.active_proxies:
                if proxy['url'] == proxy_url:
                    proxy['failures'] += 1
                    print(f"  Échec proxy {proxy_url} ({proxy['failures']}/{self.max_failed_attempts})")
                    
                    if proxy['failures'] >= self.max_failed_attempts:
                        self.remove_proxy(proxy_url)
                        if len(self.active_proxies) < self.min_proxies:
                            threading.Thread(target=self.refresh_proxies, daemon=True).start()
                    break
    
    def mark_proxy_success(self, proxy_url: str):
        """Marque un proxy comme ayant réussi"""
        with self.lock:
            for proxy in self.active_proxies:
                if proxy['url'] == proxy_url:
                    proxy['successes'] += 1
                    proxy['failures'] = max(0, proxy['failures'] - 1)
                    proxy['last_used'] = datetime.now()
                    break
    
    def get_next_proxy(self) -> Optional[Dict]:
        """Récupère le prochain proxy en rotation"""
        with self.lock:
            if not self.active_proxies:
                return None
            
            proxy = self.active_proxies[self.proxy_index % len(self.active_proxies)]
            self.proxy_index = (self.proxy_index + 1) % len(self.active_proxies)
            
            return {
                'http': proxy['url'],
                'https': proxy['url'],
                '_url': proxy['url'] 
            }
    
    def refresh_proxies(self, force: bool = False):
        """Rafraîchit le pool de proxies"""
        if not force and len(self.active_proxies) >= self.min_proxies:
            print(f" Pool suffisant: {len(self.active_proxies)} proxies actifs")
            return
        
        print(f"\n Rafraîchissement du pool de proxies...")
        print(f" État actuel: {len(self.active_proxies)} proxies actifs")
        
        active_urls = {p['url'] for p in self.active_proxies}
        new_proxies = [p for p in self.candidate_proxies if p and p not in active_urls]
        
        if not new_proxies:
            print(" Aucun proxy privé configuré")
            return
        
        random.shuffle(new_proxies)
        
        print(f" Test de {min(50, len(new_proxies))} proxies...")
        
        tested = 0
        added = 0
        
        for proxy in new_proxies[:50]:
            tested += 1
            if tested % 10 == 0:
                print(f"   Testé {tested}/50...")
            
            if self.test_proxy(proxy):
                self.add_proxy(proxy)
                added += 1
                
                if len(self.active_proxies) >= self.min_proxies * 2:
                    break
        
        print(f" Rafraîchissement terminé: {added} nouveaux proxies ajoutés")
        print(f" Pool actuel: {len(self.active_proxies)} proxies actifs\n")
    
    def start_auto_refresh(self):
        """Démarre le rafraîchissement automatique en arrière-plan"""
        if self.refresh_thread and self.refresh_thread.is_alive():
            return
        
        def auto_refresh_loop():
            while not self.should_stop:
                time.sleep(self.refresh_interval)
                if len(self.active_proxies) < self.min_proxies:
                    print(f"\n Rafraîchissement automatique déclenché (seuil: {self.min_proxies})")
                    self.refresh_proxies()
        
        self.refresh_thread = threading.Thread(target=auto_refresh_loop, daemon=True)
        self.refresh_thread.start()
        print(f" Rafraîchissement automatique activé (intervalle: {self.refresh_interval}s)")
    
    def stop_auto_refresh(self):
        """Arrête le rafraîchissement automatique"""
        self.should_stop = True
        if self.refresh_thread:
            self.refresh_thread.join(timeout=5)
    
    def get_stats(self) -> Dict:
        """Retourne les statistiques du pool"""
        with self.lock:
            total_successes = sum(p['successes'] for p in self.active_proxies)
            total_failures = sum(p['failures'] for p in self.active_proxies)
            
            return {
                'active_proxies': len(self.active_proxies),
                'total_successes': total_successes,
                'total_failures': total_failures,
                'proxies': self.active_proxies.copy()
            }
    
    def initialize(self, async_test=True):
        """Initialise le pool de proxies au démarrage"""
        print("\n" + "="*60)
        print(" INITIALISATION DU GESTIONNAIRE DE PROXIES")
        print("="*60)
        
        if async_test:
            with self.lock:
                for proxy_url in self.candidate_proxies:
                    if not any(p['url'] == proxy_url for p in self.active_proxies):
                        self.active_proxies.append({
                            'url': proxy_url,
                            'failures': 0,
                            'successes': 0,
                            'last_used': None,
                            'added_at': datetime.now()
                        })
            print(f" {len(self.active_proxies)} proxies chargés (tests en background)")
            
            threading.Thread(target=self._background_test, daemon=True).start()
            self.start_auto_refresh()
        else:
            self.refresh_proxies(force=True)
            
            if self.active_proxies:
                print(f" {len(self.active_proxies)} proxies prêts")
                self.start_auto_refresh()
            else:
                print("  Aucun proxy fonctionnel trouvé")
                print(" L'application fonctionnera sans proxy")
        
        print("="*60 + "\n")
        
        return len(self.active_proxies) > 0
    
    def _background_test(self):
        """Teste les proxies en arrière-plan"""
        print(" Test des proxies en arrière-plan...")
        time.sleep(2)
        
        to_remove = []
        for proxy in self.active_proxies[:]:
            if not self.test_proxy(proxy['url']):
                to_remove.append(proxy['url'])
        
        for proxy_url in to_remove:
            self.remove_proxy(proxy_url)
        
        print(f" Tests terminés: {len(self.active_proxies)} proxies fonctionnels")

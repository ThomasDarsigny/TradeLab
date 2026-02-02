import yfinance as yf
import requests
import time

session = requests.Session()
session.headers.update({
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
    'Accept-Encoding': 'gzip, deflate, br',
    'Referer': 'https://finance.yahoo.com/',
    'Origin': 'https://finance.yahoo.com',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
    'Connection': 'keep-alive',
    'DNT': '1'
})

print(" Attente avant requête...")
time.sleep(2)

print(" Récupération des données MSFT...")
msft = yf.Ticker("MSFT", session=session)

try:
    info = msft.fast_info
    print(f"Nom : {info.get('longName', 'N/A')}")
    print(f"Prix : ${info.get('lastPrice', 'N/A')}")
    print(" Yahoo Finance fonctionne!")
except Exception as e:
    print(f" Erreur : {e}")
    print(f"Type : {type(e).__name__}")

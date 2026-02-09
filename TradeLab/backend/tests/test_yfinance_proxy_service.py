import time
import requests

from typing import Dict, Optional, Union

BASE_URL = "http://127.0.0.1:8001"


def get_json(path: str, params: Optional[dict] = None) -> dict:
    url = f"{BASE_URL}{path}"
    response = requests.get(url, params=params, timeout=15)
    response.raise_for_status()
    return response.json()


def test_proxy_stats() -> None:
    print("0) Proxy stats")
    stats = get_json("/proxy/stats")
    enabled = stats.get("enabled")
    print(f"   enabled={enabled}")
    if enabled:
        print(
            f"   active={stats.get('active_proxies')} "
            f"successes={stats.get('total_successes')} "
            f"failures={stats.get('total_failures')}"
        )


def test_quote(symbol: str) -> None:
    print(f"1) Quote {symbol}")
    data = get_json(f"/quote/{symbol}")
    print(
        f"   price={data.get('price')} change={data.get('change')} "
        f"changePercent={data.get('changePercent')}"
    )


def test_history(symbol: str) -> None:
    print(f"2) History {symbol}")
    data = get_json(f"/history/{symbol}", params={"period": "1mo", "interval": "1d"})
    closes = data.get("close", [])
    if closes:
        print(f"   rows={len(closes)} first={closes[0]} last={closes[-1]}")
    else:
        print("   empty history")


def main() -> None:
    print("=" * 60)
    print("YFINANCE PROXY SERVICE TEST")
    print("=" * 60)

    test_proxy_stats()
    time.sleep(1)

    for symbol in ["AAPL", "MSFT", "DOL.TO"]:
        print("-" * 60)
        test_quote(symbol)
        time.sleep(1)
        test_history(symbol)
        time.sleep(1)

    print("=" * 60)
    print("DONE")
    print("=" * 60)


if __name__ == "__main__":
    main()

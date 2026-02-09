import json
import time
import requests
import yfinance as yf


def build_session() -> requests.Session:
    session = requests.Session()
    session.headers.update({
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/120.0.0.0 Safari/537.36"
        ),
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7",
        "Referer": "https://finance.yahoo.com/",
        "Origin": "https://finance.yahoo.com",
    })
    return session


def check_yahoo_api(session: requests.Session, symbol: str) -> bool:
    print("0) Check Yahoo quote endpoint")
    url = f"https://query2.finance.yahoo.com/v7/finance/quote?symbols={symbol}"
    try:
        response = session.get(url, timeout=10)
    except Exception as exc:
        print(f"   FAIL: request error: {exc}")
        return False

    content_type = response.headers.get("content-type", "")
    print(f"   status={response.status_code} content-type={content_type}")

    if not response.ok:
        return False

    try:
        payload = response.json()
    except json.JSONDecodeError:
        snippet = response.text[:200].replace("\n", " ")
        print(f"   FAIL: invalid JSON: {snippet}")
        return False

    results = payload.get("quoteResponse", {}).get("result", [])
    if results:
        print("   OK: JSON response with results")
        return True

    print("   FAIL: JSON response but empty results")
    return False


def test_symbol(symbol: str, session: requests.Session) -> None:
    print("-" * 60)
    print(f"Test yfinance for {symbol}")

    yahoo_ok = check_yahoo_api(session, symbol)
    if not yahoo_ok:
        print("   NOTE: Yahoo response looks blocked; yfinance may fail.")

    # Test 1: fast_info quote
    print("1) Fetch fast_info quote")
    ticker = yf.Ticker(symbol, session=session)
    try:
        info = ticker.fast_info
        price = info.get("lastPrice")
        if price is not None:
            change = info.get("regularMarketChange", 0)
            change_pct = info.get("regularMarketChangePercent", 0)
            print(f"   OK price={price:.2f} change={change:+.2f} ({change_pct:+.2f}%)")
        else:
            print("   FAIL: missing lastPrice")
    except Exception as exc:
        print(f"   FAIL: quote error: {exc}")

    time.sleep(1)

    # Test 2: history
    print("2) Fetch history (1mo, 1d)")
    try:
        hist = ticker.history(period="1mo", interval="1d")
        if hist is not None and not hist.empty:
            first_close = hist["Close"].iloc[0]
            last_close = hist["Close"].iloc[-1]
            print(
                f"   OK rows={len(hist)} first_close={first_close:.2f} "
                f"last_close={last_close:.2f}"
            )
        else:
            print("   FAIL: empty history")
    except Exception as exc:
        print(f"   FAIL: history error: {exc}")


if __name__ == "__main__":
    print("=" * 60)
    print("YFINANCE TEST")
    print("=" * 60)

    session = build_session()
    symbols = ["AAPL", "MSFT", "DOL.TO"]
    for sym in symbols:
        test_symbol(sym, session)
        time.sleep(1)

    print("=" * 60)
    print("DONE")
    print("=" * 60)

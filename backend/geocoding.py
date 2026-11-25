"""Manual place lookup: persistent cache, identifying UA, at most one request/second."""
import json
import os
import threading
import time
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

from .store import Store

_lock = threading.Lock()
_last_request = 0.0


def search_places(store: Store, query: str) -> list[dict]:
    global _last_request
    query = query.strip()
    if len(query) < 2 or len(query) > 200:
        raise ValueError('Wpisz nazwę miejscowości (2–200 znaków).')
    key = query.casefold()
    with _lock:
        with store.connect() as db:
            db.execute('CREATE TABLE IF NOT EXISTS geocoding_cache (query TEXT PRIMARY KEY, payload TEXT NOT NULL)')
            cached = db.execute('SELECT payload FROM geocoding_cache WHERE query=?', (key,)).fetchone()
        if cached:
            return json.loads(cached[0])
        delay = 1.1 - (time.monotonic() - _last_request)
        if delay > 0:
            time.sleep(delay)
        _last_request = time.monotonic()
        base = os.environ.get('KORZENIE_GEOCODER_URL', 'https://nominatim.openstreetmap.org/search')
        params = urlencode(dict(q=query, format='jsonv2', limit=6, addressdetails=1, **{'accept-language':'pl'}))
        request = Request(base+'?'+params, headers={'User-Agent':os.environ.get('KORZENIE_GEOCODER_USER_AGENT','Korzenie/0.2.0 (local genealogy application; explicit place lookup)'), 'Accept':'application/json'})
        try:
            with urlopen(request, timeout=12) as response:
                data = json.loads(response.read(1024*1024))
            if not isinstance(data, list):
                raise ValueError('Nieprawidłowa odpowiedź wyszukiwarki miejsc.')
            result = []
            for item in data[:6]:
                lat, lon = float(item['lat']), float(item['lon'])
                if not -90 <= lat <= 90 or not -180 <= lon <= 180:
                    continue
                result.append(dict(lat=lat, lon=lon, label=str(item['display_name'])[:1000], name=str(item.get('name') or item['display_name'].split(',')[0])[:500], source='nominatim'))
        except (HTTPError, URLError, TimeoutError, ValueError, KeyError, TypeError) as exc:
            raise RuntimeError('Nie udało się wyszukać miejsca. Sprawdź internet lub wpisz współrzędne ręcznie.') from exc
        with store.connect() as db:
            db.execute('INSERT OR REPLACE INTO geocoding_cache VALUES (?,?)', (key,json.dumps(result,ensure_ascii=False)))
        return result

"""Local-only FastAPI application; production frontend is served from dist/."""
import io
import os
import sqlite3
import uuid
import zipfile
from pathlib import Path
from urllib.parse import quote
from tempfile import TemporaryDirectory
from typing import Literal

from fastapi import Body, FastAPI, File, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse, Response
from fastapi.staticfiles import StaticFiles
from backend.models import State
from backend.geocoding import search_places

from backend.store import Store, Conflict
from backend.gedcom import export_tree, import_gedcom
from backend.packages import read_package, safe_archive_path, MAX_PACKAGE
from backend.media import check_media

PROJECT = Path(__file__).resolve().parents[1]
MAX_FILE = 20 * 1024 * 1024
ALLOWED = {'.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.pdf': 'application/pdf', '.txt': 'text/plain', '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'}


def create_app(
    data_dir: str | Path | None = None, *, desktop_origin: str | None = None
) -> FastAPI:
    store = Store(Path(data_dir or os.environ.get('GENEALOGY_DATA_DIR', PROJECT / 'data')))
    app = FastAPI(title='KinEver — lokalne API', version='1.0.0')
    app.state.store = store

    @app.middleware('http')
    async def local_guard(request: Request, call_next):
        host = request.url.hostname
        if host not in ('127.0.0.1', 'localhost', 'testserver'):
            return Response('Nieprawidłowy host.', status_code=403)
        origin = request.headers.get('origin')
        if origin and origin not in (desktop_origin, 'http://127.0.0.1:5173', 'http://localhost:5173', 'http://127.0.0.1:8000', 'http://localhost:8000'):
            return Response('Niedozwolone źródło żądania.', status_code=403)
        if request.headers.get('sec-fetch-site') == 'cross-site':
            return Response('Niedozwolone źródło żądania.', status_code=403)
        length = request.headers.get('content-length', '0')
        if not length.isdigit() or int(length) > 50 * 1024 * 1024:
            return Response('Żądanie przekracza limit 50 MB.', status_code=413)
        response = await call_next(request)
        response.headers['X-Content-Type-Options'] = 'nosniff'
        response.headers['Cache-Control'] = 'no-store'
        return response

    @app.get('/api/preferences/language')
    def get_language():
        with store.connect() as db:
            row = db.execute("SELECT value FROM preferences WHERE key='language'").fetchone()
        return {'language': row[0] if row else None}

    @app.put('/api/preferences/language')
    def save_language(language: Literal['pl', 'en'] = Body(embed=True)):
        with store.connect() as db:
            db.execute(
                "INSERT INTO preferences VALUES ('language', ?) "
                'ON CONFLICT(key) DO UPDATE SET value=excluded.value',
                (language,),
            )
        return {'language': language}

    @app.post('/api/database/reveal')
    def reveal_database(request: Request):
        if request.headers.get('x-korzenie-action') != 'reveal-database' or request.headers.get('origin') != str(request.base_url).rstrip('/'):
            raise HTTPException(403, 'Otwórz lokalizację z poziomu aplikacji.')
        if os.name != 'nt':
            raise HTTPException(501, 'Otwieranie lokalizacji jest dostępne w Windows.')
        try:
            os.startfile(str(store.db.resolve().parent))
        except OSError as exc:
            raise HTTPException(500, 'Nie udało się otworzyć folderu bazy danych.') from exc
        return {'ok': True}

    @app.get('/api/health')
    def health():
        return {'status': 'ok', 'storage': 'sqlite'}

    @app.get('/api/places/search')
    def place_search(q: str):
        try:
            return search_places(store, q)
        except ValueError as exc:
            raise HTTPException(422, str(exc))
        except RuntimeError as exc:
            raise HTTPException(503, str(exc))

    @app.get('/api/state')
    def read_state():
        return store.read()

    @app.put('/api/state')
    def write_state(state: State):
        try:
            state = state.model_dump(by_alias=True, exclude_unset=True, exclude_none=True)
            return {'revision': store.write(state)}
        except Conflict as exc:
            raise HTTPException(409, str(exc))
        except (ValueError, KeyError, TypeError, sqlite3.IntegrityError) as exc:
            raise HTTPException(422, str(exc))

    @app.post('/api/media', status_code=201)
    async def upload(file: UploadFile = File(...)):
        name = Path((file.filename or 'plik').replace('\\', '/')).name[:200]
        suffix = Path(name).suffix.lower()
        if suffix not in ALLOWED:
            raise HTTPException(415, 'Dozwolone: JPEG, PNG, WebP, PDF, TXT i DOCX.')
        mid = str(uuid.uuid4()) + suffix
        path = store.root / 'media' / mid
        size = 0
        head = b''
        try:
            with path.open('xb') as output:
                while chunk := await file.read(65536):
                    size += len(chunk)
                    if size > MAX_FILE:
                        raise HTTPException(413, 'Maksymalny rozmiar pliku to 20 MB.')
                    if len(head) < 16:
                        head += chunk[:16]
                    output.write(chunk)
            if size == 0:
                raise HTTPException(422, 'Plik jest pusty.')
            valid = {'.jpg': head.startswith(b'\xff\xd8\xff'), '.jpeg': head.startswith(b'\xff\xd8\xff'), '.png': head.startswith(b'\x89PNG\r\n\x1a\n'), '.webp': head.startswith(b'RIFF') and head[8:12] == b'WEBP', '.pdf': head.startswith(b'%PDF-'), '.docx': head.startswith(b'PK'), '.txt': True}[suffix]
            if not valid:
                raise HTTPException(415, 'Zawartość pliku nie pasuje do rozszerzenia.')
            if suffix == '.docx':
                try:
                    with zipfile.ZipFile(path) as archive:
                        if 'word/document.xml' not in archive.namelist():
                            raise ValueError()
                except (ValueError, zipfile.BadZipFile):
                    raise HTTPException(415, 'Nieprawidłowy dokument DOCX.')
            with store.connect() as db:
                db.execute('INSERT INTO media VALUES (?,?,?,?)', (mid, name, ALLOWED[suffix], size))
        except Exception:
            path.unlink(missing_ok=True)
            raise
        finally:
            await file.close()
        return dict(id=mid, name=name, mime=ALLOWED[suffix], size=size, url=f'/api/media/{mid}')

    @app.get('/api/media/{mid}')
    def media_file(mid: str, download: bool = False):
        with store.connect() as db:
            row = db.execute('SELECT name,mime FROM media WHERE id=?', (mid,)).fetchone()
        if not row:
            raise HTTPException(404, 'Nie znaleziono pliku.')
        if not (store.root / 'media' / mid).is_file():
            raise HTTPException(404, 'Brakuje pliku na dysku. Przywróć go z kopii zapasowej.')
        return FileResponse(store.root / 'media' / mid, media_type=row[1], filename=row[0], content_disposition_type='inline' if row[1].startswith('image/') and not download else 'attachment')

    @app.get('/api/trees/{tree_id}/export')
    def export(tree_id: str, format: str = 'ged'):
        state = store.read()
        tree = next((t for t in state['trees'] if t['id'] == tree_id), None)
        if not tree:
            raise HTTPException(404, 'Nie znaleziono drzewa.')
        if format not in ('ged', 'gdz', 'ged551', 'zip551'):
            raise HTTPException(422, 'Wybierz ged, ged551, gdz lub zip551.')
        with store.connect() as db:
            media = {r[0]: dict(name=r[1], mime=r[2]) for r in db.execute('SELECT id,name,mime FROM media')}
        ged, mids = export_tree(tree, state['connectionsByTree'].get(tree_id, []), media, '5.5.1' if format in ('ged551', 'zip551') else '7.0')
        payload, mime = ged, 'text/vnd.familysearch.gedcom'
        if format in ('gdz', 'zip551'):
            buffer = io.BytesIO()
            with zipfile.ZipFile(buffer, 'w', zipfile.ZIP_DEFLATED) as archive:
                archive.writestr('gedcom.ged', ged)
                for mid in mids:
                    archive.write(store.root / 'media' / mid, f'media/{mid}')
            payload, mime = buffer.getvalue(), 'application/vnd.familysearch.gedcom+zip' if format == 'gdz' else 'application/zip'
        return Response(payload, media_type=mime, headers={'Content-Disposition': f"attachment; filename*=UTF-8''{quote(tree['name'], safe='')}.{'ged' if format == 'ged551' else 'zip' if format == 'zip551' else format}"})

    @app.post('/api/import')
    async def import_file(file: UploadFile = File(...)):
        filename = file.filename or 'album.ged'
        raw = await file.read(MAX_PACKAGE + 1)
        await file.close()
        if len(raw) > MAX_PACKAGE:
            raise HTTPException(413, 'Limit pakietu importu to 40 MB.')
        created = []
        try:
            ged, package_files = read_package(raw, filename)
            tree, links = import_gedcom(ged, include_media=True)
            tree['name'] = Path(filename.replace('\\','/')).stem[:180] or 'Zaimportowane drzewo'
            state = store.read()
            media_records = []
            imported = {}
            missing = set()
            for person in tree['people']:
                for ref in person.pop('_mediaRefs', []):
                    try:
                        path = safe_archive_path(ref['path'])
                    except ValueError:
                        missing.add(ref['path'])
                        continue
                    content = package_files.get(path)
                    if content is None:
                        missing.add(path)
                        continue
                    if path not in imported:
                        name = Path(ref['name'].replace('\\','/')).name[:200] or Path(path).name
                        # The stored file extension comes from FILE, not an arbitrary descriptive title.
                        if Path(name).suffix.lower() != Path(path).suffix.lower():
                            name += Path(path).suffix.lower()
                        suffix, mime = check_media(name, content)
                        mid = str(uuid.uuid4()) + suffix
                        destination = store.root / 'media' / mid
                        created.append(destination)
                        destination.write_bytes(content)
                        item = dict(id=mid, name=name, mime=mime, size=len(content), url=f'/api/media/{mid}')
                        imported[path] = item
                        media_records.append(item)
                    item = imported[path]
                    portrait = ref['role']=='KORZENIE:PORTRAIT' or (not ref['role'] and not person.get('photo') and item['mime'].startswith('image/'))
                    if portrait and item['mime'].startswith('image/') and not person.get('photo'):
                        person['photo'] = item['url']
                    else:
                        person['attachments'].append({**item, 'caption':ref['caption']})
            state['trees'].append(tree)
            state['connectionsByTree'][tree['id']] = links
            store.write(state, media_records)
            created.clear()
            warning = f'Brak {len(missing)} plików wskazanych w GEDCOM. Dane rodzinne zaimportowano; niedostępnych mediów nie pobierano z dysku ani internetu.' if missing else ''
            return {'treeId':tree['id'], 'people':len(tree['people']), 'mediaCount':len(media_records), 'warning':warning}
        except Conflict as exc:
            raise HTTPException(409, str(exc))
        except (ValueError, KeyError, UnicodeError) as exc:
            raise HTTPException(422, str(exc))
        finally:
            for path in created:
                path.unlink(missing_ok=True)

    @app.get('/api/trees/{tree_id}/view')
    def get_view(tree_id: str):
        import json
        with store.connect() as db:
            row = db.execute('SELECT payload FROM views WHERE tree_id=?', (tree_id,)).fetchone()
        return json.loads(row[0]) if row else None

    @app.put('/api/trees/{tree_id}/view')
    def save_view(tree_id: str, payload: dict):
        import json
        encoded = json.dumps(payload)
        if len(encoded) > 1024 * 1024:
            raise HTTPException(413, 'Układ drzewa przekracza limit.')
        with store.connect() as db:
            if not db.execute('SELECT 1 FROM trees WHERE id=?', (tree_id,)).fetchone():
                raise HTTPException(404, 'Nie znaleziono drzewa.')
            db.execute('INSERT INTO views VALUES (?,?) ON CONFLICT(tree_id) DO UPDATE SET payload=excluded.payload', (tree_id, encoded))
        return {'ok': True}

    @app.get('/api/backup')
    def backup():
        # SQLite online backup yields a consistent database even while the app runs.
        buffer = io.BytesIO()
        with TemporaryDirectory(dir=store.root) as temporary:
            destination = Path(temporary) / 'genealogy.sqlite3'
            with store.connect() as source:
                target = sqlite3.connect(destination)
                try:
                    source.backup(target)
                    mids = [row[0] for row in target.execute('SELECT id FROM media')]
                finally:
                    target.close()
            with zipfile.ZipFile(buffer, 'w', zipfile.ZIP_DEFLATED) as archive:
                archive.write(destination, 'genealogy.sqlite3')
                for mid in mids:
                    archive.write(store.root / 'media' / mid, f'media/{mid}')
        return Response(buffer.getvalue(), media_type='application/zip', headers={'Content-Disposition': 'attachment; filename="KinEver-backup.zip"'})

    if (PROJECT / 'dist').exists():
        app.mount('/', StaticFiles(directory=PROJECT / 'dist', html=True), name='frontend')
    return app


app = create_app() if not getattr(__import__('sys'), 'frozen', False) else None

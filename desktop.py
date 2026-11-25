"""KinEver desktop entry point for Windows."""
import ctypes
import logging
import msvcrt
import os
from pathlib import Path
import socket
import sys
import tempfile
import threading
import time
from urllib.request import urlopen

import uvicorn
import webview

from backend.main import create_app

VERSION = '1.0.0'


def run(root: Path, *, smoke_test: bool = False) -> None:
    root.mkdir(parents=True, exist_ok=True)
    with (root / 'desktop.lock').open('a+b') as lock:
        lock.seek(0)
        try:
            msvcrt.locking(lock.fileno(), msvcrt.LK_NBLCK, 1)
        except OSError as exc:
            raise RuntimeError('KinEver jest już otwarty.') from exc
        with socket.socket() as listener:
            listener.bind(('127.0.0.1', 0))
            listener.listen()
            port = listener.getsockname()[1]
            url = f'http://127.0.0.1:{port}'
            app = create_app(root, desktop_origin=url)
            server = uvicorn.Server(uvicorn.Config(
                app, port=port, log_config=None, access_log=False, ws='none',
            ))
            worker = threading.Thread(
                target=server.run, kwargs={'sockets': [listener]}, daemon=True,
            )
            worker.start()
            try:
                deadline = time.monotonic() + 15
                while not server.started and worker.is_alive() and time.monotonic() < deadline:
                    time.sleep(0.05)
                if not server.started:
                    raise RuntimeError('Nie udało się uruchomić aplikacji.')
                with urlopen(url + '/', timeout=5) as response:
                    if response.status != 200 or 'text/html' not in response.headers['Content-Type']:
                        raise RuntimeError('Brakuje interfejsu aplikacji.')
                if smoke_test:
                    with urlopen(url + '/api/state', timeout=5) as response:
                        assert b'"trees":[]' in response.read()
                    return
                webview.settings['ALLOW_DOWNLOADS'] = True
                webview.create_window(f'KinEver · {VERSION}', url, width=1250, height=850,
                                      min_size=(600, 480), confirm_close=False)
                webview.start(gui='edgechromium')
            finally:
                server.should_exit = True
                worker.join(timeout=5)


if __name__ == '__main__':
    if '--self-test' in sys.argv:
        with tempfile.TemporaryDirectory() as folder:
            run(Path(folder), smoke_test=True)
    else:
        root = Path(os.environ['LOCALAPPDATA']) / 'Korzenie' / 'alpha'
        try:
            root.mkdir(parents=True, exist_ok=True)
            logging.basicConfig(filename=root / 'korzenie.log', encoding='utf-8', level=logging.INFO)
            run(root)
        except Exception as exc:
            logging.exception('Nie udało się uruchomić KinEver')
            ctypes.windll.user32.MessageBoxW(None, str(exc), 'KinEver', 0x10)

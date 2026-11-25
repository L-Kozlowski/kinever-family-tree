"""Read genealogy packages without extracting archive paths onto the filesystem."""
import io
import stat
import zipfile
from pathlib import PurePosixPath
from urllib.parse import unquote

MAX_FILE = 20 * 1024 * 1024
MAX_PACKAGE = 40 * 1024 * 1024
MAX_EXPANDED = 200 * 1024 * 1024


def safe_archive_path(value: str) -> str:
    value = unquote(value)
    if not value or '\\' in value or ':' in value or value.startswith('/') or '\x00' in value:
        raise ValueError('Archiwum zawiera niedozwoloną ścieżkę pliku.')
    path = PurePosixPath(value)
    if '..' in path.parts:
        raise ValueError('Archiwum zawiera ścieżkę wychodzącą poza pakiet.')
    return str(path)


def read_package(raw: bytes, name: str) -> tuple[bytes, dict[str, bytes]]:
    if name.lower().endswith(('.ged', '.gedcom')):
        if len(raw) > MAX_FILE:
            raise ValueError('Limit pliku GEDCOM to 20 MB.')
        return raw, {}
    if not name.lower().endswith(('.gdz', '.gedzip', '.zip')):
        raise ValueError('Wybierz GEDCOM (.ged), GEDZIP (.gdz) lub ZIP z plikiem GEDCOM.')
    if len(raw) > MAX_PACKAGE:
        raise ValueError('Limit archiwum to 40 MB.')
    try:
        archive = zipfile.ZipFile(io.BytesIO(raw))
        with archive:
            items = {}
            expanded = 0
            for info in archive.infolist():
                key = safe_archive_path(info.orig_filename)
                if stat.S_ISLNK(info.external_attr >> 16) or info.flag_bits & 1:
                    raise ValueError('Dowiązania i zaszyfrowane archiwa nie są obsługiwane.')
                if info.is_dir():
                    continue
                if key in items:
                    raise ValueError('Archiwum zawiera powielone ścieżki.')
                expanded += info.file_size
                if len(items) >= 2000 or info.file_size > MAX_FILE or expanded > MAX_EXPANDED:
                    raise ValueError('Pakiet przekracza limit plików lub rozmiaru po rozpakowaniu (200 MB).')
                items[key] = info
            candidates = [key for key in items if key.lower().endswith(('.ged', '.gedcom'))]
            ged_name = 'gedcom.ged' if 'gedcom.ged' in candidates else candidates[0] if len(candidates) == 1 else None
            if not ged_name:
                raise ValueError('Pakiet musi zawierać jeden plik GEDCOM albo główny gedcom.ged.')
            ged = archive.read(items[ged_name])
            files = {key: archive.read(info) for key, info in items.items() if key != ged_name}
            # FILE references are relative to the GEDCOM file's directory.
            folder = str(PurePosixPath(ged_name).parent)
            if folder != '.':
                files = {key[len(folder)+1:]: content for key, content in files.items() if key.startswith(folder+'/')}
            return ged, files
    except (zipfile.BadZipFile, RuntimeError, NotImplementedError) as exc:
        raise ValueError('Nie można odczytać archiwum ZIP/GEDZIP.') from exc

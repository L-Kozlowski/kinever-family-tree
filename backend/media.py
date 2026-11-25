"""Shared content checks for uploads and imported media."""
import io
import zipfile
from pathlib import Path

MIME_TYPES = {'.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.webp':'image/webp','.pdf':'application/pdf','.txt':'text/plain','.docx':'application/vnd.openxmlformats-officedocument.wordprocessingml.document'}


def check_media(name: str, content: bytes) -> tuple[str,str]:
    suffix = Path(name).suffix.lower()
    if suffix not in MIME_TYPES:
        raise ValueError('Nieobsługiwany załącznik: ' + name + '. Dozwolone: JPEG, PNG, WebP, PDF, TXT i DOCX.')
    if not content or len(content)>20*1024*1024:
        raise ValueError('Załącznik jest pusty lub przekracza 20 MB: ' + name)
    valid = {'.jpg':content.startswith(b'\xff\xd8\xff'),'.jpeg':content.startswith(b'\xff\xd8\xff'),'.png':content.startswith(b'\x89PNG\r\n\x1a\n'),'.webp':content.startswith(b'RIFF') and content[8:12]==b'WEBP','.pdf':content.startswith(b'%PDF-'),'.txt':True,'.docx':content.startswith(b'PK')}[suffix]
    if not valid:
        raise ValueError('Zawartość załącznika nie pasuje do rozszerzenia: ' + name)
    if suffix=='.docx':
        try:
            with zipfile.ZipFile(io.BytesIO(content)) as archive:
                if 'word/document.xml' not in archive.namelist():
                    raise ValueError('Nieprawidłowy dokument DOCX: ' + name)
        except zipfile.BadZipFile as exc:
            raise ValueError('Nieprawidłowy dokument DOCX: ' + name) from exc
    return suffix,MIME_TYPES[suffix]

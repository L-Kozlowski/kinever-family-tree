"""GEDCOM 7 export and a deliberately bounded GEDCOM 5.5.1/7 importer."""
import re
import uuid
from collections import defaultdict
from typing import Any


def multiline(level: int, tag: str, text: str) -> list[str]:
    values = str(text).replace('\r', '').split('\n')
    values = ['@' + v if v.startswith('@') else v for v in values]
    return [f'{level} {tag} {values[0]}'] + [f'{level+1} CONT {v}' for v in values[1:]]


MONTHS = ('JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC')


def standard_date(value: str) -> str:
    value = value.strip()
    if re.fullmatch(r'\d{3,4}', value):
        return value
    match = re.fullmatch(r'(\d{4})-(\d{2})-(\d{2})', value)
    if match:
        year, month, day = map(int, match.groups())
    else:
        match = re.fullmatch(r'(\d{1,2})[./](\d{1,2})[./](\d{4})', value)
        if not match:
            approximate = re.fullmatch(r'ok\.?\s*(\d{3,4})', value, re.I)
            if approximate:
                return 'ABT ' + approximate[1]
            return value if re.fullmatch(r'(?:(?:ABT|BEF|AFT|CAL|EST) )?(?:\d{1,2} )?(?:(?:JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC) )?\d{3,4}', value) else ''
        day, month, year = map(int, match.groups())
    try:
        from datetime import date
        date(year, month, day)
        return f'{day} {MONTHS[month-1]} {year}'
    except ValueError:
        return ''


def export_tree(tree: dict[str, Any], connections: list[dict[str, str]], media: dict[str, Any], version: str = '7.0') -> tuple[bytes, list[str]]:
    legacy = version == '5.5.1'
    def text(level, tag, value):
        if not legacy:
            return multiline(level, tag, value)
        rows = str(value).replace('\r', '').split('\n')
        result = []
        for index, row in enumerate(rows):
            prefix = f'{level} {tag} ' if index == 0 else f'{level+1} CONT '
            # Small chunks keep each UTF-8 encoded GEDCOM 5 line below 255 bytes.
            chunks = [row[i:i+45] for i in range(0, len(row), 45)] or ['']
            result.append(prefix + chunks[0].replace('@', '@@'))
            result += [f'{level+1} CONC ' + chunk.replace('@', '@@') for chunk in chunks[1:]]
        return result
    lines = ['0 HEAD', '1 SOUR KINEVER', '2 NAME KinEver', '1 GEDC', f'2 VERS {version}']
    if legacy:
        lines += ['2 FORM LINEAGE-LINKED', '1 CHAR UTF-8', '1 SUBM @SUB1@', '1 LANG Polish']
    else:
        lines += ['1 LANG pl']
    def place_lines(level, name, location):
        result = text(level, 'PLAC', name)
        if location:
            lat, lon = location['lat'], location['lon']
            result += [f'{level+1} MAP', f"{level+2} LATI {'N' if lat >= 0 else 'S'}{abs(lat):.8f}", f"{level+2} LONG {'E' if lon >= 0 else 'W'}{abs(lon):.8f}"]
        return result

    people = tree['people']
    ids = {p['id']: f'I{i+1}' for i, p in enumerate(people)}
    families = {}
    for link in connections:
        if link['kind'] == 'partner':
            families.setdefault(tuple(sorted((link['source'], link['target']))), [])
    parents = defaultdict(list)
    for link in connections:
        if link['kind'] in ('parent', 'adoption'):
            parents[link['target']].append(link)
    for child, links in parents.items():
        key = tuple(sorted(link['source'] for link in links))
        families.setdefault(key, []).append((child, any(l['kind'] == 'adoption' for l in links)))
    fam_ids = {key: f'F{i+1}' for i, key in enumerate(families)}
    media_ids = {}
    media_captions = defaultdict(list)
    for person in people:
        lines.append(f"0 @{ids[person['id']]}@ INDI")
        surname = person.get('maidenName') or person.get('lastName', '')
        lines += text(1, 'NAME', f"{person['firstName']} /{surname.replace('/', '')}/")
        familiar_name = person.get('familiarName', '').strip()
        if familiar_name:
            lines += text(2, 'NICK', familiar_name)
        if person.get('maidenName') and person.get('lastName') != surname:
            lines += text(1, 'NAME', f"{person['firstName']} /{person['lastName'].replace('/', '')}/")
            lines += ['2 TYPE ' + ('married' if legacy else 'MARRIED')]
        if person.get('gender') in ('Kobieta', 'Mężczyzna', 'Inna'):
            lines.append('1 SEX ' + {'Kobieta': 'F', 'Mężczyzna': 'M', 'Inna': 'U' if legacy else 'X'}[person['gender']])
        for field, tag, place in [('birth', 'BIRT', 'birthPlace'), ('death', 'DEAT', None)]:
            date = person.get(field, '')
            if date or (place and (person.get(place) or person.get('birthLocation'))):
                lines.append(f'1 {tag}')
                if date:
                    normalized = standard_date(date)
                    if legacy:
                        lines += text(2, 'DATE', normalized or f'({date})')
                        if normalized and normalized != date:
                            lines += text(2, 'NOTE', 'Oryginalna data: ' + date)
                    else:
                        lines.append(f'2 DATE {normalized}'.rstrip())
                        if normalized != date:
                            lines += text(3, 'PHRASE', date)
                if place and (person.get(place) or person.get('birthLocation')):
                    lines += place_lines(2, person.get(place, ''), person.get('birthLocation'))
        if person.get('residence') or person.get('residenceLocation'):
            lines += ['1 RESI', *place_lines(2, person.get('residence', ''), person.get('residenceLocation'))]
        if person.get('notes'):
            lines += text(1, 'NOTE', person['notes'])
        for key, children in families.items():
            if person['id'] in key:
                lines.append(f'1 FAMS @{fam_ids[key]}@')
            for child, adopted in children:
                if child == person['id']:
                    lines.append(f'1 FAMC @{fam_ids[key]}@')
                    if adopted:
                        lines.append('2 PEDI ' + ('adopted' if legacy else 'ADOPTED'))
                        adopted_ids = {l['source'] for l in parents[child] if l['kind'] == 'adoption'}
                        ordered = sorted(key, key=lambda i: next((p.get('gender') == 'Kobieta' for p in people if p['id'] == i), False))
                        who = 'BOTH' if len(adopted_ids) == len(key) and len(key) == 2 else ('HUSB' if ordered[0] in adopted_ids else 'WIFE')
                        lines += ['1 ADOP', f'2 FAMC @{fam_ids[key]}@', f'3 ADOP {who}']
        refs = []
        if person.get('photo'):
            refs.append(dict(url=person['photo'], name='Portret', role='portrait'))
        refs += person.get('attachments', [])
        for attachment in refs:
            mid = attachment['url'].rsplit('/', 1)[-1]
            if mid not in media:
                continue
            media_key = (mid, attachment.get('role', 'attachment'))
            if media_key not in media_ids:
                media_ids[media_key] = f'M{len(media_ids)+1}'
            lines.append(f'1 OBJE @{media_ids[media_key]}@')
            if attachment.get('caption'):
                if legacy:
                    media_captions[media_key].append(attachment['caption'])
                else:
                    lines += text(2, 'TITL', attachment['caption'])
    for key, children in families.items():
        lines.append(f'0 @{fam_ids[key]}@ FAM')
        ordered = sorted(key, key=lambda i: next((p.get('gender') == 'Kobieta' for p in people if p['id'] == i), False))
        for index, parent in enumerate(ordered):
            lines.append(f"1 {('HUSB', 'WIFE')[index]} @{ids[parent]}@")
        for child, _ in children:
            lines.append(f'1 CHIL @{ids[child]}@')
    for (mid, role), xref in media_ids.items():
        item = media[mid]
        lines += [f'0 @{xref}@ OBJE', f'1 FILE media/{mid}', f"2 FORM {item['mime'].split('/')[-1] if legacy else item['mime']}"]
        lines += text(2, 'TITL', item['name'])
        lines += ['1 REFN ' + ('KORZENIE:PORTRAIT' if role == 'portrait' else 'KORZENIE:ATTACHMENT')]
        if legacy and media_captions[(mid, role)]:
            lines += text(1, 'NOTE', '\n'.join(media_captions[(mid, role)]))
    if legacy:
        lines += ['0 @SUB1@ SUBM', '1 NAME KinEver']
    lines += ['0 TRLR']
    return ('\n'.join(lines) + '\n').encode('utf-8'), list(dict.fromkeys(mid for mid, role in media_ids))


def import_gedcom(raw: bytes, include_media: bool = False) -> tuple[dict[str, Any], list[dict[str, str]]]:
    text = raw.decode('utf-8-sig')
    if len(text) > 20 * 1024 * 1024 or not re.search(r'^0 HEAD\s*$', text, re.M) or not re.search(r'^0 TRLR\s*$', text, re.M):
        raise ValueError('Wybierz kompletny plik GEDCOM w UTF-8 (do 20 MB).')
    records, current, stack = [], None, []
    for line in text.splitlines():
        match = re.fullmatch(r'(\d+) (?:(@[^@]+@) )?([A-Z_0-9]+)(?: (.*))?', line)
        if not match:
            raise ValueError('Nieprawidłowa linia GEDCOM.')
        level, xref, tag, value = match.groups()
        level = int(level)
        if level == 0:
            current = dict(xref=xref, tag=tag, value=value or '', children=[])
            records.append(current)
            stack = [current]
        else:
            if level > len(stack):
                raise ValueError('Nieprawidłowe zagnieżdżenie GEDCOM.')
            stack = stack[:level]
            node = dict(tag=tag, value=value or '', children=[])
            stack[-1]['children'].append(node)
            stack.append(node)
    is_v7 = any(n['tag'] == 'GEDC' and any(c['tag'] == 'VERS' and c['value'].startswith('7') for c in n['children']) for r in records if r['tag'] == 'HEAD' for n in r['children'])
    def unescape(value):
        return (value[1:] if value.startswith('@@') else value) if is_v7 else value.replace('@@', '@')
    def nodes(node, tag):
        return [n for n in node['children'] if n['tag'] == tag]
    def val(node, tag):
        found = nodes(node, tag)
        if not found:
            return ''
        n = found[0]
        return unescape(n['value']) + ''.join(('\n' if c['tag'] == 'CONT' else '') + unescape(c['value']) for c in n['children'] if c['tag'] in ('CONT', 'CONC'))
    media_records = {r['xref']: r for r in records if r['tag'] == 'OBJE' and r['xref']}
    def location_of(event):
        places = nodes(event, 'PLAC')
        maps = nodes(places[0], 'MAP') if places else []
        if not maps:
            return None
        def coordinate(raw, positive, negative, limit):
            raw = raw.strip().upper().replace(',', '.')
            direction = raw[0] if raw and raw[0] in 'NSEW' else ''
            value = float(raw[1:] if direction else raw)
            if direction and direction not in (positive, negative):
                raise ValueError('Nieprawidłowy kierunek współrzędnej GEDCOM.')
            if direction:
                value = abs(value) * (-1 if direction == negative else 1)
            if not -limit <= value <= limit:
                raise ValueError('Współrzędne GEDCOM są poza zakresem.')
            return value
        lat_raw, lon_raw = val(maps[0], 'LATI'), val(maps[0], 'LONG')
        if not lat_raw or not lon_raw:
            return None
        return dict(lat=coordinate(lat_raw,'N','S',90),lon=coordinate(lon_raw,'E','W',180),label=val(event,'PLAC'),source='gedcom')

    persons, xrefs = [], {}
    for rec in records:
        if rec['tag'] != 'INDI':
            continue
        pid = str(uuid.uuid4())
        if not rec['xref'] or rec['xref'] in xrefs:
            raise ValueError('Powielony identyfikator osoby GEDCOM.')
        xrefs[rec['xref']] = pid
        name = val(rec, 'NAME').split('/')
        surname = name[1] if len(name) > 1 else ''
        person = dict(id=pid, firstName=name[0].strip() or 'Nieznana osoba', lastName=surname, maidenName='', birth='', death='', birthPlace='', residence='', notes=val(rec, 'NOTE'), portrait=2, attachments=[])
        names = nodes(rec, 'NAME')
        familiar_name = next((nickname for entry in names if (nickname := val(entry, 'NICK').strip())), '')
        if familiar_name:
            person['familiarName'] = familiar_name
        if len(names) > 1 and val(names[1], 'TYPE').upper() == 'MARRIED':
            person['maidenName'] = surname
            married_value = unescape(names[1]['value']) + ''.join(unescape(c['value']) for c in names[1]['children'] if c['tag']=='CONC')
            married = married_value.split('/')
            person['lastName'] = married[1] if len(married) > 1 else surname
        person['gender'] = {'F': 'Kobieta', 'M': 'Mężczyzna', 'X': 'Inna'}.get(val(rec, 'SEX'), '')
        for tag, field in [('BIRT', 'birth'), ('DEAT', 'death')]:
            event = nodes(rec, tag)
            if event:
                person[field] = val(event[0], 'DATE')
                dates = nodes(event[0], 'DATE')
                original = val(event[0], 'NOTE')
                if original.startswith('Oryginalna data: '):
                    person[field] = original.removeprefix('Oryginalna data: ')
                if dates and val(dates[0], 'PHRASE'):
                    person[field] = val(dates[0], 'PHRASE')
                if tag == 'BIRT':
                    person['birthPlace'] = val(event[0], 'PLAC')
                    location = location_of(event[0])
                    if location:
                        person['birthLocation'] = location
        residence = nodes(rec, 'RESI')
        if residence:
            person['residence'] = val(residence[0], 'PLAC')
            location = location_of(residence[0])
            if location:
                person['residenceLocation'] = location
        if include_media:
            refs = []
            for link in nodes(rec, 'OBJE'):
                record = media_records.get(link['value'], link)
                for file in nodes(record, 'FILE'):
                    refs.append(dict(path=file['value'], name=val(file, 'TITL') or file['value'].rsplit('/',1)[-1], caption=val(link,'TITL') or val(record,'NOTE'), role=val(record,'REFN')))
            person['_mediaRefs'] = refs
        persons.append(person)
    links, seen = [], set()
    def add(a, b, kind):
        if a not in xrefs or b not in xrefs:
            raise ValueError('Rodzina wskazuje nieistniejącą osobę.')
        key = (a, b, kind)
        if key not in seen:
            seen.add(key)
            links.append(dict(id=str(uuid.uuid4()), source=xrefs[a], target=xrefs[b], kind=kind))
    for rec in records:
        if rec['tag'] == 'FAM':
            parents = [n['value'] for n in rec['children'] if n['tag'] in ('HUSB', 'WIFE')]
            if len(parents) == 2:
                add(*parents, 'partner')
            for child in nodes(rec, 'CHIL'):
                indi = next((r for r in records if r['xref'] == child['value']), {})
                adopted = any(n['value'] == rec['xref'] and val(n, 'PEDI').upper() == 'ADOPTED' for n in indi.get('children', []) if n['tag'] == 'FAMC')
                adopted_roles = set()
                for event in nodes(indi, 'ADOP'):
                    for fam in nodes(event, 'FAMC'):
                        if fam['value'] == rec['xref']:
                            adopted_roles.add(val(fam, 'ADOP').upper() or 'BOTH')
                for parent in parents:
                    role = next(n['tag'] for n in rec['children'] if n['tag'] in ('HUSB', 'WIFE') and n['value'] == parent)
                    is_adoptive = (role in adopted_roles or 'BOTH' in adopted_roles) if adopted_roles else adopted
                    add(parent, child['value'], 'adoption' if is_adoptive else 'parent')
    if not persons:
        raise ValueError('Plik nie zawiera osób.')
    tree = dict(id=str(uuid.uuid4()), name='Zaimportowane drzewo', description='Import GEDCOM', people=persons, updated='Przed chwilą')
    return tree, links

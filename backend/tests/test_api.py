import io
import zipfile
import pytest
from fastapi.testclient import TestClient
from backend.main import create_app
from backend.gedcom import export_tree, import_gedcom


def person(pid, name='Jan'):
    return dict(id=pid, firstName=name, lastName='Testowy', maidenName='', birth='ok. 1950', death='', birthPlace='Łódź', residence='Kraków', notes='Wspomnienia\nDruga linia @ znak', portrait=2, attachments=[])


@pytest.fixture
def client(tmp_path):
    with TestClient(create_app(tmp_path)) as client:
        yield client


def state(people=None, links=None):
    return dict(revision=0, trees=[dict(id='t', name='Testowy album', description='', updated='', people=people or [person('a'), person('b', 'Anna'), person('c', 'Ewa')])], connectionsByTree={'t': links or [dict(id='p', source='a', target='b', kind='partner'), dict(id='r1', source='a', target='c', kind='parent'), dict(id='r2', source='b', target='c', kind='parent')]})


def test_persistence_and_optimistic_lock(client, tmp_path):
    original = state()
    assert client.put('/api/state', json=original).json() == {'revision': 1}
    restarted = TestClient(create_app(tmp_path))
    saved = restarted.get('/api/state').json()
    assert saved['trees'] == original['trees']
    assert saved['connectionsByTree'] == original['connectionsByTree']
    assert client.put('/api/state', json=original).status_code == 409
    assert restarted.get('/api/state').json()['revision'] == 1


def test_graph_validation_rolls_back(client):
    data = state()
    assert client.put('/api/state', json=data).status_code == 200
    data['revision'] = 1
    data['connectionsByTree']['t'].append(dict(id='cycle', source='c', target='a', kind='parent'))
    assert client.put('/api/state', json=data).status_code == 422
    assert len(client.get('/api/state').json()['connectionsByTree']['t']) == 3
    data['connectionsByTree']['t'][-1]['target'] = 'missing'
    assert client.put('/api/state', json=data).status_code == 422


def test_media_export_and_backup(client):
    content = b'%PDF-1.4\nSynthetic test document\n%%EOF'
    uploaded = client.post('/api/media', files={'file': ('../akt.pdf', content, 'application/pdf')})
    assert uploaded.status_code == 201
    media = uploaded.json()
    assert media['name'] == 'akt.pdf'
    data = state()
    data['trees'][0]['people'][0]['attachments'] = [{**media, 'caption': 'Akt urodzenia'}]
    assert client.put('/api/state', json=data).status_code == 200
    assert client.get(media['url']).content == content
    assert 'attachment' in client.get(media['url']).headers['content-disposition']
    result = client.get('/api/trees/t/export?format=gdz')
    assert result.status_code == 200
    with zipfile.ZipFile(io.BytesIO(result.content)) as archive:
        assert archive.read('media/' + media['id']) == content
        ged = archive.read('gedcom.ged').decode()
        assert '1 FILE media/' + media['id'] in ged
        assert 'Akt urodzenia' in ged
        assert '2 CONT Druga linia @ znak' in ged
    backup = client.get('/api/backup')
    with zipfile.ZipFile(io.BytesIO(backup.content)) as archive:
        assert 'genealogy.sqlite3' in archive.namelist()
        assert archive.read('media/' + media['id']) == content


def test_upload_rejects_active_and_fake_files(client):
    assert client.post('/api/media', files={'file': ('evil.html', b'<script/>')}).status_code == 415
    assert client.post('/api/media', files={'file': ('fake.png', b'not png')}).status_code == 415
    assert client.post('/api/media', files={'file': ('bad.docx', b'PKbad')}).status_code == 415
    assert client.get('/api/media/absent').status_code == 404
    data = state()
    data['trees'][0]['people'][0]['photo'] = '/etc/passwd'
    assert client.put('/api/state', json=data).status_code == 422


def test_cross_origin_and_host_blocked(client):
    assert client.put('/api/state', json=state(), headers={'Origin': 'https://evil.example'}).status_code == 403
    assert client.get('/api/state', headers={'Host': 'evil.example'}).status_code == 403


def test_gedcom_roundtrip_and_import(client):
    data = state()
    data['trees'][0]['people'][1].update(maidenName='Rodowa', lastName='Zamężna', gender='Kobieta')
    data['connectionsByTree']['t'][1]['kind'] = 'adoption'
    data['connectionsByTree']['t'][2]['kind'] = 'adoption'
    assert client.put('/api/state', json=data).status_code == 200
    raw = client.get('/api/trees/t/export').content
    tree, links = import_gedcom(raw)
    assert len(tree['people']) == 3
    assert tree['people'][0]['birth'] == 'ok. 1950'
    assert tree['people'][0]['notes'] == data['trees'][0]['people'][0]['notes']
    assert tree['people'][1]['maidenName'] == 'Rodowa'
    assert tree['people'][1]['lastName'] == 'Zamężna'
    assert sum(l['kind'] == 'adoption' for l in links) == 2
    response = client.post('/api/import', files={'file': ('test.ged', raw)})
    assert response.status_code == 200
    assert len(client.get('/api/state').json()['trees']) == 2


def test_invalid_import_does_not_modify_state(client):
    assert client.post('/api/import', files={'file': ('bad.ged', b'not a family')}).status_code == 422
    assert client.get('/api/state').json()['trees'] == []


def test_single_parent_and_multiple_partners_roundtrip():
    data = state()
    data['trees'][0]['people'] += [person('d'), person('e'), person('f')]
    data['connectionsByTree']['t'] += [dict(id='p2', source='a', target='d', kind='partner'), dict(id='r3', source='a', target='e', kind='parent'), dict(id='r4', source='d', target='e', kind='parent'), dict(id='r5', source='a', target='f', kind='parent')]
    raw, _ = export_tree(data['trees'][0], data['connectionsByTree']['t'], {})
    tree, links = import_gedcom(raw)
    assert len(tree['people']) == 6
    assert sum(l['kind'] == 'partner' for l in links) == 2
    assert sum(l['kind'] == 'parent' for l in links) == 5


def test_schema_errors_are_422(client):
    assert client.put('/api/state', json={'revision': 0, 'trees': [42], 'connectionsByTree': {}}).status_code == 422
    assert client.put('/api/state', json=state([dict(id='a', firstName=42)])).status_code == 422


def test_view_survives_person_save_and_restart(client, tmp_path):
    assert client.put('/api/state', json=state()).status_code == 200
    view = {'positions': {'a': {'x': 12, 'y': 24}}, 'viewport': {'x': 0, 'y': 10, 'zoom': 0.8}}
    assert client.put('/api/trees/t/view', json=view).status_code == 200
    data = client.get('/api/state').json()
    data['trees'][0]['people'][0]['notes'] = 'Nowa notatka'
    assert client.put('/api/state', json=data).status_code == 200
    with TestClient(create_app(tmp_path)) as restarted:
        assert restarted.get('/api/trees/t/view').json() == view


def test_mixed_adoption_preserved():
    data = state()
    data['connectionsByTree']['t'][1]['kind'] = 'adoption'
    raw, _ = export_tree(data['trees'][0], data['connectionsByTree']['t'], {})
    tree, links = import_gedcom(raw)
    assert sum(l['kind'] == 'adoption' for l in links) == 1
    assert sum(l['kind'] == 'parent' for l in links) == 1


def test_gedcom7_escaping():
    data = state()
    note = '@leading\nemail@example.com\n@next @@ literal'
    data['trees'][0]['people'][0]['notes'] = note
    raw, _ = export_tree(data['trees'][0], data['connectionsByTree']['t'], {})
    assert b'1 NOTE @@leading' in raw
    assert b'2 CONT email@example.com' in raw
    tree, _ = import_gedcom(raw)
    assert tree['people'][0]['notes'] == note


def test_legacy_export_for_other_apps(client):
    assert client.put('/api/state', json=state()).status_code == 200
    raw = client.get('/api/trees/t/export?format=ged551').content
    assert b'2 VERS 5.5.1' in raw
    assert b'2 FORM LINEAGE-LINKED' in raw
    assert b'1 CHAR UTF-8' in raw
    assert b'1 SUBM @SUB1@' in raw
    assert b'2 DATE ABT 1950' in raw
    tree, links = import_gedcom(raw)
    assert len(tree['people']) == 3
    assert len(links) == 3


def test_standard_dates_are_machine_readable():
    from backend.gedcom import standard_date
    assert standard_date('12.05.1956') == '12 MAY 1956'
    assert standard_date('1956-05-12') == '12 MAY 1956'
    assert standard_date('ok. 1956') == 'ABT 1956'
    assert standard_date('31.02.1956') == ''


def test_backup_restores_database_and_files(client, tmp_path):
    media = client.post('/api/media', files={'file': ('wspomnienia.txt', b'Synthetic record', 'text/plain')}).json()
    data = state()
    data['trees'][0]['people'][0]['attachments'] = [media]
    assert client.put('/api/state', json=data).status_code == 200
    archive = zipfile.ZipFile(io.BytesIO(client.get('/api/backup').content))
    restored_dir = tmp_path / 'restored'
    for name in archive.namelist():
        assert not name.startswith('/') and '..' not in name.split('/')
        path = restored_dir / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(archive.read(name))
    with TestClient(create_app(restored_dir)) as restored:
        assert restored.get('/api/state').json()['trees'] == data['trees']
        assert restored.get(media['url']).content == b'Synthetic record'
        result = restored.get('/api/trees/t/export?format=zip551')
        assert result.status_code == 200
        with zipfile.ZipFile(io.BytesIO(result.content)) as exported:
            assert b'2 VERS 5.5.1' in exported.read('gedcom.ged')
            assert exported.read('media/' + media['id']) == b'Synthetic record'

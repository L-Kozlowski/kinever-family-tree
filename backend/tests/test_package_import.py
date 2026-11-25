import io
import zipfile
import pytest
from fastapi.testclient import TestClient
from backend.main import create_app
from backend.tests.test_api import state

PNG = b'\x89PNG\r\n\x1a\n' + b'synthetic-test-payload'
PDF = b'%PDF-1.4\nSynthetic document\n%%EOF'


@pytest.fixture
def client(tmp_path):
    with TestClient(create_app(tmp_path)) as app:
        yield app


@pytest.mark.parametrize('format', ['ged', 'ged551', 'gdz', 'zip551'])
def test_export_import_family_with_media(client, format):
    portrait = client.post('/api/media', files={'file':('portrait.png',PNG,'image/png')}).json()
    picture = client.post('/api/media', files={'file':('album.png',PNG,'image/png')}).json()
    document = client.post('/api/media', files={'file':('akt.pdf',PDF,'application/pdf')}).json()
    data = state()
    data['trees'][0]['people'][0].update(photo=portrait['url'],attachments=[{**picture,'caption':'Fotografia rodzinna'},{**document,'caption':'Akt urodzenia'}])
    assert client.put('/api/state',json=data).status_code == 200
    exported = client.get('/api/trees/t/export?format='+format).content
    extension = {'ged':'ged','ged551':'ged','gdz':'gdz','zip551':'zip'}[format]
    result = client.post('/api/import',files={'file':('rodzina.'+extension,exported)})
    assert result.status_code == 200, result.text
    summary = result.json()
    saved = client.get('/api/state').json()
    imported = next(t for t in saved['trees'] if t['id']==summary['treeId'])
    assert len(imported['people'])==3
    assert imported['people'][0]['birth']=='ok. 1950'
    assert len(saved['connectionsByTree'][imported['id']])==3
    if format in ('gdz','zip551'):
        person = imported['people'][0]
        assert summary['mediaCount']==3
        assert summary['warning']==''
        assert client.get(person['photo']).content==PNG
        assert len(person['attachments'])==2
        assert person['attachments'][1]['caption']=='Akt urodzenia'
        assert client.get(person['attachments'][1]['url']).content==PDF
        assert person['photo']!=portrait['url'],'import copies media to a separate album'
    else:
        assert summary['mediaCount']==0
        assert 'Brak 3' in summary['warning']


def package(entries):
    output=io.BytesIO()
    with zipfile.ZipFile(output,'w') as archive:
        for name,content in entries.items():
            archive.writestr(name,content)
    raw = output.getvalue()
    for name in entries:
        if '\\' in name:
            raw = raw.replace(name.replace('\\','/').encode(), name.encode())
    return raw


@pytest.mark.parametrize('path',['../outside.txt','/absolute.txt','C:/secret.txt','media\\evil.txt','media/%2e%2e/evil.txt'])
def test_rejects_archive_path_traversal(client,path):
    raw=package({'gedcom.ged':b'0 HEAD\n1 GEDC\n2 VERS 7.0\n0 @I1@ INDI\n1 NAME Jan /Testowy/\n0 TRLR\n',path:b'test'})
    assert client.post('/api/import',files={'file':('unsafe.zip',raw)}).status_code==422
    assert client.get('/api/state').json()['trees']==[]


def test_attachment_without_profile_does_not_become_portrait(client):
    picture=client.post('/api/media',files={'file':('album.png',PNG,'image/png')}).json()
    data=state();data['trees'][0]['people'][0]['attachments']=[picture]
    assert client.put('/api/state',json=data).status_code==200
    raw=client.get('/api/trees/t/export?format=gdz').content
    result=client.post('/api/import',files={'file':('album.gdz',raw)}).json()
    person=next(t for t in client.get('/api/state').json()['trees'] if t['id']==result['treeId'])['people'][0]
    assert not person.get('photo')
    assert len(person['attachments'])==1


def test_invalid_graph_rolls_back_uploaded_import_files(client):
    ged=b'0 HEAD\n1 GEDC\n2 VERS 7.0\n0 @I1@ INDI\n1 NAME Jan /Testowy/\n1 OBJE @M1@\n0 @M1@ OBJE\n1 FILE media/p.png\n2 FORM image/png\n0 @F1@ FAM\n1 HUSB @I1@\n1 CHIL @I1@\n0 TRLR\n'
    raw=package({'gedcom.ged':ged,'media/p.png':PNG})
    assert client.post('/api/import',files={'file':('invalid.gdz',raw)}).status_code==422
    assert client.get('/api/state').json()['trees']==[]
    assert list((client.app.state.store.root/'media').iterdir())==[]
    with client.app.state.store.connect() as db:
        assert db.execute('SELECT count(*) FROM media').fetchone()[0]==0

@pytest.mark.parametrize('format',['gdz','zip551'])
def test_shared_file_retains_different_roles_for_different_people(client,format):
    picture=client.post('/api/media',files={'file':('same.png',PNG,'image/png')}).json()
    data=state();data['trees'][0]['people'][0]['photo']=picture['url'];data['trees'][0]['people'][1]['attachments']=[picture]
    assert client.put('/api/state',json=data).status_code==200
    raw=client.get('/api/trees/t/export?format='+format).content
    result=client.post('/api/import',files={'file':('family.'+('gdz' if format=='gdz' else 'zip'),raw)}).json()
    tree=next(t for t in client.get('/api/state').json()['trees'] if t['id']==result['treeId'])
    assert tree['people'][0].get('photo')
    assert not tree['people'][1].get('photo')
    assert len(tree['people'][1]['attachments'])==1
    assert result['mediaCount']==1


def test_rejects_package_without_gedcom(client):
    assert client.post('/api/import',files={'file':('backup.zip',package({'genealogy.sqlite3':b'not a genealogy exchange'}))}).status_code==422


def test_missing_package_media_is_reported_without_reading_external_paths(client):
    ged=b'0 HEAD\n1 GEDC\n2 VERS 7.0\n0 @I1@ INDI\n1 NAME Jan /Testowy/\n1 OBJE @M1@\n0 @M1@ OBJE\n1 FILE https://example.com/private.jpg\n2 FORM image/jpeg\n0 TRLR\n'
    response=client.post('/api/import',files={'file':('missing.gdz',package({'gedcom.ged':ged}))})
    assert response.status_code==200
    assert 'Brak 1' in response.json()['warning']
    assert response.json()['mediaCount']==0

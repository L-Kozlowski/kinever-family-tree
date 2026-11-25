import io
import json
import pytest
from fastapi.testclient import TestClient
from backend.main import create_app
from backend.tests.test_api import state
from backend.gedcom import export_tree, import_gedcom
import backend.geocoding as geocoding


@pytest.fixture
def client(tmp_path):
    with TestClient(create_app(tmp_path)) as app:
        yield app


def test_coordinates_and_blond_portrait_persist(client,tmp_path):
    data=state();person=data['trees'][0]['people'][0]
    person.update(portrait=4,customPortrait=True,birthLocation=dict(lat=52.2297,lon=21.0122,label='Warszawa, Polska',source='manual'),residenceLocation=dict(lat=-33.8688,lon=151.2093,label='Sydney',source='manual'))
    assert client.put('/api/state',json=data).status_code==200
    with TestClient(create_app(tmp_path)) as reopened:
        saved=reopened.get('/api/state').json()['trees'][0]['people'][0]
        assert saved['birthLocation']==person['birthLocation'];assert saved['residenceLocation']==person['residenceLocation'];assert saved['portrait']==4


@pytest.mark.parametrize('lat,lon',[(91,0),(0,-181),('NaN',0)])
def test_invalid_coordinates_do_not_modify_database(client,lat,lon):
    data=state();data['trees'][0]['people'][0]['birthLocation']=dict(lat=lat,lon=lon)
    assert client.put('/api/state',json=data).status_code==422
    assert client.get('/api/state').json()['trees']==[]


@pytest.mark.parametrize('version',['7.0','5.5.1'])
def test_coordinate_exchange_preserves_hemispheres_and_zero(version):
    data=state();p=data['trees'][0]['people'][0]
    p.update(birthPlace='Sydney',birthLocation=dict(lat=-33.8688,lon=151.2093),residence='Punkt na równiku',residenceLocation=dict(lat=0,lon=-0.5))
    raw,_=export_tree(data['trees'][0],data['connectionsByTree']['t'],{},version)
    assert b'4 LATI S33.86880000' in raw;assert b'4 LONG W0.50000000' in raw
    tree,_=import_gedcom(raw);person=tree['people'][0]
    assert person['birthLocation']['lat']==pytest.approx(-33.8688);assert person['birthLocation']['lon']==pytest.approx(151.2093)
    assert person['residenceLocation']['lat']==0;assert person['residenceLocation']['lon']==-0.5


def test_place_search_is_explicit_identified_and_cached(client,monkeypatch):
    calls=[]
    def fake(request,timeout):
        calls.append(request)
        return io.BytesIO(json.dumps([dict(lat='51.1079',lon='17.0385',name='Wrocław',display_name='Wrocław, dolnośląskie, Polska')]).encode())
    monkeypatch.setattr(geocoding,'urlopen',fake);monkeypatch.setattr(geocoding,'_last_request',0)
    response=client.get('/api/places/search',params={'q':'Wrocław'})
    assert response.status_code==200;assert response.json()[0]['lat']==51.1079
    assert client.get('/api/places/search',params={'q':'wrocław'}).json()==response.json()
    assert len(calls)==1;assert 'Korzenie/' in calls[0].get_header('User-agent')
    assert client.get('/api/places/search',params={'q':'x'}).status_code==422


def test_lookup_failure_keeps_manual_coordinates_available(client,monkeypatch):
    def fail(*args,**kwargs):
        raise geocoding.URLError('offline')
    monkeypatch.setattr(geocoding,'urlopen',fail);monkeypatch.setattr(geocoding,'_last_request',0)
    response=client.get('/api/places/search',params={'q':'Kraków'})
    assert response.status_code==503;assert 'ręcznie' in response.json()['detail']
